const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { uuidParamValidation } = require('../middleware/validation');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate the next due date based on frequency.
 * @param {string} currentDate  ISO date string (YYYY-MM-DD)
 * @param {string} frequency    weekly|monthly|quarterly|yearly
 * @returns {string}            next due date as ISO string
 */
function nextDueDate(currentDate, frequency) {
  const d = new Date(currentDate);
  switch (frequency) {
    case 'weekly':    d.setDate(d.getDate() + 7);       break;
    case 'monthly':   d.setMonth(d.getMonth() + 1);     break;
    case 'quarterly': d.setMonth(d.getMonth() + 3);     break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
    default:          d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

/**
 * Convert any frequency amount to its monthly equivalent.
 */
function toMonthly(amount, frequency) {
  const n = parseFloat(amount);
  switch (frequency) {
    case 'weekly':    return n * (52 / 12);
    case 'quarterly': return n / 3;
    case 'yearly':    return n / 12;
    default:          return n; // monthly
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/v1/subscriptions — create a subscription
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, amount, frequency = 'monthly', next_due_date, category = 'Entertainment', notes, auto_renew = true } = req.body;

    if (!name || !amount || !next_due_date) {
      return res.status(400).json({ success: false, message: 'name, amount and next_due_date are required' });
    }
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be greater than 0' });
    }

    const result = await query(
      `INSERT INTO subscriptions (user_id, name, amount, frequency, next_due_date, category, notes, auto_renew)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, name.trim(), amount, frequency, next_due_date, category, notes || null, auto_renew]
    );

    res.status(201).json({ success: true, message: 'Subscription created', data: result.rows[0] });
  } catch (error) {
    console.error('❌ Create subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to create subscription', error: error.message });
  }
});

// GET /api/v1/subscriptions — list all subscriptions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let queryText = `SELECT * FROM subscriptions WHERE user_id = $1`;
    const params = [userId];

    if (status) {
      queryText += ` AND status = $2`;
      params.push(status);
    }

    queryText += ` ORDER BY next_due_date ASC`;

    const result = await query(queryText, params);
    const subscriptions = result.rows;

    // Annotate each with days_until_due and overdue flag
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const annotated = subscriptions.map(s => {
      const due = new Date(s.next_due_date);
      due.setHours(0, 0, 0, 0);
      const diffMs = due - today;
      const days_until_due = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return {
        ...s,
        days_until_due,
        is_overdue: days_until_due < 0,
        is_due_soon: days_until_due >= 0 && days_until_due <= 7
      };
    });

    res.json({ success: true, data: annotated });
  } catch (error) {
    console.error('❌ Get subscriptions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subscriptions' });
  }
});

// GET /api/v1/subscriptions/insights — smart summary
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Active subscriptions
    const subsResult = await query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY next_due_date ASC`,
      [userId]
    );
    const subs = subsResult.rows;

    // Monthly income (last 3 months avg)
    const incomeResult = await query(
      `SELECT COALESCE(AVG(monthly_total), 0) as avg_income FROM (
         SELECT DATE_TRUNC('month', income_date) as month, SUM(amount) as monthly_total
         FROM income WHERE user_id = $1 AND income_date >= NOW() - INTERVAL '3 months'
         GROUP BY month
       ) t`,
      [userId]
    );
    const avgMonthlyIncome = parseFloat(incomeResult.rows[0].avg_income) || 0;

    // Total monthly cost
    const totalMonthly = subs.reduce((sum, s) => sum + toMonthly(s.amount, s.frequency), 0);
    const totalYearly = totalMonthly * 12;
    const incomePercentage = avgMonthlyIncome > 0 ? (totalMonthly / avgMonthlyIncome) * 100 : null;

    // Upcoming in next 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);

    const upcomingThisWeek = subs.filter(s => {
      const due = new Date(s.next_due_date);
      return due >= today && due <= in7;
    });

    // Overdue
    const overdue = subs.filter(s => new Date(s.next_due_date) < today);

    // Most expensive
    const sorted = [...subs].sort((a, b) => toMonthly(b.amount, b.frequency) - toMonthly(a.amount, a.frequency));
    const topExpensive = sorted.slice(0, 3).map(s => ({
      name: s.name,
      monthly_equivalent: Math.round(toMonthly(s.amount, s.frequency) * 100) / 100
    }));

    // Category breakdown
    const categoryBreakdown = {};
    subs.forEach(s => {
      const cat = s.category || 'Other';
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = 0;
      categoryBreakdown[cat] += toMonthly(s.amount, s.frequency);
    });

    // Alerts
    const alerts = [];
    if (incomePercentage !== null && incomePercentage > 20) {
      alerts.push({ type: 'warning', message: `Subscriptions consume ${incomePercentage.toFixed(1)}% of your monthly income. Consider reviewing.` });
    }
    if (overdue.length > 0) {
      alerts.push({ type: 'danger', message: `${overdue.length} subscription(s) are overdue.` });
    }
    if (upcomingThisWeek.length > 0) {
      const total = upcomingThisWeek.reduce((s, sub) => s + parseFloat(sub.amount), 0);
      alerts.push({ type: 'info', message: `GHS ${total.toFixed(2)} due across ${upcomingThisWeek.length} subscription(s) this week.` });
    }

    res.json({
      success: true,
      data: {
        total_active: subs.length,
        total_monthly_cost: Math.round(totalMonthly * 100) / 100,
        total_yearly_cost: Math.round(totalYearly * 100) / 100,
        income_percentage: incomePercentage ? Math.round(incomePercentage * 10) / 10 : null,
        upcoming_this_week: upcomingThisWeek,
        overdue,
        top_expensive: topExpensive,
        category_breakdown: categoryBreakdown,
        alerts
      }
    });
  } catch (error) {
    console.error('❌ Subscription insights error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch insights' });
  }
});

// POST /api/v1/subscriptions/:id/pay — mark as paid
router.post('/:id/pay', authenticateToken, uuidParamValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Fetch subscription
    const subResult = await query(
      `SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [id, userId]
    );
    if (subResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Active subscription not found' });
    }
    const sub = subResult.rows[0];

    // Insert expense record
    const today = new Date().toISOString().split('T')[0];
    await query(
      `INSERT INTO expenses (user_id, amount, category, payment_method, expense_date, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, sub.amount, sub.category, 'other', today, `Subscription: ${sub.name}`]
    );

    // Update next_due_date
    const newDueDate = nextDueDate(sub.next_due_date, sub.frequency);
    const updated = await query(
      `UPDATE subscriptions SET next_due_date = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *`,
      [newDueDate, id, userId]
    );

    res.json({
      success: true,
      message: `Payment recorded. Next due: ${newDueDate}`,
      data: updated.rows[0]
    });
  } catch (error) {
    console.error('❌ Pay subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
});

// PUT /api/v1/subscriptions/:id — update subscription
router.put('/:id', authenticateToken, uuidParamValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, amount, frequency, next_due_date, category, notes, auto_renew, status } = req.body;

    const result = await query(
      `UPDATE subscriptions
       SET name         = COALESCE($1, name),
           amount       = COALESCE($2, amount),
           frequency    = COALESCE($3, frequency),
           next_due_date= COALESCE($4, next_due_date),
           category     = COALESCE($5, category),
           notes        = COALESCE($6, notes),
           auto_renew   = COALESCE($7, auto_renew),
           status       = COALESCE($8, status),
           updated_at   = NOW()
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [name, amount, frequency, next_due_date, category, notes, auto_renew, status, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    res.json({ success: true, message: 'Subscription updated', data: result.rows[0] });
  } catch (error) {
    console.error('❌ Update subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to update subscription' });
  }
});

// DELETE /api/v1/subscriptions/:id — cancel / delete
router.delete('/:id', authenticateToken, uuidParamValidation, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === 'true') {
      await query(`DELETE FROM subscriptions WHERE id = $1 AND user_id = $2`, [id, userId]);
      return res.json({ success: true, message: 'Subscription deleted permanently' });
    }

    // Soft-cancel
    const result = await query(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    res.json({ success: true, message: 'Subscription cancelled', data: result.rows[0] });
  } catch (error) {
    console.error('❌ Delete subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
  }
});

module.exports = router;
