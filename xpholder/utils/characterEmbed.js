const { EmbedBuilder } = require("discord.js");
const { getLevelInfo, getRoleMultiplier, getTier } = require("./getters");
const {
  DEV_SERVER_URL,
  XPHOLDER_ICON_URL,
  XPHOLDER_COLOUR,
  XPHOLDER_LEVEL_UP_COLOUR,
} = require("../config.json");
function buildCharacterEmbed(guildService, player, characterObj) {
  /*
      Parameters
      ----------
      guildService : object
          /services/guild.js
  
      player : object
          GuildMember - https://discord.js.org/#/docs/discord.js/main/class/GuildMember
  
      characterObj : object
      {
          "character_id"   : player_id-character_index
          "character_index": 0 -> 10
          "name"           : "My Character"
          "sheet_url"      : "https://www.dndbeyond.com"
          "picture_url"    : "picture url"
          "player_id"      : "881210880887513139"
          "xp"             : 0
      }
  
      Returns
      -------
      characterEmbed : obj
          https://discord.js.org/#/docs/builders/main/class/EmbedBuilder
      */
  // { "level" : STRING, "levelXp" : NUMBER, "xpToNext" : NUMBER }
  const levelInfo = getLevelInfo(guildService.levels, characterObj["xp"]);

  const progress = getProgressionBar(
    levelInfo["levelXp"],
    levelInfo["xpToNext"]
  );
  let tierInfo = getTier(parseInt(levelInfo["level"]));
  const roleBonus = getRoleMultiplier(
    guildService.config["roleBonus"],
    guildService.roles,
    player._roles
  );

  let characterEmbed = new EmbedBuilder()
    .setTitle(characterObj["name"])
    .setThumbnail(
      characterObj["picture_url"] != "" &&
        characterObj["picture_url"] !== "null"
        ? characterObj["picture_url"]
        : XPHOLDER_ICON_URL
    )
    .setFields(
      { inline: true, name: "Level", value: `${levelInfo["level"]}` },
      { inline: true, name: "Role Boost", value: `${roleBonus}` },
      {
        inline: true,
        name: "Current Tier",
        value: `<@&${guildService.config[`tier${tierInfo["tier"]}RoleId`]}>`,
      },

      {
        inline: true,
        name: "Total Character XP",
        value: `${Math.floor(characterObj["xp"])}`,
      },
      {
        inline: true,
        name: "Current Level XP",
        value: `${Math.floor(levelInfo["levelXp"])}`,
      },
      {
        inline: true,
        name: "Next Level XP",
        value: `${Math.floor(levelInfo["xpToNext"])}`,
      },

      { inline: false, name: `Progress`, value: `${progress}` },

      { inline: true, name: "Player ID", value: `${player.id}` },
      {
        inline: true,
        name: "Character No.",
        value: `${characterObj["character_index"]}`,
      }
    )
    .setFooter({
      text: `Dont Like What You See? Try /edit_character (${characterObj["character_index"]}/${guildService.config["characterCount"]})`,
    })
    .setColor(XPHOLDER_COLOUR);

  if (characterObj["sheet_url"] != "") {
    characterEmbed.setURL(characterObj["sheet_url"]);
  }
  return characterEmbed;
}

function getProgressionBar(xp, xpToNext) {
  /*
      Parameters
      ----------
      xp : number
      0
  
      xpToNext : number
      0
  
      Returns
      -------
      progressMessage : string
      |█████----------| 33% Complete
      */
  let progressMessage = "```|";
  const progress = xp / xpToNext;

  for (let i = 0; i < Math.round(progress * 15); i++) {
    progressMessage += "█";
  }
  for (let i = 0; i < Math.round((1 - progress) * 15); i++) {
    progressMessage += "-";
  }
  progressMessage += `| ${Math.round(progress * 100)}% Complete\`\`\``;

  return progressMessage;
}
function getEmbedLevelSettings(newLevelInfo, oldLevelInfo) {
  let levelFieldName = "Level";
  let levelFieldValue = newLevelInfo["level"];
  let color = XPHOLDER_COLOUR;
  // determining if the player is a different level than before
  if (oldLevelInfo["level"] != newLevelInfo["level"]) {
    levelFieldName = "Level Up!";
    levelFieldValue = `${oldLevelInfo["level"]} --> **${newLevelInfo["level"]}**`;
    color = XPHOLDER_LEVEL_UP_COLOUR;
  }
  return {
    levelField: { inline: true, name: levelFieldName, value: levelFieldValue },
    color,
  };
}
function buildXPEmbed(
  title = "",
  character = {},
  fields = [],
  color = "",
  memo = ""
) {
  const awardEmbed = new EmbedBuilder()
    .setDescription(memo)
    .setFooter({
      text: `Like the bot? Click the title to visit the dev server!`,
    })
    .setThumbnail(
      character["picture_url"] != "" && character["picture_url"] !== "null"
        ? character["picture_url"]
        : XPHOLDER_ICON_URL
    )
    .setURL(DEV_SERVER_URL);
  awardEmbed.setTitle(title);
  awardEmbed.setFields(...fields);
  if (color) {
    awardEmbed.setColor;
  }
  return awardEmbed;
}

module.exports = {
  buildCharacterEmbed,
  buildXPEmbed,
  getEmbedLevelSettings,
  getProgressionBar,
};
