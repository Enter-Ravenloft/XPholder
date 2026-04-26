# XPHolder

A Discord bot for tracking D&D character XP, with a small companion web dashboard. Originally a multi-tenant project; this fork runs on a single guild.

For the architecture overview, conventions, sharp edges, and the current backlog, see [AGENTS.md](AGENTS.md).

## What it does

- Tracks player characters and their XP per guild (one Postgres schema per guild).
- Awards XP automatically for in-channel roleplay messages (configurable per channel and per role).
- Announces level-ups and manages the corresponding tier / character-slot / freeze Discord roles.
- Provides slash commands for moderators to award/edit XP, run an event ledger, and bulk-import/export characters.
- Surfaces stats in a web dashboard gated by Discord OAuth + the moderation role.

## Setting up the Discord bot

In the [Discord Developer Portal](https://discord.com/developers/applications), create a new Application and a Bot user. Copy the bot token.

### Privileged Gateway Intents (Bot tab)
- Server Members Intent
- Message Content Intent

### OAuth2 install URL (OAuth2 → URL Generator)
- **Scopes**: `bot`, `applications.commands`
- **Bot Permissions**:
  - View Channels
  - Send Messages
  - Use Slash Commands
  - Manage Roles
  - Attach Files

## Local development (Docker)

Recommended path. Brings up Postgres + bot + dashboard with one command.

### Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Setup

1. Copy the example env and fill it in:
   ```sh
   cp .env.example .env
   ```
   - `DISCORD_TOKEN`, `CLIENT_ID`, `COMMAND_INSTALLATION_SERVER_ID` — from your dev application.
   - `SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP` — JSON map of `serverId` → `channelId` for log embeds (use `{}` to disable).
   - `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `SESSION_SECRET` — only needed if you're running the dashboard.

   `DATABASE_URL` and `NODE_ENV` are set by Docker Compose; don't add them to `.env`.

2. Start everything:
   ```sh
   docker compose up --build
   ```
   Bot logs `ready` when connected. Dashboard at http://localhost:3000.

3. (First run) install slash commands and register your test server:
   ```sh
   node deploy-commands.js
   ```
   Then in Discord: `/register`. If you have a CSV backup, `/import_characters_csv` will restore characters.

### Notes
- Code is volume-mounted, but Node won't hot-reload — `docker compose restart bot` after edits.
- The Postgres data lives in the `pgdata` Docker volume. `docker compose down -v` wipes it.
- The dev bot is fully isolated from production: separate token, DB, and Discord guild.
- `tooling/restore-prod-to-dev.sh` refreshes local data from a prod backup. Read before running.

## Running the tests

```sh
npm test          # single pass
npm run test:watch
```

Tests use [Vitest](https://vitest.dev/) and live next to the source files they cover (e.g., `xpholder/utils/playerName.test.js`). See [AGENTS.md](AGENTS.md) for current coverage and gaps.

## Adding a new command

1. Drop a `.js` file under `xpholder/commands/everyone/`, `xpholder/commands/mod/`, or `xpholder/commands/owner/`. The directory is convention only — re-check the role inside `execute()` (see existing commands for the pattern).
2. Restart the bot so the new file is picked up: `docker compose restart bot`.
3. Re-deploy slash command schemas to Discord:
   - `node deploy-commands.js` — guild-scoped, near-instant updates. Recommended for development.
   - `node deploy-global-commands.js` — global commands; can take up to an hour to propagate.

`xpholder/commands/mod/eventEdit.js` is the cleanest template to copy from.

## Deployment

Production runs on Heroku per `Procfile`:

```
worker: node main.js
web: node dashboard/server.js
```

`NODE_ENV=production` enables secure cookies on the dashboard and the daily Discord member sync on the bot.
