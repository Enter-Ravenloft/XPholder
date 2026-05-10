const { SlashCommandBuilder } = require("@discordjs/builders");
const { resolveEventOption } = require("../../utils/resolveEventOption");
const {
  parseEventEditCustomId,
  computeFieldDiff,
  parseAndValidateModalFields,
  buildEventEditMessage,
  buildEventEditModal,
} = require("../../utils/eventEditHelpers");
const { logEventEditChange } = require("../../utils/logging");

async function handleEditTypeSelect(guildService, interaction) {
  const parsed = parseEventEditCustomId(interaction.customId);
  if (!parsed) return;
  const eventId = parsed.eventId;
  const newType = interaction.values[0];

  const before = await guildService.getEvent(eventId);
  if (!before) {
    await interaction.update({ content: "This event no longer exists.", embeds: [], components: [] });
    return;
  }
  if (before.event_type === newType) {
    await interaction.deferUpdate();
    return;
  }

  await guildService.updateEvent(eventId, { event_type: newType });
  const after = await guildService.getEvent(eventId);
  const dms = await guildService.getEventDms(eventId);
  await interaction.update(buildEventEditMessage(after, dms));

  try {
    await logEventEditChange(interaction, after, "event_type", before.event_type, newType);
  } catch (err) {
    console.error("logEventEditChange failed:", err);
  }
}

async function handleEditTierSelect(guildService, interaction) {
  const parsed = parseEventEditCustomId(interaction.customId);
  if (!parsed) return;
  const eventId = parsed.eventId;
  const newTier = interaction.values[0];

  const before = await guildService.getEvent(eventId);
  if (!before) {
    await interaction.update({ content: "This event no longer exists.", embeds: [], components: [] });
    return;
  }
  if (before.tier === newTier) {
    await interaction.deferUpdate();
    return;
  }

  await guildService.updateEvent(eventId, { tier: newTier });
  const after = await guildService.getEvent(eventId);
  const dms = await guildService.getEventDms(eventId);
  await interaction.update(buildEventEditMessage(after, dms));

  try {
    await logEventEditChange(interaction, after, "tier", before.tier, newTier);
  } catch (err) {
    console.error("logEventEditChange failed:", err);
  }
}

async function handleEditDmSelect(guildService, interaction) {
  const parsed = parseEventEditCustomId(interaction.customId);
  if (!parsed) return;
  const eventId = parsed.eventId;
  const userId = interaction.values[0];

  const beforeEvent = await guildService.getEvent(eventId);
  if (!beforeEvent) {
    await interaction.update({ content: "This event no longer exists.", embeds: [], components: [] });
    return;
  }
  const beforeDms = await guildService.getEventDms(eventId);
  const beforePrimary = beforeDms.find((d) => d.is_primary);

  let member;
  try {
    member = await interaction.guild.members.fetch(userId);
  } catch (err) {
    console.error("guild.members.fetch failed:", err);
    await interaction.reply({ content: "That user is no longer in the server.", ephemeral: true });
    return;
  }

  if (beforePrimary && beforePrimary.user_id === userId) {
    await interaction.deferUpdate();
    return;
  }

  await guildService.setPrimaryDm(eventId, userId, member.displayName);

  const afterEvent = await guildService.getEvent(eventId);
  const afterDms = await guildService.getEventDms(eventId);
  await interaction.update(buildEventEditMessage(afterEvent, afterDms));

  try {
    await logEventEditChange(
      interaction,
      afterEvent,
      "primary_dm",
      beforePrimary ? beforePrimary.username : null,
      member.displayName
    );
  } catch (err) {
    console.error("logEventEditChange failed:", err);
  }
}

async function handleEditChannelSelect(guildService, interaction) {
  const parsed = parseEventEditCustomId(interaction.customId);
  if (!parsed) return;
  const eventId = parsed.eventId;
  const channel = interaction.channels.first();

  const before = await guildService.getEvent(eventId);
  if (!before) {
    await interaction.update({ content: "This event no longer exists.", embeds: [], components: [] });
    return;
  }
  if (!channel) {
    await interaction.deferUpdate();
    return;
  }
  if (before.role_play_channel_id === channel.id) {
    await interaction.deferUpdate();
    return;
  }

  await guildService.updateEvent(eventId, {
    role_play_channel_id: channel.id,
    role_play_channel_name: channel.name,
  });
  const after = await guildService.getEvent(eventId);
  const dms = await guildService.getEventDms(eventId);
  await interaction.update(buildEventEditMessage(after, dms));

  try {
    await logEventEditChange(
      interaction,
      after,
      "role_play_channel",
      before.role_play_channel_name,
      channel.name
    );
  } catch (err) {
    console.error("logEventEditChange failed:", err);
  }
}

async function handleEditTextButton(guildService, interaction) {
  const parsed = parseEventEditCustomId(interaction.customId);
  if (!parsed) return;
  const event = await guildService.getEvent(parsed.eventId);
  if (!event) {
    await interaction.reply({ content: "This event no longer exists.", ephemeral: true });
    return;
  }
  await interaction.showModal(buildEventEditModal(event));
}

async function handleEditModalSubmit(guildService, interaction) {
  const parsed = parseEventEditCustomId(interaction.customId);
  if (!parsed) return;
  const eventId = parsed.eventId;

  const validation = parseAndValidateModalFields({
    name: interaction.fields.getTextInputValue("name"),
    start_date: interaction.fields.getTextInputValue("start_date"),
    end_date: interaction.fields.getTextInputValue("end_date"),
    xp_reward: interaction.fields.getTextInputValue("xp_reward"),
    gp_reward: interaction.fields.getTextInputValue("gp_reward"),
  });

  if (!validation.valid) {
    await interaction.reply({ content: validation.errors.join("\n"), ephemeral: true });
    return;
  }

  const submitted = validation.parsed;
  const before = await guildService.getEvent(eventId);
  if (!before) {
    await interaction.update({ content: "This event no longer exists.", embeds: [], components: [] });
    return;
  }

  if (
    before.status === "active" &&
    (submitted.end_date != null || submitted.xp_reward != null || submitted.gp_reward != null)
  ) {
    await interaction.reply({
      content: "End date, XP reward, and GP reward can only be edited on completed events. Use /event_end to close an active event.",
      ephemeral: true,
    });
    return;
  }

  const current = {
    name: before.name,
    start_date: before.start_date.toISOString().split("T")[0],
    end_date: before.end_date ? before.end_date.toISOString().split("T")[0] : null,
    xp_reward: before.xp_reward,
    gp_reward: before.gp_reward,
  };
  const diff = computeFieldDiff(current, submitted);

  if (Object.keys(diff).length === 0) {
    await interaction.reply({ content: "No changes.", ephemeral: true });
    return;
  }

  await guildService.updateEvent(eventId, diff);
  const after = await guildService.getEvent(eventId);
  const dms = await guildService.getEventDms(eventId);
  await interaction.update(buildEventEditMessage(after, dms));

  for (const [field, newValue] of Object.entries(diff)) {
    try {
      await logEventEditChange(interaction, after, field, current[field], newValue);
    } catch (err) {
      console.error("logEventEditChange failed:", err);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_edit")
    .setDescription("Edit The Details Of An Event! [ MOD ]")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("The Event To Edit")
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
      await interaction.editReply("Sorry, you do not have the right role to use this command.");
      return;
    }

    const eventId = await resolveEventOption(interaction, guildService, "active");
    if (eventId == null) return;

    const event = await guildService.getEvent(eventId);
    if (!event) {
      await interaction.editReply("Sorry, that event does not exist.");
      return;
    }

    const dms = await guildService.getEventDms(eventId);
    await interaction.editReply(buildEventEditMessage(event, dms));
  },
  async autocomplete(guildService, interaction) {
    const focusedValue = interaction.options.getFocused();
    const active = await guildService.searchEvents(focusedValue, "active");
    const completed = await guildService.searchEvents(focusedValue, "completed");
    const events = [...active, ...completed].slice(0, 25);
    await interaction.respond(
      events.map((e) => ({
        name: `${e.status === "active" ? "🟢 " : ""}${e.name}`,
        value: `${e.event_id}`,
      }))
    );
  },
  handleEditTypeSelect,
  handleEditTierSelect,
  handleEditDmSelect,
  handleEditChannelSelect,
  handleEditTextButton,
  handleEditModalSubmit,
};
