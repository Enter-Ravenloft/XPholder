const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR } = require("../../config.json");
const { getLevelInfo } = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_add_pc")
    .setDescription("Adds A PC To An Active Event! [ MOD ]")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("The Event To Add The PC To")
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
        .setDescription("Which Character To Add (1 -> 10)")
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

    const character = await guildService.getCharacter(characterId);
    if (!character) {
      await interaction.editReply("Sorry, that character does not exist.");
      return;
    }

    const levelInfo = getLevelInfo(guildService.levels, character.xp);

    try {
      await guildService.addEventParticipant(
        eventId,
        characterId,
        player.id,
        character.name,
        parseInt(levelInfo.level),
        character.xp
      );
    } catch (error) {
      if (error.code === "23505") {
        await interaction.editReply(
          "That character is already in this event."
        );
        return;
      }
      throw error;
    }

    const embed = new EmbedBuilder()
      .setTitle("PC Added To Event")
      .setColor(XPHOLDER_COLOUR)
      .setFields(
        { inline: true, name: "Event", value: event.name },
        { inline: true, name: "Character", value: character.name },
        { inline: true, name: "Player", value: `${player}` },
        { inline: true, name: "Level", value: `${levelInfo.level}` },
        { inline: true, name: "XP", value: `${Math.floor(character.xp)}` }
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
      const playerOption = interaction.options.get("player");
      if (!playerOption) return;
      const characters = await guildService.getAllCharacters(playerOption.value);
      const filtered = characters.filter((c) =>
        c.name.toLowerCase().startsWith(focusedOption.value.toLowerCase())
      );
      await interaction.respond(
        filtered.map((c) => ({ name: c.name, value: c.character_index }))
      );
    }
  },
};
