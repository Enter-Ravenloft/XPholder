const { SlashCommandBuilder } = require("@discordjs/builders");

const { logError } = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("temp_update_registration")
    .setDescription(
      "Creates tables that may not have existed from the original registration"
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
    await interaction.editReply("Creating Additional Tables!");
    try {
      await guildService.tempUpdateRegistration();
    } catch (err) {
      await logError(interaction, err);
      return;
    }

    await interaction.editReply("Update Successful!");
  },
};
