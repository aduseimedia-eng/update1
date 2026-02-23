// ============================================
// NOTIFICATION ROUTES
// Email notification settings and delivery
// ============================================

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { triggerBillReminders, triggerWeeklySummaries } = require('../scheduledTasks');

// Get notification settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      'SELECT notification_settings FROM users WHERE id = $1',
      [userId]
    );
    
    const settings = result.rows[0]?.notification_settings || {
      weekly: true,
      bills: true,
      goals: true,
      challenges: true,
      budget: true,
      tips: false
    };
    
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notification settings' });
  }
});

// Update notification settings
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = req.body;
    
    await query(
      'UPDATE users SET notification_settings = $1 WHERE id = $2',
      [JSON.stringify(settings), userId]
    );
    
    res.json({ success: true, message: 'Notification settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update notification settings' });
  }
});

// Send test email
router.post('/test-email', authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    
    await emailService.sendTestEmail(userEmail);
    
    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send test email' });
  }
});

// Send bill reminder email
router.post('/bill-reminder', authenticateToken, async (req, res) => {
  try {
    const { billName, amount, dueDate } = req.body;
    const userEmail = req.user.email;
    
    await emailService.sendBillReminderEmail(userEmail, billName, amount, dueDate);
    
    res.json({ success: true, message: 'Bill reminder sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send bill reminder' });
  }
});

// Send goal milestone email
router.post('/goal-milestone', authenticateToken, async (req, res) => {
  try {
    const { goalName, progress, milestone } = req.body;
    const userEmail = req.user.email;
    
    await emailService.sendGoalMilestoneEmail(userEmail, goalName, progress, milestone);
    
    res.json({ success: true, message: 'Goal milestone notification sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send goal notification' });
  }
});

// Send budget alert email
router.post('/budget-alert', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { spent, budget, percentage, period } = req.body;
    const userEmail = req.user.email;
    
    // Get user name for personalization
    const userResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
    const userName = userResult.rows[0]?.name || 'User';
    
    await emailService.sendBudgetAlertEmail(userEmail, userName, spent, budget, percentage, period);
    
    res.json({ success: true, message: 'Budget alert sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send budget alert' });
  }
});

// Send weekly summary email
router.post('/weekly-summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { expenses, income, savings, goals } = req.body;
    const userEmail = req.user.email;
    
    const userResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
    const userName = userResult.rows[0]?.name || 'User';
    
    await emailService.sendWeeklySummaryEmail(userEmail, userName, expenses, income, savings, goals);
    
    res.json({ success: true, message: 'Weekly summary sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send weekly summary' });
  }
});

// Get user's notifications (in-app)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, unread_only = false } = req.query;
    
    let queryText = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [userId];
    
    if (unread_only === 'true') {
      queryText += ' AND is_read = false';
    }
    
    queryText += ' ORDER BY created_at DESC LIMIT $2';
    params.push(parseInt(limit));
    
    const result = await query(queryText, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [userId]
    );
    
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
  }
});

// ==========================================
// ADMIN: Manual trigger endpoints (for testing)
// In production, consider adding admin auth
// ==========================================

// Manually trigger bill reminders
router.post('/admin/trigger-bill-reminders', authenticateToken, async (req, res) => {
  try {
    const count = await triggerBillReminders();
    res.json({ 
      success: true, 
      message: `Bill reminders triggered. ${count} emails sent.`,
      emailsSent: count
    });
  } catch (error) {
    console.error('Bill reminder trigger error:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger bill reminders' });
  }
});

// Manually trigger weekly summaries
router.post('/admin/trigger-weekly-summaries', authenticateToken, async (req, res) => {
  try {
    const count = await triggerWeeklySummaries();
    res.json({ 
      success: true, 
      message: `Weekly summaries triggered. ${count} emails sent.`,
      emailsSent: count
    });
  } catch (error) {
    console.error('Weekly summary trigger error:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger weekly summaries' });
  }
});

module.exports = router;
