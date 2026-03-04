const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'smart_money_gh',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '6669',
});

async function setupTestData() {
  try {
    console.log('\n=== SETTING UP TEST DATA ===\n');

    // Create a test user
    console.log('1. Creating test user...');
    const hashedPassword = await bcrypt.hash('Test@1234', 10);
    
    const userRes = await pool.query(
      `INSERT INTO users (email, phone, password_hash, name, phone_verified, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, email_verified = $6, phone_verified = $5
       RETURNING id, email`,
      ['test@example.com', '0551234567', hashedPassword, 'Test User', true, true]
    );
    const userId = userRes.rows[0].id;
    console.log(`   ✓ User created/updated: ${userRes.rows[0].email} (ID: ${userId})`);

    // Create test bills
    console.log('\n2. Creating test bills...');
    const billsData = [
      { title: 'Internet Bill', amount: 50, category: 'Utilities', due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0] }, // tomorrow
      { title: 'Rent', amount: 500, category: 'Housing', due_date: new Date(Date.now() + 172800000).toISOString().split('T')[0] }, // 2 days from now
      { title: 'Electricity', amount: 75, category: 'Utilities', due_date: new Date(Date.now() - 86400000).toISOString().split('T')[0] }, // yesterday (overdue)
    ];

    for (const bill of billsData) {
      const billRes = await pool.query(
        `INSERT INTO bill_reminders 
         (user_id, title, amount, currency, category, due_date, frequency, reminder_days_before, is_paid, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [userId, bill.title, bill.amount, 'GHS', bill.category, bill.due_date, 'monthly', 3, false, true]
      );
      console.log(`   ✓ Bill created: ${bill.title} (Due: ${bill.due_date})`);
    }

    // Create test subscriptions
    console.log('\n3. Creating test subscriptions...');
    try {
      const subRes = await pool.query(
        `INSERT INTO subscriptions (user_id, name, amount, currency, next_due_date, frequency, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [userId, 'Netflix Monthly', 20, 'GHS', new Date(Date.now() + 259200000).toISOString().split('T')[0], 'monthly', true]
      );
      console.log(`   ✓ Subscription created: Netflix Monthly`);
    } catch (subError) {
      console.log(`   ⓘ Subscriptions table not yet created (skipping)`);
    }

    console.log('\n✅ Test data setup complete!');
    console.log(`\n📝 Test credentials:`);
    console.log(`   Email: test@example.com`);
    console.log(`   Password: Test@1234`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

setupTestData();
