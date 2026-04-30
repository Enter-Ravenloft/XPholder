const { resolveEventId } = require("./resolveEventId");
const { logFallbackResolved } = require("./logging");

const ERROR_MSG =
  "Couldn't identify that event. Try running the command again from a fresh slash command (clear any pre-filled options), then pick from the dropdown.";

async function resolveEventOption(interaction, guildService, statusFilter = "active") {
  const raw = interaction.options.getString("event");
  const result = await resolveEventId(guildService, raw, statusFilter);

  if (result == null) {
    await interaction.editReply(ERROR_MSG);
    return null;
  }

  if (result.fromFallback) {
    try {
      await logFallbackResolved(interaction, raw, result.eventId, result.name);
    } catch (err) {
      console.error("logFallbackResolved failed:", err);
    }
  }

  return result.eventId;
}

module.exports = { resolveEventOption, ERROR_MSG };
