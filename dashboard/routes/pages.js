const express = require("express");
const router = express.Router();
const { requireAuth, requireLogin } = require("../middleware/auth");
const { getRegisteredGuilds, getGuildConfig, getEventStats, getEvents, getEvent, hasEventsTable, getActivePcStats, getDmStats, hasPlayersTable, getPlayerStats, searchPlayersAndCharacters, getPlayerDetail, getPlayerHistoryByName } = require("../db");
const { playerName } = require("../../xpholder/utils/playerName");

router.get("/", requireAuth, async (req, res) => {
  try {
    const hasEvents = await hasEventsTable(req.session.guildId);
    if (!hasEvents) {
      return res.render("no-events", { message: "Event tables not found. Run /apply_registration_update in Discord." });
    }
    const hasPlayers = await hasPlayersTable(req.session.guildId);
    if (!hasPlayers) {
      return res.render("no-events", { message: "Player tracking not enabled. Run /apply_registration_update in Discord." });
    }

    const { range, from, to } = req.query;
    const dateRange = {};
    const today = new Date().toISOString().split("T")[0];

    if (range === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      dateRange.from = d.toISOString().split("T")[0];
    } else if (range === "1y") {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      dateRange.from = d.toISOString().split("T")[0];
    } else if (range === "custom") {
      if (from) dateRange.from = from;
      if (to) dateRange.to = to;
    }
    // "all" or no range = no date filter

    const [stats, activePcStats, playerStats] = await Promise.all([
      getEventStats(req.session.guildId, dateRange),
      getActivePcStats(req.session.guildId),
      getPlayerStats(req.session.guildId),
    ]);

    res.render("index", {
      stats,
      activePcStats,
      playerStats,
      activeRange: range || "all",
      customFrom: from || "",
      customTo: to || "",
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.render("error", { message: "Failed to load dashboard." });
  }
});

router.get("/events", requireAuth, async (req, res) => {
  try {
    const status = req.query.status || null;
    const perPage = req.query.per_page === "all" ? null : parseInt(req.query.per_page) || 100;
    const page = parseInt(req.query.page) || 1;
    const sort = req.query.sort || "desc"; // "asc" or "desc" for start_date

    const { events, totalCount } = await getEvents(req.session.guildId, status, {
      limit: perPage,
      offset: perPage ? (page - 1) * perPage : 0,
      sortDir: sort,
    });

    const totalPages = perPage ? Math.ceil(totalCount / perPage) : 1;

    res.render("events", {
      events,
      statusFilter: status || "all",
      perPage: perPage || "all",
      page,
      totalPages,
      totalCount,
      sort,
    });
  } catch (error) {
    console.error("Events list error:", error);
    res.render("error", { message: "Failed to load events." });
  }
});

router.get("/event/:id", requireAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) {
      return res.render("error", { message: "Invalid event ID." });
    }
    const event = await getEvent(req.session.guildId, eventId);
    if (!event) {
      return res.render("error", { message: "Event not found." });
    }
    res.render("event-detail", { event });
  } catch (error) {
    console.error("Event detail error:", error);
    res.render("error", { message: "Failed to load event." });
  }
});

router.get("/dms", requireAuth, async (req, res) => {
  try {
    const hasTable = await hasEventsTable(req.session.guildId);
    if (!hasTable) {
      return res.render("no-events", { message: "Event tables not found. Run /apply_registration_update in Discord." });
    }

    const { range, from, to } = req.query;
    const dateRange = {};
    if (range === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      dateRange.from = d.toISOString().split("T")[0];
    } else if (range === "1y") {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      dateRange.from = d.toISOString().split("T")[0];
    } else if (range === "custom") {
      if (from) dateRange.from = from;
      if (to) dateRange.to = to;
    }

    const dmStats = await getDmStats(req.session.guildId, dateRange);
    // Pre-format DM names for chart labels (EJS templates handle table display)
    const formattedDmStats = dmStats.map((dm) => ({
      ...dm,
      username: playerName(dm.username, null) || dm.username,
    }));
    res.render("dms", {
      dmStats: formattedDmStats,
      activeRange: range || "all",
      customFrom: from || "",
      customTo: to || "",
    });
  } catch (error) {
    console.error("DMs page error:", error);
    res.render("error", { message: "Failed to load DM stats." });
  }
});

router.get("/active-pcs", requireAuth, async (req, res) => {
  try {
    const hasTable = await hasEventsTable(req.session.guildId);
    if (!hasTable) {
      return res.render("no-events", { message: "Event tables not found. Run /apply_registration_update in Discord." });
    }
    const stats = await getActivePcStats(req.session.guildId);
    const playerStats = await getPlayerStats(req.session.guildId);
    res.render("active-pcs", { stats, playerStats });
  } catch (error) {
    console.error("Active PCs error:", error);
    res.render("error", { message: "Failed to load active PC stats." });
  }
});

router.get("/players", requireAuth, async (req, res) => {
  try {
    const hasTable = await hasPlayersTable(req.session.guildId);
    if (!hasTable) {
      return res.render("no-events", { message: "Player tracking not enabled. Run /apply_registration_update in Discord." });
    }

    const q = (req.query.q || "").trim();
    const searchResults = q.length >= 2
      ? await searchPlayersAndCharacters(req.session.guildId, q)
      : null;

    res.render("players", { q, searchResults });
  } catch (error) {
    console.error("Players page error:", error);
    res.render("error", { message: "Failed to load players." });
  }
});

router.get("/player/:id", requireAuth, async (req, res) => {
  try {
    const playerId = req.params.id;
    if (!/^\d+$/.test(playerId)) {
      return res.render("error", { message: "Invalid player ID." });
    }

    const hasTable = await hasPlayersTable(req.session.guildId);
    if (!hasTable) {
      return res.render("no-events", { message: "Player tracking not enabled. Run /apply_registration_update in Discord." });
    }

    const detail = await getPlayerDetail(req.session.guildId, playerId);
    if (!detail) {
      return res.render("error", { message: "Player not found." });
    }

    const historyByName = await getPlayerHistoryByName(req.session.guildId, playerId);

    const currentNames = new Set(detail.pcs.map((pc) => pc.name));
    const pcs = detail.pcs.map((pc) => ({
      ...pc,
      history: historyByName.get(pc.name) || [],
    }));
    const pastCharacters = [];
    for (const [name, events] of historyByName) {
      if (!currentNames.has(name)) {
        pastCharacters.push({ name, events });
      }
    }
    // Each character's events are already start_date DESC from the SQL,
    // so events[0] is the most recent. Sort characters by that date, newest first.
    pastCharacters.sort((a, b) => b.events[0].start_date - a.events[0].start_date);

    res.render("player-detail", {
      player: detail.player,
      pcs,
      pastCharacters,
    });
  } catch (error) {
    console.error("Player detail error:", error);
    res.render("error", { message: "Failed to load player." });
  }
});

router.get("/select-guild", requireLogin, async (req, res) => {
  try {
    const registeredGuildIds = await getRegisteredGuilds();
    const userGuilds = req.session.userGuilds || [];
    const availableGuilds = userGuilds.filter((g) =>
      registeredGuildIds.includes(g.id)
    );

    if (availableGuilds.length === 1) {
      const guild = availableGuilds[0];
      const moderationRoleId = await getGuildConfig(guild.id, "moderationRoleId");

      if (moderationRoleId && process.env.NODE_ENV !== "test") {
        const DISCORD_API = "https://discord.com/api/v10";
        const memberRes = await fetch(
          `${DISCORD_API}/guilds/${guild.id}/members/${req.session.user.id}`,
          { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
        );

        if (memberRes.ok) {
          const member = await memberRes.json();
          if (!member.roles.includes(moderationRoleId)) {
            return res.render("unauthorized");
          }
        } else {
          return res.render("unauthorized");
        }
      }

      req.session.guildId = guild.id;
      req.session.guildName = guild.name;
      return res.redirect("/");
    }

    res.render("select-guild", { guilds: availableGuilds });
  } catch (error) {
    console.error("Guild selection error:", error);
    res.render("error", { message: "Failed to load guilds." });
  }
});

router.post("/select-guild", requireLogin, async (req, res) => {
  const { guildId } = req.body;

  // Validate guildId is strictly numeric (prevents SQL injection via schema name)
  if (!guildId || !/^\d+$/.test(guildId)) {
    return res.render("error", { message: "Invalid guild." });
  }

  // Look up guild name from the user's known guilds, not from untrusted form body
  const userGuilds = req.session.userGuilds || [];
  const guild = userGuilds.find((g) => g.id === guildId);
  if (!guild) {
    return res.render("unauthorized");
  }

  // Check if user has mod role for this guild
  const moderationRoleId = await getGuildConfig(guildId, "moderationRoleId");

  if (moderationRoleId) {
    const DISCORD_API = "https://discord.com/api/v10";
    const memberRes = await fetch(
      `${DISCORD_API}/guilds/${guildId}/members/${req.session.user.id}`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }
    );

    if (memberRes.ok) {
      const member = await memberRes.json();
      if (!member.roles.includes(moderationRoleId)) {
        return res.render("unauthorized");
      }
    } else {
      return res.render("unauthorized");
    }
  }

  req.session.guildId = guildId;
  req.session.guildName = guild.name;
  res.redirect("/");
});

module.exports = router;
