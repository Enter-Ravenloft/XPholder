function resolveChannelId({ name, snapshot, aliases }) {
  if (!name) return null;
  if (aliases && aliases[name] !== undefined) {
    return aliases[name];
  }
  const lookup = name.toLowerCase();
  for (const [snapshotName, id] of Object.entries(snapshot || {})) {
    if (snapshotName.toLowerCase() === lookup) {
      return id;
    }
  }
  return null;
}

module.exports = { resolveChannelId };
