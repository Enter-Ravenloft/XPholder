const { SlashCommandBuilder } = require("@discordjs/builders");

const { logError } = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("apply_registration_update")
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
      interaction.user.id != interaction.guild.ownerId &&
      !guildService.isDev(interaction.member._roles)
    ) {
      await interaction.editReply(
        "Sorry, but you are not the owner of the server, and can not use this command."
      );
      return;
    }
    await interaction.editReply("Creating Additional Tables!");
    try {
      await guildService.updateRegistration();
    } catch (err) {
      await logError(interaction, err);
      return;
    }

    await interaction.editReply("Update Successful!");
  },
};
