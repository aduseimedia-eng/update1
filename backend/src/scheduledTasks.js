// ============================================
// SCHEDULED TASKS
// Cron jobs for automatic email notifications
// ============================================

const cron = require('node-cron');
const { 
  sendDueBillReminders, 
  sendWeeklySummaries,
  resetMonthlyBudgetAlerts 
} = require('./services/emailTriggerService');

/**
 * Initialize all scheduled tasks
 */
const initScheduledTasks = () => {
  console.log('📅 Initializing scheduled email tasks...');
  
  // Bill reminders - Run every day at 8:00 AM GMT
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running daily bill reminders check...');
    try {
      const count = await sendDueBillReminders();
      console.log(`✅ Bill reminders sent: ${count}`);
    } catch (error) {
      console.error('❌ Bill reminders job failed:', error);
    }
  }, {
    timezone: 'Africa/Accra'
  });
  
  // Weekly summaries - Run every Sunday at 6:00 PM GMT
  cron.schedule('0 18 * * 0', async () => {
    console.log('⏰ Running weekly summary emails...');
    try {
      const count = await sendWeeklySummaries();
      console.log(`✅ Weekly summaries sent: ${count}`);
    } catch (error) {
      console.error('❌ Weekly summaries job failed:', error);
    }
  }, {
    timezone: 'Africa/Accra'
  });
  
  // Reset budget alerts - Run on 1st of every month at midnight
  cron.schedule('0 0 1 * *', async () => {
    console.log('⏰ Resetting monthly budget alerts...');
    try {
      await resetMonthlyBudgetAlerts();
    } catch (error) {
      console.error('❌ Budget alert reset failed:', error);
    }
  }, {
    timezone: 'Africa/Accra'
  });
  
  console.log('✅ Scheduled tasks initialized:');
  console.log('   - Bill reminders: Daily at 8:00 AM');
  console.log('   - Weekly summaries: Sunday at 6:00 PM');
  console.log('   - Budget reset: 1st of each month');
};

/**
 * Manually trigger bill reminders (for testing)
 */
const triggerBillReminders = async () => {
  console.log('🔔 Manually triggering bill reminders...');
  return await sendDueBillReminders();
};

/**
 * Manually trigger weekly summaries (for testing)
 */
const triggerWeeklySummaries = async () => {
  console.log('📊 Manually triggering weekly summaries...');
  return await sendWeeklySummaries();
};

module.exports = {
  initScheduledTasks,
  triggerBillReminders,
  triggerWeeklySummaries
};
