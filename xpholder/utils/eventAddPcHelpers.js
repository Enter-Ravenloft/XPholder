const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { XPHOLDER_COLOUR } = require("../config.json");
const { formatParticipantName } = require("./participantRender");

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

function buildAddPcMessage(
  event,
  activeParticipants,
  droppedParticipants,
  selectedPlayerId,
  availableCharacters
) {
  const dropped = droppedParticipants || [];
  const activeLines = activeParticipants.map(
    (p) => `• ${formatParticipantName(p)} (Lvl ${p.starting_level})`
  );
  const participantList = activeLines.length > 0 ? activeLines.join("\n") : "None";

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
  fields.push({
    inline: false,
    name: `Participants (${activeParticipants.length})`,
    value: participantList,
  });

  if (dropped.length > 0) {
    const droppedLines = dropped.map(
      (p) => `• ${p.character_name} (Lvl ${p.starting_level})`
    );
    fields.push({
      inline: false,
      name: `Dropped (${dropped.length})`,
      value: droppedLines.join("\n"),
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`Add PCs to ${event.name}`)
    .setColor(XPHOLDER_COLOUR)
    .setFields(...fields);

  const userRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`event_add_pc_user:${event.event_id}:n${activeParticipants.length}`)
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
