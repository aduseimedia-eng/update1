// Normalize challenge XP rewards to match difficulty tiers
const { query } = require('./src/config/database');

const DIFFICULTY_XP_MAP = {
  'easy': 50,
  'medium': 100,
  'hard': 200,
  'extreme': 400
};

async function normalizeChallengXPRewards() {
  try {
    console.log('🎯 Normalizing challenge XP rewards to match difficulty tiers...\n');
    
    let totalUpdated = 0;
    
    for (const [difficulty, xp] of Object.entries(DIFFICULTY_XP_MAP)) {
      const result = await query(
        'UPDATE savings_challenges SET xp_reward = $1 WHERE difficulty = $2',
        [xp, difficulty]
      );
      
      totalUpdated += result.rowCount;
      console.log(`✓ ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}: ${result.rowCount} challenge(s) → ${xp} XP`);
    }
    
    // Show final state
    const allRes = await query(`
      SELECT difficulty, xp_reward, COUNT(*) as count 
      FROM savings_challenges 
      GROUP BY difficulty, xp_reward 
      ORDER BY difficulty
    `);
    
    console.log('\n📊 Final challenge XP distribution:');
    allRes.rows.forEach(row => {
      console.log(`  • ${row.difficulty}: ${row.xp_reward} XP (${row.count} challenge(s))`);
    });
    
    console.log(`\n✅ Total challenges updated: ${totalUpdated}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

normalizeChallengXPRewards();
