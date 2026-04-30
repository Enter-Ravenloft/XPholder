const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR } = require("../../config.json");
const { getLevelInfo } = require("../../utils");
const { resolveEventOption } = require("../../utils/resolveEventOption");
const {
  parseAddPcCustomId,
  buildAddPcMessage,
} = require("../../utils/eventAddPcHelpers");
const { logEventParticipantAdded } = require("../../utils/logging");

async function handleAddPcUserSelect(guildService, interaction) {
  const parsed = parseAddPcCustomId(interaction.customId);
  if (!parsed) return;
  const eventId = parsed.eventId;
  const playerId = interaction.values[0];

  try {
    await interaction.guild.members.fetch(playerId);
  } catch (err) {
    console.error("guild.members.fetch failed:", err);
    await interaction.reply({ content: "That player is no longer in the server.", ephemeral: true });
    return;
  }

  const event = await guildService.getEvent(eventId);
  if (!event || event.status !== "active") {
    try {
      await interaction.update({ content: "This event is no longer active.", embeds: [], components: [] });
    } catch (err) {
      console.error("interaction.update failed:", err);
    }
    return;
  }

  const characters = await guildService.getAllCharacters(playerId);
  const participants = await guildService.getEventParticipants(eventId);
  const participantIds = new Set(participants.map((p) => p.character_id));
  const availableCharacters = characters.filter((c) => !participantIds.has(c.character_id));

  if (availableCharacters.length === 0) {
    await interaction.reply({
      content: "This player has no characters available to add (either they have none, or all of theirs are already in this event).",
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.update(buildAddPcMessage(event, participants, playerId, availableCharacters));
  } catch (err) {
    console.error("interaction.update failed:", err);
    await interaction.followUp({
      content: "The editor message could not be refreshed. Re-run /event_add_pc to continue.",
      ephemeral: true,
    });
  }
}

async function handleAddPcCharacterSelect(guildService, interaction) {
  const parsed = parseAddPcCustomId(interaction.customId);
  if (!parsed || parsed.playerId == null) return;
  const eventId = parsed.eventId;
  const playerId = parsed.playerId;
  const characterIndex = interaction.values[0];
  const characterId = `${playerId}-${characterIndex}`;

  const event = await guildService.getEvent(eventId);
  if (!event || event.status !== "active") {
    try {
      await interaction.update({ content: "This event is no longer active.", embeds: [], components: [] });
    } catch (err) {
      console.error("interaction.update failed:", err);
    }
    return;
  }

  const character = await guildService.getCharacter(characterId);
  if (!character) {
    await interaction.reply({ content: "Sorry, that character no longer exists.", ephemeral: true });
    return;
  }

  const levelInfo = getLevelInfo(guildService.levels, character.xp);

  try {
    await guildService.addEventParticipant(
      eventId,
      characterId,
      playerId,
      character.name,
      parseInt(levelInfo.level),
      character.xp
    );
  } catch (error) {
    if (error.code === "23505") {
      await interaction.reply({ content: "That character is already in this event.", ephemeral: true });
      return;
    }
    throw error;
  }

  const updatedParticipants = await guildService.getEventParticipants(eventId);

  try {
    await interaction.update(buildAddPcMessage(event, updatedParticipants, null, []));
  } catch (err) {
    console.error("interaction.update failed:", err);
    await interaction.followUp({
      content: "PC added, but the editor message could not be refreshed. Re-run /event_add_pc to continue.",
      ephemeral: true,
    });
  }

  try {
    await logEventParticipantAdded(interaction, event, character, playerId, levelInfo);
  } catch (err) {
    console.error("logEventParticipantAdded failed:", err);
  }
}

async function handleAddPcDoneButton(guildService, interaction) {
  const parsed = parseAddPcCustomId(interaction.customId);
  if (!parsed) return;
  const eventId = parsed.eventId;

  const event = await guildService.getEvent(eventId);
  const participants = event ? await guildService.getEventParticipants(eventId) : [];
  const finalMessage = event ? buildAddPcMessage(event, participants, null, []) : null;

  try {
    if (finalMessage) {
      await interaction.update({ embeds: finalMessage.embeds, components: [] });
    } else {
      await interaction.update({ content: "Editor closed.", embeds: [], components: [] });
    }
  } catch (err) {
    console.error("interaction.update failed:", err);
  }
}

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

    const eventId = await resolveEventOption(interaction, guildService, "active");
    if (eventId == null) return;
    const player = interaction.options.getUser("player");
    try {
      await interaction.guild.members.fetch(player.id);
    } catch {
      await interaction.editReply("That player is no longer in the server.");
      return;
    }
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
  handleAddPcUserSelect,
  handleAddPcCharacterSelect,
  handleAddPcDoneButton,
};
