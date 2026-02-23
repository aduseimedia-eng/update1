// Run email notification tracking migration
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:HqBCBQHyrxnBodPVcKKQdvdIMHlHQezX@mainline.proxy.rlwy.net:48302/railway',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000
});

async function runMigration() {
  console.log('Connecting to Railway database (30s timeout)...');
  
  try {
    // Test connection
    const test = await pool.query('SELECT NOW()');
    console.log('Connected! Time:', test.rows[0].now);
    
    // Migration 1: users table
    console.log('\n1. Adding last_budget_alert_threshold to users...');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_budget_alert_threshold INTEGER DEFAULT 0');
    console.log('   ✓ Done');
    
    // Migration 2: goals table
    console.log('2. Adding last_milestone_notified to goals...');
    await pool.query('ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_milestone_notified INTEGER DEFAULT 0');
    console.log('   ✓ Done');
    
    // Migration 3: bill_reminders table
    console.log('3. Adding last_reminder_sent to bill_reminders...');
    await pool.query('ALTER TABLE bill_reminders ADD COLUMN IF NOT EXISTS last_reminder_sent DATE');
    console.log('   ✓ Done');
    
    // Migration 4: index
    console.log('4. Creating index on bill_reminders.due_date...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_bill_reminders_due_date ON bill_reminders(due_date)');
    console.log('   ✓ Done');
    
    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
