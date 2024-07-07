const { SlashCommandBuilder } = require("@discordjs/builders");

const { isAuthorizedRole, logError } = require("../../utils");
const commandLevel = "mod";
module.exports = {
  data: new SlashCommandBuilder()
    .setName("quest_create")
    .setDescription("Reqisters a new quest[ MOD ]")

    .addStringOption((option) =>
      option
        .setName("quest_name")
        .setDescription("The name of the quest")
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("rp_channel")
        .setDescription("The channel where RP will take place")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("quest_type")
        .setDescription("The Type of Quest")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addRoleOption((option) =>
      option
        .setName("tier")
        .setDescription("Baseline tier of the quest")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("min_level")
        .setDescription("Minimum level to join the quest")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("max_level")
        .setDescription("Maximum level to join the quest")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("dm_tokens")
        .setDescription("Does this quest use DM Tokens?")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("arc_tokens")
        .setDescription("Does this quest use arc tokens?")
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
    if (!isAuthorizedRole(guildService, interaction, commandLevel)) {
      await interaction.editReply(
        "Sorry, you do not have the right role to use this command."
      );
      return;
    }

    const questName = interaction.options.getString("quest_name");
    const rpChannel = interaction.options.getChannel("rp_channel");
    const questType = interaction.options.getInteger("quest_type");
    const dmTokens = interaction.options.getBoolean("dm_tokens");
    const arcTokens = interaction.options.getBoolean("arc_tokens");
    const dungeonMaster = interaction.user.id;
    const tier = interaction.options.get("tier").value;
    const minLevel = interaction.options.getInteger("min_level");
    const maxLevel = interaction.options.getInteger("max_level");

    const questObject = {
      name: questName,
      channel: rpChannel.id,
      dm: dungeonMaster,
      questType,
      dmTokens,
      arcTokens,
      tier,
      minLevel,
      maxLevel,
    };
    const newQuest = await guildService.createQuest(questObject);
    if (newQuest.length === 1) {
      const quest = newQuest.find((quest) => quest);
      await interaction.editReply(`Successfully created "${quest.quest_name}"!
The Quest ID is \`${quest.quest_id}\`. Save this ID for reference later.`);
    }
  },
  async autocomplete(guildService, interaction) {
    const option = interaction.options.getFocused(true);
    switch (option.name) {
      case "quest_type":
        const choices = guildService.getQuestTypeIdAutocomplete(option.value);
        await interaction.respond(choices);
        break;
    }
  },
};
