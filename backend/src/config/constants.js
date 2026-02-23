// Ghana-specific expense categories
const EXPENSE_CATEGORIES = [
  'Food / Chop Bar',
  'Transport (Trotro / Bolt)',
  'Data / Airtime',
  'Rent / Hostel',
  'Utilities',
  'Church / Donations',
  'Betting / Gaming',
  'Entertainment',
  'Shopping',
  'Miscellaneous'
];

// Payment methods available in Ghana
const PAYMENT_METHODS = [
  'Cash',
  'MTN MoMo',
  'Telecel Cash',
  'Bank Transfer',
  'AirtelTigo Money'
];

// Income sources
const INCOME_SOURCES = [
  'Allowance',
  'Salary',
  'Business',
  'Gift',
  'Hustle',
  'Investment',
  'Other'
];

// Budget period types
const BUDGET_PERIODS = ['weekly', 'monthly'];

// Goal statuses
const GOAL_STATUSES = ['active', 'completed', 'abandoned'];

// Badge definitions
const BADGES = {
  DATA_KING: {
    name: 'Data King/Queen',
    description: 'Spend less than GHS 50 on data/airtime for a month',
    tiers: {
      bronze: { threshold: 50, xp: 50 },
      silver: { threshold: 30, xp: 100 },
      gold: { threshold: 20, xp: 200 }
    }
  },
  CHOP_SAVER: {
    name: 'Chop Saver',
    description: 'Stay within food budget for consecutive months',
    tiers: {
      bronze: { months: 1, xp: 50 },
      silver: { months: 2, xp: 100 },
      gold: { months: 3, xp: 200 }
    }
  },
  BUDGET_BOSS: {
    name: 'Budget Boss',
    description: 'Complete a month under budget',
    tiers: {
      bronze: { months: 1, xp: 100 },
      silver: { months: 3, xp: 200 },
      gold: { months: 6, xp: 500 }
    }
  },
  CONSISTENCY_CHAMP: {
    name: 'Consistency Champ',
    description: 'Log expenses daily for consecutive days',
    tiers: {
      bronze: { days: 7, xp: 50 },
      silver: { days: 30, xp: 150 },
      gold: { days: 90, xp: 300 }
    }
  },
  GOAL_GETTER: {
    name: 'Goal Getter',
    description: 'Complete savings goals',
    tiers: {
      bronze: { goals: 1, xp: 100 },
      silver: { goals: 3, xp: 250 },
      gold: { goals: 5, xp: 500 }
    }
  },
  TRANSPORT_WISE: {
    name: 'Transport Wise',
    description: 'Keep transport costs low',
    tiers: {
      bronze: { threshold: 100, xp: 50 },
      silver: { threshold: 75, xp: 100 },
      gold: { threshold: 50, xp: 200 }
    }
  }
};

// XP rewards
const XP_REWARDS = {
  EXPENSE_LOG: 10,
  BUDGET_MET: 100,
  GOAL_COMPLETED: 250,
  STREAK_DAY: 5,
  MONTHLY_SUMMARY: 20
};

// Level thresholds (XP needed for each level)
const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  500,    // Level 4
  1000,   // Level 5
  2000,   // Level 6
  3500,   // Level 7
  5500,   // Level 8
  8000,   // Level 9
  11000   // Level 10
];

// Budget alert thresholds (percentage)
const BUDGET_ALERT_THRESHOLDS = [50, 75, 90, 100];

// Ghana phone number validation (accepts 233XXXXXXXXX or 0XXXXXXXXX)
const GHANA_PHONE_REGEX = /^(233[0-9]{9}|0[0-9]{9})$/;
const GHANA_PHONE_PREFIXES = ['233', '0'];

// Motivational messages for dashboard
const MOTIVATIONAL_MESSAGES = {
  UNDER_BUDGET: [
    "Chale, you dey do well! 💪",
    "Keep it up, boss! Your wallet go thank you 🙌",
    "You be money master! 🌟",
    "Eiii, you dey save paaa! 💰"
  ],
  OVER_BUDGET: [
    "Small small ooo, you go reach 😅",
    "Masa, check your spending waa 🤔",
    "Time to slow down small 💡",
    "Remember your budget o! 📊"
  ],
  ON_TRACK: [
    "You dey on point! ✨",
    "Nice one! Keep pushing 🚀",
    "Balance is key, you're doing great! ⚖️",
    "Steady progress, champ! 👏"
  ],
  STREAK: [
    "You dey hot! {streak} days streak 🔥",
    "Consistency is key! {streak} days strong 💪",
    "Keep the fire burning! {streak} days 🌟"
  ],
  GOAL_NEAR: [
    "Almost there! You fit do am! 🎯",
    "Small more, you go reach your goal! 💪",
    "Your goal dey close! Push am! 🚀"
  ],
  GOAL_COMPLETED: [
    "Ayeekoo! You did it! 🎉",
    "Goal completed! You too sharp! 🌟",
    "Eiii, you be goal getter! 💯"
  ]
};

// Notification types
const NOTIFICATION_TYPES = {
  BUDGET_ALERT: 'budget_alert',
  GOAL_REMINDER: 'goal_reminder',
  STREAK_MILESTONE: 'streak_milestone',
  BADGE_EARNED: 'badge_earned',
  WEEKLY_SUMMARY: 'weekly_summary',
  LEVEL_UP: 'level_up'
};

// Recurring expense frequencies
const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly'];

module.exports = {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  INCOME_SOURCES,
  BUDGET_PERIODS,
  GOAL_STATUSES,
  BADGES,
  XP_REWARDS,
  LEVEL_THRESHOLDS,
  BUDGET_ALERT_THRESHOLDS,
  GHANA_PHONE_REGEX,
  GHANA_PHONE_PREFIXES,
  MOTIVATIONAL_MESSAGES,
  NOTIFICATION_TYPES,
  RECURRING_FREQUENCIES
};
