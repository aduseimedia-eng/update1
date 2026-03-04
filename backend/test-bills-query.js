const { query } = require('./src/config/database');

async function testBillsQuery() {
  try {
    console.log('\n=== TESTING BILLS QUERY ===\n');

    // Get all bills (no filter)
    console.log('1. ALL BILLS IN DATABASE:');
    const allBills = await query('SELECT id, user_id, title, is_active, due_date FROM bill_reminders ORDER BY created_at DESC LIMIT 10');
    console.log(`   Found ${allBills.rows.length} bills`);
    allBills.rows.forEach(bill => {
      console.log(`   - ID: ${bill.id}, User: ${bill.user_id}, Title: ${bill.title}, Active: ${bill.is_active}, Due: ${bill.due_date}`);
    });

    // Get all bills regardless of is_active
    console.log('\n2. ALL BILLS (including inactive):');
    const allBillsInactive = await query(`
      SELECT id, user_id, title, is_active, due_date, created_at 
      FROM bill_reminders 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log(`   Found ${allBillsInactive.rows.length} bills`);
    allBillsInactive.rows.forEach(bill => {
      console.log(`   - ID: ${bill.id}, User: ${bill.user_id}, Title: ${bill.title}, Active: ${bill.is_active}, Due: ${bill.due_date}, Created: ${bill.created_at}`);
    });

    // Check the schema for is_active default
    console.log('\n3. CHECKING TABLE SCHEMA:');
    const schema = await query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bill_reminders'
      ORDER BY ordinal_position
    `);
    const isActiveCol = schema.rows.find(col => col.column_name === 'is_active');
    console.log(`   is_active column: data_type=${isActiveCol.data_type}, default=${isActiveCol.column_default}, nullable=${isActiveCol.is_nullable}`);

    // Get users and their bills
    console.log('\n4. BILLS BY USER:');
    const userBills = await query(`
      SELECT user_id, COUNT(*) as total_bills, COUNT(CASE WHEN is_active THEN 1 END) as active_bills
      FROM bill_reminders
      GROUP BY user_id
      ORDER BY total_bills DESC
    `);
    console.log(`   Total users with bills: ${userBills.rows.length}`);
    userBills.rows.forEach(row => {
      console.log(`   - User ${row.user_id}: ${row.total_bills} total, ${row.active_bills} active`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testBillsQuery();
