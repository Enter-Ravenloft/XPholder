const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR } = require("../../config.json");
const { playerName } = require("../../utils/playerName");
const { resolveEventOption } = require("../../utils/resolveEventOption");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_info")
    .setDescription("Shows Details For An Event! [ MOD ]")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("The Event To View")
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Show This Command To Everyone?")
        .setRequired(false)
    ),
  async execute(guildService, interaction) {
    if (
      !guildService.isMod(interaction.member._roles) &&
      interaction.user.id != interaction.guild.ownerId &&
      !guildService.isDev(interaction.member._roles)
    ) {
      await interaction.editReply(
        "Sorry, you do not have the right role to use this command."
      );
      return;
    }

    const eventId = await resolveEventOption(interaction, guildService, "active");
    if (eventId == null) return;

    const event = await guildService.getEvent(eventId);
    if (!event) {
      await interaction.editReply("Sorry, that event does not exist.");
      return;
    }

    const participants = await guildService.getEventParticipants(eventId);
    const dms = await guildService.getEventDms(eventId);

    const participantList = participants.length > 0
      ? participants.map((p) => {
          const level = p.starting_level > 1 || p.starting_xp > 0 ? ` (Lvl ${p.starting_level})` : "";
          const player = p.player_id ? ` - <@${p.player_id}>` : "";
          return `${p.character_name}${level}${player}`;
        }).join("\n")
      : "None";
    const sortedDms = [...dms].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    const dmList = sortedDms.length > 0
      ? sortedDms.map((d) => playerName(d.username, null) || d.username).join(", ")
      : "None";

    const statusEmoji = event.status === "active" ? "🟢 " : "";
    const startDate = event.start_date.toISOString().split("T")[0];
    const endDate = event.end_date ? event.end_date.toISOString().split("T")[0] : "Ongoing";

    let channelValue = null;
    if (event.role_play_channel_id) {
      channelValue = `<#${event.role_play_channel_id}>`;
    } else if (event.role_play_channel_name) {
      channelValue = event.role_play_channel_name;
    }

    const fields = [
      { inline: true, name: "Type", value: event.event_type },
      { inline: true, name: "Tier", value: event.tier },
      { inline: true, name: "Status", value: event.status },
    ];
    if (channelValue !== null) {
      fields.push({ inline: true, name: "Channel", value: channelValue });
    }
    fields.push(
      { inline: true, name: "Start", value: startDate },
      { inline: true, name: "End", value: endDate },
      { inline: true, name: "DMs", value: dmList },
      { inline: false, name: `Participants (${participants.length})`, value: participantList }
    );

    const embed = new EmbedBuilder()
      .setTitle(`${statusEmoji} ${event.name}`)
      .setColor(XPHOLDER_COLOUR)
      .setFields(...fields)
      .setFooter({ text: `Event ID: ${eventId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
  async autocomplete(guildService, interaction) {
    const focusedValue = interaction.options.getFocused();
    // Search both active and completed for info viewing
    const active = await guildService.searchEvents(focusedValue, "active");
    const completed = await guildService.searchEvents(focusedValue, "completed");
    const events = [...active, ...completed].slice(0, 25);
    await interaction.respond(
      events.map((e) => ({
        name: `${e.status === "active" ? "🟢 " : ""}${e.name}`,
        value: `${e.event_id}`,
      }))
    );
  },
};
