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

module.exports = router;
