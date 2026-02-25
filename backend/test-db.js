// Simple database test
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const fs = require('fs');

const dbUrl = process.env.DATABASE_URL;

console.log('=== KudiSave Migration Script ===');
console.log('DATABASE_URL exists:', !!dbUrl);
console.log('URL preview:', dbUrl?.substring(0, 30) + '...');

if (!dbUrl) {
  console.error('ERROR: No DATABASE_URL found in .env');
  process.exit(1);
}

// Connect without SSL for Railway proxy
const pool = new Pool({
  connectionString: dbUrl,
  connectionTimeoutMillis: 30000
});

async function run() {
  try {
    console.log('Testing connection...');
    const testResult = await pool.query('SELECT NOW() as time');
    console.log('Connected! Server time:', testResult.rows[0].time);
    
    // Read and run migration
    const sqlPath = path.join(__dirname, 'migrations', 'add_subscriptions_and_savings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running subscription migration...');
    await pool.query(sql);
    console.log('SUCCESS: Tables created!');
    
    // Verify
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'savings_transactions')
    `);
    console.log('Verified tables:', tables.rows.map(r => r.table_name));
    process.exit(0);
    
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
