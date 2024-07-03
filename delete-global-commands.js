const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

const dotenv = require("dotenv");
dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;

const rest = new REST({ version: "9" })
  .setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started deleting global application (/) commands.");

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });

    console.log("Successfully deleted global application (/) commands.");
  } catch (error) {
    console.log(error);
  }
})();
