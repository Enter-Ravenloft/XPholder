# Historical Event Migration — Deploy Runbook

## What this does
Imports ~745 historical events (2021-11 through 2026-03) from `events.csv` into the production `guild<ID>.events` / `event_participants` / `event_dms` tables, and populates the `players` table with real usernames including known departed members.

## Prerequisites
- Node.js 20+ locally (scripts run from your machine, NOT inside the dyno)
- Prod `DATABASE_URL` (get from a teammate with Heroku access: `heroku config:get DATABASE_URL --app xpholder`)
- This `tooling/` directory (delivered separately; not in the repo)

## Files in this package
```
seedPlayers.js              # populates players table
seedEventsWithMatches.js    # populates events/participants/dms
events.csv                  # raw historical event log
pc-match-results.csv        # csv_name -> character_id mapping (curated)
event-pc-overrides.csv      # per-event PC overrides (ambiguous short names)
departed-players.csv        # real usernames for players who left the server
dataMigration/data/         # membership snapshots used by seedPlayers
```

## Important behaviors to know
1. **Non-destructive for live events.** `seedEventsWithMatches.js` deletes only events with `start_date < '2026-04-01'` before reseeding. Events created via `/event_start` after April 1 are preserved.
2. **No schema changes.** All tables already exist in prod from previous migrations. The script only INSERTs and (scoped) DELETEs data.
3. **SSL is auto-detected** for Heroku Postgres connection strings. Set `PGSSL=1` if running against a different managed Postgres.
4. **Run order matters for display names.** `seedPlayers.js` first, then `seedEventsWithMatches.js`. The inverse works too (events seed has no FK dependency on players), but the dashboard will show "Player XXXX" placeholders until players is seeded.

## Run order

### 1. Export the prod DB URL
```bash
export DATABASE_URL="<value from heroku config:get DATABASE_URL>"
export GUILD_ID="1481312707750920303"   # XPholder main guild
```

### 2. Seed the players table
```bash
node tooling/seedPlayers.js
```
Expected output:
```
Inserted <N> current members
Added <M> departed members from historical character data
Total players: <N+M>
```

### 3. Seed the historical events
```bash
node tooling/seedEventsWithMatches.js tooling/events.csv tooling/pc-match-results.csv
```
Expected output (approximate, from dev dry run):
```
Loaded 694 PC matches, 85 name corrections, 1 per-event overrides
Seeded 745 historical events (14 rows skipped)
Participants: 3039 auto-matched, 22 resolved via correct_pc_name, 368 still unmatched
Match rate: 89.3%
```

## Verification
After running both scripts:
```sql
-- via heroku pg:psql or local psql against DATABASE_URL

-- Event counts
SELECT COUNT(*) AS total, MIN(start_date), MAX(start_date)
FROM guild1481312707750920303.events;
-- Expect ~745 historical + any live events

-- Live events preserved?
SELECT event_id, name, start_date FROM guild1481312707750920303.events
WHERE start_date >= '2026-04-01' ORDER BY start_date;

-- Players populated
SELECT COUNT(*) FILTER (WHERE is_member) AS current_members,
       COUNT(*) FILTER (WHERE NOT is_member) AS departed_members
FROM guild1481312707750920303.players;

-- Unmatched participants (should be ~368)
SELECT COUNT(*) FROM guild1481312707750920303.event_participants
WHERE character_id LIKE 'unknown-%' OR character_id LIKE 'retired-%';
```

Then hit the dashboard — events should populate, DM names should format cleanly, and `/active-pcs` should show player counts per tier.

## Rollback
If something goes wrong, the script is idempotent for historical events — just re-run it. Live events outside the cutoff are never touched.

If you need to fully revert the migration (wipe imported events but keep live ones):
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

If you add more departed-player name corrections to `departed-players.csv` or event PC overrides to `event-pc-overrides.csv` later, rerun the appropriate script — both are idempotent for their scope.
