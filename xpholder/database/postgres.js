const { Pool } = require("pg");

const pool = (() => {
    if (process.env.NODE_ENV !== 'production') {
        return new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: false
        });
    } else {
        return new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    } 
})();
 
const query = (text, params, callback) => {
    return pool.query(text, params, callback)
}

const db = { "query": query }

module.exports = { db }
