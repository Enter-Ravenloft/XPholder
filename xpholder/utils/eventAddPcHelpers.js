const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { XPHOLDER_COLOUR } = require("../config.json");

function parseAddPcCustomId(customId) {
  if (typeof customId !== "string") return null;
  const match = /^event_add_pc_(user|char|done):(\d+)(?::(\d+))?(?::n\d+)?$/.exec(customId);
  if (!match) return null;
  const kind = match[1];
  const eventId = parseInt(match[2], 10);
  const playerId = match[3] ?? null;

  // char REQUIRES a playerId; user/done MUST NOT have one
  if (kind === "char" && playerId == null) return null;
  if ((kind === "user" || kind === "done") && playerId != null) return null;

  return { kind, eventId, playerId };
}

function buildAddPcMessage(event, participants, selectedPlayerId, availableCharacters) {
  const participantList = participants.length > 0
    ? participants.map((p) => `• ${p.character_name} (Lvl ${p.starting_level})`).join("\n")
    : "None";

  const embed = new EmbedBuilder()
    .setTitle(`Add PCs to ${event.name}`)
    .setColor(XPHOLDER_COLOUR)
    .setFields(
      { inline: true, name: "Type", value: event.event_type },
      { inline: true, name: "Tier", value: event.tier },
      { inline: true, name: "Status", value: event.status },
      { inline: false, name: "Participants", value: participantList }
    );

  const userRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`event_add_pc_user:${event.event_id}:n${participants.length}`)
      .setPlaceholder("Choose a Player")
  );

  const doneRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_add_pc_done:${event.event_id}`)
      .setLabel("Done")
      .setStyle(ButtonStyle.Secondary)
  );

  const components = [userRow];

  if (selectedPlayerId && availableCharacters.length > 0) {
    const charRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`event_add_pc_char:${event.event_id}:${selectedPlayerId}`)
        .setPlaceholder("Pick a character")
        .addOptions(
          availableCharacters.map((c) => ({
            label: c.name,
            value: `${c.character_index}`,
          }))
        )
    );
    components.push(charRow);
  }

  components.push(doneRow);

  return { embeds: [embed], components };
}

module.exports = {
  parseAddPcCustomId,
  buildAddPcMessage,
};
