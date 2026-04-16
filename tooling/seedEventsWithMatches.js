const fs = require("fs");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://xpholder:xpholder@localhost:5432/xpholder";
const GUILD_ID = process.env.GUILD_ID || "1481312707750920303";

// Heroku Postgres requires SSL with their self-signed cert; local Docker does not.
const needsSsl = /amazonaws\.com|herokuapp|heroku\.com/.test(DATABASE_URL) || process.env.PGSSL === "1";
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});
const schema = `guild${GUILD_ID}`;

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === "") return null;
  dateStr = dateStr.trim();
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const months = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const day = parts[0].padStart(2, "0");
  const month = months[parts[1]];
  const year = parts[2];
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function mapEventType(channel, title) {
  const lower = (channel + " " + title).toLowerCase();
  if (lower.includes("arena") || lower.includes("colosseum")) return "Arena";
  if (lower.includes("discourse")) return "Discourse";
  if (lower.includes("skirmish")) return "Skirmish";
  if (lower.includes("arc")) return "Arc Quest";
  if (lower.includes("adventure")) return "Adventure";
  return "Mission";
}

function normalizeTier(bracket) {
  if (!bracket) return "3-4";
  bracket = bracket.trim();
  const valid = ["3-4", "5-7", "8-10", "11-13", "14-16", "17-20", "Open"];
  if (valid.includes(bracket)) return bracket;
  if (bracket === "Disc") return "Open";
  return "3-4";
}

function loadMatchResults(path) {
  // CSV columns: csv_name, db_name, player_id, character_id, match_method,
  //              known_player_nickname, correct_pc_name, event_examples, notes,
  //              event_override_name, event_override_date
  // A row with event_override_name + event_override_date applies ONLY to that
  // specific event (keyed by name|date|csv_name); otherwise the row is global.
  const csv = fs.readFileSync(path, "utf-8");
  const lines = csv.split("\n").filter((l) => l.trim() !== "");
  const map = {};
  const corrections = {};
  const overrides = {};
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const csvName = fields[0];
    const dbName = fields[1];
    const playerId = fields[2];
    const characterId = fields[3];
    const method = fields[4];
    const correctPcName = (fields[6] || "").trim();
    const overrideEvent = (fields[9] || "").trim();
    const overrideDate = (fields[10] || "").trim();
    if (overrideEvent && overrideDate && characterId) {
      overrides[`${overrideEvent}|${overrideDate}|${csvName}`] = { characterId, playerId, dbName };
    } else if (method !== "unmatched" && characterId) {
      map[csvName] = { characterId, playerId, dbName };
    } else if (correctPcName) {
      corrections[csvName] = correctPcName;
    }
  }
  return { map, corrections, overrides };
}

async function resolveCorrection(correctName) {
  // Try exact match first, then case-insensitive
  let res = await pool.query(
    `SELECT character_id, player_id, name FROM ${schema}.characters WHERE name = $1;`,
    [correctName]
  );
  if (res.rows.length === 1) return res.rows[0];
  res = await pool.query(
    `SELECT character_id, player_id, name FROM ${schema}.characters WHERE LOWER(name) = LOWER($1);`,
    [correctName]
  );
  if (res.rows.length === 1) return res.rows[0];
  return null;
}

async function seed() {
  const eventsPath = process.argv[2] || "tooling/events.csv";
  const matchPath = process.argv[3] || "tooling/pc-match-results.csv";

  const { map: matchMap, corrections, overrides: eventOverrides } = loadMatchResults(matchPath);
  console.log(`Loaded ${Object.keys(matchMap).length} PC matches, ${Object.keys(corrections).length} name corrections, ${Object.keys(eventOverrides).length} per-event overrides`);

  const csv = fs.readFileSync(eventsPath, "utf-8");
  const lines = csv.split("\n").filter((l) => l.trim() !== "");
  const dataLines = lines.slice(2).reverse();

  const datePattern = /^\d{1,2}-[A-Z][a-z]{2}-\d{4}$/;

  // Clear ONLY historical (pre-cutoff) data — preserve live events created via /event_start
  // Cutoff is the day after the last event in events.csv (2026-03-30).
  const HISTORICAL_CUTOFF = "2026-04-01";
  await pool.query(
    `DELETE FROM ${schema}.event_participants
     WHERE event_id IN (SELECT event_id FROM ${schema}.events WHERE start_date < $1);`,
    [HISTORICAL_CUTOFF]
  );
  await pool.query(
    `DELETE FROM ${schema}.event_dms
     WHERE event_id IN (SELECT event_id FROM ${schema}.events WHERE start_date < $1);`,
    [HISTORICAL_CUTOFF]
  );
  await pool.query(
    `DELETE FROM ${schema}.events WHERE start_date < $1;`,
    [HISTORICAL_CUTOFF]
  );

  let imported = 0;
  let skipped = 0;
  let participantsMatched = 0;
  let participantsCorrected = 0;
  let participantsUnmatched = 0;
  const resolvedCorrectionCache = {};

  for (const line of dataLines) {
    const fields = parseCsvLine(line);
    if (fields.length < 8) {
      skipped++;
      continue;
    }

    const startDateStr = parseDate(fields[0]);
    const dmName = fields[2];
    const title = fields[3];
    const channel = fields[4] || "";
    const status = (fields[5] || "").toLowerCase().includes("active") ? "active" : "completed";
    const tier = normalizeTier(fields[7]);
    const endDateStr = parseDate(fields[16]);

    if (!startDateStr || !title || !dmName) {
      skipped++;
      continue;
    }

    const eventType = mapEventType(channel, title);
    const avgXp = parseInt(fields[17]) || null;

    // Insert event
    const eventRes = await pool.query(
      `INSERT INTO ${schema}.events (name, event_type, tier, start_date, end_date, xp_reward, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING event_id;`,
      [title, eventType, tier, startDateStr, status === "completed" ? endDateStr : null, avgXp, status]
    );
    const eventId = eventRes.rows[0].event_id;

    // Insert DM
    await pool.query(
      `INSERT INTO ${schema}.event_dms (event_id, user_id, username, is_primary)
       VALUES ($1, $2, $3, TRUE);`,
      [eventId, `dm-${dmName.toLowerCase().replace(/\s+/g, "")}`, dmName]
    );

    // Insert participants using match results
    for (let i = 9; i <= 15; i++) { // PC 1-7 (indices 9-15)
      const pcName = (fields[i] || "").trim();
      if (!pcName || datePattern.test(pcName)) continue;

      // Per-event override takes precedence over the global csv_name match
      const overrideKey = `${title}|${startDateStr}|${pcName}`;
      const match = eventOverrides[overrideKey] || matchMap[pcName];
      const correctedName = corrections[pcName];

      try {
        if (match) {
          // Matched — use real character_id, player_id, and store character_name
          await pool.query(
            `INSERT INTO ${schema}.event_participants (event_id, character_id, player_id, character_name, starting_level, starting_xp)
             VALUES ($1, $2, $3, $4, 1, 0);`,
            [eventId, match.characterId, match.playerId, match.dbName]
          );
          participantsMatched++;
        } else if (correctedName) {
          // Human reviewer provided a correct PC name — try a fallback lookup
          let resolved = resolvedCorrectionCache[correctedName];
          if (resolved === undefined) {
            resolved = await resolveCorrection(correctedName);
            resolvedCorrectionCache[correctedName] = resolved;
          }
          if (resolved) {
            await pool.query(
              `INSERT INTO ${schema}.event_participants (event_id, character_id, player_id, character_name, starting_level, starting_xp)
               VALUES ($1, $2, $3, $4, 1, 0);`,
              [eventId, resolved.character_id, resolved.player_id, resolved.name]
            );
            participantsCorrected++;
          } else {
            // Correction didn't resolve — store the corrected display name but no player link
            const placeholderId = `unknown-${correctedName.toLowerCase().replace(/\s+/g, "")}`;
            await pool.query(
              `INSERT INTO ${schema}.event_participants (event_id, character_id, player_id, character_name, starting_level, starting_xp)
               VALUES ($1, $2, NULL, $3, 1, 0);`,
              [eventId, placeholderId, correctedName]
            );
            participantsUnmatched++;
          }
        } else {
          // Unmatched — use placeholder character_id, store character_name for display
          const placeholderId = `unknown-${pcName.toLowerCase().replace(/\s+/g, "")}`;
          await pool.query(
            `INSERT INTO ${schema}.event_participants (event_id, character_id, player_id, character_name, starting_level, starting_xp)
             VALUES ($1, $2, NULL, $3, 1, 0);`,
            [eventId, placeholderId, pcName]
          );
          participantsUnmatched++;
        }
      } catch (e) {
        // ignore duplicates
      }
    }

    imported++;
  }

  const totalParticipants = participantsMatched + participantsCorrected + participantsUnmatched;
  console.log(`\nSeeded ${imported} historical events (${skipped} rows skipped)`);
  console.log(`Participants: ${participantsMatched} auto-matched, ${participantsCorrected} resolved via correct_pc_name, ${participantsUnmatched} still unmatched`);
  console.log(`Match rate: ${(((participantsMatched + participantsCorrected) / totalParticipants) * 100).toFixed(1)}%`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
