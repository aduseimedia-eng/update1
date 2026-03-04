// ============================================
// BILL REMINDERS ROUTES
// File: backend/src/routes/bills.js
// ============================================

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all bill reminders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, category } = req.query;

    let queryText = `
      SELECT 
        id, user_id, title, amount, currency, category, due_date, frequency,
        reminder_days_before, is_paid, last_paid_date, auto_create_expense, 
        notes, is_active, created_at, updated_at,
        CASE 
          WHEN is_paid THEN 'paid'
          WHEN due_date <= CURRENT_DATE THEN 'overdue'
          WHEN due_date <= CURRENT_DATE + reminder_days_before THEN 'due_soon'
          ELSE 'pending'
        END as status,
        due_date - CURRENT_DATE as days_until_due
      FROM bill_reminders
      WHERE user_id = $1 AND is_active = TRUE
    `;
    const params = [userId];
    let paramIndex = 2;

    if (category) {
      queryText += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    queryText += ' ORDER BY due_date ASC';

    const result = await query(queryText, params);
    
    // Filter by status if provided
    let bills = result.rows;
    if (status) {
      bills = bills.filter(b => b.status === status);
    }

    res.json({ success: true, data: bills });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bill reminders' });
  }
});

// Create bill reminder
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      title, amount, currency = 'GHS', category, due_date, 
      frequency, reminder_days_before = 3, auto_create_expense = false, notes 
    } = req.body;

    if (!title || !amount || !category || !due_date || !frequency) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await query(
      `INSERT INTO bill_reminders 
        (user_id, title, amount, currency, category, due_date, frequency, 
         reminder_days_before, auto_create_expense, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [userId, title, amount, currency, category, due_date, frequency, 
       reminder_days_before, auto_create_expense, notes]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ success: false, message: 'Failed to create bill reminder' });
  }
});

// Update bill reminder
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { 
      title, amount, currency, category, due_date, 
      frequency, reminder_days_before, auto_create_expense, notes, is_active 
    } = req.body;

    const result = await query(
      `UPDATE bill_reminders 
       SET title = COALESCE($1, title),
           amount = COALESCE($2, amount),
           currency = COALESCE($3, currency),
           category = COALESCE($4, category),
           due_date = COALESCE($5, due_date),
           frequency = COALESCE($6, frequency),
           reminder_days_before = COALESCE($7, reminder_days_before),
           auto_create_expense = COALESCE($8, auto_create_expense),
           notes = COALESCE($9, notes),
           is_active = COALESCE($10, is_active)
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
      [title, amount, currency, category, due_date, frequency, 
       reminder_days_before, auto_create_expense, notes, is_active, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bill reminder not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating bill:', error);
    res.status(500).json({ success: false, message: 'Failed to update bill reminder' });
  }
});

// Mark bill as paid
router.post('/:id/pay', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { create_expense = true } = req.body;

    // Get the bill first
    const billResult = await query(
      'SELECT * FROM bill_reminders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (billResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bill reminder not found' });
    }

    const bill = billResult.rows[0];

    // Create expense if requested
    if (create_expense || bill.auto_create_expense) {
      await query(
        `INSERT INTO expenses (user_id, amount, category, payment_method, expense_date, note, currency)
         VALUES ($1, $2, $3, 'Cash', CURRENT_DATE, $4, $5)`,
        [userId, bill.amount, bill.category, `Bill payment: ${bill.title}`, bill.currency]
      );
    }

    // Update bill - calculate next due date for recurring bills
    let updateQuery;
    if (bill.frequency === 'once') {
      updateQuery = await query(
        `UPDATE bill_reminders SET is_paid = TRUE, last_paid_date = CURRENT_DATE 
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId]
      );
    } else {
      // Calculate next due date
      const nextDueDate = new Date(bill.due_date);
      switch (bill.frequency) {
        case 'weekly': nextDueDate.setDate(nextDueDate.getDate() + 7); break;
        case 'monthly': nextDueDate.setMonth(nextDueDate.getMonth() + 1); break;
        case 'yearly': nextDueDate.setFullYear(nextDueDate.getFullYear() + 1); break;
      }

      updateQuery = await query(
        `UPDATE bill_reminders 
         SET is_paid = FALSE, last_paid_date = CURRENT_DATE, due_date = $1
         WHERE id = $2 AND user_id = $3 RETURNING *`,
        [nextDueDate.toISOString().split('T')[0], id, userId]
      );
    }

    res.json({ 
      success: true, 
      data: updateQuery.rows[0],
      message: 'Bill marked as paid' + (create_expense ? ' and expense created' : '')
    });
  } catch (error) {
    console.error('Error paying bill:', error);
    res.status(500).json({ success: false, message: 'Failed to mark bill as paid' });
  }
});

// Delete bill reminder
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM bill_reminders WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Bill reminder not found' });
    }

    res.json({ success: true, message: 'Bill reminder deleted successfully' });
  } catch (error) {
    console.error('Error deleting bill:', error);
    res.status(500).json({ success: false, message: 'Failed to delete bill reminder' });
  }
});

// Get upcoming bills summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE due_date <= CURRENT_DATE) as overdue_count,
        COUNT(*) FILTER (WHERE due_date > CURRENT_DATE AND due_date <= CURRENT_DATE + reminder_days_before) as due_soon_count,
        COUNT(*) FILTER (WHERE due_date > CURRENT_DATE + reminder_days_before) as upcoming_count,
        COALESCE(SUM(amount) FILTER (WHERE due_date <= CURRENT_DATE + 7), 0) as total_due_this_week,
        COALESCE(SUM(amount) FILTER (WHERE due_date <= CURRENT_DATE + 30), 0) as total_due_this_month
       FROM bill_reminders
       WHERE user_id = $1 AND is_active = TRUE AND is_paid = FALSE`,
      [userId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bills summary' });
  }
});

module.exports = router;
