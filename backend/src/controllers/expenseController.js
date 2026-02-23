const { query, transaction } = require('../config/database');
const { updateStreak, awardXP } = require('../services/gamificationService');
const { XP_REWARDS } = require('../config/constants');
const { checkBudgetAndAlert } = require('../services/emailTriggerService');

/**
 * Create new expense
 */
const createExpense = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      amount, 
      category, 
      payment_method, 
      expense_date, 
      note, 
      is_recurring, 
      recurring_frequency 
    } = req.body;

    const result = await query(
      `INSERT INTO expenses 
       (user_id, amount, category, payment_method, expense_date, note, is_recurring, recurring_frequency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, amount, category, payment_method, expense_date, note, is_recurring, recurring_frequency]
    );

    const expense = result.rows[0];

    // Update streak
    await updateStreak(userId);

    // Award XP for logging expense
    await awardXP(userId, XP_REWARDS.EXPENSE_LOG, 'Expense logged');

    // Check budget and send alert if needed (async, don't await)
    checkBudgetAndAlert(userId).catch(err => console.error('Budget alert error:', err));

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: expense
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create expense',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all expenses for user
 */
const getExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      start_date, 
      end_date, 
      category, 
      payment_method, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let queryText = `
      SELECT * FROM expenses 
      WHERE user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    // Add filters
    if (start_date) {
      queryText += ` AND expense_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND expense_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (category) {
      queryText += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (payment_method) {
      queryText += ` AND payment_method = $${paramIndex}`;
      params.push(payment_method);
      paramIndex++;
    }

    queryText += ` ORDER BY expense_date DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM expenses WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: {
        expenses: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expenses'
    });
  }
};

/**
 * Get single expense
 */
const getExpense = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense'
    });
  }
};

/**
 * Update expense
 */
const updateExpense = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { 
      amount, 
      category, 
      payment_method, 
      expense_date, 
      note, 
      is_recurring, 
      recurring_frequency 
    } = req.body;

    // Check if expense exists and belongs to user
    const checkResult = await query(
      'SELECT id FROM expenses WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    const result = await query(
      `UPDATE expenses 
       SET amount = $1, category = $2, payment_method = $3, 
           expense_date = $4, note = $5, is_recurring = $6, 
           recurring_frequency = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [amount, category, payment_method, expense_date, note, is_recurring, recurring_frequency, id, userId]
    );

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense'
    });
  }
};

/**
 * Delete expense
 */
const deleteExpense = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense'
    });
  }
};

/**
 * Get expense summary
 */
const getExpenseSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month' } = req.query;

    let dateFilter;
    if (period === 'week') {
      dateFilter = "expense_date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "expense_date >= CURRENT_DATE - INTERVAL '30 days'";
    } else {
      dateFilter = "expense_date >= CURRENT_DATE - INTERVAL '365 days'";
    }

    const result = await query(
      `SELECT 
        COUNT(*) as total_transactions,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MAX(amount) as max_amount,
        MIN(amount) as min_amount
       FROM expenses 
       WHERE user_id = $1 AND ${dateFilter}`,
      [userId]
    );

    // Category breakdown
    const categoryResult = await query(
      `SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total
       FROM expenses 
       WHERE user_id = $1 AND ${dateFilter}
       GROUP BY category
       ORDER BY total DESC`,
      [userId]
    );

    const summary = result.rows[0];
    res.json({
      success: true,
      data: {
        summary: {
          total_transactions: summary.total_transactions || '0',
          total_amount: summary.total_amount || '0',
          avg_amount: summary.avg_amount || '0',
          max_amount: summary.max_amount || '0',
          min_amount: summary.min_amount || '0'
        },
        by_category: categoryResult.rows,
        period
      }
    });
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expense summary'
    });
  }
};

/**
 * Bulk delete expenses
 */
const bulkDeleteExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { expense_ids } = req.body;

    if (!Array.isArray(expense_ids) || expense_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'expense_ids must be a non-empty array'
      });
    }

    const result = await query(
      'DELETE FROM expenses WHERE id = ANY($1) AND user_id = $2 RETURNING id',
      [expense_ids, userId]
    );

    res.json({
      success: true,
      message: `${result.rows.length} expenses deleted successfully`,
      deleted_count: result.rows.length
    });
  } catch (error) {
    console.error('Bulk delete expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expenses'
    });
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  bulkDeleteExpenses
};
