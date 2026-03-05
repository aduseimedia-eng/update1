// Script to seed default challenges into the database
const { query } = require('./src/config/database');

const defaultChallenges = [
  {
    title: 'No-Spend Weekend',
    description: 'Spend nothing on Saturday and Sunday',
    challenge_type: 'no_spend',
    target_amount: null,
    target_days: 2,
    xp_reward: 50,
    difficulty: 'easy'
  },
  {
    title: 'Save ₵50 This Week',
    description: 'Save at least ₵50 by the end of the week',
    challenge_type: 'save_amount',
    target_amount: 50,
    target_days: 7,
    xp_reward: 75,
    difficulty: 'easy'
  },
  {
    title: 'Save ₵200 This Month',
    description: 'Save at least ₵200 this month',
    challenge_type: 'save_amount',
    target_amount: 200,
    target_days: 30,
    xp_reward: 150,
    difficulty: 'medium'
  },
  {
    title: 'Cut Transport Costs',
    description: 'Reduce transport spending by 30%',
    challenge_type: 'reduce_category',
    target_amount: null,
    target_days: 7,
    xp_reward: 100,
    difficulty: 'medium'
  },
  {
    title: '7-Day Streak',
    description: 'Log expenses for 7 consecutive days',
    challenge_type: 'streak',
    target_amount: null,
    target_days: 7,
    xp_reward: 100,
    difficulty: 'easy'
  },
  {
    title: 'No Betting Week',
    description: 'No betting/gaming expenses for a week',
    challenge_type: 'no_spend',
    target_amount: null,
    target_days: 7,
    xp_reward: 150,
    difficulty: 'hard'
  },
  {
    title: 'Frugal Foodie',
    description: 'Keep food expenses under ₵100 for a week',
    challenge_type: 'save_amount',
    target_amount: 100,
    target_days: 7,
    xp_reward: 100,
    difficulty: 'medium'
  },
  {
    title: 'Data Detox',
    description: 'Reduce data/airtime spending by 50%',
    challenge_type: 'reduce_category',
    target_amount: null,
    target_days: 7,
    xp_reward: 120,
    difficulty: 'hard'
  },
  {
    title: '30-Day Saver',
    description: 'Save something every day for 30 days',
    challenge_type: 'streak',
    target_amount: null,
    target_days: 30,
    xp_reward: 300,
    difficulty: 'extreme'
  },
  {
    title: 'Budget Master',
    description: 'Stay under budget for 4 weeks',
    challenge_type: 'custom',
    target_amount: null,
    target_days: 28,
    xp_reward: 250,
    difficulty: 'hard'
  }
];

async function seedChallenges() {
  try {
    console.log('🌱 Seeding default challenges...');
    
    // Check if challenges already exist
    const checkResult = await query('SELECT COUNT(*) as count FROM savings_challenges');
    const count = checkResult.rows[0].count;
    
    if (count > 0) {
      console.log(`✅ Challenges already exist (${count} found). Skipping seed.`);
      process.exit(0);
    }
    
    // Insert all challenges
    for (const challenge of defaultChallenges) {
      const result = await query(
        `INSERT INTO savings_challenges 
         (title, description, challenge_type, target_amount, target_days, xp_reward, difficulty) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, title`,
        [
          challenge.title,
          challenge.description,
          challenge.challenge_type,
          challenge.target_amount,
          challenge.target_days,
          challenge.xp_reward,
          challenge.difficulty
        ]
      );
      
      console.log(`  ✓ Created: ${result.rows[0].title}`);
    }
    
    console.log(`\n✅ Successfully seeded ${defaultChallenges.length} challenges!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding challenges:', error.message);
    process.exit(1);
  }
}

// Run the seed
seedChallenges();
