const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR } = require("../../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_info")
    .setDescription("Shows Details For An Event!")
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

    const eventId = parseInt(interaction.options.getString("event"));

    const event = await guildService.getEvent(eventId);
    if (!event) {
      await interaction.editReply("Sorry, that event does not exist.");
      return;
    }

    const participants = await guildService.getEventParticipants(eventId);
    const dms = await guildService.getEventDms(eventId);

    const participantList = participants.length > 0
      ? participants.map((p) => `${p.character_name} (Lvl ${p.starting_level}) - <@${p.player_id}>`).join("\n")
      : "None";
    const dmList = dms.length > 0
      ? dms.map((d) => `<@${d.user_id}>${d.is_primary ? " (Primary)" : ""}`).join(", ")
      : "None";

    const statusEmoji = event.status === "active" ? "🟢" : "✅";
    const startDate = event.start_date.toISOString().split("T")[0];
    const endDate = event.end_date ? event.end_date.toISOString().split("T")[0] : "Ongoing";

    const embed = new EmbedBuilder()
      .setTitle(`${statusEmoji} ${event.name}`)
      .setColor(XPHOLDER_COLOUR)
      .setFields(
        { inline: true, name: "Type", value: event.event_type },
        { inline: true, name: "Tier", value: event.tier },
        { inline: true, name: "Status", value: event.status },
        { inline: true, name: "Start", value: startDate },
        { inline: true, name: "End", value: endDate },
        { inline: true, name: "DMs", value: dmList },
        { inline: false, name: `Participants (${participants.length})`, value: participantList }
      )
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
        name: `${e.status === "active" ? "🟢" : "✅"} ${e.name}`,
        value: `${e.event_id}`,
      }))
    );
  },
};
