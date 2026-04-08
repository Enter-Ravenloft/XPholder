const fs = require("fs");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://xpholder:xpholder@db:5432/xpholder";
const GUILD_ID = process.env.GUILD_ID;

if (!GUILD_ID) {
  console.error("Usage: GUILD_ID=<your_guild_id> node tooling/seedEvents.js");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });
const schema = `guild${GUILD_ID}`;

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === "") return null;
  dateStr = dateStr.trim();
  // Format: "10-Mar-2026" or "3-Mar-2026"
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
  if (lower.includes("adventure")) return "Adventure";
  return "Mission";
}

function normalizeTier(bracket) {
  if (!bracket) return "3-4";
  bracket = bracket.trim();
  const valid = ["3-4", "5-7", "8-10", "11-13", "14-16", "17-20"];
  if (valid.includes(bracket)) return bracket;
  if (bracket === "Disc") return "3-4"; // Discourse events, default tier
  return "3-4";
}

async function seed() {
  const csvPath = process.argv[2] || "/app/tooling/events.csv";
  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.split("\n").filter((l) => l.trim() !== "");

  // Skip header rows (first two lines)
  const dataLines = lines.slice(2);

  // Ensure tables exist
  const tableCheck = await pool.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'events');`,
    [schema]
  );
  if (!tableCheck.rows[0].exists) {
    console.error(`Events table does not exist in schema ${schema}. Run /apply_registration_update first.`);
    process.exit(1);
  }

  // Clear existing seed data
  await pool.query(`DELETE FROM ${schema}.event_participants;`);
  await pool.query(`DELETE FROM ${schema}.event_dms;`);
  await pool.query(`DELETE FROM ${schema}.events;`);
  await pool.query(`ALTER SEQUENCE ${schema}.events_event_id_seq RESTART WITH 1;`);

  let imported = 0;
  let skipped = 0;

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
    const pcCount = parseInt(fields[6]) || 0;
    const tier = normalizeTier(fields[7]);
    const endDateStr = parseDate(fields[15]);

    if (!startDateStr || !title || !dmName) {
      skipped++;
      continue;
    }

    const eventType = mapEventType(channel, title);

    const avgXp = parseInt(fields[16]) || null;

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

    // Insert PCs as participants (we don't have real character IDs, so use placeholder names)
    const pcNames = [];
    for (let i = 9; i <= 15; i++) {
      if (fields[i] && fields[i].trim() !== "") {
        pcNames.push(fields[i].trim());
      }
    }
    for (const pcName of pcNames) {
      const fakeCharId = `pc-${pcName.toLowerCase().replace(/\s+/g, "")}`;
      // Ensure a placeholder character exists
      try {
        await pool.query(
          `INSERT INTO ${schema}.characters (character_id, character_index, name, sheet_url, picture_url, player_id, xp)
           VALUES ($1, 1, $2, '', '', $3, 0) ON CONFLICT (character_id) DO NOTHING;`,
          [fakeCharId, pcName, `player-${pcName.toLowerCase().replace(/\s+/g, "")}`]
        );
      } catch (e) {
        // ignore duplicate
      }

      try {
        await pool.query(
          `INSERT INTO ${schema}.event_participants (event_id, character_id, starting_level, starting_xp)
           VALUES ($1, $2, 1, 0);`,
          [eventId, fakeCharId]
        );
      } catch (e) {
        // ignore duplicate
      }
    }

    imported++;
  }

  console.log(`Seeded ${imported} events (${skipped} rows skipped)`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
