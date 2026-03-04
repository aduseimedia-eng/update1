const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'smart_money_gh',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '6669',
});

async function checkUsers() {
  try {
    console.log('\n=== CHECKING USERS IN DATABASE ===\n');

    // Get all users
    const users = await pool.query('SELECT id, email, phone, full_name, created_at FROM users LIMIT 10');
    console.log(`✓ Found ${users.rows.length} users:`);
    users.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Email: ${user.email}, Phone: ${user.phone}, Name: ${user.full_name}`);
    });

    // Get bills for the first user
    if (users.rows.length > 0) {
      const userId = users.rows[0].id;
      console.log(`\n=== BILLS FOR USER ${userId} ===\n`);
      
      const bills = await pool.query('SELECT id, title, is_active, due_date FROM bill_reminders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]);
      console.log(`✓ Found ${bills.rows.length} bills:`);
      bills.rows.forEach(bill => {
        console.log(`  - ID: ${bill.id}, Title: ${bill.title}, Active: ${bill.is_active}, Due: ${bill.due_date}`);
      });
    }

    console.log('\n✓ Database connection successful!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
}

checkUsers();
