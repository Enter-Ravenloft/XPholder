const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR } = require("../../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_list")
    .setDescription("Lists Events!")
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Filter By Status")
        .addChoices(
          { name: "Active", value: "active" },
          { name: "Completed", value: "completed" },
          { name: "All", value: "all" }
        )
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

    const statusFilter = interaction.options.getString("status") || "active";
    const status = statusFilter === "all" ? null : statusFilter;

    const events = await guildService.getEvents(status);

    if (events.length === 0) {
      await interaction.editReply(
        `No ${statusFilter} events found.`
      );
      return;
    }

    const eventLines = events.slice(0, 25).map((e) => {
      const statusEmoji = e.status === "active" ? "🟢" : "✅";
      const startDate = e.start_date.toISOString().split("T")[0];
      return `${statusEmoji} **${e.name}** — ${e.event_type} | ${e.tier} | ${startDate}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`Events (${statusFilter})`)
      .setDescription(eventLines.join("\n"))
      .setColor(XPHOLDER_COLOUR)
      .setFooter({ text: `Showing ${Math.min(events.length, 25)} of ${events.length} events` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
