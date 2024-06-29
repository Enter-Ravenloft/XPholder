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

module.exports = {
  awardCXPs,
};
