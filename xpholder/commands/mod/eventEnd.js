const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_APPROVE_COLOUR } = require("../../config.json");
const { isValidYmd } = require("../../utils/validation");
const { playerName } = require("../../utils/playerName");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_end")
    .setDescription("Marks An Event As Completed! [ MOD ]")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("The Event To End")
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("end_date")
        .setDescription("End Date (YYYY-MM-DD). Defaults to today.")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("xp_reward")
        .setDescription("XP reward for completing this event")
        .setMinValue(0)
        .setMaxValue(1000000)
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("gp_reward")
        .setDescription("GP reward for completing this event")
        .setMinValue(0)
        .setMaxValue(1000000)
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
    const endDateStr = interaction.options.getString("end_date");
    if (endDateStr && !isValidYmd(endDateStr)) {
      await interaction.editReply(
        "Invalid `end_date`. Use `YYYY-MM-DD` (e.g. `2026-04-15`)."
      );
      return;
    }
    const endDate = endDateStr || new Date().toISOString().split("T")[0];
    const xpReward = interaction.options.getInteger("xp_reward");
    const gpReward = interaction.options.getInteger("gp_reward");

    const event = await guildService.getEvent(eventId);
    if (!event) {
      await interaction.editReply("Sorry, that event does not exist.");
      return;
    }
    if (event.status !== "active") {
      await interaction.editReply("That event is already completed.");
      return;
    }

    await guildService.endEvent(eventId, endDate, xpReward, gpReward);

    const participants = await guildService.getEventParticipants(eventId);
    const dms = await guildService.getEventDms(eventId);

    const participantList = participants.length > 0
      ? participants.map((p) => {
          const level = p.starting_level > 1 || p.starting_xp > 0 ? ` (Lvl ${p.starting_level})` : "";
          return `${p.character_name}${level}`;
        }).join("\n")
      : "None";
    const sortedDms = [...dms].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    const dmList = sortedDms.map((d) => playerName(d.username, null) || d.username).join(", ");

    const embed = new EmbedBuilder()
      .setTitle("Event Completed")
      .setColor(XPHOLDER_APPROVE_COLOUR)
      .setFields(
        { inline: true, name: "Event", value: event.name },
        { inline: true, name: "Type", value: event.event_type },
        { inline: true, name: "Tier", value: event.tier },
        { inline: true, name: "Start", value: event.start_date.toISOString().split("T")[0] },
        { inline: true, name: "End", value: endDate },
        { inline: true, name: "DMs", value: dmList },
        { inline: true, name: "XP Reward", value: xpReward != null ? `${xpReward}` : "—" },
        { inline: true, name: "GP Reward", value: gpReward != null ? `${gpReward}` : "—" },
        { inline: false, name: `Participants (${participants.length})`, value: participantList }
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
