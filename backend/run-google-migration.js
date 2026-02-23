const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:panKcFnPJtaegfJEXVlJSBBHxQPJmsge@hopper.proxy.rlwy.net:52261/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE users ALTER COLUMN phone DROP NOT NULL');
    console.log('✅ phone is now nullable');
  } catch(e) { console.log('phone already nullable:', e.message); }

  try {
    await client.query('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
    console.log('✅ password_hash is now nullable');
  } catch(e) { console.log('password_hash already nullable:', e.message); }

  try {
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)");
    console.log('✅ google_id column added');
  } catch(e) { console.log('google_id:', e.message); }

  try {
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local'");
    console.log('✅ auth_provider column added');
  } catch(e) { console.log('auth_provider:', e.message); }

  try {
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT");
    console.log('✅ profile_picture column added');
  } catch(e) { console.log('profile_picture:', e.message); }

  try {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx
      ON users(google_id) WHERE google_id IS NOT NULL
    `);
    console.log('✅ google_id unique index created');
  } catch(e) { console.log('index:', e.message); }

  client.release();
  await pool.end();
  console.log('Migration complete');
}

run();
