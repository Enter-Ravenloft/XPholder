const { Pool } = require("pg");

const pool = (() => {
  const connectionString = `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.DB_SERVER}:${process.env.DB_PORT}/postgres`;
  if (process.env.NODE_ENV !== "production") {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
    });
  } else {
    return new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
})();

const query = (text, params, callback) => {
  return pool.query(text, params, callback);
};

const db = { query: query };

module.exports = { db };
