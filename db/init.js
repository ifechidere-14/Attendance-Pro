/**
 * Database initializer.
 *
 * Reads schema.sql and applies it to the CockroachDB database referenced by
 * DATABASE_URL. If that database does not exist yet, connect to any existing
 * database on the cluster first (e.g. "defaultdb") and the schema script will
 * create and switch to "attendance_system".
 *
 * Usage:  npm run db:init
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('✖ DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const useTls = String(process.env.DB_SSL) === 'true';
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log('→ Connecting to CockroachDB …');

  // Try the configured database first; if it does not exist, fall back to
  // connecting without a database name so the schema script can create it.
  let client = null;
  try {
    client = new Client({ connectionString, ssl: useTls ? { rejectUnauthorized: false } : false, connectionTimeoutMillis: 20000 });
    await client.connect();
  } catch (err) {
    if (err.code === '3D000' || /database .* does not exist/i.test(err.message || '')) {
      console.log('→ Database does not exist yet, connecting to the cluster to create it …');
      client = new Client({
        connectionString: connectionString.replace(/\/[^/]+\?/, '/defaultdb?').replace(/\/[^/]+$/, '/defaultdb'),
        ssl: useTls ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 20000
      });
      await client.connect();
    } else {
      throw err;
    }
  }

  console.log('→ Applying schema.sql …');

  // Split the schema into individual statements (CockroachDB older versions do
  // not accept multiple statements in a single simple query).
  const statements = schema
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      const body = s.replace(/^\s*--.*$/gm, '').trim(); // drop comment-only blocks
      return body.length > 0;
    });

  for (const statement of statements) {
    await client.query(statement);
  }
  console.log(`✓ Database schema applied successfully (${statements.length} statements).`);
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('✖ Failed to apply schema:', err.message);
  process.exit(1);
});
