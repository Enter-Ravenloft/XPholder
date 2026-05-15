require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.COMMAND_INSTALLATION_SERVER_ID;
  if (!token || !guildId) {
    console.error("Missing DISCORD_TOKEN or COMMAND_INSTALLATION_SERVER_ID in env");
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  await guild.channels.fetch();

  const snapshot = {};
  const collisions = [];

  for (const [id, channel] of guild.channels.cache) {
    if (channel.type !== ChannelType.GuildText) continue;
    const key = channel.name.toLowerCase();
    if (snapshot[key]) {
      collisions.push(channel.name);
    } else {
      snapshot[key] = id;
    }
  }

  const outPath = path.join(__dirname, "discordChannelsSnapshot.json");
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");

  console.log(`Wrote ${Object.keys(snapshot).length} text channels to ${outPath}`);
  if (collisions.length > 0) {
    console.error(`WARNING: ${collisions.length} name collision(s) — only one id stored per name:`);
    for (const name of collisions) console.error(`  - ${name}`);
  }

  await client.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
