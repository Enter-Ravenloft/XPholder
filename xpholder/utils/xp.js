function awardCXPs(startingXp, cxp, levels) {
  for (; cxp > 0; cxp--) {
    startingXp += awardCXP(startingXp, levels);
  }
  return startingXp;
}

function awardCXP(xp, levels) {
  const levelInfo = getLevelInfo(levels, xp);

  if (parseInt(levelInfo["level"]) < 4) {
    return levelInfo["xpToNext"] / 4;
  }
  return levelInfo["xpToNext"] / 8;
}

function calculateXp(awardType, character, levels, value) {
  switch (awardType) {
    case "set_level":
      let newXp = 0;
      for (const [level, xp] of Object.entries(levels)) {
        if (parseInt(level) < value) {
          newXp += xp;
        }
      }
      return newXp;
    case "set_xp":
      return value;
    case "give_xp":
      return character["xp"] + value;
    case "set_cxp":
      return awardCXPs(0, value, levels);
    case "give_cxp":
      return awardCXPs(character["xp"], value, levels);
      break;
  }
}

module.exports = {
  calculateXp,
};
