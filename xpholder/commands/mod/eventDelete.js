const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_RETIRE_COLOUR } = require("../../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_delete")
    .setDescription("Deletes An Active Event! [ MOD ]")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("The Event To Delete")
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

    const event = await guildService.getEvent(eventId);
    if (!event) {
      await interaction.editReply("Sorry, that event does not exist.");
      return;
    }
    if (event.status !== "active") {
      await interaction.editReply(
        "Sorry, only active events can be deleted."
      );
      return;
    }

    await guildService.deleteEvent(eventId);

    const embed = new EmbedBuilder()
      .setTitle("Event Deleted")
      .setColor(XPHOLDER_RETIRE_COLOUR)
      .setFields(
        { inline: true, name: "Event", value: event.name },
        { inline: true, name: "Type", value: event.event_type }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
  async autocomplete(guildService, interaction) {
    const focusedValue = interaction.options.getFocused();
    const events = await guildService.searchEvents(focusedValue);
    await interaction.respond(
      events.map((e) => ({ name: e.name, value: `${e.event_id}` }))
    );
  },
};
