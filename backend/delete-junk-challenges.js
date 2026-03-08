const { pool } = require('./src/config/database');

async function deleteAllJunk() {
  try {
    console.log('🔍 Scanning for junk challenges...\n');
    
    // List ALL challenges including inactive ones
    const allResult = await pool.query('SELECT id, title, is_active FROM savings_challenges ORDER BY created_at');
    console.log('All challenges (including inactive):');
    allResult.rows.forEach((c, i) => {
      console.log(`${i+1}. "${c.title}" (active: ${c.is_active})`);
    });
    
    // Delete by specific junk patterns
    const junkPatterns = ['Ghh', 'xcvxv', 'test', 'Test'];
    let deletedCount = 0;
    
    console.log('\n🗑️ Deleting junk challenges...');
    for (const pattern of junkPatterns) {
      const delResult = await pool.query(
        'DELETE FROM savings_challenges WHERE LOWER(title) LIKE LOWER($1)',
        [`%${pattern}%`]
      );
      if (delResult.rowCount > 0) {
        console.log(`✅ Deleted ${delResult.rowCount} challenge(s) matching "${pattern}"`);
        deletedCount += delResult.rowCount;
      }
    }
    
    // Final check
    const finalResult = await pool.query('SELECT id, title FROM savings_challenges ORDER BY created_at');
    console.log(`\n✅ Final count: ${finalResult.rows.length} challenges`);
    console.log('Remaining challenges:');
    finalResult.rows.forEach((c, i) => {
      console.log(`${i+1}. ${c.title}`);
    });
    
    if (deletedCount === 0) {
      console.log('\n✅ No junk challenges found - database is clean!');
    }
    
    pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

deleteAllJunk();
