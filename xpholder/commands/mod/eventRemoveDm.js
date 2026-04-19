const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_RETIRE_COLOUR } = require("../../config.json");
const { playerName } = require("../../utils/playerName");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_remove_dm")
    .setDescription("Removes A DM From An Active Event! [ MOD ]")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("The Event To Remove The DM From")
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("dm")
        .setDescription("The DM To Remove")
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
    if (isNaN(eventId)) {
      await interaction.editReply("Please pick an event from the autocomplete list.");
      return;
    }
    const dmUserId = interaction.options.getString("dm");

    const event = await guildService.getEvent(eventId);
    if (!event) {
      await interaction.editReply("Sorry, that event does not exist.");
      return;
    }
    if (event.status !== "active") {
      await interaction.editReply("Sorry, that event is not active.");
      return;
    }

    const removed = await guildService.removeEventDm(eventId, dmUserId);

    if (!removed) {
      await interaction.editReply("That DM is not in this event.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("DM Removed From Event")
      .setColor(XPHOLDER_RETIRE_COLOUR)
      .setFields(
        { inline: true, name: "Event", value: event.name },
        { inline: true, name: "DM", value: playerName(removed.username, null) || removed.username }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
  async autocomplete(guildService, interaction) {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === "event") {
      const events = await guildService.searchEvents(focusedOption.value);
      await interaction.respond(
        events.map((e) => ({ name: e.name, value: `${e.event_id}` }))
      );
    } else if (focusedOption.name === "dm") {
      const eventOption = interaction.options.get("event");
      if (!eventOption) return;
      const eventId = parseInt(eventOption.value);
      if (isNaN(eventId)) return;
      const dms = await guildService.getEventDms(eventId);
      const filtered = dms.filter((d) =>
        (d.username || "").toLowerCase().startsWith(focusedOption.value.toLowerCase())
      );
      await interaction.respond(
        filtered.slice(0, 25).map((d) => ({
          name: playerName(d.username, null) || d.username,
          value: d.user_id,
        }))
      );
    }
  },
};
