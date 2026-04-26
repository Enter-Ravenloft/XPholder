# AGENTS.md

Bootstrapping context for coding agents (and humans) new to this repo.

## What this is

Discord bot (`main.js` + `xpholder/`) plus a small Express+EJS dashboard (`dashboard/`) that share a Postgres database. Tracks D&D characters and XP for a Discord guild.

Originally a multi-tenant project; this fork runs on a single guild (Enter Ravenloft). Multi-tenant scaffolding is still in the code (per-guild schemas, registration flow) but optimizing for >1 guild is not a goal.

Two maintainers: the repo owner and one other contributor.

## Running it

```sh
cp .env.example .env   # fill in DISCORD_TOKEN, CLIENT_ID, etc.
docker compose up --build
```

Brings up Postgres + bot + dashboard. Bot logs `ready` when connected. Dashboard at http://localhost:3000.

- Code is volume-mounted, but Node doesn't hot-reload: `docker compose restart bot` after edits.
- `NODE_ENV=test` is set in `docker-compose.yml` and suppresses the daily player sync (see "Dev safety").
- Production runs on Heroku per `Procfile` (`worker: node main.js`, `web: node dashboard/server.js`).
- After changing a command's slash schema, run `node deploy-commands.js` to push to Discord.

### Tests
- `npm test` — runs the Vitest suite once.
- `npm run test:watch` — watch mode.
- Tests live next to the file they cover, named `*.test.js`. Test files use ESM `import` (Vitest handles transpile); source files stay CommonJS.
- Coverage today: pure utility functions only. Commands, `guildService`, and the dashboard are not yet covered. See "Test strategy" below for the plan.

### What you can't run
- **Lint/format**: no ESLint or Prettier config.

For UI changes (Discord interactions, dashboard pages), `npm test` won't catch regressions — exercise the feature in Discord or in a browser before reporting it as done.

## Architecture

### Bot

- `main.js` — Discord client and three event handlers:
  - `ready` — kicks off `syncGuildPlayers` for each guild, then schedules a 24h interval. Both gated by `NODE_ENV !== "test"`.
  - `interactionCreate` — slash commands, autocomplete, buttons. Builds a fresh `guildService` per interaction.
  - `messageCreate` — awards XP for messages >10 words (or starting with `!`) in a configured channel.
- `xpholder/commands/{everyone,mod,owner}/` — each file exports `{ data: SlashCommandBuilder, execute(gService, interaction), [autocomplete] }`. Auto-loaded at startup. Directory is convention only — mod/owner commands re-check the role inside `execute()`.
- `xpholder/services/guild.js` — `guildService` class. Wraps all DB access, holds per-guild cached state (`config`, `levels`, `roles`, `channels`, `characterTiers`) loaded by `init()`.
- `xpholder/utils/`
  - `getters.js` — XP math (`getXp`, `getLevelInfo`, `getRoleMultiplier`, `getTier`, `getActiveCharacterNumber`).
  - `xp.js` — award math (`calculateXp`, `awardCXPs`).
  - `characterEmbed.js` — Discord embed builders.
  - `logging.js` — pushes log embeds to a per-server channel from `SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP`.
  - `validation.js`, `playerName.js` — pure helpers, shared with the dashboard.
  - `roleManagement.js`, `characterManagement.js` — tier role sync after XP changes.
- `xpholder/database/postgres.js` — `pg` `Pool` wrapper exporting `{ db: { query } }`. `sqlite.js` next to it is dead code from before the Postgres migration.

### Dashboard

- `dashboard/server.js` — Express: Postgres-backed sessions, CSRF middleware, Discord OAuth login, mod-role gate per guild.
- `dashboard/db.js` — read-only queries against the bot's per-guild schemas. `validateGuildId()` enforces numeric-only before any schema-name interpolation.
- `dashboard/views/` — EJS + Tailwind. Tailwind output is built at Docker image build time.
- `dashboard/routes/` — `auth.js`, `pages.js`, `api.js`.

There is no API between bot and dashboard — they share the database. Bot writes, dashboard reads.

### Database

One Postgres instance, one schema per registered guild named `guild<guildId>`. Per-guild tables: `config`, `levels`, `roles`, `channels`, `characters`, `character_tiers`, `players`, `events`, `event_participants`, `event_dms`.

`guildService.init()` does `SET search_path TO <schema>` (using `pg-format` `%I`) and then loads the cached state. **Schema-name handling in queries is inconsistent**: some rely on `search_path`, others template-literal-interpolate `${this.schema}`. Standardizing this is on the backlog. New code: match the surrounding file.

## Conventions

### Adding a slash command
1. Drop a file in `xpholder/commands/{everyone,mod,owner}/`.
2. First thing in `execute()`: the role check. Owner-only:
   ```js
   if (interaction.user.id != interaction.guild.ownerId && !gService.isDev(interaction.member._roles)) { ... return; }
   ```
   Mod-or-owner: same plus `!gService.isMod(interaction.member._roles) &&`.
3. Always include a `public` boolean option. The dispatcher uses it to set `ephemeral`.
4. Use `xpholder/commands/mod/eventEdit.js` as the template — it's the highest-quality example in the repo (explicit validation, "nothing to update" guard, status-aware field gating).
5. Run `node deploy-commands.js`.

### Database access
- Go through `guildService` methods. Don't call `db.query` from commands.
- Parameterize values. If you must interpolate identifiers, whitelist them — see `guildService.updateEvent` for the pattern.

### Error handling
- Today's pattern in commands is `try { ... } catch (error) { console.log(error); }`. The top-level dispatcher in `main.js` will show the user "Something went wrong running that command" if `execute()` throws.
- There is no structured logger yet. Replacing `console.log(error)` with a `reportError(context, err)` helper that pushes to the Discord log channel + `console.error` with stack and `interaction.id` is on the backlog.
- For non-exception failures (validation, missing things), `await interaction.editReply("Sorry, ...")` and return. Match the existing voice.

### Style
- No enforced lint. Prevailing style: double quotes, 2-space indent, `function foo() {}` for helpers, arrow methods inside command objects.
- Spelling in legacy code is uneven (`INITALIZATION`, `chukedArray`, `fielfs`). Fix in passing if already editing the line; don't run sweeping renames.

### Working style
This repo has accumulated rough edges from a multi-year history with three authors. When you spot something inconsistent (schema interpolation, error handling, typos) you'll be tempted to do a sweeping cleanup. Don't. Make the change the user asked for, and at most flag the adjacent issue. The maintainers prefer small focused diffs they can review against a known intent.

## Test strategy

The codebase has three distinct testing surfaces, and each wants a different approach. The plan is sequenced so that the safety net is in place before behavior-modifying work begins.

**Phase 1 — Pure-function unit tests.** Cheap, high-signal, no infrastructure. Cover everything in `xpholder/utils/` that doesn't do I/O. *Status: complete.*

**Phase 2 — Postgres integration tests for `guildService`.** This is the unlock for the schema-handling refactor (backlog #1). Plan:
- Vitest `globalSetup` against the docker-compose `db` service.
- Per-test isolation via a unique schema name (`guildtest_<random>`), dropped on teardown. `guildService` is already schema-scoped, so this maps naturally.
- Separate `npm run test:integration` script so unit tests stay fast and runnable without Docker.
- Characterize each `guildService` method: insert/read round-trips, upsert conflict handling, that `searchEvents` escapes `%`/`_`, that `updateEvent`'s column whitelist actually rejects unknown columns, etc.

**Phase 3 — Extract-and-test as the on-ramp to each backlog item that touches code.** Don't try to test command files as-is via heavy mocking — the ratio of fixture-setup to coverage is bad and the tests are brittle. Instead, when about to change a piece of code: pull the pure logic into a helper, test the helper, then make the behavior change. Examples currently visible:
- `main.js:updateCharacterXpAndMessage` (backlog #2 / level-up race) — extract `computeLevelTransition(oldXp, newXp, levels) → { changed, oldLevel, newLevel, newTier }`, test it, then wrap the DB write in a transaction.
- `evaluateCharacterTierRoles` in `xpholder/utils/roleManagement.js` — split the "which roles should this player have" computation (pure) from `roles.add/remove` (side effect).
- `dashboard/db.js:getActivePcStats` has an inlined `getLevel(xp)` that duplicates `getters.js:getLevelInfo` with a different implementation. Worth consolidating into a single tested helper at some point.

**Anti-recommendation:** don't write end-to-end tests of `main.js`'s `messageCreate` or `interactionCreate` handlers as-is. They're orchestrators with too many side effects; mock-heavy tests there would lock in current structure and make refactoring harder, not easier.

## Sharp edges

- **Test coverage is shallow.** Pure utils are covered; commands, `guildService`, and the dashboard are not. Adding integration tests for the DB layer is the natural next step.
- **`init()` runs every interaction and qualifying message** — ~5 Postgres round-trips per Discord event. `guildService.xpCache` and `last_touched` are placeholder fields for caching that was never wired up.
- **Level-up race in `main.js:377` `updateCharacterXpAndMessage`** — reads `character.xp`, computes old/new level info from `character.xp + xp`, then issues an unconditional `UPDATE ... xp = xp + $1`. Two parallel awards can both miss the level boundary. Wants a transaction with `RETURNING xp`.
- **Hard-coded dev role ID** `"1059613628803850261"` at `xpholder/services/guild.js:58` (`isDev()`). Should be config.
- **`SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP` is `JSON.parse`d at module load** in `xpholder/utils/logging.js` with no try/catch — a malformed env var crashes the bot at boot.
- **`getXp` falls off the switch** in `xpholder/utils/getters.js` — silently returns 0 if `xpPerPostFormula` is misconfigured.
- **`buildXPEmbed` line `awardEmbed.setColor;`** (no parens) — color param silently ignored.
- **`awardXp.js:299` Undo button is broken**: "This interaction failed" from Discord with no app-side logs. Fix is gated on better error reporting.
- **`messageCreate` channel walk** sequentially `await guild.channels.fetch(parentId)` instead of `cache.get(parentId)` first. Not a correctness bug, just slow.
- **Dead code**: `xpholder/database/sqlite.js`; `mkdirp` dep; `node-fetch` import in `importCharacters.js` (Node 20 has built-in `fetch`); `console.log;` no-op at `main.js:238`.
- **Latent crash in `xpholder/utils/xp.js`**: `awardCXPs` calls `getLevelInfo` without importing it. Currently unreachable — the `set_cxp`/`give_cxp` award types are commented out in `awardXp.js`. If you revive CXP support, add `const { getLevelInfo } = require("./getters")` and write tests.

## Dev safety

- `NODE_ENV=test` (set by `docker-compose.yml`) skips the daily player sync. The dev bot is connected to a different Discord guild than the prod data in the local DB; syncing would mark every prod player as departed. If you touch sync logic, preserve this guard.
- The dashboard's `getRegisteredGuilds()` returns whatever schemas exist locally — typically a copy of prod. The dashboard guild ID will not match the dev bot's connected guild.
- `tooling/restore-prod-to-dev.sh` refreshes local data from a prod backup. Read before running.

## Where to look for things

- "Why isn't my command running?" — Check it's deployed (`node deploy-commands.js`) and that `client.commands.get(name)` resolves at `main.js:172`.
- "Why isn't XP being awarded?" — `messageCreate` in `main.js:270` filters: in-guild, not bot, ≥10 words OR starts with `!`, channel is in `gService.channels`, channel's `xp_per_post != 0`, character exists.
- "How does a player become a character?" — `/approve_player` (`xpholder/commands/mod/approvePlayer.js`) inserts into `characters`, keyed by `${playerId}-${characterIndex}`.
- "How are tier roles managed?" — `evaluateCharacterTierRoles` in `xpholder/utils/roleManagement.js`, called from helpers in `xpholder/utils/characterManagement.js`.
- "Where do logs go?" — Discord channel mapped from `SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP`. See `xpholder/utils/logging.js`.

## Backlog (current priorities)

1. Move dev role ID to config; standardize schema-name handling across `guildService`. *(Tackle this after Phase 2 of the test strategy is in place.)*
2. Fix the level-up race (transaction + `RETURNING xp`).
3. `reportError(context, err)` helper; replace `console.log(error)`; close the Undo FIXME.
4. Cache `guildService` per guild (small TTL, invalidate on `update*`).
5. Expand test coverage: `guildService` (against a real Postgres in Docker) and a few command handlers.
6. Tooling hygiene: ESLint + Prettier; `engines` in `package.json`; drop dead deps; validate `SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP` at startup; fix `setColor;`; default-throw in `getXp`.
7. Dedupe the `config-schema` comment block from `register.js` and `editConfig.js`.
