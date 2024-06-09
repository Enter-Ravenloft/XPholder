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
# Postgres User: This is used to form the Postgres connection string
PGUSER=
# Postgres Password: This is used to form the Postgres connection string
PGPASSWORD=
# Server that the postgres DB is hosted at
DB_SERVER=
# Port that is used to access the DB
DB_PORT=
# Bot Token: this is provided by the discord developer portal when a bot is created
DISCORD_TOKEN=
# Test Bot Token: this is provided by the discord developer portal when a bot is created
DISCORD_TOKEN_TEST=

# Client ID of bot
CLIENT_ID=
# ID of server that is used for testing purposes
TESTING_SERVER_ID=
# ID of the channel where logging should occur
LOGGING_CHANNEL_ID=
# ID of the channel where errors should be surfaced
ERROR_CHANNEL_ID=
```

- Run `node deploy-commands.js` to install the bot commands on TESTING_SERVER_ID

- Run `node main.js` to start the bot
- Run `/register` in the test server
  - \*\* if one is available, use `/import_characters_csv` to restore from a backup

## Hosting on Replit

##### TODO: cleanup (?)

Create Replit account

https://replit.com/github -> import XPHolder repo

Add the bot token as a Secret with name DISCORD_TOKEN

Create the directory `./guilds/`
Create the file `./guilds/<test-server-id>.db`
