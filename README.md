# XPHolder

A Discord bot for managing Avrae player character XP.

## Setting up the Discord Bot

https://discord.com/developers/applications
Create new Application, generate and save copy of bot token

Permissions needed:

- message content intent (for message XP)
- use slash commands
- read messages / view channels
- manage roles (Tier1, Tier2, etc)

OAuth2 URL Generator

**Scopes**
bot

**Bot Permissions**
read messages / view channels
send messages
use slash commands
create private threads
Manage Roles
attach files

## Local development

### Requirements

- node
- PostgreSQL

### Setup

#### Setup PostgreSQL

- Download PostgreSQL installer from the [PostgreSQL Download Page](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
- Run the installer and follow instructions

#### Clone and install XPHelper

- Clone the repo
- Run `npm ci` to install project dependencies
- Create a `.env` file with the following content:

```
NODE_ENV=test
# This is the connection string to the postgress db
DATABASE_URL=
# Name of the database that will be connected to:  This will be used to form the connection string. If it is left undefined, the connection will fall back to the default database name that postgres provides
DB_NAME=
# Bot Token: this is provided by the discord developer portal when a bot is created
DISCORD_TOKEN=

# Client ID of bot
CLIENT_ID=
# A JSON object mapping server IDs to channel IDs for logging,
# e.g. '{"<serverId1>": <channelId1>, "<serverId2>": <channelId2>, ...}'
SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP=
# The server to install commands on
COMMAND_INSTALLATION_SERVER_ID=
```

- Run `node deploy-commands.js` to install the bot commands on COMMAND_INSTALLATION_SERVER_ID

- Run `node main.js` to start the bot
- Run `/register` in the test server
  - \*\* if one is available, use `/import_characters_csv` to restore from a backup

## Adding a New Command

Add a <commandName>.js file under one of commands/everyone/, commands/mod/, or commands/owner.

Redeploy the XPHolder bot with the changes.

Run `node deploy-global-commands.js` to install the new commands.
