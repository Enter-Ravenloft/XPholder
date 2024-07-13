const { evaluateCharacterTierRoles } = require("./roleManagement");
async function setCharacterXP(player, character, guildService) {
  /*
    character - schema :
        character_id   : STRING
        character_index: NUMBER
        name           : STRING
        sheet_url      : STRING
        picture_url    : STRING
        player_id      : STRING
        xp             : NUMBER
  */
  const characterSchema = {
    character_id: character["character_id"],
    character_index: character["character_index"],
    player_id: character["player_id"],
    xp: character["xp"],
  };

  await guildService.setCharacterXP(characterSchema);
  await evaluateCharacterTierRoles(player, guildService);
}

async function updateCharacterXP(player, character, delta, guildService) {
  await guildService.updateCharacterXP(character, delta);
  await evaluateCharacterTierRoles(player, guildService);
}

module.exports = {
  setCharacterXP,
  updateCharacterXP,
};
