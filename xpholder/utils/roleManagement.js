const { getLevelInfo } = require("./getters");

async function evaluateCharacterTierRoles(player, guildService) {
  const tiers = guildService.characterTiers;
  const tierRoles = tiers.map((tierRole) => tierRole["role_id"]);
  const relevantRoles = player.roles.cache.filter((role) =>
    tierRoles.includes(role.id)
  );

  const playerCharacters = await guildService.getAllCharacters(player.id);
  const neededRoles = [];
  for (const character of playerCharacters) {
    const levelInfo = getLevelInfo(guildService.levels, character["xp"]);
    const tier = tiers.find(
      (tier) =>
        tier["minimum_level"] <= levelInfo.level &&
        tier["maximum_level"] >= levelInfo.level
    );
    if (tier) {
      neededRoles.push(tier["role_id"]);
    }
  }
  const uniqueRoles = neededRoles.filter(
    (value, index, array) => array.indexOf(value) === index
  );
  const rolesToRemove = relevantRoles.filter(
    (role) => !uniqueRoles.includes(role)
  );
  const rolesToAdd = uniqueRoles.filter(
    (role) => ![...relevantRoles.values()].includes(role)
  );

  const playerWithoutRoles = await player.roles.remove(rolesToRemove);
  await playerWithoutRoles.roles.add(rolesToAdd);
}

module.exports = {
  evaluateCharacterTierRoles,
};
