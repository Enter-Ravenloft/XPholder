const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit_tiers")
    .setDescription("Adds / Removes Roles From Server Database! [ MOD ]")

    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("A Role To Be Added / Removed")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("bonus")
        .setDescription(
          "Multiplyer To Awareded XP ( negatives remove from database )"
        )
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("minimum_level")
        .setDescription("First level of the tier")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("maximum_level")
        .setDescription(
          "Last level of the tier (must be equal to or larger than minimum_level)"
        )
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("public")
        .setDescription("Show This Command To Everyone?")
        .setRequired(false)
    ),
  async execute(guildService, interaction) {
    /*
        ----------
        VALIDATION
        ----------
        */

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

    /*
        --------------
        INITALIZATIONS
        --------------
        */
    const role = interaction.options.getRole("role");
    const bonus = interaction.options.getInteger("bonus");
    const minimumLevel = interaction.options.getInteger("minimum_level");
    const maximumLevel = interaction.options.getInteger("maximum_level");
    await guildService.updateCharacterTier(
      role.id,
      bonus,
      minimumLevel,
      maximumLevel
    );

    await interaction.editReply("Success!");
  },
};
