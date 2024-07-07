const { SlashCommandBuilder } = require("@discordjs/builders");
const { isAuthorizedRole } = require("../../utils");
const { autocomplete } = require("./awardXp");
const commandLevel = "mod";
module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit_quest_statuses")
    .setDescription("Adds / Removes Quest Status From Database! [ MOD ]")

    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Name of the quest status")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("description")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("delete")
        .setDescription("Delete an existing quest status with the given name?")
        .setRequired(false)
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
    const isAuthorized = await isAuthorizedRole(
      guildService,
      interaction,
      commandLevel
    );
    if (!isAuthorized) {
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

    const questType = interaction.options.getString("status");
    let res;
    if (interaction.options.getBoolean("delete")) {
      res = await guildService.deleteQuestStatus(questType);
    } else {
      const typeDescription = interaction.options.getString("description");
      res = await guildService.updateQuestStatus(questType, typeDescription);
    }

    await interaction.editReply(res.toString());
  },
  async autocomplete(guildService, interaction) {
    const option = interaction.options.getFocused(true);
    switch (option.name) {
      case "status":
        const choices = guildService.getQuestStatusAutocomplete(option.value);
        await interaction.respond(choices);
        break;
    }
  },
};
