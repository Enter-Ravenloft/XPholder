const { Pool } = require("pg");

const DEFAULT_DB_URL = "postgresql://xpholder:xpholder@localhost:5432/xpholder";

module.exports = async function setup() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DB_URL;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("SELECT 1");
  } catch (e) {
    throw new Error(
      `Cannot connect to Postgres at ${process.env.DATABASE_URL}. ` +
        `Run "docker compose up -d db" first. (${e.message})`
    );
  } finally {
    await pool.end();
  }
};
