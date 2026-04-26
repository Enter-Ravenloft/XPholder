const { Pool } = require("pg");
const format = require("pg-format");
const { randomBytes } = require("crypto");
const { guildService } = require("../../xpholder/services/guild.js");

const DEFAULT_DB_URL = "postgresql://xpholder:xpholder@localhost:5432/xpholder";

const DEFAULT_TEST_CONFIG = {
  levelUpMessage: "test",
  levelUpChannelId: "0",
  moderationRoleId: "100",
  approveLevel: 1,
  approveMessage: "approved",
  roleBonus: "highest",
  xpPerPostFormula: "exponential",
  xpPerPostDivisor: 100,
  allowPlayerManageXp: "off",
  characterCount: 3,
  tier1RoleId: "t1",
  tier2RoleId: "t2",
  tier3RoleId: "t3",
  tier4RoleId: "t4",
  xpFreezeRoleId: "freeze",
  xpShareRoleId: "share",
  character1RoleId: "c1",
  character2RoleId: "c2",
  character3RoleId: "c3",
  inactiveRole60Id: "",
  inactiveRole90Id: "",
  inactiveRole180Id: "",
  inactiveRole365Id: "",
};

function newPool() {
  const connectionString = process.env.DATABASE_URL || DEFAULT_DB_URL;
  return new Pool({ connectionString, max: 1 });
}

function newGuildId() {
  return "t" + randomBytes(8).toString("hex");
}

async function createTestGuildService(overrides = {}) {
  const pool = newPool();
  const db = { query: (...args) => pool.query(...args) };
  const gService = new guildService(db, newGuildId());

  // search_path must be set on the (single) connection before unqualified
  // CREATE TABLE inside registerServer. With max:1, the pool guarantees the
  // same connection is reused for every subsequent query.
  await db.query(format("SET search_path TO %I;", gService.schema));
  await gService.registerServer({ ...DEFAULT_TEST_CONFIG, ...overrides });
  await gService.init();

  return {
    gService,
    db,
    pool,
    schema: gService.schema,
    cleanup: async () => {
      try {
        await db.query(
          format("DROP SCHEMA IF EXISTS %I CASCADE;", gService.schema)
        );
      } finally {
        await pool.end();
      }
    },
  };
}

module.exports = {
  createTestGuildService,
  newPool,
  newGuildId,
  DEFAULT_TEST_CONFIG,
};
