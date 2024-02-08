const { SlashCommandBuilder } = require('@discordjs/builders');
const { sqlInjectionCheck, buildCharacterEmbed } = require("../../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit__other_character')
        .setDescription('Edit Another Player\'s Character [MOD]')
        .addUserOption(option => option
            .setName("player")
            .setDescription("The Player You Wish To Edit")
            .setRequired(true))
        .addIntegerOption(option => option
            .setName("character")
            .setDescription("Which Character You Want To Edit ( 1 -> 10 )")
            .setMinValue(1)
            .setMaxValue(10)
            .setAutocomplete(true)
            .setRequired(true))
        .addStringOption(option => option
            .setName("character_name")
            .setDescription("Name Of The Character")
            .setRequired(true))

        .addStringOption(option => option
            .setName("sheet_url")
            .setDescription("A Link To Their Character Sheet")
            .setRequired(false))
        .addStringOption(option => option
            .setName("picture_url")
            .setDescription("A Link To The Character Picture")
            .setRequired(false))

        .addBooleanOption(option => option
            .setName("public")
            .setDescription("Show This Command To Everyone?")
            .setRequired(false))
    ,
    async execute(guildService, interaction) {
        /*
        ----------
        VALIDATION
        ----------
        */

        if (!guildService.isMod(interaction.member._roles) 
            && interaction.user.id != interaction.guild.ownerId
            && !guildService.isDev(interaction.member._roles)) {
            await interaction.editReply("Sorry, you do not have the right role to use this command.");
            return;
        }

        /*
        --------------
        INITALIZATIONS
        --------------
        */
        const player = interaction.options.getUser("player");
        const characterNumber = interaction.options.getInteger("character");
        const name = interaction.options.getString("character_name");
        const sheetUrl = interaction.options.getString("sheet_url");
        const pictureUrl = interaction.options.getString("picture_url");

        const guild = interaction.member.guild
        const user = interaction.user;
#        const player = await guild.members.fetch(user.id);

        const character = await guildService.getCharacter(`${player.id}-${characterNumber}`);

        if (!character) {
            await interaction.editReply("Sorry, but that character does not exist");
            return
        }
        /*
        ----------------------------------------
        VALIDATING URLS ( MINIMIZE FISHY LINKS )
        ----------------------------------------
        */
        let characterSheet;
        if (sheetUrl) {
            if (!(
                sheetUrl.startsWith("https://ddb.ac/characters/") ||
                sheetUrl.startsWith("https://dicecloud.com/character/") ||
                sheetUrl.startsWith("https://v1.dicecloud.com/character/") ||
                sheetUrl.startsWith("https://www.dndbeyond.com/profile/") ||
                sheetUrl.startsWith("https://www.dndbeyond.com/characters/") ||
                sheetUrl.startsWith("https://docs.google.com/spreadsheets/")
            )) { characterSheet = ""; }
            else if (sqlInjectionCheck(sheetUrl)) {
                characterSheet = "";
            } else { characterSheet = sheetUrl; }
        } else { characterSheet = ""; }

        let characterUrl;
        if (pictureUrl) {
            if (sqlInjectionCheck(pictureUrl)) {
                characterUrl = null;
            } else { characterUrl = pictureUrl.startsWith("https") ? pictureUrl : ""; }
        } else { characterUrl = null; }

        let characterName;
        if (sqlInjectionCheck(name)) {
            characterName = "Character";
        } else { characterName = name; }

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
        const updatedCharacter = {
            "character_id": `${player.id}-${characterNumber}`,
            "character_index": `${characterNumber}`,
            "name": characterName,
            "sheet_url": characterSheet ? characterSheet : character["sheet_url"],
            "picture_url": characterUrl ? characterUrl : character["picture_url"],
            "player_id": player.id,
            "xp": character["xp"]
        }
        await guildService.updateCharacterInfo(updatedCharacter);

        const characterEmbed = buildCharacterEmbed(guildService, player, updatedCharacter, characterNumber)

        await interaction.editReply({ embeds: [characterEmbed] });

    }
}