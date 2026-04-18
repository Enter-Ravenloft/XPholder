const { listOfObjsToObj } = require("../utils");
const { LEVELS } = require("../config.json");
const format = require("pg-format");

class guildService {
  constructor(database, guildId) {
    this.db = database;
    this.guildId = guildId;
    this.schema = "guild" + guildId;

    this.xpCache = {};
    this.registered = false;
    this.last_touched = Date.now();
  }

  /*
    -------------
    INITALIZATION
    -------------
    */

  async init() {
    // This tells Postgres to run all subsequent commands in this guild's schema, so that multiple
    // guilds can have independent copies of the tables with their own data.
    await this.db.query(format("SET search_path TO %I;", this.schema));

    if (!(await this.isRegistered())) {
      return;
    }
    this.registered = true;
    this.config = await this.loadInit("config", "name", "value");
    this.levels = await this.loadInit("levels", "level", "xp_to_next");
    this.roles = await this.loadInit("roles", "role_id", "xp_bonus");
    this.channels = await this.loadInit(
      "channels",
      "channel_id",
      "xp_per_post"
    );
    this.characterTiers = await this.fetchCharacterTiers();
  }

  async loadInit(table, primaryKey, value) {
    const res = await this.db.query(format("SELECT * FROM %I;", table));
    return listOfObjsToObj(res.rows, primaryKey, value);
  }

  /*
    ---------
    VALIDATOR
    ---------
    */

  isMod(listOfRoles) {
    return listOfRoles.includes(this.config["moderationRoleId"]);
  }

  isDev(listOfRoles) {
    return listOfRoles.includes("1059613628803850261"); // N.B. specific to Enter Raveloft
  }

  async isRegistered() {
    const res = await this.tableExists("config");
    return res;
  }

  async tableExists(tableName) {
    const query = format(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = %L AND table_name = %L);",
      this.schema,
      tableName
    );
    const res = await this.db.query(query);
    const exists = res.rows[0].exists === true || res.rows[0].exists === 't';
    console.log(`Table check: ${this.schema}.${tableName} exists = ${exists} (raw: ${res.rows[0].exists})`);
    return exists;
  }

  /*
    ---------
    CHARACTER
    ---------
    */

  async deleteCharacter(character) {
    const res = await this.db.query(
      `DELETE FROM ${this.schema}.characters WHERE character_id = $1;`,
      [character["character_id"]]
    );
    return res;
  }

  async getAllCharacters(playerId) {
    const res = await this.db.query(
      `SELECT * FROM ${this.schema}.characters WHERE player_id = $1 ORDER BY character_index;`,
      [playerId]
    );
    return res.rows;
  }

  async getAllGuildCharacters() {
    const res = await this.db.query(`SELECT * FROM ${this.schema}.characters;`);
    return res.rows;
  }

  async getCharacter(characterId) {
    const res = await this.db.query(
      `SELECT * FROM ${this.schema}.characters WHERE character_id = $1;`,
      [characterId]
    );
    return res.rows.length == 0 ? null : res.rows[0];
  }

  async insertCharacter(character) {
    const res = await this.db.query(
      `INSERT INTO ${this.schema}.characters (character_id, character_index, name, sheet_url, picture_url, player_id, xp) VALUES ( $1, $2, $3, $4, $5, $6, $7 );`,
      [
        character.character_id,
        character.character_index,
        character.name,
        character.sheet_url,
        character.picture_url,
        character.player_id,
        character.xp,
      ]
    );
    return res;
  }

  async updateCharacterInfo(character) {
    const res = await this.db.query(
      `UPDATE ${this.schema}.characters SET name = $1, sheet_url = $2, picture_url = $3 WHERE character_id = $4;`,
      [
        character.name,
        character.sheet_url,
        character.picture_url,
        character.character_id,
      ]
    );
    return res;
  }
  async updateCharacterXP(character, deltaXp) {
    const res = await this.db.query(
      `UPDATE ${this.schema}.characters SET xp = xp + $1 WHERE character_id = $2;`,
      [deltaXp, character.character_id]
    );
    return res;
  }
  async setCharacterXP(character) {
    const res = await this.db.query(
      `UPDATE ${this.schema}.characters SET xp = $1 WHERE character_id = $2;`,
      [character.xp, character.character_id]
    );
    return res;
  }

  async upsertPlayer(playerId, username, displayName, inactiveDays) {
    await this.db.query(
      `INSERT INTO ${this.schema}.players (player_id, username, display_name, is_member, inactive_days, last_seen)
       VALUES ($1, $2, $3, TRUE, $4, NOW())
       ON CONFLICT (player_id) DO UPDATE SET
         username = $2,
         display_name = $3,
         is_member = TRUE,
         inactive_days = $4,
         last_seen = NOW();`,
      [playerId, username, displayName, inactiveDays]
    );
  }

  async markAbsentMembers(presentPlayerIds) {
    if (presentPlayerIds.length === 0) return;
    const placeholders = presentPlayerIds.map((_, i) => `$${i + 1}`).join(", ");
    await this.db.query(
      `UPDATE ${this.schema}.players SET is_member = FALSE WHERE player_id NOT IN (${placeholders});`,
      presentPlayerIds
    );
  }

  async getPlayer(playerId) {
    const res = await this.db.query(
      `SELECT * FROM ${this.schema}.players WHERE player_id = $1;`,
      [playerId]
    );
    return res.rows[0];
  }

  /*
    ---------------
    UPDATING TABLES
    ---------------
    */

  async updateConfig(config) {
    for (const [name, value] of Object.entries(config)) {
      await this.db.query(
        `UPDATE ${this.schema}.config SET value = $1 WHERE name = $2;`,
        [value, name]
      );
    }

    this.config = await this.loadInit("config");
  }

  async updateChannel(channelId, xpPerPost) {
    // IF THE XP IS POSITIVE ( ZERO INCLUDED ) WE WANT TO ADD THE ROLE TO THE DATABASE; ELSE, DELETE THE ROLE
    if (xpPerPost >= 0) {
      if (channelId in this.channels) {
        await this.db.query(
          `UPDATE ${this.schema}.channels SET xp_per_post = $1 WHERE channel_id = $2;`,
          [xpPerPost, channelId]
        );
      } else {
        await this.db.query(
          `INSERT INTO ${this.schema}.channels ( channel_id, xp_per_post ) VALUES ($1, $2);`,
          [channelId, xpPerPost]
        );
      }
    } else {
      await this.db.query(
        `DELETE FROM ${this.schema}.channels WHERE channel_id = $1;`,
        [channelId]
      );
    }

    this.channels = await this.loadInit("channels");
  }

  async updateLevel(level, xpToNext) {
    await this.db.query(
      `UPDATE ${this.schema}.levels SET xp_to_next = $1 WHERE level = $2;`,
      [xpToNext, level]
    );

    this.levels = await this.loadInit("levels", "level", "xp_to_next");
  }

  async updateRole(roleId, xpBonus) {
    // IF THE XP IS POSITIVE ( ZERO INCLUDED ) WE WANT TO ADD THE ROLE TO THE DATABASE; ELSE, DELETE THE ROLE
    if (xpBonus >= 0) {
      if (roleId in this.roles) {
        await this.db.query(
          `UPDATE ${this.schema}.roles SET xp_bonus = $1 WHERE role_id = $2;`,
          [xpBonus, roleId]
        );
      } else {
        await this.db.query(
          `INSERT INTO ${this.schema}.roles ( role_id, xp_bonus ) VALUES ($1, $2);`,
          [roleId, xpBonus]
        );
      }
    } else {
      await this.db.query(
        `DELETE FROM ${this.schema}.roles WHERE role_id = $1;`,
        [roleId]
      );
    }

    this.roles = await this.loadInit("roles");
  }

  async updateCharacterTier(
    roleId,
    xpBonus,
    minimumLevel = 0,
    maximumLevel = 0
  ) {
    if (xpBonus >= 0) {
      const existingTier = this.characterTiers.find(
        (tier) => tier["role_id"] === roleId
      );
      if (existingTier) {
        const tierMinimum =
          minimumLevel > 0 ? minimumLevel : existingTier["minimum_level"];
        const tierMaximum =
          maximumLevel >= tierMinimum
            ? maximumLevel
            : existingTier["maximum_level"] >= tierMinimum
            ? existingTier["maximum_level"]
            : tierMinimum;

        await this.db.query(
          `
            UPDATE 
                ${this.schema}.character_tiers
            SET 
                minimum_level = $1,
                maximum_level = $2,
                xp_bonus = $3
            WHERE 
                role_id = $4;   
        `,
          [tierMinimum, tierMaximum, xpBonus, roleId]
        );
      } else {
        const tierMinimum = minimumLevel > 0 ? minimumLevel : 1;
        const tierMaximum =
          maximumLevel > tierMinimum ? maximumLevel : tierMinimum;
        await this.db.query(
          `
              INSERT INTO
                ${this.schema}.character_tiers
                (
                    minimum_level,
                    maximum_level,
                    xp_bonus,
                    role_id
                )
                VALUES(
                    $1,
                    $2,
                    $3,
                    $4
                );
          `,
          [tierMinimum, tierMaximum, xpBonus, roleId]
        );
      }
    } else {
      await this.db.query(
        `
            DELETE FROM ${this.schema}.character_tiers
            WHERE role_id = $1
            `,
        [roleId]
      );
    }
    this.characterTiers = await this.fetchCharacterTiers();
  }

  /*
    --------------------
    REGISTERING A SERVER
    --------------------
    */

  async registerServer(configDetails) {
    await this.db.query(format("CREATE SCHEMA IF NOT EXISTS %I;", this.schema));

    await this.createTables();

    /*
        ---------------------
        POPULATING THE CONFIG
        ---------------------
        */

    for (const [name, value] of Object.entries(configDetails)) {
      await this.db.query(
        `INSERT INTO ${this.schema}.config ( name, value ) VALUES ($1, $2);`,
        [name, value]
      );
    }

    /*
        ---------------------
        POPULATING THE LEVELS
        ---------------------
        */

    for (const [level, xp_to_next] of Object.entries(LEVELS)) {
      await this.db.query(
        `INSERT INTO ${this.schema}.levels ( level, xp_to_next ) VALUES ($1, $2);`,
        [level, xp_to_next]
      );
    }

    /*
        --------------------
        POPULATING THE ROLES
        --------------------
        */

    await this.db.query(
      `INSERT INTO ${this.schema}.roles ( role_id, xp_bonus ) VALUES ($1, 0)`,
      [configDetails["xpFreezeRoleId"]]
    );
  }

  async updateRegistration() {
    console.log(`Starting updateRegistration for schema: ${this.schema}`);
    const doesCharacterTiersTableExist = await this.tableExists(
      "character_tiers"
    );
    if (!doesCharacterTiersTableExist) {
      await this.createCharacterTiersTable();
    }
    const doesPlayersTableExist = await this.tableExists("players");
    if (!doesPlayersTableExist) {
      await this.createPlayersTable();
    }
    const inactiveRoleKeys = [
      "inactiveRole60Id",
      "inactiveRole90Id",
      "inactiveRole180Id",
      "inactiveRole365Id",
    ];
    for (const key of inactiveRoleKeys) {
      try {
        await this.db.query(
          `INSERT INTO ${this.schema}.config (name, value)
           SELECT $1, ''
           WHERE NOT EXISTS (SELECT 1 FROM ${this.schema}.config WHERE name = $1);`,
          [key]
        );
      } catch (e) {
        console.error(`Error processing config key ${key}:`, e);
        throw e;
      }
    }

    const doesEventsTableExist = await this.tableExists("events");
    if (!doesEventsTableExist) {
      await this.createEventsTable();
      await this.createEventParticipantsTable();
      await this.createEventDmsTable();
    } else {
      // Add reward columns if they don't exist yet
      await this.db.query(
        `ALTER TABLE ${this.schema}.events ADD COLUMN IF NOT EXISTS xp_reward INTEGER;`
      );
      await this.db.query(
        `ALTER TABLE ${this.schema}.events ADD COLUMN IF NOT EXISTS gp_reward INTEGER;`
      );
      await this.db.query(
        `ALTER TABLE ${this.schema}.event_participants ADD COLUMN IF NOT EXISTS player_id TEXT;`
      );
      await this.db.query(
        `ALTER TABLE ${this.schema}.event_participants ADD COLUMN IF NOT EXISTS character_name TEXT;`
      );
    }
    console.log("Finished updateRegistration");
  }

  /*
    ------------------------
    CREATING TABLE FUNCTIONS
    ------------------------
    */

  async createTables() {
    await this.createChannelsTable();
    await this.createCharactersTable();
    await this.createConfigTable();
    await this.createLevelsTable();
    await this.createRolesTable();
    await this.createCharacterTiersTable();
    await this.createPlayersTable();
    await this.createEventsTable();
    await this.createEventParticipantsTable();
    await this.createEventDmsTable();
  }

  async createChannelsTable() {
    const res = await this.db.query(
      "CREATE TABLE channels ( channel_id TEXT PRIMARY KEY, xp_per_post INTEGER );"
    );
    return res;
  }
  async createCharactersTable() {
    const res = await this.db.query(
      "CREATE TABLE characters ( character_id TEXT PRIMARY KEY , character_index INTEGER, name TEXT , sheet_url TEXT , picture_url TEXT , player_id TEXT , xp REAL );"
    );
    return res;
  }
  async createConfigTable() {
    const res = await this.db.query(
      "CREATE TABLE config ( name TEXT PRIMARY KEY, value VARCHAR(2000) );"
    );
    return res;
  }
  async createLevelsTable() {
    const res = await this.db.query(
      "CREATE TABLE levels ( level INTEGER PRIMARY KEY, xp_to_next INTEGER );"
    );
    return res;
  }
  async createRolesTable() {
    const res = await this.db.query(
      "CREATE TABLE roles ( role_id TEXT PRIMARY KEY, xp_bonus INTEGER );"
    );
    return res;
  }
  async createCharacterTiersTable() {
    const res = await this.db.query(
      `CREATE TABLE
        character_tiers (
            tier_id SERIAL PRIMARY KEY,
            role_id TEXT NOT NULL,
            minimum_level INTEGER NOT NULL,
            maximum_level INTEGER NOT NULL,
            xp_bonus INTEGER NOT NULL
        );`
    );
    return res;
  }
  async createPlayersTable() {
    await this.db.query(
      `CREATE TABLE IF NOT EXISTS players (
        player_id TEXT PRIMARY KEY,
        username TEXT,
        display_name TEXT,
        is_member BOOLEAN DEFAULT TRUE,
        inactive_days INTEGER,
        first_seen TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP DEFAULT NOW()
      );`
    );
  }
  async createEventsTable() {
    await this.db.query(
      `CREATE TABLE IF NOT EXISTS events (
        event_id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        tier TEXT NOT NULL,
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        end_date DATE,
        xp_reward INTEGER,
        gp_reward INTEGER,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
        created_at TIMESTAMP DEFAULT NOW()
      );`
    );
  }
  async createEventParticipantsTable() {
    await this.db.query(
      `CREATE TABLE IF NOT EXISTS event_participants (
        participant_id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
        character_id TEXT NOT NULL,
        player_id TEXT,
        character_name TEXT,
        starting_level INTEGER NOT NULL,
        starting_xp REAL NOT NULL,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(event_id, character_id)
      );`
    );
  }
  async createEventDmsTable() {
    await this.db.query(
      `CREATE TABLE IF NOT EXISTS event_dms (
        dm_id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        username TEXT,
        is_primary BOOLEAN DEFAULT FALSE,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(event_id, user_id)
      );`
    );
  }

  /*
    ------
    EVENTS
    ------
    */

  async createEvent(name, eventType, tier, startDate, dmUserId, dmUsername) {
    const res = await this.db.query(
      `INSERT INTO ${this.schema}.events (name, event_type, tier, start_date) VALUES ($1, $2, $3, $4) RETURNING event_id;`,
      [name, eventType, tier, startDate]
    );
    const eventId = res.rows[0].event_id;
    await this.addEventDm(eventId, dmUserId, dmUsername, true);
    return eventId;
  }

  async getEvent(eventId) {
    const res = await this.db.query(
      `SELECT * FROM ${this.schema}.events WHERE event_id = $1;`,
      [eventId]
    );
    return res.rows.length === 0 ? null : res.rows[0];
  }

  async getEvents(status = null) {
    if (status) {
      const res = await this.db.query(
        `SELECT * FROM ${this.schema}.events WHERE status = $1 ORDER BY created_at DESC;`,
        [status]
      );
      return res.rows;
    }
    const res = await this.db.query(
      `SELECT * FROM ${this.schema}.events ORDER BY created_at DESC;`
    );
    return res.rows;
  }

  async searchEvents(searchTerm, status = "active") {
    const res = await this.db.query(
      `SELECT * FROM ${this.schema}.events WHERE status = $1 AND LOWER(name) LIKE $2 ORDER BY name LIMIT 25;`,
      [status, `%${searchTerm.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`]
    );
    return res.rows;
  }

  async endEvent(eventId, endDate, xpReward = null, gpReward = null) {
    await this.db.query(
      `UPDATE ${this.schema}.events SET status = 'completed', end_date = $1, xp_reward = $2, gp_reward = $3 WHERE event_id = $4;`,
      [endDate, xpReward, gpReward, eventId]
    );
  }

  async deleteEvent(eventId) {
    await this.db.query(
      `DELETE FROM ${this.schema}.events WHERE event_id = $1;`,
      [eventId]
    );
  }

  async updateEvent(eventId, fields) {
    const allowed = ["name", "event_type", "tier", "start_date"];
    const setClauses = [];
    const values = [];
    let i = 1;
    for (const col of allowed) {
      if (fields[col] !== undefined) {
        setClauses.push(`${col} = $${i++}`);
        values.push(fields[col]);
      }
    }
    if (setClauses.length === 0) return;
    values.push(eventId);
    await this.db.query(
      `UPDATE ${this.schema}.events SET ${setClauses.join(", ")} WHERE event_id = $${i};`,
      values
    );
  }

  async setPrimaryDm(eventId, userId, username) {
    await this.db.query(
      `UPDATE ${this.schema}.event_dms SET is_primary = FALSE WHERE event_id = $1;`,
      [eventId]
    );
    await this.db.query(
      `INSERT INTO ${this.schema}.event_dms (event_id, user_id, username, is_primary)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (event_id, user_id) DO UPDATE SET is_primary = TRUE, username = EXCLUDED.username;`,
      [eventId, userId, username]
    );
  }

  async addEventParticipant(eventId, characterId, playerId, characterName, startingLevel, startingXp) {
    await this.db.query(
      `INSERT INTO ${this.schema}.event_participants (event_id, character_id, player_id, character_name, starting_level, starting_xp) VALUES ($1, $2, $3, $4, $5, $6);`,
      [eventId, characterId, playerId, characterName, startingLevel, startingXp]
    );
  }

  async removeEventParticipant(eventId, characterId) {
    const res = await this.db.query(
      `DELETE FROM ${this.schema}.event_participants WHERE event_id = $1 AND character_id = $2 RETURNING *;`,
      [eventId, characterId]
    );
    return res.rows[0] || null;
  }

  async getEventParticipants(eventId) {
    const res = await this.db.query(
      `SELECT ep.*,
         COALESCE(ep.character_name, c.name) as character_name,
         COALESCE(ep.player_id, c.player_id) as player_id
       FROM ${this.schema}.event_participants ep
       LEFT JOIN ${this.schema}.characters c ON ep.character_id = c.character_id
       WHERE ep.event_id = $1
       ORDER BY ep.joined_at;`,
      [eventId]
    );
    return res.rows;
  }

  async addEventDm(eventId, userId, username, isPrimary = false) {
    await this.db.query(
      `INSERT INTO ${this.schema}.event_dms (event_id, user_id, username, is_primary) VALUES ($1, $2, $3, $4);`,
      [eventId, userId, username, isPrimary]
    );
  }

  async getEventDms(eventId) {
    const res = await this.db.query(
      `SELECT * FROM ${this.schema}.event_dms WHERE event_id = $1 ORDER BY is_primary DESC;`,
      [eventId]
    );
    return res.rows;
  }

  async removeEventDm(eventId, userId) {
    const res = await this.db.query(
      `DELETE FROM ${this.schema}.event_dms WHERE event_id = $1 AND user_id = $2 RETURNING *;`,
      [eventId, userId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  async getEventStats() {
    const res = await this.db.query(
      `SELECT
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE status = 'active') as active_events,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_events
       FROM ${this.schema}.events;`
    );
    const participantRes = await this.db.query(
      `SELECT
        COUNT(DISTINCT ep.character_id) as total_participants,
        COALESCE(AVG(party_size), 0) as avg_party_size
       FROM ${this.schema}.event_participants ep
       JOIN (
         SELECT event_id, COUNT(*) as party_size
         FROM ${this.schema}.event_participants
         GROUP BY event_id
       ) sizes ON ep.event_id = sizes.event_id;`
    );
    const dmRes = await this.db.query(
      `SELECT user_id, username, COUNT(*) as event_count,
        COUNT(*) FILTER (WHERE is_primary) as primary_count
       FROM ${this.schema}.event_dms
       GROUP BY user_id, username
       ORDER BY event_count DESC;`
    );
    return {
      ...res.rows[0],
      ...participantRes.rows[0],
      top_dms: dmRes.rows,
    };
  }

  /*
  ------------------------
  FETCH TABLE FUNCTIONS
  ------------------------
  */
  async fetchCharacterTiers() {
    const doesCharacterTiersTableExist = await this.tableExists(
      "character_tiers"
    );
    if (doesCharacterTiersTableExist) {
      const table = await this.db.query(
        format(`
            SELECT 
                tier_id,
                role_id,
                minimum_level,
                maximum_level,
                xp_bonus
            FROM
                ${this.schema}.character_tiers;`)
      );
      return table.rows;
    }
    return [];
  }
}

module.exports = { guildService };
