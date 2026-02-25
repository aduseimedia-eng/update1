// Simple database test
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const fs = require('fs');

// Use DATABASE_PUBLIC_URL for external access
const dbUrl = 'postgresql://postgres:HqBCBQHyrxnBodPVcKKQdvdIMHlHQezX@mainline.proxy.rlwy.net:48302/railway';

console.log('=== KudiSave Migration Script ===');
console.log('Using Railway public proxy URL');

// Connect with SSL for external proxy
const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 60000
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
