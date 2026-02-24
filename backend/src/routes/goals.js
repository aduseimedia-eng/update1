const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { goalValidation, uuidParamValidation } = require('../middleware/validation');
const { checkGoalMilestoneAndNotify } = require('../services/emailTriggerService');

router.post('/', authenticateToken, goalValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, target_amount, deadline } = req.body;
    const result = await query('INSERT INTO goals (user_id, title, target_amount, deadline) VALUES ($1, $2, $3, $4) RETURNING *', [userId, title, target_amount, deadline]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ Error creating goal:', error);
    res.status(500).json({ success: false, message: 'Failed to create goal', error: error.message });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query('SELECT *, ROUND((current_amount / NULLIF(target_amount, 0) * 100), 2) as progress_percentage FROM goals WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch goals' });
  }
});

router.put('/:id', authenticateToken, uuidParamValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { current_amount, status, title, target_amount } = req.body;
    const result = await query('UPDATE goals SET current_amount = COALESCE($1, current_amount), status = COALESCE($2, status), title = COALESCE($5, title), target_amount = COALESCE($6, target_amount) WHERE id = $3 AND user_id = $4 RETURNING *', [current_amount, status, id, userId, title, target_amount]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Goal not found' });
    
    const goal = result.rows[0];
    
    // Check for milestone and send notification (async, don't block response)
    if (goal.current_amount && goal.target_amount) {
      checkGoalMilestoneAndNotify(userId, {
        id: goal.id,
        title: goal.title,
        target_amount: parseFloat(goal.target_amount),
        current_amount: parseFloat(goal.current_amount)
      }).catch(err => console.error('Goal milestone notification error:', err));
    }
    
    res.json({ success: true, data: goal });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update goal' });
  }
});

// ─── DELETE /api/v1/goals/:id — delete a goal ────────────────────────────────
router.delete('/:id', authenticateToken, uuidParamValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    res.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    console.error('❌ Delete goal error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete goal' });
  }
});

// ─── GET /api/v1/goals/:id/insights — smart insights for a single goal ───────
router.get('/:id/insights', authenticateToken, uuidParamValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const goalResult = await query(
      `SELECT *, ROUND((current_amount / NULLIF(target_amount, 0) * 100), 2) as progress_percentage
       FROM goals WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const goal = goalResult.rows[0];
    const remaining = parseFloat(goal.target_amount) - parseFloat(goal.current_amount);
    const progress = parseFloat(goal.progress_percentage) || 0;

    // Days until deadline
    let daysRemaining = null;
    let monthsRemaining = null;
    let monthlyRequired = null;
    let onTrack = null;

    if (goal.deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadline = new Date(goal.deadline);
      deadline.setHours(0, 0, 0, 0);
      const diffMs = deadline - today;
      daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
      monthsRemaining = Math.max(daysRemaining / 30.44, 0.1);
      monthlyRequired = remaining > 0 ? remaining / monthsRemaining : 0;
      onTrack = daysRemaining > 0 && progress >= ((new Date() - new Date(goal.created_at)) / (deadline - new Date(goal.created_at))) * 100;
    }

    // Recent transactions
    const txResult = await query(
      `SELECT * FROM savings_transactions WHERE goal_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [id]
    );

    // Alerts
    const alerts = [];
    if (daysRemaining !== null && daysRemaining < 30 && remaining > 0) {
      alerts.push({ type: 'warning', message: `Deadline in ${daysRemaining} days. You still need GHS ${remaining.toFixed(2)}.` });
    }
    if (progress >= 100) {
      alerts.push({ type: 'success', message: 'Congratulations! Goal achieved! 🎉' });
    } else if (progress >= 75) {
      alerts.push({ type: 'info', message: `Almost there! ${(100 - progress).toFixed(1)}% more to go.` });
    }

    res.json({
      success: true,
      data: {
        goal,
        remaining: Math.max(remaining, 0),
        progress_percentage: progress,
        days_remaining: daysRemaining,
        months_remaining: monthsRemaining ? Math.round(monthsRemaining * 10) / 10 : null,
        monthly_required: monthlyRequired ? Math.round(monthlyRequired * 100) / 100 : null,
        on_track: onTrack,
        recent_transactions: txResult.rows,
        alerts
      }
    });
  } catch (error) {
    console.error('❌ Goal insights error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch goal insights' });
  }
});

// ─── POST /api/v1/goals/:id/deposit — add savings to a goal ──────────────────
router.post('/:id/deposit', authenticateToken, uuidParamValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { amount, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be greater than 0' });
    }

    // Verify goal belongs to user and is active
    const goalResult = await query(
      `SELECT * FROM goals WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (goalResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }
    const goal = goalResult.rows[0];
    if (goal.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Goal is already completed' });
    }

    // Insert savings transaction
    await query(
      `INSERT INTO savings_transactions (goal_id, user_id, amount, notes) VALUES ($1, $2, $3, $4)`,
      [id, userId, amount, notes || null]
    );

    // Update goal current_amount (cap at target)
    const updatedResult = await query(
      `UPDATE goals
       SET current_amount = LEAST(current_amount + $1, target_amount),
           status = CASE WHEN current_amount + $1 >= target_amount THEN 'completed' ELSE status END,
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *, ROUND((current_amount / NULLIF(target_amount, 0) * 100), 2) as progress_percentage`,
      [amount, id, userId]
    );

    const updatedGoal = updatedResult.rows[0];

    // Fire milestone notification
    if (updatedGoal.current_amount && updatedGoal.target_amount) {
      checkGoalMilestoneAndNotify(userId, {
        id: updatedGoal.id,
        title: updatedGoal.title,
        target_amount: parseFloat(updatedGoal.target_amount),
        current_amount: parseFloat(updatedGoal.current_amount)
      }).catch(err => console.error('Goal milestone notification error:', err));
    }

    res.json({
      success: true,
      message: updatedGoal.status === 'completed'
        ? `Goal "${updatedGoal.title}" completed! 🎉`
        : `GHS ${parseFloat(amount).toFixed(2)} deposited successfully`,
      data: updatedGoal
    });
  } catch (error) {
    console.error('❌ Deposit error:', error);
    res.status(500).json({ success: false, message: 'Failed to record deposit' });
  }
});

module.exports = router;
