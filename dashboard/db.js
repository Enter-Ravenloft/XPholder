const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function getRegisteredGuilds() {
  const res = await pool.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'guild%';`
  );
  return res.rows.map((r) => r.schema_name.replace("guild", ""));
}

function buildDateFilter(paramIndex, { from, to } = {}) {
  const conditions = [];
  const params = [];
  if (from) {
    conditions.push(`start_date >= $${paramIndex}`);
    params.push(from);
    paramIndex++;
  }
  if (to) {
    conditions.push(`start_date <= $${paramIndex}`);
    params.push(to);
    paramIndex++;
  }
  return { conditions, params, nextIndex: paramIndex };
}

async function getEventStats(guildId, dateRange = {}) {
  const schema = `guild${guildId}`;
  const { conditions, params } = buildDateFilter(1, dateRange);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const eventsRes = await pool.query(
    `SELECT
      COUNT(*) as total_events,
      COUNT(*) FILTER (WHERE status = 'active') as active_events,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_events
     FROM ${schema}.events ${where};`,
    params
  );

  // For participant/DM stats, join through events to apply date filter
  const eventJoinWhere = conditions.length > 0
    ? `WHERE e.${conditions.join(" AND e.")}`
    : "";

  const participantRes = await pool.query(
    `SELECT
      COUNT(DISTINCT ep.character_id) as total_participants,
      COALESCE(
        (SELECT AVG(cnt) FROM (
          SELECT COUNT(*) as cnt FROM ${schema}.event_participants ep2
          JOIN ${schema}.events e ON ep2.event_id = e.event_id
          ${eventJoinWhere}
          GROUP BY ep2.event_id
        ) sub),
        0
      ) as avg_party_size
     FROM ${schema}.event_participants ep
     JOIN ${schema}.events e ON ep.event_id = e.event_id
     ${eventJoinWhere};`,
    params
  );

  const dmRes = await pool.query(
    `SELECT ed.user_id, ed.username, COUNT(*) as event_count,
      COUNT(*) FILTER (WHERE ed.is_primary) as primary_count
     FROM ${schema}.event_dms ed
     JOIN ${schema}.events e ON ed.event_id = e.event_id
     ${eventJoinWhere}
     GROUP BY ed.user_id, ed.username
     ORDER BY event_count DESC
     LIMIT 10;`,
    params
  );

  const tierRes = await pool.query(
    `SELECT tier, COUNT(*) as count
     FROM ${schema}.events ${where}
     GROUP BY tier
     ORDER BY tier;`,
    params
  );

  const typeRes = await pool.query(
    `SELECT event_type, COUNT(*) as count
     FROM ${schema}.events ${where}
     GROUP BY event_type
     ORDER BY count DESC;`,
    params
  );

  return {
    ...eventsRes.rows[0],
    ...participantRes.rows[0],
    top_dms: dmRes.rows,
    events_by_tier: tierRes.rows,
    events_by_type: typeRes.rows,
  };
}

async function getEvents(guildId, status = null, { limit = null, offset = 0, sortDir = "desc" } = {}) {
  const schema = `guild${guildId}`;
  const dir = sortDir === "asc" ? "ASC" : "DESC";

  let whereClause = "";
  const params = [];
  let paramIdx = 1;

  if (status) {
    whereClause = `WHERE e.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  // Get total count
  const countRes = await pool.query(
    `SELECT COUNT(*) as total FROM ${schema}.events e ${whereClause};`,
    params
  );
  const totalCount = parseInt(countRes.rows[0].total);

  // Get paginated results
  let query = `
    SELECT e.*,
      (SELECT COUNT(*) FROM ${schema}.event_participants WHERE event_id = e.event_id) as participant_count,
      (SELECT string_agg(username, ', ') FROM ${schema}.event_dms WHERE event_id = e.event_id) as dm_names
    FROM ${schema}.events e
    ${whereClause}
    ORDER BY e.start_date ${dir}`;

  const dataParams = [...params];
  if (limit) {
    query += ` LIMIT $${paramIdx}`;
    dataParams.push(limit);
    paramIdx++;
    query += ` OFFSET $${paramIdx}`;
    dataParams.push(offset);
  }
  query += ";";

  const res = await pool.query(query, dataParams);
  return { events: res.rows, totalCount };
}

async function getEvent(guildId, eventId) {
  const schema = `guild${guildId}`;
  const eventRes = await pool.query(
    `SELECT * FROM ${schema}.events WHERE event_id = $1;`,
    [eventId]
  );
  if (eventRes.rows.length === 0) return null;

  const participantRes = await pool.query(
    `SELECT ep.*, c.name as character_name, c.player_id, c.xp as current_xp
     FROM ${schema}.event_participants ep
     JOIN ${schema}.characters c ON ep.character_id = c.character_id
     WHERE ep.event_id = $1
     ORDER BY ep.joined_at;`,
    [eventId]
  );

  const dmRes = await pool.query(
    `SELECT * FROM ${schema}.event_dms WHERE event_id = $1 ORDER BY is_primary DESC;`,
    [eventId]
  );

  return {
    ...eventRes.rows[0],
    participants: participantRes.rows,
    dms: dmRes.rows,
  };
}

async function hasEventsTable(guildId) {
  const schema = `guild${guildId}`;
  const res = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = 'events'
    );`,
    [schema]
  );
  return res.rows[0].exists;
}

async function getActivePcStats(guildId) {
  const schema = `guild${guildId}`;

  // Get the levels table to compute level from XP
  const levelsRes = await pool.query(
    `SELECT level, xp_to_next FROM ${schema}.levels ORDER BY level;`
  );
  const levels = levelsRes.rows;

  // Build cumulative XP thresholds for each level
  // Level 1 requires 0 cumulative XP, level 2 requires levels[0].xp_to_next, etc.
  const thresholds = [0]; // level 1 starts at 0
  let cumulative = 0;
  for (const row of levels) {
    cumulative += row.xp_to_next;
    thresholds.push(cumulative);
  }

  // Get all characters with their XP
  const charsRes = await pool.query(
    `SELECT character_id, xp FROM ${schema}.characters;`
  );

  // Compute level for each character
  function getLevel(xp) {
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (xp >= thresholds[i]) return Math.min(i + 1, 20);
    }
    return 1;
  }

  const brackets = [
    { label: "3-4", min: 3, max: 4 },
    { label: "5-7", min: 5, max: 7 },
    { label: "8-10", min: 8, max: 10 },
    { label: "11-13", min: 11, max: 13 },
    { label: "14-16", min: 14, max: 16 },
    { label: "17-20", min: 17, max: 20 },
  ];

  // Count all characters per bracket
  const charsByBracket = {};
  for (const b of brackets) charsByBracket[b.label] = new Set();

  for (const c of charsRes.rows) {
    const level = getLevel(c.xp);
    for (const b of brackets) {
      if (level >= b.min && level <= b.max) {
        charsByBracket[b.label].add(c.character_id);
        break;
      }
    }
  }

  // Get PCs in active events, grouped by event tier
  const activeRes = await pool.query(
    `SELECT e.tier, COUNT(DISTINCT ep.character_id) as in_events
     FROM ${schema}.event_participants ep
     JOIN ${schema}.events e ON ep.event_id = e.event_id
     WHERE e.status = 'active'
     GROUP BY e.tier;`
  );
  const inEventsByTier = {};
  for (const row of activeRes.rows) {
    inEventsByTier[row.tier] = parseInt(row.in_events);
  }

  // Days since last event started per tier
  const lastEventRes = await pool.query(
    `SELECT tier, MAX(start_date) as last_start
     FROM ${schema}.events
     GROUP BY tier;`
  );
  const lastEventByTier = {};
  for (const row of lastEventRes.rows) {
    const daysSince = Math.ceil((new Date() - new Date(row.last_start)) / (1000 * 60 * 60 * 24));
    lastEventByTier[row.tier] = daysSince;
  }

  // Build result
  const rows = brackets.map((b) => {
    const activePcs = charsByBracket[b.label].size;
    const inEvents = inEventsByTier[b.label] || 0;
    const pctInEvents = activePcs > 0 ? ((inEvents / activePcs) * 100).toFixed(1) : "0.0";
    const daysSince = lastEventByTier[b.label] != null ? lastEventByTier[b.label] : null;
    return {
      bracket: b.label,
      active_pcs: activePcs,
      in_events: inEvents,
      pct_in_events: pctInEvents,
      days_since_last: daysSince,
    };
  });

  const totalPcs = rows.reduce((s, r) => s + r.active_pcs, 0);
  const totalInEvents = rows.reduce((s, r) => s + r.in_events, 0);

  // Total players (distinct player_ids)
  const playersRes = await pool.query(
    `SELECT COUNT(DISTINCT player_id) as total_players FROM ${schema}.characters;`
  );
  const totalPlayers = parseInt(playersRes.rows[0].total_players);

  // Players with at least one character in an active event
  const activePlayers = await pool.query(
    `SELECT COUNT(DISTINCT c.player_id) as active_players
     FROM ${schema}.event_participants ep
     JOIN ${schema}.events e ON ep.event_id = e.event_id
     JOIN ${schema}.characters c ON ep.character_id = c.character_id
     WHERE e.status = 'active';`
  );
  const totalActivePlayers = parseInt(activePlayers.rows[0].active_players);

  return { rows, totalPcs, totalInEvents, totalPlayers, totalActivePlayers };
}

async function getDmStats(guildId, dateRange = {}) {
  const schema = `guild${guildId}`;
  const { conditions, params } = buildDateFilter(1, dateRange);
  const eventWhere = conditions.length > 0 ? `WHERE e.${conditions.join(" AND e.")}` : "";

  // Get all DMs with their event counts and durations
  const res = await pool.query(
    `SELECT
      ed.username,
      COUNT(*) as events_started,
      COUNT(*) FILTER (WHERE e.status = 'completed') as completed_events,
      COUNT(*) FILTER (WHERE e.status = 'active') as active_events,
      MAX(e.start_date) as latest_start,
      -- durations for completed events only
      ARRAY_AGG(
        CASE WHEN e.status = 'completed' AND e.end_date IS NOT NULL
          THEN (e.end_date - e.start_date)
          ELSE NULL
        END
      ) as durations,
      -- avg XP: use avg of participant counts * avg party xp? We'll compute avg_xp from event data
      COALESCE(AVG(
        CASE WHEN e.status = 'completed' AND e.end_date IS NOT NULL
          THEN (e.end_date - e.start_date)
          ELSE NULL
        END
      ), 0) as mean_duration
     FROM ${schema}.event_dms ed
     JOIN ${schema}.events e ON ed.event_id = e.event_id
     ${eventWhere}
     GROUP BY ed.username
     ORDER BY events_started DESC;`,
    params
  );

  const dmRows = res.rows.map((row) => {
    // Filter out nulls for duration calculations
    const durations = (row.durations || []).filter((d) => d !== null);
    const meanDuration = durations.length > 0
      ? (durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(1)
      : null;
    const medianDuration = durations.length > 0
      ? (() => {
          const sorted = [...durations].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 === 0
            ? ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(0)
            : sorted[mid].toString();
        })()
      : null;
    const eventDays = durations.length > 0
      ? Math.round(parseFloat(row.events_started) * parseFloat(meanDuration))
      : 0;

    return {
      username: row.username,
      latest_start: row.latest_start,
      events_started: parseInt(row.events_started),
      completed_events: parseInt(row.completed_events),
      active_events: parseInt(row.active_events),
      mean_duration: meanDuration,
      median_duration: medianDuration,
      event_days: eventDays,
    };
  });

  return dmRows;
}

module.exports = { pool, getRegisteredGuilds, getEventStats, getEvents, getEvent, hasEventsTable, getActivePcStats, getDmStats };
