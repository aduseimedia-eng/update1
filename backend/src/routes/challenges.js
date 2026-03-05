// ============================================
// SAVINGS CHALLENGES ROUTES
// File: backend/src/routes/challenges.js
// ============================================

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Create a custom challenge (saved to DB)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, challenge_type, target_amount, target_days, xp_reward, difficulty } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const result = await query(
      `INSERT INTO savings_challenges (title, description, challenge_type, target_amount, target_days, xp_reward, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        title,
        description || '',
        challenge_type || 'custom',
        target_amount || null,
        target_days || 30,
        xp_reward || 100,
        difficulty || 'medium'
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).json({ success: false, message: 'Failed to create challenge' });
  }
});

// Get all available challenges
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { difficulty, type } = req.query;

    let queryText = 'SELECT * FROM savings_challenges WHERE is_active = TRUE';
    const params = [];
    let paramIndex = 1;

    if (difficulty) {
      queryText += ` AND difficulty = $${paramIndex}`;
      params.push(difficulty);
      paramIndex++;
    }

    if (type) {
      queryText += ` AND challenge_type = $${paramIndex}`;
      params.push(type);
    }

    queryText += ' ORDER BY difficulty, xp_reward';

    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch challenges' });
  }
});

// Get user's active challenges
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        uc.*,
        sc.title,
        sc.description,
        sc.challenge_type,
        sc.xp_reward,
        sc.difficulty,
        sc.target_category,
        ROUND((uc.current_progress / NULLIF(uc.target_progress, 0) * 100), 2) as progress_percentage,
        uc.end_date - CURRENT_DATE as days_remaining
       FROM user_challenges uc
       JOIN savings_challenges sc ON uc.challenge_id = sc.id
       WHERE uc.user_id = $1 AND uc.status = 'active'
       ORDER BY uc.end_date ASC`,
      [userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching active challenges:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active challenges' });
  }
});

// Get user's challenge history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20 } = req.query;

    let queryText = `
      SELECT 
        uc.*,
        sc.title,
        sc.description,
        sc.challenge_type,
        sc.xp_reward,
        sc.difficulty
       FROM user_challenges uc
       JOIN savings_challenges sc ON uc.challenge_id = sc.id
       WHERE uc.user_id = $1
    `;
    const params = [userId];

    if (status) {
      queryText += ' AND uc.status = $2';
      params.push(status);
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    params.push(safeLimit);
    queryText += ` ORDER BY uc.created_at DESC LIMIT $${params.length}`;

    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch challenge history' });
  }
});

// Get challenge stats - MUST be before parametrized routes
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_count,
        COALESCE(SUM(xp_earned), 0) as total_xp_from_challenges
       FROM user_challenges
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch challenge stats' });
  }
});

// Join a challenge
router.post('/:challengeId/join', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { challengeId } = req.params;

    // Check if challenge exists
    const challengeResult = await query(
      'SELECT * FROM savings_challenges WHERE id = $1 AND is_active = TRUE',
      [challengeId]
    );

    if (challengeResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    const challenge = challengeResult.rows[0];

    // Check if user already has this challenge active
    const existingCheck = await query(
      `SELECT id FROM user_challenges 
       WHERE user_id = $1 AND challenge_id = $2 AND status = 'active'`,
      [userId, challengeId]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Challenge already active' });
    }

    // Calculate end date and target progress
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (challenge.target_days || 7));

    let targetProgress = challenge.target_amount || challenge.target_days || 1;

    const result = await query(
      `INSERT INTO user_challenges 
        (user_id, challenge_id, start_date, end_date, target_progress)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, challengeId, startDate.toISOString().split('T')[0], 
       endDate.toISOString().split('T')[0], targetProgress]
    );

    res.status(201).json({ 
      success: true, 
      data: { ...result.rows[0], challenge },
      message: `You've joined the "${challenge.title}" challenge!`
    });
  } catch (error) {
    console.error('Error joining challenge:', error);
    res.status(500).json({ success: false, message: 'Failed to join challenge' });
  }
});

// Update challenge progress (called automatically by other endpoints)
router.post('/:userChallengeId/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { userChallengeId } = req.params;
    const { progress_increment } = req.body;

    const result = await query(
      `UPDATE user_challenges 
       SET current_progress = current_progress + $1
       WHERE id = $2 AND user_id = $3 AND status = 'active'
       RETURNING *`,
      [progress_increment || 1, userChallengeId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    const userChallenge = result.rows[0];

    // Check if completed
    if (userChallenge.current_progress >= userChallenge.target_progress) {
      // Get challenge details for XP
      const challengeResult = await query(
        'SELECT xp_reward FROM savings_challenges WHERE id = $1',
        [userChallenge.challenge_id]
      );

      const xpReward = challengeResult.rows[0]?.xp_reward || 0;

      // Mark as completed and award XP
      await query(
        `UPDATE user_challenges 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, xp_earned = $1
         WHERE id = $2`,
        [xpReward, userChallengeId]
      );

      // Add XP to user
      await query(
        `INSERT INTO user_xp (user_id, total_xp, level)
         VALUES ($1, $2, 1)
         ON CONFLICT (user_id) DO UPDATE SET total_xp = user_xp.total_xp + $2`,
        [userId, xpReward]
      );

      return res.json({ 
        success: true, 
        data: { ...userChallenge, status: 'completed' },
        message: `Challenge completed! You earned ${xpReward} XP!`
      });
    }

    res.json({ success: true, data: userChallenge });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ success: false, message: 'Failed to update progress' });
  }
});

// Abandon a challenge
router.post('/:userChallengeId/abandon', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { userChallengeId } = req.params;

    const result = await query(
      `UPDATE user_challenges 
       SET status = 'abandoned'
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING *`,
      [userChallengeId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    res.json({ success: true, message: 'Challenge abandoned' });
  } catch (error) {
    console.error('Error abandoning challenge:', error);
    res.status(500).json({ success: false, message: 'Failed to abandon challenge' });
  }
});

module.exports = router;
