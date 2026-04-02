const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_RETIRE_COLOUR } = require("../../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_remove_pc")
    .setDescription("Removes A PC From An Active Event! [ MOD ]")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("The Event To Remove The PC From")
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription("The Player Who Owns The Character")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("character")
        .setDescription("Which Character To Remove (1 -> 10)")
        .setMinValue(1)
        .setMaxValue(10)
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
    const player = interaction.options.getUser("player");
    const characterIndex = interaction.options.getInteger("character");
    const characterId = `${player.id}-${characterIndex}`;

    const event = await guildService.getEvent(eventId);
    if (!event) {
      await interaction.editReply("Sorry, that event does not exist.");
      return;
    }
    if (event.status !== "active") {
      await interaction.editReply("Sorry, that event is not active.");
      return;
    }

    const removed = await guildService.removeEventParticipant(eventId, characterId);

    if (!removed) {
      await interaction.editReply("That character is not in this event.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("PC Removed From Event")
      .setColor(XPHOLDER_RETIRE_COLOUR)
      .setFields(
        { inline: true, name: "Event", value: event.name },
        { inline: true, name: "Character", value: removed.character_name || characterId },
        { inline: true, name: "Player", value: `${player}` }
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
    } else if (focusedOption.name === "character") {
      const eventOption = interaction.options.get("event");
      const playerOption = interaction.options.get("player");
      if (!eventOption || !playerOption) return;
      const participants = await guildService.getEventParticipants(parseInt(eventOption.value));
      const playerParticipants = participants.filter(
        (p) => p.player_id === playerOption.value
      );
      const filtered = playerParticipants.filter((p) =>
        (p.character_name || "").toLowerCase().startsWith(focusedOption.value.toLowerCase())
      );
      await interaction.respond(
        filtered.map((p) => {
          const index = parseInt(p.character_id.split("-").pop());
          return { name: p.character_name || p.character_id, value: index };
        })
      );
    }
  },
};
