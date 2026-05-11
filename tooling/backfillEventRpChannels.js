require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { resolveChannelId } = require("./backfillEventRpChannelsResolver");

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://xpholder:xpholder@db:5432/xpholder";
const GUILD_ID = process.env.GUILD_ID || process.env.COMMAND_INSTALLATION_SERVER_ID;
const SCHEMA = process.env.GUILD_SCHEMA || (GUILD_ID ? `guild${GUILD_ID}` : null);

if (!SCHEMA) {
  console.error("Missing GUILD_SCHEMA or GUILD_ID/COMMAND_INSTALLATION_SERVER_ID in env");
  process.exit(1);
}

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

// Quoted-field-aware CSV line parser, matching tooling/seedEvents.js.
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

// Minimal CSV escaping for the unresolved output: any comma is replaced with a
// semicolon so each value stays in its own field without needing quoting.
function csvEscape(value) {
  return String(value == null ? "" : value).replace(/,/g, ";");
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1, ssl: false });

  const csvPath = path.join(__dirname, "events.csv");
  const snapshotPath = path.join(__dirname, "discordChannelsSnapshot.json");
  const aliasesPath = path.join(__dirname, "eventRpChannelAliases.json");
  const unresolvedPath = path.join(__dirname, "eventRpChannelsUnresolved.csv");

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const aliases = JSON.parse(fs.readFileSync(aliasesPath, "utf8"));

  const csv = fs.readFileSync(csvPath, "utf8");
  const lines = csv.split("\n").filter((l) => l.trim() !== "");
  const header = lines.shift();
  console.log(`Read ${lines.length} CSV data rows. Header: ${header.slice(0, 80)}...`);

  const unresolved = [];
  let updatedCount = 0;
  let resolvedToId = 0;
  let skippedNoChannel = 0;
  let skippedNoEventMatch = 0;

  for (const line of lines) {
    const fields = parseCsvLine(line);
    if (fields.length < 5) continue;

    const startDateRaw = fields[0];
    const eventTitle = (fields[3] || "").trim();
    const rpChannelName = (fields[4] || "").trim();

    if (!eventTitle) continue;
    if (!rpChannelName) {
      skippedNoChannel++;
      continue;
    }

    const startDate = parseDate(startDateRaw);
    if (!startDate) {
      unresolved.push({
        event_id: "",
        event_name: eventTitle,
        csv_channel_name: rpChannelName,
        reason: "bad-date",
        start_date: startDateRaw,
      });
      continue;
    }

    const matchRes = await pool.query(
      `SELECT event_id, role_play_channel_id FROM ${SCHEMA}.events WHERE start_date = $1 AND name = $2 LIMIT 1;`,
      [startDate, eventTitle]
    );
    if (matchRes.rows.length === 0) {
      skippedNoEventMatch++;
      unresolved.push({
        event_id: "",
        event_name: eventTitle,
        csv_channel_name: rpChannelName,
        reason: "no-event-match",
        start_date: startDate,
      });
      continue;
    }
    const eventId = matchRes.rows[0].event_id;
    const alreadyHasId = matchRes.rows[0].role_play_channel_id !== null;

    const resolvedId = resolveChannelId({ name: rpChannelName, snapshot, aliases });

    // Idempotent via COALESCE: never overwrites an already-set value.
    await pool.query(
      `UPDATE ${SCHEMA}.events
       SET role_play_channel_id = COALESCE(role_play_channel_id, $1),
           role_play_channel_name = COALESCE(role_play_channel_name, $2)
       WHERE event_id = $3;`,
      [resolvedId, rpChannelName, eventId]
    );
    updatedCount++;

    if (resolvedId === null && !alreadyHasId) {
      unresolved.push({
        event_id: eventId,
        event_name: eventTitle,
        csv_channel_name: rpChannelName,
        reason: "no-id-match",
        start_date: startDate,
      });
    } else if (resolvedId !== null) {
      resolvedToId++;
    }
  }

  // Write unresolved CSV (always written so the maintainer has a fresh artifact).
  const unresolvedHeader = "event_id,event_name,csv_channel_name,reason,start_date\n";
  const unresolvedBody = unresolved
    .map((r) => [r.event_id, r.event_name, r.csv_channel_name, r.reason, r.start_date].map(csvEscape).join(","))
    .join("\n");
  fs.writeFileSync(unresolvedPath, unresolvedHeader + unresolvedBody + (unresolvedBody ? "\n" : ""));

  console.log(`Updated ${updatedCount} events (resolved-to-id: ${resolvedToId}; name-only / no-id-match: ${updatedCount - resolvedToId}).`);
  console.log(`Skipped (no channel in CSV): ${skippedNoChannel}.`);
  console.log(`Skipped (no event match): ${skippedNoEventMatch}.`);
  console.log(`Unresolved details written to: ${unresolvedPath} (${unresolved.length} rows).`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
