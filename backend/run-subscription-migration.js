// Run subscriptions migration
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse DATABASE_URL directly
const dbUrl = process.env.DATABASE_URL;
console.log('📋 Database URL found:', dbUrl ? 'Yes' : 'No');

// For Railway proxy connections
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false // Railway proxy doesn't require SSL
});

async function runMigration() {
  try {
    console.log('🔗 Connecting to Railway PostgreSQL...');
    
    const sqlPath = path.join(__dirname, 'migrations', 'add_subscriptions_and_savings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📜 Running migration: add_subscriptions_and_savings.sql');
    await pool.query(sql);
    
    console.log('✅ Subscriptions and savings_transactions tables created successfully!');
    
    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'savings_transactions')
    `);
    
    console.log('📋 Tables verified:', result.rows.map(r => r.table_name).join(', '));
    
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

runMigration();
