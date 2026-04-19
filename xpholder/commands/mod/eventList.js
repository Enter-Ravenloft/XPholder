const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR } = require("../../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("events_active")
    .setDescription("Lists Active Events! [ MOD ]")
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

    const events = await guildService.getEvents("active");

    if (events.length === 0) {
      await interaction.editReply("No active events found.");
      return;
    }

    const eventLines = [];
    for (const e of events.slice(0, 25)) {
      const dms = await guildService.getEventDms(e.event_id);
      const primaryDm = dms.find((d) => d.is_primary);
      const dmName = primaryDm ? primaryDm.username : "Unknown";
      const startDate = e.start_date.toISOString().split("T")[0];
      eventLines.push(`🟢 **${e.name}** ${e.event_type} | ${e.tier} | ${startDate} | DM: ${dmName}`);
    }

    const embed = new EmbedBuilder()
      .setTitle("Active Events")
      .setDescription(eventLines.join("\n"))
      .setColor(XPHOLDER_COLOUR)
      .setFooter({ text: `${Math.min(events.length, 25)} of ${events.length} active events` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
