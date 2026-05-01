const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { XPHOLDER_COLOUR } = require("../config.json");
const { isValidYmd } = require("./validation");
const { playerName } = require("./playerName");

const EVENT_TYPES = ["Mission", "Adventure", "Skirmish", "Arena", "Discourse", "Arc Quest"];
const TIERS = ["3-4", "5-7", "8-10", "11-13", "14-16", "17-20", "Open"];
const REWARD_MAX = 1_000_000;

function parseEventEditCustomId(customId) {
  if (typeof customId !== "string") return null;
  const match = /^event_edit_(type|tier|dm|text|modal):(\d+)$/.exec(customId);
  if (!match) return null;
  return { kind: match[1], eventId: parseInt(match[2], 10) };
}

function computeFieldDiff(current, submitted) {
  const diff = {};
  for (const [key, value] of Object.entries(submitted)) {
    const cur = current[key];
    if (value === cur) continue;
    if (value == null && cur == null) continue;
    diff[key] = value;
  }
  return diff;
}

function parseAndValidateModalFields(raw) {
  const name = (raw.name ?? "").trim();
  const startDate = (raw.start_date ?? "").trim();
  const endDateRaw = (raw.end_date ?? "").trim();
  const xpRaw = (raw.xp_reward ?? "").trim();
  const gpRaw = (raw.gp_reward ?? "").trim();

  const errors = [];
  if (name === "") errors.push("Name cannot be empty.");
  if (!isValidYmd(startDate)) errors.push("Invalid start_date. Use YYYY-MM-DD.");
  if (endDateRaw !== "" && !isValidYmd(endDateRaw)) {
    errors.push("Invalid end_date. Use YYYY-MM-DD or leave empty.");
  }

  let xpReward = null;
  if (xpRaw !== "") {
    const n = parseInt(xpRaw, 10);
    if (!Number.isInteger(n) || String(n) !== xpRaw || n < 0 || n > REWARD_MAX) {
      errors.push(`Invalid xp_reward. Use an integer 0-${REWARD_MAX} or leave empty.`);
    } else {
      xpReward = n;
    }
  }

  let gpReward = null;
  if (gpRaw !== "") {
    const n = parseInt(gpRaw, 10);
    if (!Number.isInteger(n) || String(n) !== gpRaw || n < 0 || n > REWARD_MAX) {
      errors.push(`Invalid gp_reward. Use an integer 0-${REWARD_MAX} or leave empty.`);
    } else {
      gpReward = n;
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    parsed: {
      name,
      start_date: startDate,
      end_date: endDateRaw === "" ? null : endDateRaw,
      xp_reward: xpReward,
      gp_reward: gpReward,
    },
  };
}

function buildEventEditMessage(event, dms) {
  const startDate = event.start_date.toISOString().split("T")[0];
  const endDate = event.end_date ? event.end_date.toISOString().split("T")[0] : "—";
  const sortedDms = [...dms].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  const dmList =
    sortedDms.length > 0
      ? sortedDms.map((d) => playerName(d.username, null) || d.username).join(", ")
      : "—";

  const embed = new EmbedBuilder()
    .setTitle(`Editing: ${event.name}`)
    .setColor(XPHOLDER_COLOUR)
    .setFields(
      { inline: true, name: "Type", value: event.event_type },
      { inline: true, name: "Tier", value: event.tier },
      { inline: true, name: "Status", value: event.status },
      { inline: true, name: "Start", value: startDate },
      { inline: true, name: "End", value: endDate },
      { inline: true, name: "DMs", value: dmList },
      {
        inline: true,
        name: "XP Reward",
        value: event.xp_reward != null ? `${event.xp_reward}` : "—",
      },
      {
        inline: true,
        name: "GP Reward",
        value: event.gp_reward != null ? `${event.gp_reward}` : "—",
      },
      { inline: true, name: "Event ID", value: `${event.event_id}` }
    )
    .setFooter({ text: "Pick from the menus or click the button to edit text fields." });

  const typeRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`event_edit_type:${event.event_id}`)
      .setPlaceholder("Change event type")
      .addOptions(
        EVENT_TYPES.map((t) => ({ label: t, value: t, default: t === event.event_type }))
      )
  );

  const tierRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`event_edit_tier:${event.event_id}`)
      .setPlaceholder("Change tier")
      .addOptions(TIERS.map((t) => ({ label: t, value: t, default: t === event.tier })))
  );

  const dmRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`event_edit_dm:${event.event_id}`)
      .setPlaceholder("Change primary DM")
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_edit_text:${event.event_id}`)
      .setLabel("Edit Name, Dates & Rewards")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [typeRow, tierRow, dmRow, buttonRow] };
}

function buildEventEditModal(event) {
  const startDate = event.start_date.toISOString().split("T")[0];
  const endDate = event.end_date ? event.end_date.toISOString().split("T")[0] : "";
  const titlePrefix = "Edit: ";
  const titleNameMax = 45 - titlePrefix.length;
  const truncatedName =
    event.name.length > titleNameMax
      ? event.name.slice(0, titleNameMax - 3) + "..."
      : event.name;

  const modal = new ModalBuilder()
    .setCustomId(`event_edit_modal:${event.event_id}`)
    .setTitle(`${titlePrefix}${truncatedName}`);

  const nameInput = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(event.name);

  const startInput = new TextInputBuilder()
    .setCustomId("start_date")
    .setLabel("Start Date (YYYY-MM-DD)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(startDate);

  const endInput = new TextInputBuilder()
    .setCustomId("end_date")
    .setLabel("End Date (YYYY-MM-DD; empty for none)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(endDate);

  const xpInput = new TextInputBuilder()
    .setCustomId("xp_reward")
    .setLabel(`XP Reward (0-${REWARD_MAX}; empty for none)`)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(event.xp_reward != null ? `${event.xp_reward}` : "");

  const gpInput = new TextInputBuilder()
    .setCustomId("gp_reward")
    .setLabel(`GP Reward (0-${REWARD_MAX}; empty for none)`)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(event.gp_reward != null ? `${event.gp_reward}` : "");

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(startInput),
    new ActionRowBuilder().addComponents(endInput),
    new ActionRowBuilder().addComponents(xpInput),
    new ActionRowBuilder().addComponents(gpInput)
  );

  return modal;
}

module.exports = {
  parseEventEditCustomId,
  computeFieldDiff,
  parseAndValidateModalFields,
  buildEventEditMessage,
  buildEventEditModal,
  EVENT_TYPES,
  TIERS,
};
