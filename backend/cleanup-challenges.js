const { pool } = require('./src/config/database');

async function cleanupChallenges() {
  try {
    // Get all challenges to see what we have
    const result = await pool.query('SELECT id, title, challenge_type FROM savings_challenges ORDER BY created_at');
    console.log('📋 Current challenges in database:');
    result.rows.forEach((c, i) => {
      console.log(`${i + 1}. ${c.title} (${c.challenge_type})`);
    });
    
    // Delete challenges with junk titles
    const junkTitles = ['Ghh', 'xcvxv', 'test', 'Test Challenge'];
    for (const title of junkTitles) {
      const delResult = await pool.query('DELETE FROM savings_challenges WHERE title = $1', [title]);
      if (delResult.rowCount > 0) {
        console.log(`✅ Deleted: ${title} (${delResult.rowCount} rows)`);
      }
    }
    
    // Verify remaining challenges
    const finalResult = await pool.query('SELECT COUNT(*) FROM savings_challenges WHERE is_active = TRUE');
    console.log(`\n✅ Final challenge count: ${finalResult.rows[0].count} active challenges`);
    
    const finalList = await pool.query('SELECT title FROM savings_challenges WHERE is_active = TRUE ORDER BY created_at');
    console.log('✅ Remaining challenges:');
    finalList.rows.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.title}`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

cleanupChallenges();
