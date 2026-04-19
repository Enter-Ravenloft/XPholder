const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR } = require("../../config.json");
const { isValidYmd } = require("../../utils/validation");

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
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("New Name For The Event")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("event_type")
        .setDescription("New Event Type")
        .addChoices(
          { name: "Mission", value: "Mission" },
          { name: "Adventure", value: "Adventure" },
          { name: "Skirmish", value: "Skirmish" },
          { name: "Arena", value: "Arena" },
          { name: "Discourse", value: "Discourse" },
          { name: "Arc Quest", value: "Arc Quest" }
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("New Tier / Level Bracket")
        .addChoices(
          { name: "3-4", value: "3-4" },
          { name: "5-7", value: "5-7" },
          { name: "8-10", value: "8-10" },
          { name: "11-13", value: "11-13" },
          { name: "14-16", value: "14-16" },
          { name: "17-20", value: "17-20" },
          { name: "Open", value: "Open" }
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("start_date")
        .setDescription("New Start Date (YYYY-MM-DD)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("end_date")
        .setDescription("New End Date (YYYY-MM-DD)")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("xp_reward")
        .setDescription("XP Reward")
        .setMinValue(0)
        .setMaxValue(1000000)
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("gp_reward")
        .setDescription("GP Reward")
        .setMinValue(0)
        .setMaxValue(1000000)
        .setRequired(false)
    )
    .addUserOption((option) =>
      option
        .setName("primary_dm")
        .setDescription("New Primary DM")
        .setRequired(false)
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

    const name = interaction.options.getString("name");
    const eventType = interaction.options.getString("event_type");
    const tier = interaction.options.getString("tier");
    const startDateStr = interaction.options.getString("start_date");
    const endDateStr = interaction.options.getString("end_date");
    const xpReward = interaction.options.getInteger("xp_reward");
    const gpReward = interaction.options.getInteger("gp_reward");
    const primaryDmUser = interaction.options.getUser("primary_dm");

    if (startDateStr && !isValidYmd(startDateStr)) {
      await interaction.editReply(
        "Invalid `start_date`. Use `YYYY-MM-DD` (e.g. `2026-04-15`)."
      );
      return;
    }
    if (endDateStr && !isValidYmd(endDateStr)) {
      await interaction.editReply(
        "Invalid `end_date`. Use `YYYY-MM-DD` (e.g. `2026-04-15`)."
      );
      return;
    }
    if ((endDateStr || xpReward != null || gpReward != null) && event.status === "active") {
      await interaction.editReply(
        "End date, XP reward, and GP reward can only be edited on completed events. Use `/event_end` to close an active event."
      );
      return;
    }

    if (!name && !eventType && !tier && !startDateStr && !endDateStr && xpReward == null && gpReward == null && !primaryDmUser) {
      await interaction.editReply(
        "Nothing to update. Provide at least one field to change."
      );
      return;
    }

    const fields = {};
    if (name) fields.name = name;
    if (eventType) fields.event_type = eventType;
    if (tier) fields.tier = tier;
    if (startDateStr) fields.start_date = startDateStr;
    if (endDateStr) fields.end_date = endDateStr;
    if (xpReward != null) fields.xp_reward = xpReward;
    if (gpReward != null) fields.gp_reward = gpReward;

    await guildService.updateEvent(eventId, fields);

    let newPrimaryDmLabel = null;
    if (primaryDmUser) {
      let dmMember;
      try {
        dmMember = await interaction.guild.members.fetch(primaryDmUser.id);
      } catch {
        await interaction.editReply("That user is no longer in the server.");
        return;
      }
      await guildService.setPrimaryDm(eventId, primaryDmUser.id, dmMember.displayName);
      newPrimaryDmLabel = `${primaryDmUser}`;
    }

    const updated = await guildService.getEvent(eventId);
    const startDate = updated.start_date.toISOString().split("T")[0];
    const endDate = updated.end_date ? updated.end_date.toISOString().split("T")[0] : null;

    const embedFields = [
      { inline: true, name: "Name", value: updated.name },
      { inline: true, name: "Type", value: updated.event_type },
      { inline: true, name: "Tier", value: updated.tier },
      { inline: true, name: "Start Date", value: startDate },
    ];
    if (endDate) embedFields.push({ inline: true, name: "End Date", value: endDate });
    if (updated.xp_reward != null) embedFields.push({ inline: true, name: "XP Reward", value: `${updated.xp_reward}` });
    if (updated.gp_reward != null) embedFields.push({ inline: true, name: "GP Reward", value: `${updated.gp_reward}` });
    embedFields.push({ inline: true, name: "Event ID", value: `${eventId}` });
    if (newPrimaryDmLabel) embedFields.push({ inline: true, name: "Primary DM", value: newPrimaryDmLabel });

    const embed = new EmbedBuilder()
      .setTitle("Event Updated")
      .setColor(XPHOLDER_COLOUR)
      .setFields(embedFields)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
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
};
