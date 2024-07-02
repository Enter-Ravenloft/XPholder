const awards = require("./xp");
const mappings = require("./mapping");
const getters = require("./getters");
const characterEmbed = require("./characterEmbed");
const logging = require("./logging");
const roleManagement = require("./roleManagement");
const characterManagement = require("./characterManagement");

/*
--------
SECURITY
--------
*/

function sqlInjectionCheck(myString) {
  return (
    myString.includes("`") ||
    myString.includes("'") ||
    myString.includes('"') ||
    myString.includes(";") ||
    myString.includes(",") ||
    myString.toLowerCase().includes("drop") ||
    myString.toLowerCase().includes("delete") ||
    myString.toLowerCase().includes("remove") ||
    myString.toLowerCase().includes("update") ||
    myString.toLowerCase().includes("create") ||
    myString.toLowerCase().includes("insert")
  );
}
function isAuthorizedRole(guildService, interaction, XPHolderRole) {
  switch (XPHolderRole) {
    case "everyone":
      return true;
    case "mod":
      if (guildService.isMod(interaction.member._roles)) {
        return true;
      }
    case "owner":
      if (interaction.user.id === interaction.guild.ownerId) {
        return true;
      }
    default:
      return (
        guildService.isDev(interaction.member._roles) &&
        process.env.NODE_ENV === "test"
      );
  }
}
module.exports = {
  ...awards,
  ...characterEmbed,
  ...characterManagement,
  ...getters,
  ...logging,
  ...mappings,
  ...roleManagement,
  isAuthorizedRole,
  sqlInjectionCheck,
};
