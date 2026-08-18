/**
 * Seed script — creates the default administrator account.
 *
 * Usage:  npm run seed
 * Defaults:  admin / Admin@1234   (override via .env)
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db/pool');

async function seed() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const email = process.env.ADMIN_EMAIL || 'admin@attendance.local';
  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const fullName = process.env.ADMIN_NAME || 'System Administrator';

  const hash = bcrypt.hashSync(password, 12);

  const { rows } = await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (username) DO UPDATE
       SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           updated_at = now()
     RETURNING id, username, role`,
    [username, email, hash, fullName]
  );

  console.log('✓ Admin account ready.');
  console.log(`  Username : ${rows[0].username}`);
  console.log(`  Role     : ${rows[0].role}`);
  console.log(`  Password : ${password}`);
  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('✖ Seed failed:', err.message);
  console.error('  → Make sure the schema is applied first: npm run db:init');
  process.exit(1);
});
