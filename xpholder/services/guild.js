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
    const res = await this.db.query(
      format(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '%I' AND table_name = '%I');",
        this.schema,
        tableName
      )
    );
    return res.rows[0].exists;
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
    const doesCharacterTiersTableExist = await this.tableExists(
      "character_tiers"
    );
    if (!doesCharacterTiersTableExist) {
      await this.createCharacterTiersTable();
    }
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
