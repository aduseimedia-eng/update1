// Update challenge XP rewards based on difficulty
const { query } = require('./src/config/database');
const { XP_REWARDS } = require('./src/config/constants');

const DIFFICULTY_XP_MAP = {
  'easy': XP_REWARDS.CHALLENGE_EASY,
  'medium': XP_REWARDS.CHALLENGE_MEDIUM,
  'hard': XP_REWARDS.CHALLENGE_HARD,
  'extreme': XP_REWARDS.CHALLENGE_EXTREME
};

async function updateChallengeXPRewards() {
  try {
    console.log('🎯 Updating challenge XP rewards based on difficulty...\n');
    
    for (const [difficulty, xp] of Object.entries(DIFFICULTY_XP_MAP)) {
      const result = await query(
        'UPDATE savings_challenges SET xp_reward = $1 WHERE difficulty = $2 AND xp_reward IS NULL',
        [xp, difficulty]
      );
      
      console.log(`✓ Updated ${difficulty} challenges: ${result.rowCount} row(s) affected (${xp} XP)`);
    }
    
    // Check all challenges
    const allRes = await query('SELECT difficulty, xp_reward, COUNT(*) as count FROM savings_challenges GROUP BY difficulty, xp_reward');
    console.log('\n📊 Current challenge XP rewards:');
    allRes.rows.forEach(row => {
      console.log(`  • ${row.difficulty}: ${row.xp_reward} XP (${row.count} challenge(s))`);
    });
    
    console.log('\n✅ Challenge XP rewards updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating challenges:', error.message);
    process.exit(1);
  }
}

updateChallengeXPRewards();
