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


## Local development

A `.env` folder to hold the DISCORD_TOKEN

Libraries to install
```
npm install dotenv node-fetch mkdirp discord.js@14.0.3 sqlite3 @discordjs/rest discord-api-types @discordjs/builders
```

Install node.js on Mac (`brew install node`)

Clone the repo

Run `npm init -y`, edit package.json

Edit `xpholder/config.json` to give TESTING_SERVER_ID and CLIENT_ID (bot user id)

Run `node deploy-commands.js` to install the bot commands on TESTING_SERVER_ID

Run `node main.js` to start the bot

### Setting up the DB

Create the directory `./guilds/`
Create the file `./guilds/<test-server-id>.db`
Start the bot `node main.js`
Run `/register`
(Now commands like `/help` should work)

Use `/import_characters_csv` to restore from a backup

## Hosting on Replit

Create Replit account

https://replit.com/github -> import XPHolder repo

Add the bot token as a Secret with name DISCORD_TOKEN

Create the directory `./guilds/`
Create the file `./guilds/<test-server-id>.db`
