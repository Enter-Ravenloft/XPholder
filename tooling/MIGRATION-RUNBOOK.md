# Historical Event Migration — Deploy Runbook

## What this does
Imports ~745 historical events (2021-11 through 2026-03) from `events.csv` into the production `guild<ID>.events` / `event_participants` / `event_dms` tables, using the curated PC-to-character mapping in `pc-match-results.csv`.

## Prerequisites
- Node.js 20+ locally (script runs from your machine, NOT inside the dyno)
- Prod `DATABASE_URL` (get from a teammate with Heroku access: `heroku config:get DATABASE_URL --app xpholder`)
- `events.csv` and `pc-match-results.csv` (hand-delivered separately; gitignored because they contain user identifiers)
- `tooling/seedEventsWithMatches.js` from the repo

## Important behaviors
1. **Non-destructive for live events.** The script deletes only events with `start_date < '2026-04-01'` before reseeding. Events created via `/event_start` on or after April 1 are preserved.
2. **No schema changes.** All tables already exist in prod. The script only INSERTs and (scoped) DELETEs data.
3. **SSL is auto-detected** for Heroku Postgres connection strings. Set `PGSSL=1` if running against a different managed Postgres.
4. **Players table is not touched.** It's already populated by the bot's startup sync. Departed members without a known username will show as "Player XXXX" — that's expected and unchanged by this migration.

## Run

### 1. Drop the two CSVs into the repo's `tooling/` directory
```bash
cp /path/to/events.csv tooling/
cp /path/to/pc-match-results.csv tooling/
```

### 2. Export the prod DB URL
```bash
export DATABASE_URL="<value from heroku config:get DATABASE_URL>"
export GUILD_ID="1481312707750920303"   # XPholder main guild
```

### 3. Seed the historical events
```bash
node tooling/seedEventsWithMatches.js tooling/events.csv tooling/pc-match-results.csv
```
Expected output (approximate, from dev dry run):
```
Loaded 699 PC matches, 82 name corrections, 1 per-event overrides
Seeded 745 historical events (14 rows skipped)
Participants: 3048 auto-matched, 22 resolved via correct_pc_name, 359 still unmatched
Match rate: 89.5%
```

## Verification
```sql
-- via heroku pg:psql or local psql against DATABASE_URL

-- Event counts
SELECT COUNT(*) AS total, MIN(start_date), MAX(start_date)
FROM guild1481312707750920303.events;
-- Expect ~745 historical + any live events

-- Live events preserved?
SELECT event_id, name, start_date FROM guild1481312707750920303.events
WHERE start_date >= '2026-04-01' ORDER BY start_date;

-- Unmatched participants (should be ~359)
SELECT COUNT(*) FROM guild1481312707750920303.event_participants
WHERE character_id LIKE 'unknown-%' OR character_id LIKE 'retired-%';
```

Then hit the dashboard — events should populate and `/active-pcs` should show player counts per tier.

## Rollback
The script is idempotent. To re-run with updated CSVs, just run it again — live events outside the cutoff are never touched.

To fully revert (wipe imported events, keep live ones):
```sql
DELETE FROM guild1481312707750920303.event_participants
WHERE event_id IN (SELECT event_id FROM guild1481312707750920303.events WHERE start_date < '2026-04-01');
DELETE FROM guild1481312707750920303.event_dms
WHERE event_id IN (SELECT event_id FROM guild1481312707750920303.events WHERE start_date < '2026-04-01');
DELETE FROM guild1481312707750920303.events WHERE start_date < '2026-04-01';
```

## After deployment
Restart the web dyno so the dashboard picks up any cached state:
```bash
heroku restart web --app xpholder
```
