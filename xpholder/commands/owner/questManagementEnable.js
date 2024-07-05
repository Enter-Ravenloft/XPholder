const { SlashCommandBuilder } = require("@discordjs/builders");

const { isAuthorizedRole } = require("../../utils");
const commandLevel = "owner";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quest_management_enable")
    .setDescription("Enables Quest management commands")
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

    if (!isAuthorizedRole(guildService, interaction, commandLevel)) {
      await interaction.editReply(
        "Sorry, you do not have the right role to use this command."
      );
      return;
    }
    const { message } = await guildService.createQuestManagementTables();
    await interaction.editReply(message);
  },
};
