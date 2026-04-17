const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { XPHOLDER_COLOUR } = require("../../config.json");
const { isValidYmd } = require("../../utils/validation");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event_start")
    .setDescription("Creates A New Event! [ MOD ]")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("The Name Of The Event")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("event_type")
        .setDescription("The Type Of Event")
        .addChoices(
          { name: "Mission", value: "Mission" },
          { name: "Adventure", value: "Adventure" },
          { name: "Skirmish", value: "Skirmish" },
          { name: "Arena", value: "Arena" },
          { name: "Discourse", value: "Discourse" },
          { name: "Arc Quest", value: "Arc Quest" }
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("The Tier / Level Bracket")
        .addChoices(
          { name: "3-4", value: "3-4" },
          { name: "5-7", value: "5-7" },
          { name: "8-10", value: "8-10" },
          { name: "11-13", value: "11-13" },
          { name: "14-16", value: "14-16" },
          { name: "17-20", value: "17-20" },
          { name: "Open", value: "Open" }
        )
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("primary_dm")
        .setDescription("The Primary DM (defaults to you)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("start_date")
        .setDescription("Start Date (YYYY-MM-DD). Defaults to today.")
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

    const name = interaction.options.getString("name");
    const eventType = interaction.options.getString("event_type");
    const tier = interaction.options.getString("tier");
    const dmUser = interaction.options.getUser("primary_dm") || interaction.user;
    const dmMember = await interaction.guild.members.fetch(dmUser.id);
    const startDateStr = interaction.options.getString("start_date");
    if (startDateStr && !isValidYmd(startDateStr)) {
      await interaction.editReply(
        "Invalid `start_date`. Use `YYYY-MM-DD` (e.g. `2026-04-15`)."
      );
      return;
    }
    const startDate = startDateStr || new Date().toISOString().split("T")[0];

    const eventId = await guildService.createEvent(
      name,
      eventType,
      tier,
      startDate,
      dmUser.id,
      dmMember.displayName
    );

    const embed = new EmbedBuilder()
      .setTitle("Event Created")
      .setColor(XPHOLDER_COLOUR)
      .setFields(
        { inline: true, name: "Name", value: name },
        { inline: true, name: "Type", value: eventType },
        { inline: true, name: "Tier", value: tier },
        { inline: true, name: "Start Date", value: startDate },
        { inline: true, name: "DM", value: `${dmUser}` },
        { inline: true, name: "Event ID", value: `${eventId}` }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
