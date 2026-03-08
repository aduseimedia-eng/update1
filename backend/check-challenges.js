const { pool } = require('./src/config/database');

async function checkChallenges() {
  try {
    const result = await pool.query('SELECT id, title, challenge_type FROM savings_challenges ORDER BY created_at');
    console.log('\n📋 Challenges in DB:');
    result.rows.forEach((c, i) => {
      console.log(`${i+1}. ${c.title} (${c.challenge_type})`);
    });
    console.log(`\nTotal: ${result.rows.length} challenges\n`);
    pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkChallenges();
