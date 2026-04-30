async function resolveEventId(guildService, raw, statusFilter = "active") {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  // Fast path: clean integer string. Reject partial-numeric prefixes like "42 hello".
  const parsed = parseInt(trimmed, 10);
  if (Number.isInteger(parsed) && String(parsed) === trimmed) {
    return { eventId: parsed, name: null, fromFallback: false };
  }

  // Fallback: exact-name lookup against the given status. Single match wins; ambiguous fails closed.
  const matches = await guildService.searchEventsExact(trimmed, statusFilter);
  if (matches.length === 1) {
    return { eventId: matches[0].event_id, name: matches[0].name, fromFallback: true };
  }
  return null;
}

module.exports = { resolveEventId };
