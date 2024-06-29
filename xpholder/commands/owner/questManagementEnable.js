const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require("discord.js");

const {
  XPHOLDER_COLOUR,
  XPHOLDER_ICON_URL,
  DEV_SERVER_URL,
  XPHOLDER_LEVEL_UP_COLOUR,
  XPHOLDER_RETIRE_COLOUR,
} = require("../../config.json");
const {
  getLevelInfo,
  getProgressionBar,
  awardCXPs,
  isAuthorizedRole,
} = require("../../utils");
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

    /*
        --------------
        INITALIZATIONS
        --------------
        */

    let character = await guildService.getCharacter(
      `${player.id}-${characterId}`
    );
    let awardChannel;

    // some more inits
    const oldXp = character["xp"];
    const oldLevelInfo = getLevelInfo(guildService.levels, oldXp);

    /*
        ----------------
        UPDATE CHARACTER
        ----------------
        character - schema :
            character_id   : STRING
            character_index: NUMBER
            name           : STRING
            sheet_url      : STRING
            picture_url    : STRING
            player_id      : STRING
            xp             : NUMBER
        */
    // const characterSchema = {
    //   character_id: character["character_id"],
    //   character_index: character["character_index"],
    //   player_id: character["player_id"],
    //   xp: character["xp"],
    // };

    // await guildService.setCharacterXP(characterSchema);
  },
  async autocomplete(guildService, interaction) {
    const focusedValue = interaction.options.getFocused();

    if (!interaction.options.get("player")) {
      return;
    }

    const targetUserId = interaction.options.get("player").value;
    const characters = await guildService.getAllCharacters(targetUserId);
    const choices = [];
    characters.forEach((character) =>
      choices.push([character.name, character.character_index])
    );

    const filtered = choices.filter((choice) =>
      choice[0].toLowerCase().startsWith(focusedValue.toLowerCase())
    );
    await interaction.respond(
      filtered.map((choice) => ({ name: choice[0], value: choice[1] }))
    );
  },
};
