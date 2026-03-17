const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { getEventStats, getEvents, getEvent } = require("../db");

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
    const event = await getEvent(req.session.guildId, req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (error) {
    console.error("API event error:", error);
    res.status(500).json({ error: "Failed to load event" });
  }
});

module.exports = router;
