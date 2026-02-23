// ============================================
// EMAIL TRIGGER SERVICE
// Automatic email notifications based on user events
// ============================================

const { query } = require('../config/database');
const emailService = require('./emailService');

/**
 * Check if user has email notifications enabled for a specific type
 * @param {string} userId - User UUID
 * @param {string} notificationType - Type of notification (weekly, bills, goals, challenges, budget, tips)
 * @returns {Promise<{enabled: boolean, email: string, name: string}>}
 */
const checkNotificationPreference = async (userId, notificationType) => {
  try {
    const result = await query(
      'SELECT email, name, notification_settings FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return { enabled: false, email: null, name: null };
    }
    
    const user = result.rows[0];
    const settings = user.notification_settings || {
      weekly: true,
      bills: true,
      goals: true,
      challenges: true,
      budget: true,
      tips: false
    };
    
    return {
      enabled: settings[notificationType] === true,
      email: user.email,
      name: user.name || 'User'
    };
  } catch (error) {
    console.error('Check notification preference error:', error);
    return { enabled: false, email: null, name: null };
  }
};

/**
 * Check budget and send alert if threshold exceeded
 * Called after expense creation
 * @param {string} userId - User UUID
 */
const checkBudgetAndAlert = async (userId) => {
  try {
    const { enabled, email, name } = await checkNotificationPreference(userId, 'budget');
    if (!enabled || !email) return;
    
    // Get user's monthly budget
    const budgetResult = await query(
      'SELECT monthly_budget FROM users WHERE id = $1',
      [userId]
    );
    
    const monthlyBudget = budgetResult.rows[0]?.monthly_budget;
    if (!monthlyBudget || monthlyBudget <= 0) return;
    
    // Calculate this month's spending
    const spendingResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total_spent
       FROM expenses
       WHERE user_id = $1
       AND expense_date >= date_trunc('month', CURRENT_DATE)
       AND expense_date < date_trunc('month', CURRENT_DATE) + interval '1 month'`,
      [userId]
    );
    
    const totalSpent = parseFloat(spendingResult.rows[0].total_spent);
    const percentage = Math.round((totalSpent / monthlyBudget) * 100);
    
    // Check if we should send alert (50%, 75%, 90%, 100%)
    const alertThresholds = [50, 75, 90, 100];
    
    // Get last alert threshold sent
    const lastAlertResult = await query(
      `SELECT last_budget_alert_threshold FROM users WHERE id = $1`,
      [userId]
    );
    
    const lastThreshold = lastAlertResult.rows[0]?.last_budget_alert_threshold || 0;
    
    // Find the current threshold we've crossed
    let currentThreshold = 0;
    for (const threshold of alertThresholds) {
      if (percentage >= threshold) {
        currentThreshold = threshold;
      }
    }
    
    // Only send if we've crossed a new threshold
    if (currentThreshold > lastThreshold) {
      // Update last alert threshold
      await query(
        'UPDATE users SET last_budget_alert_threshold = $1 WHERE id = $2',
        [currentThreshold, userId]
      );
      
      // Send budget alert email
      await emailService.sendBudgetAlertEmail(
        email,
        name,
        totalSpent,
        monthlyBudget,
        percentage,
        'this month'
      );
      
      console.log(`📧 Budget alert sent to ${email}: ${percentage}% used`);
    }
  } catch (error) {
    console.error('Budget alert check error:', error);
  }
};

/**
 * Send bill reminder emails for bills due soon
 * Called by scheduled job
 */
const sendDueBillReminders = async () => {
  try {
    // Get all bills due within reminder period that haven't been reminded today
    const result = await query(
      `SELECT br.*, u.email, u.name, u.notification_settings
       FROM bill_reminders br
       JOIN users u ON br.user_id = u.id
       WHERE br.is_active = TRUE
       AND br.due_date >= CURRENT_DATE
       AND br.due_date <= CURRENT_DATE + br.reminder_days_before
       AND (br.last_reminder_sent IS NULL OR br.last_reminder_sent < CURRENT_DATE)`
    );
    
    let sentCount = 0;
    
    for (const bill of result.rows) {
      const settings = bill.notification_settings || { bills: true };
      
      if (settings.bills !== true || !bill.email) continue;
      
      try {
        await emailService.sendBillReminderEmail(
          bill.email,
          bill.title,
          bill.amount,
          bill.due_date
        );
        
        // Update last reminder sent
        await query(
          'UPDATE bill_reminders SET last_reminder_sent = CURRENT_DATE WHERE id = $1',
          [bill.id]
        );
        
        sentCount++;
        console.log(`📧 Bill reminder sent for "${bill.title}" to ${bill.email}`);
      } catch (err) {
        console.error(`Failed to send bill reminder for ${bill.title}:`, err.message);
      }
    }
    
    return sentCount;
  } catch (error) {
    console.error('Send due bill reminders error:', error);
    return 0;
  }
};

/**
 * Check goal progress and send milestone emails
 * Called when goal is updated
 * @param {string} userId - User UUID
 * @param {object} goal - Goal object with id, title, target_amount, current_amount
 */
const checkGoalMilestoneAndNotify = async (userId, goal) => {
  try {
    const { enabled, email, name } = await checkNotificationPreference(userId, 'goals');
    if (!enabled || !email) return;
    
    const progress = Math.round((goal.current_amount / goal.target_amount) * 100);
    const milestones = [25, 50, 75, 100];
    
    // Get last milestone notified
    const lastResult = await query(
      'SELECT last_milestone_notified FROM goals WHERE id = $1',
      [goal.id]
    );
    
    const lastMilestone = lastResult.rows[0]?.last_milestone_notified || 0;
    
    // Find highest milestone reached
    let currentMilestone = 0;
    for (const m of milestones) {
      if (progress >= m) currentMilestone = m;
    }
    
    // Only notify if new milestone
    if (currentMilestone > lastMilestone) {
      await query(
        'UPDATE goals SET last_milestone_notified = $1 WHERE id = $2',
        [currentMilestone, goal.id]
      );
      
      await emailService.sendGoalMilestoneEmail(
        email,
        goal.title,
        progress,
        currentMilestone
      );
      
      console.log(`📧 Goal milestone (${currentMilestone}%) email sent for "${goal.title}" to ${email}`);
    }
  } catch (error) {
    console.error('Goal milestone check error:', error);
  }
};

/**
 * Send weekly summary emails to all opted-in users
 * Called by scheduled job (weekly)
 */
const sendWeeklySummaries = async () => {
  try {
    // Get all users with weekly notifications enabled
    const usersResult = await query(
      `SELECT id, email, name, notification_settings
       FROM users
       WHERE notification_settings->>'weekly' = 'true'
       OR notification_settings IS NULL`
    );
    
    let sentCount = 0;
    
    for (const user of usersResult.rows) {
      const settings = user.notification_settings || { weekly: true };
      if (settings.weekly !== true || !user.email) continue;
      
      try {
        // Get weekly expense summary
        const expenseResult = await query(
          `SELECT 
            COALESCE(SUM(amount), 0) as total_expenses,
            COUNT(*) as expense_count,
            MAX(category) as top_category
           FROM expenses
           WHERE user_id = $1
           AND expense_date >= CURRENT_DATE - 7`,
          [user.id]
        );
        
        const summary = expenseResult.rows[0];
        
        // Only send if user has activity
        if (parseInt(summary.expense_count) > 0) {
          await emailService.sendWeeklySummaryEmail(
            user.email,
            user.name || 'User',
            {
              totalExpenses: parseFloat(summary.total_expenses),
              expenseCount: parseInt(summary.expense_count),
              topCategory: summary.top_category
            }
          );
          
          sentCount++;
          console.log(`📧 Weekly summary sent to ${user.email}`);
        }
      } catch (err) {
        console.error(`Failed to send weekly summary to ${user.email}:`, err.message);
      }
    }
    
    return sentCount;
  } catch (error) {
    console.error('Send weekly summaries error:', error);
    return 0;
  }
};

/**
 * Reset monthly budget alerts (call at start of each month)
 */
const resetMonthlyBudgetAlerts = async () => {
  try {
    await query('UPDATE users SET last_budget_alert_threshold = 0');
    console.log('✅ Monthly budget alerts reset');
  } catch (error) {
    console.error('Reset budget alerts error:', error);
  }
};

module.exports = {
  checkNotificationPreference,
  checkBudgetAndAlert,
  sendDueBillReminders,
  checkGoalMilestoneAndNotify,
  sendWeeklySummaries,
  resetMonthlyBudgetAlerts
};
