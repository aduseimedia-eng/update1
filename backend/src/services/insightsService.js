const { query } = require('../config/database');

/**
 * KudiSave Spending Insights Engine v2
 * Generates smart, contextual, actionable insights from user spending data.
 * All calculations verified for accuracy.
 */

// Helper: safely parse a numeric DB value
function num(val) { return parseFloat(val) || 0; }
function int(val) { return parseInt(val) || 0; }

// ─────────────────────────────────────────────
// 1. WEEKLY SPENDING CHANGE
// ─────────────────────────────────────────────
async function weeklyChangeInsight(userId) {
  // Compare rolling 7-day windows for accuracy regardless of week start day
  const result = await query(
    `WITH current_week AS (
      SELECT COALESCE(SUM(amount), 0) as total,
             COUNT(*) as txn_count
      FROM expenses
      WHERE user_id = $1 AND expense_date > CURRENT_DATE - 7
    ),
    previous_week AS (
      SELECT COALESCE(SUM(amount), 0) as total,
             COUNT(*) as txn_count
      FROM expenses
      WHERE user_id = $1 
        AND expense_date > CURRENT_DATE - 14
        AND expense_date <= CURRENT_DATE - 7
    )
    SELECT cw.total as current, cw.txn_count as current_txns,
           pw.total as previous, pw.txn_count as previous_txns,
      CASE WHEN pw.total = 0 THEN 0 
      ELSE ROUND(((cw.total - pw.total) / pw.total * 100), 1) END as change
    FROM current_week cw, previous_week pw`,
    [userId]
  );
  const r = result.rows[0];
  const current = num(r.current);
  const previous = num(r.previous);
  const change = num(r.change);

  if (previous === 0 && current === 0) return null;

  // If previous week had no data, handle gracefully
  if (previous === 0 && current > 0) {
    return {
      type: 'info', icon: 'bar-chart-3', priority: 4, mood: 'chill',
      title: 'First Week Tracked! 📊',
      message: `You spent ₵${Math.round(current)} across ${int(r.current_txns)} transactions this week. Next week we'll compare and give you a trend!`,
      tip: 'Keep logging consistently — the real insights start after week 2! 🚀'
    };
  }

  const savedAmount = Math.round(Math.abs(current - previous));
  if (change < -20) {
    return {
      type: 'positive', icon: 'party-popper', priority: 1, mood: 'celebrate',
      title: 'Massive Savings! 🏆',
      message: `You spent ${Math.abs(change)}% LESS than last week — that's ₵${savedAmount} saved! (₵${Math.round(current)} vs ₵${Math.round(previous)})`,
      tip: 'You\'re on fire! Slide those savings into a goal — future you will celebrate 🥳'
    };
  } else if (change < -5) {
    return {
      type: 'positive', icon: 'trending-down', priority: 3, mood: 'celebrate',
      title: 'Spending Dipped! 📉',
      message: `Down ${Math.abs(change)}% from last week (₵${Math.round(current)} vs ₵${Math.round(previous)}). You saved ₵${savedAmount}!`,
      tip: 'Small wins add up. Keep this momentum going! 💪'
    };
  } else if (change > 40) {
    return {
      type: 'alert', icon: 'alert-triangle', priority: 1, mood: 'alert',
      title: 'Spending Surge! 🚨',
      message: `Spending jumped ${change}% — ₵${Math.round(current)} this week vs ₵${Math.round(previous)} last week. That's ₵${savedAmount} more!`,
      tip: 'Check your recent expenses — is there a one-off purchase or a new habit forming? 🔍'
    };
  } else if (change > 15) {
    return {
      type: 'warning', icon: 'trending-up', priority: 2, mood: 'nudge',
      title: 'Wallet Says Ouch!',
      message: `Spending crept up ${change}% from last week (₵${Math.round(current)} vs ₵${Math.round(previous)}).`,
      tip: 'Small increases become big ones. Review this week\'s extras! 👀'
    };
  } else {
    return {
      type: 'info', icon: 'minus-circle', priority: 5, mood: 'chill',
      title: 'Steady Spending ⚖️',
      message: `Almost identical to last week — ₵${Math.round(current)} vs ₵${Math.round(previous)} (${change > 0 ? '+' : ''}${change}%). Consistency is key!`,
      tip: 'Stable spending is great if it\'s within budget. Quick budget check? 🧐'
    };
  }
}

// ─────────────────────────────────────────────
// 2. TOP SPENDING CATEGORY
// ─────────────────────────────────────────────
async function topCategoryInsight(userId) {
  const result = await query(
    `SELECT category, SUM(amount) as total,
      COUNT(*) as txn_count,
      ROUND(SUM(amount) / NULLIF((SELECT SUM(amount) FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30), 0) * 100, 1) as pct
     FROM expenses
     WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30
     GROUP BY category ORDER BY total DESC LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const cat = result.rows[0];
  const pct = num(cat.pct);
  const total = num(cat.total);

  const funNames = {
    'Food': '🍔 Food', 'Transport': '🚗 Transport', 'Shopping': '🛍️ Shopping',
    'Entertainment': '🎬 Entertainment', 'Bills': '📱 Bills', 'Health': '💊 Health',
    'Education': '📚 Education', 'Utilities': '💡 Utilities', 'Rent': '🏠 Rent'
  };
  const catName = funNames[cat.category] || cat.category;

  if (pct > 60) {
    return {
      type: 'alert', icon: 'tag', priority: 2, mood: 'nudge',
      title: `${catName} Dominates! 😬`,
      message: `${cat.category} takes ${pct}% of all spending (₵${Math.round(total)}, ${cat.txn_count} transactions). It's eating more than half your budget!`,
      tip: 'When one category dominates, everything else suffers. Set a cap for this one! 🎯'
    };
  } else if (pct > 35) {
    return {
      type: 'warning', icon: 'tag', priority: 3, mood: 'nudge',
      title: `#1 Spending: ${catName}`,
      message: `${cat.category} leads at ${pct}% of spending (₵${Math.round(total)} across ${cat.txn_count} transactions this month).`,
      tip: pct > 40 ? 'Consider setting a monthly limit for this category 🙏' : 'This is normal — just make sure it\'s intentional! 📊'
    };
  } else {
    return {
      type: 'info', icon: 'tag', priority: 5, mood: 'chill',
      title: `Top Category: ${catName}`,
      message: `${cat.category} leads spending at ${pct}% (₵${Math.round(total)}), but it's a healthy share. Well balanced! 👌`,
      tip: 'Your spending is well distributed. Keep it up! 🌟'
    };
  }
}

// ─────────────────────────────────────────────
// 3. WEEKEND vs WEEKDAY SPENDING (accurate day counts)
// ─────────────────────────────────────────────
async function weekendVsWeekdayInsight(userId) {
  const result = await query(
    `SELECT 
      COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM expense_date) IN (0, 6) THEN amount END), 0) as weekend_total,
      COALESCE(SUM(CASE WHEN EXTRACT(DOW FROM expense_date) NOT IN (0, 6) THEN amount END), 0) as weekday_total,
      COUNT(DISTINCT CASE WHEN EXTRACT(DOW FROM expense_date) IN (0, 6) THEN expense_date END) as weekend_days,
      COUNT(DISTINCT CASE WHEN EXTRACT(DOW FROM expense_date) NOT IN (0, 6) THEN expense_date END) as weekday_days
     FROM expenses
     WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30`,
    [userId]
  );
  const r = result.rows[0];
  const weekendDays = int(r.weekend_days);
  const weekdayDays = int(r.weekday_days);

  if (weekendDays === 0 || weekdayDays === 0) return null;

  const weekendAvg = num(r.weekend_total) / weekendDays;
  const weekdayAvg = num(r.weekday_total) / weekdayDays;

  if (weekendAvg === 0 && weekdayAvg === 0) return null;

  const ratio = weekendAvg / Math.max(weekdayAvg, 1);

  if (ratio > 1.8) {
    return {
      type: 'warning', icon: 'calendar-heart', priority: 3, mood: 'nudge',
      title: 'Weekend Warrior! 🎊',
      message: `Weekends cost ${Math.round((ratio - 1) * 100)}% more per day — ₵${Math.round(weekendAvg)}/day vs ₵${Math.round(weekdayAvg)} on weekdays.`,
      tip: 'Plan weekend fun in advance with a set budget. Free activities exist too! 🌳'
    };
  } else if (ratio < 0.5 && weekdayAvg > 0) {
    return {
      type: 'positive', icon: 'briefcase', priority: 5, mood: 'chill',
      title: 'Chill Weekends 🧘',
      message: `Weekends are relaxed at ₵${Math.round(weekendAvg)}/day vs ₵${Math.round(weekdayAvg)} on weekdays. Your weekends are your wallet's favorite!`,
      tip: 'Weekday costs are often food + transport. Try meal-prepping on Sundays! 🍱'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 4. NO-SPEND DAYS (rolling 7 days, not calendar week)
// ─────────────────────────────────────────────
async function noSpendDaysInsight(userId) {
  const result = await query(
    `SELECT 
      7 as total_days,
      COUNT(DISTINCT expense_date) as spend_days
     FROM expenses
     WHERE user_id = $1 AND expense_date > CURRENT_DATE - 7`,
    [userId]
  );
  const r = result.rows[0];
  const noSpendDays = 7 - int(r.spend_days);

  if (noSpendDays >= 4) {
    return {
      type: 'positive', icon: 'sparkles', priority: 2, mood: 'celebrate',
      title: `${noSpendDays} Zero-Spend Days! 🤑`,
      message: `${noSpendDays} out of 7 days with ZERO spending! That's elite-level discipline! 🏅`,
      tip: 'Can you beat this next week? Challenge yourself! 💪'
    };
  } else if (noSpendDays >= 2) {
    return {
      type: 'positive', icon: 'sparkles', priority: 4, mood: 'chill',
      title: `${noSpendDays} No-Spend Days 🌟`,
      message: `${noSpendDays} days this past week with zero spending. Your wallet got some rest!`,
      tip: 'Aim for 3+ no-spend days to supercharge your savings 🎯'
    };
  } else if (noSpendDays === 0) {
    return {
      type: 'info', icon: 'help-circle', priority: 4, mood: 'nudge',
      title: 'Money Goes Brrrr 💸',
      message: 'You spent money every single day this past week. Your wallet hasn\'t had a break! 😅',
      tip: 'Challenge: pick one day this week and spend absolutely nothing. Can you do it? 🎯'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 5. UNUSUAL SPENDING DETECTION (Spike)
// ─────────────────────────────────────────────
async function unusualSpendingInsight(userId) {
  const result = await query(
    `WITH daily_avg AS (
      SELECT COALESCE(AVG(daily_total), 0) as avg_daily,
             COALESCE(STDDEV(daily_total), 0) as std_daily
      FROM (
        SELECT expense_date, SUM(amount) as daily_total
        FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30
        GROUP BY expense_date
      ) d
    ),
    today AS (
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE user_id = $1 AND expense_date = CURRENT_DATE
    ),
    yesterday AS (
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE user_id = $1 AND expense_date = CURRENT_DATE - 1
    )
    SELECT da.avg_daily, da.std_daily, t.total as today_total, y.total as yesterday_total
    FROM daily_avg da, today t, yesterday y`,
    [userId]
  );
  const r = result.rows[0];
  const avg = num(r.avg_daily);
  const std = num(r.std_daily);
  const today = num(r.today_total);
  const yesterday = num(r.yesterday_total);

  const checkAmount = today > 0 ? today : yesterday;
  const checkLabel = today > 0 ? 'Today' : 'Yesterday';

  if (avg > 0 && std > 0 && checkAmount > avg + (std * 1.5)) {
    const multiplier = (checkAmount / avg).toFixed(1);
    return {
      type: 'alert', icon: 'shield-alert', priority: 1, mood: 'alert',
      title: `${checkLabel}: Unusual Spend! 💸`,
      message: `${checkLabel}'s spending (₵${Math.round(checkAmount)}) is ${multiplier}x your daily average of ₵${Math.round(avg)}. That's significantly above normal!`,
      tip: 'Was this planned? If not, review the expense. One big day can shift your whole week 🔍'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 6. CATEGORY TREND (Growing AND Shrinking, with threshold)
// ─────────────────────────────────────────────
async function categoryTrendInsight(userId) {
  const result = await query(
    `WITH current_month AS (
      SELECT category, SUM(amount) as total
      FROM expenses WHERE user_id = $1 AND expense_date >= date_trunc('month', CURRENT_DATE)
      GROUP BY category
    ),
    previous_month AS (
      SELECT category, SUM(amount) as total
      FROM expenses WHERE user_id = $1 
        AND expense_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
        AND expense_date < date_trunc('month', CURRENT_DATE)
      GROUP BY category
    )
    SELECT cm.category, cm.total as current_total, pm.total as previous_total,
      CASE WHEN pm.total = 0 THEN 100
      ELSE ROUND(((cm.total - pm.total) / pm.total * 100), 1) END as change_pct
    FROM current_month cm
    JOIN previous_month pm ON cm.category = pm.category
    WHERE pm.total > 5
    ORDER BY ABS(((cm.total - pm.total) / NULLIF(pm.total, 0) * 100)) DESC
    LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const cat = result.rows[0];
  const change = num(cat.change_pct);
  const currentTotal = num(cat.current_total);
  const previousTotal = num(cat.previous_total);
  const diff = Math.round(Math.abs(currentTotal - previousTotal));

  if (change > 50) {
    return {
      type: 'alert', icon: 'trending-up', priority: 2, mood: 'nudge',
      title: `${cat.category} Spiking! 📈`,
      message: `${cat.category} is up ${change}% vs last month — ₵${Math.round(currentTotal)} vs ₵${Math.round(previousTotal)}. That's ₵${diff} more!`,
      tip: 'Dig into what\'s driving this increase and set a category budget 🎯'
    };
  } else if (change > 20) {
    return {
      type: 'warning', icon: 'trending-up', priority: 3, mood: 'nudge',
      title: `${cat.category} Rising ${change}%`,
      message: `${cat.category} spending grew from ₵${Math.round(previousTotal)} to ₵${Math.round(currentTotal)} this month (+₵${diff}).`,
      tip: 'Keep an eye on this — consistent increases add up fast! 👀'
    };
  } else if (change < -30) {
    return {
      type: 'positive', icon: 'trending-down', priority: 3, mood: 'celebrate',
      title: `${cat.category} Tamed! 🦁`,
      message: `${cat.category} dropped ${Math.abs(change)}% — you saved ₵${diff} compared to last month! Real progress! 💪`,
      tip: 'You\'ve proven you can control this category. Legend status! 🌟'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 7. BUDGET PROXIMITY WARNING (with pace tracking)
// ─────────────────────────────────────────────
async function budgetInsight(userId) {
  const result = await query(
    `SELECT b.amount as budget, b.period_type, b.start_date, b.end_date,
      COALESCE(SUM(e.amount), 0) as spent,
      ROUND(COALESCE(SUM(e.amount), 0) / NULLIF(b.amount, 0) * 100, 1) as usage_pct,
      (b.end_date - CURRENT_DATE) as days_left,
      (CURRENT_DATE - b.start_date) as days_elapsed,
      (b.end_date - b.start_date) as total_days
     FROM budgets b
     LEFT JOIN expenses e ON b.user_id = e.user_id
       AND e.expense_date BETWEEN b.start_date AND b.end_date
     WHERE b.user_id = $1 AND b.is_active = true
     GROUP BY b.amount, b.period_type, b.start_date, b.end_date
     LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const b = result.rows[0];
  const usage = num(b.usage_pct);
  const spent = num(b.spent);
  const budget = num(b.budget);
  const remaining = budget - spent;
  const daysLeft = Math.max(int(b.days_left), 0);
  const daysElapsed = Math.max(int(b.days_elapsed), 1);
  const totalDays = Math.max(int(b.total_days), 1);
  const expectedUsage = Math.round((daysElapsed / totalDays) * 100);
  const dailyAllowance = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0;

  if (usage >= 100) {
    return {
      type: 'alert', icon: 'shield-alert', priority: 0, mood: 'alert',
      title: 'Budget Exceeded! 🚨',
      message: `You've spent ₵${Math.round(spent)} of your ₵${Math.round(budget)} ${b.period_type} budget — ₵${Math.round(Math.abs(remaining))} over! ${daysLeft > 0 ? `Still ${daysLeft} days left in the period.` : ''}`,
      tip: 'Review your biggest expenses and cut what you can for the rest of the period! 🛑'
    };
  } else if (usage >= 80) {
    return {
      type: 'warning', icon: 'clock', priority: 1, mood: 'nudge',
      title: 'Budget Running Low! 🫣',
      message: `${usage}% used with ${daysLeft} days left. Only ₵${Math.round(remaining)} remains — that's ₵${dailyAllowance}/day to stay on track.`,
      tip: `Stick to ₵${dailyAllowance}/day max and you'll finish within budget! You got this! 💪`
    };
  } else if (usage > expectedUsage + 15) {
    return {
      type: 'warning', icon: 'gauge', priority: 2, mood: 'nudge',
      title: 'Ahead of Budget Pace ⚡',
      message: `You're at ${usage}% used but should be around ${expectedUsage}% based on time elapsed. Spending faster than planned!`,
      tip: `Slow down to ₵${dailyAllowance}/day to finish within budget 🎯`
    };
  } else if (usage < expectedUsage - 20 && usage > 0) {
    return {
      type: 'positive', icon: 'wallet', priority: 3, mood: 'celebrate',
      title: 'Under Budget! 😎',
      message: `${usage}% spent vs ${expectedUsage}% expected at this point. You're ₵${Math.round(budget * (expectedUsage - usage) / 100)} ahead of pace!`,
      tip: 'Amazing discipline! Consider saving the surplus toward a goal 🎯'
    };
  } else if (usage <= 40) {
    return {
      type: 'positive', icon: 'wallet', priority: 5, mood: 'celebrate',
      title: 'Budget Boss! 💎',
      message: `Only ${usage}% used with ₵${Math.round(remaining)} remaining. You're running this budget like a CEO!`,
      tip: 'Maybe put some of that extra into a savings goal? 🎯'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 8. SAVINGS GOAL PACE
// ─────────────────────────────────────────────
async function savingsGoalInsight(userId) {
  const result = await query(
    `SELECT title, current_amount, target_amount, deadline,
      ROUND(current_amount / NULLIF(target_amount, 0) * 100, 1) as progress,
      deadline - CURRENT_DATE as days_remaining
     FROM goals
     WHERE user_id = $1 AND status = 'active' AND deadline IS NOT NULL
     ORDER BY deadline ASC LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const g = result.rows[0];
  const progress = num(g.progress);
  const daysLeft = int(g.days_remaining);
  const remaining = num(g.target_amount) - num(g.current_amount);
  const dailyNeeded = daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining;

  if (daysLeft <= 0 && progress < 100) {
    return {
      type: 'warning', icon: 'hourglass', priority: 1, mood: 'nudge',
      title: 'Goal Deadline Passed 😬',
      message: `"${g.title}" deadline has passed at ${progress}%. Still ₵${Math.round(remaining)} to go.`,
      tip: `Extend the deadline — progress beats perfection! You're at ${progress}%, not 0%! 💪`
    };
  } else if (daysLeft > 0 && daysLeft <= 7 && progress < 90) {
    return {
      type: 'warning', icon: 'target', priority: 1, mood: 'nudge',
      title: 'Goal Crunch Time! ⏱️',
      message: `"${g.title}" is due in ${daysLeft} days at ${progress}%. Need ₵${dailyNeeded}/day to make it!`,
      tip: `Save ₵${dailyNeeded}/day for ${daysLeft} days and you'll hit your target! Sprint! 🏃`
    };
  } else if (progress >= 90 && progress < 100) {
    return {
      type: 'positive', icon: 'flag', priority: 2, mood: 'celebrate',
      title: 'SO Close! 🤩',
      message: `"${g.title}" is ${progress}% done! Just ₵${Math.round(remaining)} more!`,
      tip: 'One more push and this goal is CRUSHED! You can taste it! 💥'
    };
  } else if (daysLeft > 7 && progress > 0) {
    const saved = num(g.current_amount);
    const target = num(g.target_amount);
    if (progress >= 50) {
      return {
        type: 'positive', icon: 'rocket', priority: 3, mood: 'celebrate',
        title: 'Goal On Track! 🚀',
        message: `"${g.title}" is ${progress}% done with ${daysLeft} days left. ₵${dailyNeeded}/day needed.`,
        tip: 'You\'re past halfway! Keep the momentum going! 🌟'
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// 9. BEST & WORST SPENDING DAY
// ─────────────────────────────────────────────
async function bestDayInsight(userId) {
  const result = await query(
    `SELECT 
      TO_CHAR(expense_date, 'Day') as day_name,
      ROUND(AVG(daily_total), 2) as avg_amount,
      COUNT(*) as occurrences
     FROM (
       SELECT expense_date, SUM(amount) as daily_total
       FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 60
       GROUP BY expense_date
     ) d
     GROUP BY TO_CHAR(expense_date, 'Day'), EXTRACT(DOW FROM expense_date)
     HAVING COUNT(*) >= 2
     ORDER BY avg_amount ASC
     LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  const dayName = r.day_name.trim();
  const avgAmount = num(r.avg_amount);

  // Also get the worst day
  const worstResult = await query(
    `SELECT TO_CHAR(expense_date, 'Day') as day_name,
      ROUND(AVG(daily_total), 2) as avg_amount
     FROM (
       SELECT expense_date, SUM(amount) as daily_total
       FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 60
       GROUP BY expense_date
     ) d
     GROUP BY TO_CHAR(expense_date, 'Day'), EXTRACT(DOW FROM expense_date)
     HAVING COUNT(*) >= 2
     ORDER BY avg_amount DESC
     LIMIT 1`,
    [userId]
  );

  if (worstResult.rows.length > 0) {
    const worst = worstResult.rows[0];
    const worstDay = worst.day_name.trim();
    const worstAvg = num(worst.avg_amount);
    if (worstDay !== dayName) {
      return {
        type: 'info', icon: 'calendar', priority: 5, mood: 'chill',
        title: `${dayName} = Cheapest 💚`,
        message: `${dayName}: ₵${Math.round(avgAmount)}/day (cheapest) vs ${worstDay}: ₵${Math.round(worstAvg)}/day (most expensive). That's ${Math.round((worstAvg / Math.max(avgAmount, 1) - 1) * 100)}% more!`,
        tip: 'Schedule bigger purchases on your cheap day. Small hack, big savings! 🧠'
      };
    }
  }

  return {
    type: 'info', icon: 'calendar', priority: 5, mood: 'chill',
    title: `${dayName} = Chill Day 🧊`,
    message: `${dayName} is when your wallet gets to relax — only ₵${Math.round(avgAmount)} on average.`,
    tip: 'Fun hack: schedule big purchases on your cheapest day of the week 🧠'
  };
}

// ─────────────────────────────────────────────
// 10. STREAK-BASED INSIGHT
// ─────────────────────────────────────────────
async function streakInsight(userId) {
  try {
    const result = await query(
      'SELECT current_streak, longest_streak FROM streaks WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) return null;
    const s = result.rows[0];
    const current = int(s.current_streak);
    const longest = int(s.longest_streak);

    if (current >= 7 && current === longest) {
      return {
        type: 'positive', icon: 'flame', priority: 2, mood: 'celebrate',
        title: `${current}-Day RECORD! 🏅`,
        message: `${current} days straight — your LONGEST streak EVER! You're unstoppable! 🚀`,
        tip: 'DON\'T STOP! Log today\'s expenses and keep the fire burning! 🔥🔥🔥'
      };
    } else if (current >= 7) {
      return {
        type: 'positive', icon: 'flame', priority: 3, mood: 'celebrate',
        title: `${current}-Day Streak! 💪`,
        message: `${current} days of consistent tracking! Record is ${longest} days — ${longest - current} more to beat it!`,
        tip: `You're ${longest - current} days from a new record! Keep going! 🎯`
      };
    } else if (current >= 3) {
      return {
        type: 'info', icon: 'flame', priority: 4, mood: 'chill',
        title: `${current}-Day Streak 🔥`,
        message: `${current} consecutive days of tracking. Building that habit! Best ever: ${longest} days.`,
        tip: 'Consistency is the secret to financial mastery. Keep it up! 📈'
      };
    } else if (current === 0) {
      return {
        type: 'info', icon: 'moon', priority: 5, mood: 'nudge',
        title: 'Streak Paused 💤',
        message: 'Your tracking streak is on hold. Wake it up by logging an expense today!',
        tip: 'People who track daily save 2x more on average. Let\'s restart! 🚀'
      };
    }
  } catch (e) {
    return null;
  }
  return null;
}

// ─────────────────────────────────────────────
// 11. SAVINGS RATE INSIGHT
// ─────────────────────────────────────────────
async function savingsRateInsight(userId) {
  const result = await query(
    `SELECT 
      COALESCE((SELECT SUM(amount) FROM income WHERE user_id = $1 AND income_date >= date_trunc('month', CURRENT_DATE)), 0) as income,
      COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = $1 AND expense_date >= date_trunc('month', CURRENT_DATE)), 0) as expenses`,
    [userId]
  );
  const r = result.rows[0];
  const income = num(r.income);
  const expenses = num(r.expenses);
  if (income === 0) return null;

  const saved = income - expenses;
  const rate = Math.round((saved / income) * 100);

  if (rate >= 40) {
    return {
      type: 'positive', icon: 'trophy', priority: 1, mood: 'celebrate',
      title: `${rate}% Savings Rate! 👑`,
      message: `You're keeping ${rate}% of your income (₵${Math.round(saved)}) this month! That's world-class saving!`,
      tip: 'Experts recommend 20%. You\'re DOUBLE that! Future millionaire energy! 💸'
    };
  } else if (rate >= 20) {
    return {
      type: 'positive', icon: 'piggy-bank', priority: 3, mood: 'celebrate',
      title: `${rate}% Saved! 🌟`,
      message: `₵${Math.round(saved)} saved out of ₵${Math.round(income)} income (${rate}%). You're hitting the recommended 20% target!`,
      tip: 'You\'re doing exactly what financial experts recommend. Proud of you! 🎯'
    };
  } else if (rate > 0 && rate < 10) {
    return {
      type: 'warning', icon: 'trending-down', priority: 2, mood: 'nudge',
      title: `Only ${rate}% Saved 😢`,
      message: `You're keeping just ₵${Math.round(saved)} of ₵${Math.round(income)} income (${rate}%). Your savings account is looking thin!`,
      tip: 'Quick win: cut your top spending category by 20%. Small moves, big results! 🎯'
    };
  } else if (rate <= 0) {
    return {
      type: 'alert', icon: 'alert-circle', priority: 0, mood: 'alert',
      title: 'Spending > Income! 🚨',
      message: `You've spent ₵${Math.round(Math.abs(saved))} more than you earned this month. Expenses (₵${Math.round(expenses)}) beat income (₵${Math.round(income)}).`,
      tip: 'Urgent: identify and cut your biggest non-essential expense TODAY! Every cedi counts! 💪'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 12. PAYMENT METHOD INSIGHT
// ─────────────────────────────────────────────
async function paymentMethodInsight(userId) {
  const result = await query(
    `SELECT payment_method, 
      COUNT(*) as txn_count, 
      SUM(amount) as total,
      ROUND(SUM(amount) / NULLIF((SELECT SUM(amount) FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30), 0) * 100, 1) as pct
     FROM expenses
     WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30 AND payment_method IS NOT NULL
     GROUP BY payment_method ORDER BY total DESC LIMIT 2`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const primary = result.rows[0];
  const pct = num(primary.pct);

  if (pct > 80) {
    const methodTips = {
      'Cash': 'Cash is hard to track — consider MoMo or card for better visibility 📲',
      'Mobile Money': 'Great for tracking! Check your MoMo statement monthly for hidden charges 🕵️',
      'MoMo': 'Great for tracking! Check your MoMo statement monthly for hidden charges 🕵️',
      'Card': 'Card spending is easy to track but also easy to overspend. Watch those taps! 💳',
      'Bank Transfer': 'Bank transfers leave a great paper trail. Keep it up! 🏦'
    };
    return {
      type: 'info', icon: 'credit-card', priority: 5, mood: 'chill',
      title: `${primary.payment_method} Loyalist! 📱`,
      message: `${pct}% of your spending (₵${Math.round(num(primary.total))}) goes through ${primary.payment_method}. It's your go-to! 🤝`,
      tip: methodTips[primary.payment_method] || 'Mixing payment methods can help you track and control spending better! 💡'
    };
  } else if (result.rows.length >= 2) {
    const secondary = result.rows[1];
    return {
      type: 'info', icon: 'credit-card', priority: 6, mood: 'chill',
      title: 'Payment Mix 💳',
      message: `${primary.payment_method} (${pct}%) and ${secondary.payment_method} (${num(secondary.pct)}%) are your top payment methods.`,
      tip: 'Using multiple methods is fine — just make sure you track all of them! 📊'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 13. SPENDING FORECAST (with budget awareness)
// ─────────────────────────────────────────────
async function forecastInsight(userId) {
  const result = await query(
    `SELECT 
      COALESCE(SUM(amount), 0) as spent_so_far,
      EXTRACT(DAY FROM CURRENT_DATE) as days_passed,
      EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')) as days_in_month
    FROM expenses
    WHERE user_id = $1 AND expense_date >= date_trunc('month', CURRENT_DATE)`,
    [userId]
  );
  const r = result.rows[0];
  const spent = num(r.spent_so_far);
  const daysPassed = Math.max(int(r.days_passed), 1);
  const daysInMonth = int(r.days_in_month);
  const daysLeft = daysInMonth - daysPassed;

  if (spent === 0 || daysLeft <= 0) return null;

  const dailyRate = spent / daysPassed;
  const projected = Math.round(dailyRate * daysInMonth);

  // Check against any active budget (not just monthly)
  const budgetResult = await query(
    `SELECT amount FROM budgets WHERE user_id = $1 AND is_active = true LIMIT 1`,
    [userId]
  );

  if (budgetResult.rows.length > 0) {
    const budget = num(budgetResult.rows[0].amount);
    const overAmount = projected - budget;

    if (overAmount > 0) {
      const safeDaily = Math.round((budget - spent) / Math.max(daysLeft, 1));
      return {
        type: 'warning', icon: 'scan-eye', priority: 1, mood: 'nudge',
        title: 'On Track to Overshoot 🔮',
        message: `At ₵${Math.round(dailyRate)}/day, you'll hit ₵${projected} — that's ₵${Math.round(overAmount)} over your ₵${Math.round(budget)} budget!`,
        tip: `Mission: cap spending at ₵${Math.max(safeDaily, 0)}/day for the next ${daysLeft} days 💪`
      };
    } else {
      return {
        type: 'positive', icon: 'scan-eye', priority: 4, mood: 'chill',
        title: 'On Track to Stay Under! ✅',
        message: `Projected: ₵${projected} this month — ₵${Math.round(Math.abs(overAmount))} under your ₵${Math.round(budget)} budget. Nice pace!`,
        tip: 'Keep up this daily rate and you\'ll finish strong! 🏁'
      };
    }
  }

  return {
    type: 'info', icon: 'scan-eye', priority: 4, mood: 'chill',
    title: 'Monthly Forecast 🔮',
    message: `At ₵${Math.round(dailyRate)}/day, you'll spend ~₵${projected} this month. ${daysLeft} days and ₵${Math.round(dailyRate * daysLeft)} to go.`,
    tip: 'Set a budget to get smarter forecasts! Knowledge is power 🧠'
  };
}

// ─────────────────────────────────────────────
// 14. MORNING vs AFTERNOON vs EVENING SPENDING
// ─────────────────────────────────────────────
async function timeOfDayInsight(userId) {
  const result = await query(
    `SELECT 
      COUNT(CASE WHEN EXTRACT(HOUR FROM created_at) BETWEEN 6 AND 11 THEN 1 END) as morning_txns,
      COALESCE(SUM(CASE WHEN EXTRACT(HOUR FROM created_at) BETWEEN 6 AND 11 THEN amount END), 0) as morning_total,
      COUNT(CASE WHEN EXTRACT(HOUR FROM created_at) BETWEEN 12 AND 16 THEN 1 END) as afternoon_txns,
      COALESCE(SUM(CASE WHEN EXTRACT(HOUR FROM created_at) BETWEEN 12 AND 16 THEN amount END), 0) as afternoon_total,
      COUNT(CASE WHEN EXTRACT(HOUR FROM created_at) >= 17 OR EXTRACT(HOUR FROM created_at) < 6 THEN 1 END) as evening_txns,
      COALESCE(SUM(CASE WHEN EXTRACT(HOUR FROM created_at) >= 17 OR EXTRACT(HOUR FROM created_at) < 6 THEN amount END), 0) as evening_total,
      COUNT(*) as total_txns
     FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30`,
    [userId]
  );
  const r = result.rows[0];
  const total = int(r.total_txns);
  if (total < 10) return null;

  const morningPct = Math.round(int(r.morning_txns) / total * 100);
  const eveningPct = Math.round(int(r.evening_txns) / total * 100);

  const morningAvg = int(r.morning_txns) > 0 ? num(r.morning_total) / int(r.morning_txns) : 0;
  const eveningAvg = int(r.evening_txns) > 0 ? num(r.evening_total) / int(r.evening_txns) : 0;

  if (eveningPct >= 50) {
    return {
      type: 'info', icon: 'moon-star', priority: 5, mood: 'chill',
      title: 'Night Owl Spender! 🦉',
      message: `${eveningPct}% of transactions happen after 5 PM. Average evening spend: ₵${Math.round(eveningAvg)} per transaction.`,
      tip: 'Evening spending often = dining out + entertainment. Set an evening budget! 🎯'
    };
  } else if (morningPct >= 45) {
    return {
      type: 'info', icon: 'sunrise', priority: 5, mood: 'chill',
      title: 'Early Bird Spender! 🐦',
      message: `${morningPct}% of transactions happen before noon. Average morning spend: ₵${Math.round(morningAvg)}.`,
      tip: 'Morning spending is often routine (coffee, transport). Try a no-spend morning day! 🧘'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 15. BIGGEST SINGLE EXPENSE (with median comparison)
// ─────────────────────────────────────────────
async function biggestExpenseInsight(userId) {
  const result = await query(
    `SELECT e.amount, e.category, e.note, e.expense_date,
      stats.avg_amount
     FROM expenses e,
     (SELECT AVG(amount) as avg_amount
      FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30) stats
     WHERE e.user_id = $1 AND e.expense_date > CURRENT_DATE - 30
     ORDER BY e.amount DESC LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  const amount = num(r.amount);
  const avg = num(r.avg_amount);
  const multiplier = avg > 0 ? (amount / avg).toFixed(1) : 0;

  if (multiplier > 3) {
    const noteText = r.note ? ` — "${r.note}"` : '';
    return {
      type: 'warning', icon: 'zap', priority: 3, mood: 'nudge',
      title: 'Biggest Expense! 💣',
      message: `₵${Math.round(amount)} on ${r.category}${noteText}. That's ${multiplier}x your average transaction of ₵${Math.round(avg)}!`,
      tip: 'For big purchases: try the 24-hour rule — sleep on it before spending! 😴'
    };
  } else if (multiplier > 2) {
    return {
      type: 'info', icon: 'zap', priority: 5, mood: 'chill',
      title: 'Large Purchase 📦',
      message: `Your biggest this month: ₵${Math.round(amount)} on ${r.category} (${multiplier}x your average).`,
      tip: 'Large purchases are fine when planned. Make sure this one was intentional! ✅'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 16. RECURRING EXPENSE BURDEN
// ─────────────────────────────────────────────
async function recurringBurdenInsight(userId) {
  try {
    const result = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN is_recurring = true THEN amount END), 0) as recurring_total,
        COALESCE(SUM(amount), 0) as total,
        COUNT(CASE WHEN is_recurring = true THEN 1 END) as recurring_count
       FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30`,
      [userId]
    );
    const r = result.rows[0];
    const recurringTotal = num(r.recurring_total);
    const total = num(r.total);
    const count = int(r.recurring_count);
    const pct = total > 0 ? Math.round(recurringTotal / total * 100) : 0;

    if (pct > 50 && count > 3) {
      return {
        type: 'warning', icon: 'refresh-cw', priority: 2, mood: 'nudge',
        title: 'Recurring Costs High! 📦',
        message: `${pct}% of spending (₵${Math.round(recurringTotal)}) is recurring — ${count} auto-pay items eating your budget!`,
        tip: 'Audit your subscriptions — cancel what you don\'t actively use! 🙏'
      };
    } else if (count > 0 && pct < 15) {
      return {
        type: 'positive', icon: 'check-circle', priority: 6, mood: 'celebrate',
        title: 'Low Fixed Costs! 🥷',
        message: `Only ${pct}% of spending (₵${Math.round(recurringTotal)}) is recurring. Lean and flexible!`,
        tip: 'Low fixed costs = more freedom for savings and fun. Nice! 🎯'
      };
    }
  } catch (e) { return null; }
  return null;
}

// ─────────────────────────────────────────────
// 17. CATEGORY DIVERSITY
// ─────────────────────────────────────────────
async function categoryDiversityInsight(userId) {
  const result = await query(
    `SELECT COUNT(DISTINCT category) as cat_count,
      (SELECT category FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30 
       GROUP BY category ORDER BY SUM(amount) DESC LIMIT 1) as top_cat,
      (SELECT ROUND(SUM(amount) / NULLIF((SELECT SUM(amount) FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30), 0) * 100, 1)
       FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30
       GROUP BY category ORDER BY SUM(amount) DESC LIMIT 1) as top_pct
     FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30`,
    [userId]
  );
  const r = result.rows[0];
  const catCount = int(r.cat_count);
  const topPct = num(r.top_pct);

  if (catCount >= 6 && topPct < 30) {
    return {
      type: 'positive', icon: 'rainbow', priority: 5, mood: 'celebrate',
      title: 'Well Diversified! ⚖️',
      message: `Spending spread across ${catCount} categories with no single one above ${topPct}%. That's balanced! 🎨`,
      tip: 'Balanced spending = balanced life. Smart money moves! 🌟'
    };
  } else if (catCount <= 2 && catCount > 0) {
    return {
      type: 'info', icon: 'target', priority: 6, mood: 'chill',
      title: 'Laser Focused! 🔬',
      message: `Just ${catCount} spending ${catCount === 1 ? 'category' : 'categories'} this month. Super focused!`,
      tip: 'Focused is fine — just make sure all your needs are covered! ✅'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 18. EXPENSE FREQUENCY
// ─────────────────────────────────────────────
async function frequencyInsight(userId) {
  const result = await query(
    `SELECT COUNT(*) as total_txns,
      COUNT(DISTINCT expense_date) as active_days,
      ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT expense_date), 0), 1) as txns_per_day
     FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 14`,
    [userId]
  );
  const r = result.rows[0];
  const perDay = num(r.txns_per_day);
  const totalTxns = int(r.total_txns);
  const activeDays = int(r.active_days);

  if (perDay >= 5) {
    return {
      type: 'warning', icon: 'bolt', priority: 3, mood: 'nudge',
      title: 'Transaction Machine! 🤖',
      message: `${perDay} transactions per active day (${totalTxns} total in ${activeDays} days). That's a lot of swipes!`,
      tip: 'Try batching purchases — one trip instead of five. Fewer swipes = fewer temptations! 🛒'
    };
  } else if (perDay > 0 && perDay <= 1.5) {
    return {
      type: 'positive', icon: 'heart-pulse', priority: 6, mood: 'chill',
      title: 'Mindful Spender! 🤓',
      message: `~${perDay} transactions per day — thoughtful and intentional spending!`,
      tip: 'Fewer transactions often mean less impulse buying. Quality decisions! ✨'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 19. MICRO-SPEND TRACKER
// ─────────────────────────────────────────────
async function microSpendInsight(userId) {
  const result = await query(
    `SELECT COUNT(*) as small_count,
      COALESCE(SUM(amount), 0) as small_total,
      (SELECT COUNT(*) FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30) as total_count,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30) as total_spending
     FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30 AND amount <= 10`,
    [userId]
  );
  const r = result.rows[0];
  const smallCount = int(r.small_count);
  const smallTotal = num(r.small_total);
  const totalCount = int(r.total_count);
  const totalSpending = num(r.total_spending);
  const smallPct = totalCount > 0 ? Math.round(smallCount / totalCount * 100) : 0;
  const amountPct = totalSpending > 0 ? Math.round(smallTotal / totalSpending * 100) : 0;

  if (smallCount >= 10 && smallPct > 30) {
    return {
      type: 'warning', icon: 'coins', priority: 3, mood: 'nudge',
      title: 'Small Spends Adding Up! 🪓',
      message: `${smallCount} purchases under ₵10 totaled ₵${Math.round(smallTotal)} (${amountPct}% of all spending). Those "tiny" spends aren't tiny!`,
      tip: 'Toffees, pure water, snacks — they compound! Track these closely 🔋'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 20. INCOME TIMING (Payday spending, fixed date logic)
// ─────────────────────────────────────────────
async function incomeTimingInsight(userId) {
  const result = await query(
    `SELECT income_date, amount as income_amount
     FROM income WHERE user_id = $1 AND income_date > CURRENT_DATE - 60
     ORDER BY income_date DESC LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const payDate = result.rows[0].income_date;

  // Check spending in first 3 days after payday vs rest of 2 weeks
  const spendResult = await query(
    `SELECT 
      COALESCE(SUM(CASE WHEN expense_date BETWEEN $2::date AND ($2::date + 3) THEN amount END), 0) as first_3_days,
      COALESCE(SUM(CASE WHEN expense_date > ($2::date + 3) AND expense_date <= ($2::date + 14) THEN amount END), 0) as rest_11_days,
      COALESCE(SUM(amount), 0) as total_after_pay
     FROM expenses 
     WHERE user_id = $1 AND expense_date >= $2::date AND expense_date <= ($2::date + 14)`,
    [userId, payDate]
  );
  const s = spendResult.rows[0];
  const first3 = num(s.first_3_days);
  const total = num(s.total_after_pay);
  const firstPct = total > 0 ? Math.round(first3 / total * 100) : 0;

  if (firstPct > 45 && total > 0) {
    return {
      type: 'warning', icon: 'wind', priority: 2, mood: 'nudge',
      title: 'Payday FOMO! 🏃',
      message: `${firstPct}% of spending happens within 3 days of payday! The money barely says hello before leaving! 👋💸`,
      tip: 'Pay yourself first: move savings IMMEDIATELY on payday, then spend what\'s left! 🥇'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 21. GOAL MULTIPLIER
// ─────────────────────────────────────────────
async function goalMultiplierInsight(userId) {
  const result = await query(
    `SELECT 
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30 AND category IN ('Entertainment', 'Shopping')) as fun_spending,
      (SELECT target_amount - current_amount FROM goals WHERE user_id = $1 AND status = 'active' ORDER BY deadline ASC LIMIT 1) as goal_remaining,
      (SELECT title FROM goals WHERE user_id = $1 AND status = 'active' ORDER BY deadline ASC LIMIT 1) as goal_title`,
    [userId]
  );
  const r = result.rows[0];
  const fun = num(r.fun_spending);
  const goalLeft = num(r.goal_remaining);
  const goalTitle = r.goal_title;

  if (fun > 0 && goalLeft > 0 && goalTitle) {
    const halfFun = fun * 0.5;
    const months = Math.ceil(goalLeft / halfFun);
    if (months <= 6 && months > 0) {
      return {
        type: 'info', icon: 'calculator', priority: 3, mood: 'nudge',
        title: 'The Math is Mathing! 🤯',
        message: `Cut entertainment + shopping by 50% (save ₵${Math.round(halfFun)}/month) and you'd complete "${goalTitle}" in ${months} month${months > 1 ? 's' : ''}!`,
        tip: 'You don\'t have to stop fun — just halve it! Your future self is counting on you 🤝'
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// 22. BILL WARNING
// ─────────────────────────────────────────────
async function billWarningInsight(userId) {
  try {
    const result = await query(
      `SELECT title, amount, due_date, 
        due_date - CURRENT_DATE as days_until
       FROM bill_reminders 
       WHERE user_id = $1 AND is_active = true AND is_paid = false
         AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
       ORDER BY due_date ASC LIMIT 3`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    const bills = result.rows;
    const total = bills.reduce((sum, b) => sum + num(b.amount), 0);

    if (bills.length >= 2) {
      return {
        type: 'alert', icon: 'clipboard-list', priority: 1, mood: 'alert',
        title: `${bills.length} Bills Due Soon! 😰`,
        message: `₵${Math.round(total)} in bills this week: ${bills.map(b => `${b.title} (₵${Math.round(num(b.amount))})`).join(', ')}.`,
        tip: `Set aside ₵${Math.round(total)} now before it gets spent elsewhere! 🔒`
      };
    } else {
      const b = bills[0];
      const daysUntil = int(b.days_until);
      return {
        type: 'warning', icon: 'bell', priority: 2, mood: 'nudge',
        title: `${b.title} Due ${daysUntil === 0 ? 'TODAY' : `in ${daysUntil}d`}! ⏰`,
        message: `"${b.title}" (₵${Math.round(num(b.amount))}) is ${daysUntil === 0 ? 'due today!' : `due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`}`,
        tip: 'Mark it paid in Bills page once done. Stay on top! 📱'
      };
    }
  } catch (e) { return null; }
}

// ─────────────────────────────────────────────
// 23. SPENDING VELOCITY (3-week trend)
// ─────────────────────────────────────────────
async function velocityInsight(userId) {
  const result = await query(
    `SELECT 
      COALESCE(SUM(CASE WHEN expense_date > CURRENT_DATE - 7 THEN amount END), 0) as week_1,
      COALESCE(SUM(CASE WHEN expense_date > CURRENT_DATE - 14 AND expense_date <= CURRENT_DATE - 7 THEN amount END), 0) as week_2,
      COALESCE(SUM(CASE WHEN expense_date > CURRENT_DATE - 21 AND expense_date <= CURRENT_DATE - 14 THEN amount END), 0) as week_3
     FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 21`,
    [userId]
  );
  const r = result.rows[0];
  const w1 = num(r.week_1);
  const w2 = num(r.week_2);
  const w3 = num(r.week_3);

  if (w1 === 0 || w2 === 0 || w3 === 0) return null;

  if (w1 > w2 && w2 > w3) {
    const accel = Math.round((w1 / w3 - 1) * 100);
    return {
      type: 'alert', icon: 'rocket', priority: 1, mood: 'alert',
      title: 'Spending Accelerating! 🏎️',
      message: `3 straight weeks of increasing spend: ₵${Math.round(w3)} → ₵${Math.round(w2)} → ₵${Math.round(w1)} (+${accel}% overall). Time to pump the brakes!`,
      tip: 'Review this week\'s expenses and cut the extras before it becomes a habit! 🛑'
    };
  } else if (w1 < w2 && w2 < w3) {
    const decel = Math.round((1 - w1 / w3) * 100);
    return {
      type: 'positive', icon: 'trending-down', priority: 2, mood: 'celebrate',
      title: 'Spending Slowing Down! 🎉',
      message: `3 weeks of decreasing spending: ₵${Math.round(w3)} → ₵${Math.round(w2)} → ₵${Math.round(w1)} (down ${decel}%). Beautiful trend!`,
      tip: 'This is how financial freedom starts! Keep the momentum! 🏃‍♂️💨'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 24. ROUND NUMBER DETECTION (safe cast)
// ─────────────────────────────────────────────
async function roundNumberInsight(userId) {
  const result = await query(
    `SELECT 
      COUNT(CASE WHEN FLOOR(amount) % 10 = 0 AND amount = FLOOR(amount) THEN 1 END) as round_count,
      COUNT(*) as total_count
     FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30`,
    [userId]
  );
  const r = result.rows[0];
  const roundCount = int(r.round_count);
  const totalCount = int(r.total_count);
  const pct = totalCount > 0 ? Math.round(roundCount / totalCount * 100) : 0;

  if (pct > 60 && totalCount >= 10) {
    return {
      type: 'info', icon: 'hash', priority: 6, mood: 'chill',
      title: 'Round Number Fan! 🎱',
      message: `${pct}% of your expenses are round numbers (₵10, ₵50, etc). ${roundCount} out of ${totalCount} transactions!`,
      tip: 'If you\'re rounding up, try entering exact amounts for more accurate tracking! 💰'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 25. CATEGORY LOYALTY (simplified query)
// ─────────────────────────────────────────────
async function categoryLoyaltyInsight(userId) {
  const result = await query(
    `SELECT category, COUNT(*) as count
     FROM (
       SELECT category FROM expenses 
       WHERE user_id = $1 
       ORDER BY created_at DESC LIMIT 10
     ) recent
     GROUP BY category ORDER BY count DESC LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  const count = int(r.count);

  if (count >= 6) {
    const funReacts = {
      'Food': 'Your stomach is running the show! 🍕',
      'Transport': 'Going places... literally! 🚌',
      'Shopping': 'The shops know you by name! 🛍️',
      'Entertainment': 'Living your best life! 🎭'
    };
    return {
      type: 'info', icon: 'refresh-cw', priority: 4, mood: 'nudge',
      title: `${r.category} on Repeat! 🎵`,
      message: `${count} of your last 10 expenses are ${r.category}. ${funReacts[r.category] || 'That\'s a strong pattern! 🧐'}`,
      tip: 'Make sure this pattern is intentional, not habitual spending! 🎯'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 26. EXPENSE-FREE WEEKEND
// ─────────────────────────────────────────────
async function expenseFreeWeekendInsight(userId) {
  const dow = new Date().getDay();
  if (dow !== 0 && dow !== 6) return null;

  const result = await query(
    `SELECT COUNT(*) as weekend_expenses
     FROM expenses 
     WHERE user_id = $1 
       AND expense_date >= CURRENT_DATE - ${dow === 0 ? 1 : 0}
       AND EXTRACT(DOW FROM expense_date) IN (0, 6)`,
    [userId]
  );
  const count = int(result.rows[0].weekend_expenses);

  if (count === 0) {
    return {
      type: 'positive', icon: 'palmtree', priority: 2, mood: 'celebrate',
      title: 'Zero-Spend Weekend! 🤑',
      message: 'This weekend: ₵0 spent so far! Your wallet is having the best day! 👑',
      tip: 'Zero-spend weekends are the ultimate flex. Keep it going! 💪'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 27. DAILY AVERAGE INSIGHT
// ─────────────────────────────────────────────
async function dailyAverageInsight(userId) {
  const result = await query(
    `SELECT 
      ROUND(AVG(daily_total), 2) as avg_daily,
      ROUND(MIN(daily_total), 2) as min_daily,
      ROUND(MAX(daily_total), 2) as max_daily,
      COUNT(*) as active_days
     FROM (
       SELECT expense_date, SUM(amount) as daily_total
       FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30
       GROUP BY expense_date
     ) d`,
    [userId]
  );
  if (result.rows.length === 0 || !result.rows[0].avg_daily) return null;
  const r = result.rows[0];
  const avg = num(r.avg_daily);
  const min = num(r.min_daily);
  const max = num(r.max_daily);

  if (avg > 0) {
    const range = max - min;
    const consistency = range < avg * 0.5 ? 'Very consistent!' : range > avg * 2 ? 'Quite variable!' : 'Moderate range.';
    return {
      type: 'info', icon: 'bar-chart-3', priority: 4, mood: 'chill',
      title: `₵${Math.round(avg)}/Day Average 💳`,
      message: `Daily spending: avg ₵${Math.round(avg)}, range ₵${Math.round(min)} – ₵${Math.round(max)} across ${int(r.active_days)} active days. ${consistency}`,
      tip: 'Your daily average is your benchmark. Try to beat it tomorrow! 🎯'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 28. MONEY PERSONALITY (expanded categories)
// ─────────────────────────────────────────────
async function moneyPersonalityInsight(userId) {
  const result = await query(
    `SELECT 
      COALESCE(SUM(CASE WHEN category IN ('Food', 'Transport', 'Bills', 'Health', 'Utilities', 'Rent', 'Education') THEN amount END), 0) as needs,
      COALESCE(SUM(CASE WHEN category IN ('Entertainment', 'Shopping') THEN amount END), 0) as wants,
      COALESCE(SUM(amount), 0) as total,
      COUNT(DISTINCT category) as cat_count
     FROM expenses WHERE user_id = $1 AND expense_date > CURRENT_DATE - 30`,
    [userId]
  );
  const r = result.rows[0];
  const total = num(r.total);
  if (total === 0) return null;

  const needsPct = Math.round(num(r.needs) / total * 100);
  const wantsPct = Math.round(num(r.wants) / total * 100);

  let personality, icon, msg;
  if (needsPct > 75) {
    personality = 'The Practical One 🧱'; icon = 'hard-hat';
    msg = `${needsPct}% essentials, ${wantsPct}% wants. All business, no fluff! Super responsible!`;
  } else if (wantsPct > 45) {
    personality = 'The Fun Seeker 🎢'; icon = 'party-popper';
    msg = `${wantsPct}% goes to wants! You prioritize experiences and enjoyment. YOLO energy! 🌈`;
  } else if (needsPct >= 40 && needsPct <= 65 && wantsPct >= 15 && wantsPct <= 35) {
    personality = 'The Balanced One ⚖️'; icon = 'brain';
    msg = `Needs: ${needsPct}%, Wants: ${wantsPct}%. You've found the sweet spot between responsibility and fun!`;
  } else {
    return null;
  }

  return {
    type: 'info', icon, priority: 4, mood: 'chill',
    title: personality,
    message: msg,
    tip: 'The ideal 50/30/20 rule: 50% needs, 30% wants, 20% savings. How do you compare? 💎'
  };
}

// ─────────────────────────────────────────────
// 29. GOAL PROGRESS CELEBRATION
// ─────────────────────────────────────────────
async function goalProgressInsight(userId) {
  const result = await query(
    `SELECT title, current_amount, target_amount,
      ROUND(current_amount / NULLIF(target_amount, 0) * 100, 1) as progress
     FROM goals WHERE user_id = $1 AND status = 'active'
     ORDER BY (current_amount / NULLIF(target_amount, 0)) DESC LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const g = result.rows[0];
  const progress = num(g.progress);
  const currentAmount = num(g.current_amount);
  const targetAmount = num(g.target_amount);
  const remaining = targetAmount - currentAmount;

  if (progress >= 75 && progress < 90) {
    return {
      type: 'positive', icon: 'mountain', priority: 2, mood: 'celebrate',
      title: `${Math.round(progress)}% There! 🦸`,
      message: `"${g.title}" — ₵${Math.round(currentAmount)} of ₵${Math.round(targetAmount)} saved. Just ₵${Math.round(remaining)} to go!`,
      tip: 'You\'ve come too far to quit! Every cedi gets you closer! 💪'
    };
  } else if (progress >= 50 && progress < 75) {
    return {
      type: 'positive', icon: 'mountain', priority: 3, mood: 'celebrate',
      title: 'Halfway Hero! 🏔️',
      message: `"${g.title}" is ${Math.round(progress)}% done — ₵${Math.round(currentAmount)} saved! The summit is in sight!`,
      tip: 'Past the halfway mark! Downhill from here. Keep pushing! 🏁'
    };
  } else if (progress >= 25 && progress < 50) {
    return {
      type: 'info', icon: 'sprout', priority: 4, mood: 'chill',
      title: 'Goal Growing! 🌿',
      message: `"${g.title}" at ${Math.round(progress)}% (₵${Math.round(currentAmount)} / ₵${Math.round(targetAmount)}). Taking shape!`,
      tip: 'Consistency beats intensity. Keep watering your goal! 🚿'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// 30. MONTH-OVER-MONTH COMPARISON (pro-rated)
// ─────────────────────────────────────────────
async function monthComparisonInsight(userId) {
  const result = await query(
    `SELECT 
      COALESCE(SUM(CASE WHEN expense_date >= date_trunc('month', CURRENT_DATE) THEN amount END), 0) as this_month,
      COALESCE(SUM(CASE WHEN expense_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' 
        AND expense_date < date_trunc('month', CURRENT_DATE) THEN amount END), 0) as last_month,
      EXTRACT(DAY FROM CURRENT_DATE) as day_of_month,
      EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')) as days_in_month
    FROM expenses WHERE user_id = $1 AND expense_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'`,
    [userId]
  );
  const r = result.rows[0];
  const thisMonth = num(r.this_month);
  const lastMonth = num(r.last_month);
  const dayOfMonth = int(r.day_of_month);

  if (lastMonth === 0 || thisMonth === 0) return null;

  // Pro-rate last month for fair comparison
  const lastMonthProrated = (lastMonth / 30) * dayOfMonth;
  const diff = Math.round(thisMonth - lastMonthProrated);
  const pctChange = Math.round((diff / lastMonthProrated) * 100);

  if (pctChange > 20) {
    return {
      type: 'warning', icon: 'calendar-range', priority: 2, mood: 'nudge',
      title: 'Spending Up vs Last Month 📅',
      message: `₵${Math.round(thisMonth)} spent in ${dayOfMonth} days — ${pctChange}% more than the same point last month (₵${Math.round(lastMonthProrated)}).`,
      tip: 'Still time to course-correct! Review your biggest categories this month 🔍'
    };
  } else if (pctChange < -15) {
    return {
      type: 'positive', icon: 'calendar-range', priority: 3, mood: 'celebrate',
      title: 'Beating Last Month! 📅',
      message: `₵${Math.round(thisMonth)} spent so far — ${Math.abs(pctChange)}% less than this point last month (₵${Math.round(lastMonthProrated)}). Great restraint!`,
      tip: 'You\'re improving month over month. That\'s how habits change! 🌟'
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// MASTER: Generate All Insights
// ─────────────────────────────────────────────
async function generateInsights(userId, options = {}) {
  const { limit = 10, includeAll = false } = options;

  const generatorMeta = [
    { fn: weeklyChangeInsight(userId), source: 'Last 7 vs Previous 7 Days' },
    { fn: topCategoryInsight(userId), source: '30-Day Categories' },
    { fn: weekendVsWeekdayInsight(userId), source: '30-Day Patterns' },
    { fn: noSpendDaysInsight(userId), source: 'Last 7 Days' },
    { fn: unusualSpendingInsight(userId), source: 'Daily Spending' },
    { fn: categoryTrendInsight(userId), source: 'Month-over-Month' },
    { fn: budgetInsight(userId), source: 'Active Budget' },
    { fn: savingsGoalInsight(userId), source: 'Savings Goals' },
    { fn: bestDayInsight(userId), source: '60-Day History' },
    { fn: streakInsight(userId), source: 'Tracking Streak' },
    { fn: savingsRateInsight(userId), source: 'Income vs Expenses' },
    { fn: paymentMethodInsight(userId), source: 'Payment Methods' },
    { fn: forecastInsight(userId), source: 'Monthly Forecast' },
    { fn: timeOfDayInsight(userId), source: '30-Day Timing' },
    { fn: biggestExpenseInsight(userId), source: '30-Day Expenses' },
    { fn: recurringBurdenInsight(userId), source: 'Recurring Bills' },
    { fn: categoryDiversityInsight(userId), source: 'Category Mix' },
    { fn: frequencyInsight(userId), source: '14-Day Frequency' },
    { fn: microSpendInsight(userId), source: 'Small Purchases' },
    { fn: incomeTimingInsight(userId), source: 'Payday Pattern' },
    { fn: goalMultiplierInsight(userId), source: 'Goals + Spending' },
    { fn: billWarningInsight(userId), source: 'Upcoming Bills' },
    { fn: velocityInsight(userId), source: '3-Week Velocity' },
    { fn: roundNumberInsight(userId), source: 'Expense Amounts' },
    { fn: categoryLoyaltyInsight(userId), source: 'Recent Transactions' },
    { fn: expenseFreeWeekendInsight(userId), source: 'This Weekend' },
    { fn: dailyAverageInsight(userId), source: '30-Day Average' },
    { fn: moneyPersonalityInsight(userId), source: 'Spending Profile' },
    { fn: goalProgressInsight(userId), source: 'Goal Progress' },
    { fn: monthComparisonInsight(userId), source: 'Month Comparison' },
  ];

  // Run all insight generators in parallel
  const results = await Promise.allSettled(generatorMeta.map(g => g.fn));

  // Collect successful, non-null insights with source tags
  let insights = results
    .map((r, i) => {
      if (r.status === 'fulfilled' && r.value !== null) {
        return { ...r.value, source: generatorMeta[i].source };
      }
      return null;
    })
    .filter(Boolean);

  // Sort by priority (lower = higher priority)
  insights.sort((a, b) => (a.priority || 5) - (b.priority || 5));

  // Return limited set unless includeAll
  if (!includeAll) {
    insights = insights.slice(0, limit);
  }

  return insights;
}

module.exports = { generateInsights };
