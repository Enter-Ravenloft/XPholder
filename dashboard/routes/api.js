const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { getEventStats, getEvents, getEvent, hasPlayersTable, searchPlayersAndCharacters } = require("../db");

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const stats = await getEventStats(req.session.guildId);
    res.json(stats);
  } catch (error) {
    console.error("API stats error:", error);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/events", requireAuth, async (req, res) => {
  try {
    const status = req.query.status || null;
    const events = await getEvents(req.session.guildId, status);
    res.json(events);
  } catch (error) {
    console.error("API events error:", error);
    res.status(500).json({ error: "Failed to load events" });
  }
});

router.get("/event/:id", requireAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ error: "Invalid event ID" });
    const event = await getEvent(req.session.guildId, eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (error) {
    console.error("API event error:", error);
    res.status(500).json({ error: "Failed to load event" });
  }
});

// Returns the search-results HTML fragment for the typeahead on /players.
// Renders the same partial used by the page's initial server render, so
// there's a single source of truth for the result markup.
router.get("/players/search", requireAuth, async (req, res) => {
  try {
    const hasTable = await hasPlayersTable(req.session.guildId);
    if (!hasTable) return res.status(503).send("");
    const q = (req.query.q || "").trim();
    const searchResults = q.length >= 2
      ? await searchPlayersAndCharacters(req.session.guildId, q)
      : null;
    res.render("partials/players-search-results", { q, searchResults });
  } catch (error) {
    console.error("API players/search error:", error);
    res.status(500).send("");
  }
});

module.exports = router;
