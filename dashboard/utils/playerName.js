function playerName(displayName, username) {
  if (!displayName && !username) return null;
  const name = displayName || username;
  if (name.startsWith("[")) {
    const bracketMatch = name.match(/^\[([^\]]+)\]/);
    if (bracketMatch) return bracketMatch[1].trim();
  }
  const segments = name.split(/[|¦│[\]{}《》]|[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}☃★♦♠♣♥✦✧❤♤]/u);
  let raw = segments[0].trim();
  if (!raw) raw = segments.find((s) => s.trim()) || name;
  raw = raw
    .replace(/\s*\(.*$/, "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿˢᵀᵁⱽᵂ]+.*$/, "")
    .replace(/-[^-\s]+$/, "")
    .trim();
  if (raw.includes(" ") && /\d|\b(UTC|EST|PST|CST|MST|GMT|CET|CEST|BST|AEST|AEDT|JST|IST)\b/i.test(raw)) {
    raw = raw.split(/\s+/)[0];
  }
  return raw || name;
}

module.exports = { playerName };
