const { SlashCommandBuilder } = require("@discordjs/builders");
const { isAuthorizedRole } = require("../../utils");
const { autocomplete } = require("./awardXp");
const commandLevel = "mod";
module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit_quest_types")
    .setDescription("Adds / Removes Quest Type From Database! [ MOD ]")

    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Name of the quest type")
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
        .setDescription("Delete an existing quest type with the given name?")
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

    const questType = interaction.options.getString("type");
    let res;
    if (interaction.options.getBoolean("delete")) {
      res = await guildService.deleteQuestType(questType);
    } else {
      const typeDescription = interaction.options.getString("description");
      res = await guildService.updateQuestType(questType, typeDescription);
    }

    await interaction.editReply(res.toString());
  },
  async autocomplete(guildService, interaction) {
    const option = interaction.options.getFocused(true);
    switch (option.name) {
      case "type":
        const choices = guildService.getQuestTypeAutocomplete(option.value);
        await interaction.respond(choices);
        break;
    }
  },
};
