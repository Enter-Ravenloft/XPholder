const dotenv = require("dotenv");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR, XPHOLDER_RETIRE_COLOUR } = require("../config.json");
dotenv.config();

const SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP = JSON.parse(
  process.env.SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP
);

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

  _logToDiscord(interaction.guild, { embeds: [logEmbed] }, "logCommand");
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

  _logToDiscord(interaction.guild, { embeds: [logErrorEmbed] }, "logError");
}

async function logRPXP(player, characterName, xp, message) {
  const message = `**RPXP Awarded:** ${xp.toFixed(1)} XP to ${characterName} (${player.displayName}) for: ${message.url}`;

  _logToDiscord(message.guild, { content: message }, "logRPXP");
}

async function logRequestXPApproval(requestPlayer, characterName, approvalPlayer, deltaXP) {
  const message = `**XP Request Approved:** ${deltaXP} XP to ${characterName} (${requestPlayer.displayName}) approved by ${approvalPlayer.displayName}`;

  _logToDiscord(requestPlayer.guild, { content: message }, "logRequestXPApproval");
}

async function logRequestXPRejection(requestPlayer, characterName, approvalPlayer, deltaXP) {
  const message = `**XP Request Rejected:** ${deltaXP} XP to ${characterName} (${requestPlayer.displayName}) rejected by ${approvalPlayer.displayName}`;

  _logToDiscord(requestPlayer.guild, { content: message }, "logRequestXPRejection");
}

async function _logToDiscord(server, sendPayload, label) {
  if (!(server.id in SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP)) {
    console.warn(
      `${label}: Server ${server.id} not found in SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP (${SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP})`
    );
    return;
  }

  const loggingChannelId = SERVER_ID_TO_LOGGING_CHANNEL_ID_MAP[server.id];
  const loggingChannel = await server.channels.fetch(loggingChannelId);
  loggingChannel.send(sendPayload);
}

module.exports = {
  logCommand,
  logError,
  logRPXP,
  logRequestXPApproval,
  logRequestXPRejection,
};
