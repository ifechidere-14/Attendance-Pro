/**
 * CockroachDB connection pool (PostgreSQL wire protocol via node-postgres).
 * Connection settings are read from the .env file.
 */
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('✖ DATABASE_URL is not set. Create a .env file (see .env.example).');
  process.exit(1);
}

const useTls = String(process.env.DB_SSL) === 'true';

const pool = new Pool({
  connectionString,
  max: 10,                        // max clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  ssl: useTls ? { rejectUnauthorized: false } : false
});

// Avoid crashing the whole server on idle-client errors (e.g. network blips)
pool.on('error', (err) => {
  console.error('Unexpected error on idle CockroachDB client:', err.message);
});

// Minimal smoke test helper
async function ping() {
  const { rows } = await pool.query('SELECT version() AS version');
  return rows[0].version;
}

module.exports = pool;
module.exports.ping = ping;
