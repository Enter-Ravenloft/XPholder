const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR } = require("../../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_add_dm")
    .setDescription("Adds A Co-DM To An Active Event! [ MOD ]")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("The Event To Add The DM To")
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("dm")
        .setDescription("The DM To Add")
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
    const dm = interaction.options.getUser("dm");
    let dmMember;
    try {
      dmMember = await interaction.guild.members.fetch(dm.id);
    } catch {
      await interaction.editReply("That user is no longer in the server.");
      return;
    }

    const event = await guildService.getEvent(eventId);
    if (!event) {
      await interaction.editReply("Sorry, that event does not exist.");
      return;
    }
    if (event.status !== "active") {
      await interaction.editReply("Sorry, that event is not active.");
      return;
    }

    try {
      await guildService.addEventDm(eventId, dm.id, dmMember.displayName);
    } catch (error) {
      if (error.code === "23505") {
        await interaction.editReply("That DM is already in this event.");
        return;
      }
      throw error;
    }

    const embed = new EmbedBuilder()
      .setTitle("DM Added To Event")
      .setColor(XPHOLDER_COLOUR)
      .setFields(
        { inline: true, name: "Event", value: event.name },
        { inline: true, name: "DM", value: `${dm}` }
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
