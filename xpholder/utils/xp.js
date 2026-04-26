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
  }
}

module.exports = {
  calculateXp,
};
