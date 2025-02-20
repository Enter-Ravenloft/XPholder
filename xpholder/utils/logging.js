const dotenv = require("dotenv");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR, XPHOLDER_RETIRE_COLOUR } = require("../config.json");
dotenv.config();
const TESTING_SERVER_ID = process.env.TESTING_SERVER_ID;
const LOGGING_CHANNEL_ID = process.env.LOGGING_CHANNEL_ID;
const ERROR_CHANNEL_ID = process.env.ERROR_CHANNEL_ID;

async function logCommand(interaction) {
  // CREATING THE LOG EMBED
  const logEmbed = new EmbedBuilder()
    .setTitle(`${interaction.member.displayName} used "${interaction.commandName}"`)
    .setFields(
      { inline: false, name: "Guild", value: `${interaction.guild.name} (${interaction.guild.id})` },
      { inline: false, name: "Author", value: `${interaction.member.displayName} (${interaction.user.id})` },
      { inline: false, name: "Command", value: `${interaction.commandName}` }
    )
    .setTimestamp()
    .setColor(XPHOLDER_COLOUR)
    .setThumbnail(`${interaction.client.user.avatarURL()}`);
  // ADDING FIELDS FOR EACH OF THE OPTIONS PASSED THROUGH
  for (const option of interaction.options._hoistedOptions) {
    logEmbed.addFields({
      inline: true,
      name: `${option["name"]}`,
      value: `${option["value"]}`,
    });
  }

  // FETCHING THE TESTING SERVER AND LOG CHANNEL
  const testingServer = await interaction.client.guilds.fetch(
    TESTING_SERVER_ID
  );
  const loggingChannel = await testingServer.channels.fetch(LOGGING_CHANNEL_ID);

  // SENDING LOG EMBED
  loggingChannel.send({
    embeds: [logEmbed],
  });
}

async function logError(interaction, error) {
  // CREATING THE LOG ERROR EMBED
  const logErrorEmbed = new EmbedBuilder()
    .setTitle("An Error Has Occured")
    .setDescription(`${error}`)
    .setFields(
      { inline: false, name: "Guild", value: `${interaction.guild.name} (${interaction.guild.id})` },
      { inline: false, name: "Author", value: `${interaction.member.displayName} (${interaction.user.id})` },
      { inline: false, name: "Command", value: `${interaction.commandName}` }
    )
    .setTimestamp()
    .setColor(XPHOLDER_RETIRE_COLOUR)
    .setThumbnail(`${interaction.client.user.avatarURL()}`);
  // ADDING FIELDS FOR EACH OF THE OPTIONS PASSED THROUGH
  for (const option of interaction.options._hoistedOptions) {
    logErrorEmbed.addFields({
      inline: true,
      name: `${option["name"]}`,
      value: `${option["value"]}`,
    });
  }

  // FETCHING THE TESTING SERVER AND LOG CHANNEL
  const testingServer = await interaction.client.guilds.fetch(
    TESTING_SERVER_ID
  );
  const loggingChannel = await testingServer.channels.fetch(ERROR_CHANNEL_ID);

  // REPORTING THE ERROR
  loggingChannel.send({
    embeds: [logErrorEmbed],
  });
}

async function logRPXP(player, characterName, xp, message) {
  // CREATING THE LOG MESSAGE
  const logMessage = `Awarded **${xp.toFixed(1)}** RP XP to **${characterName}** (${player.displayName}) for: ${message.url}`;

  // FETCHING THE TESTING SERVER AND LOG CHANNEL
  const testingServer = await message.client.guilds.fetch(TESTING_SERVER_ID);
  const loggingChannel = await testingServer.channels.fetch(LOGGING_CHANNEL_ID);

  // SENDING LOG MESSAGE
  loggingChannel.send({
    content: logMessage,
  });
}

module.exports = {
  logCommand,
  logError,
  logRPXP,
};
