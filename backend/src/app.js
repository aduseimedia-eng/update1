const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const incomeRoutes = require('./routes/income');
const budgetRoutes = require('./routes/budget');
const goalRoutes = require('./routes/goals');
const reportRoutes = require('./routes/reports');
const gamificationRoutes = require('./routes/gamification');
const phoneRoutes = require('./routes/phone');
const emailRoutes = require('./routes/email');

// New feature routes (v2)
const billsRoutes = require('./routes/bills');
const currencyRoutes = require('./routes/currency');
const challengesRoutes = require('./routes/challenges');
const achievementsRoutes = require('./routes/achievements');
const comparisonsRoutes = require('./routes/comparisons');
const backupRoutes = require('./routes/backup');
const exportRoutes = require('./routes/export');
const notificationsRoutes = require('./routes/notifications');
const gmailRoutes = require('./routes/gmail');
const subscriptionsRoutes = require('./routes/subscriptions');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOrigins = [
  'https://kudisave.com',
  'https://www.kudisave.com',
  'https://aduseimedia-eng.github.io',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://localhost:5501',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000'
];

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : allowedOrigins)
    : true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'KudiSave API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Migration endpoint (run once to create subscriptions table)
app.get('/run-subscriptions-migration', async (req, res) => {
  const { pool } = require('./config/database');
  try {
    // Create subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
        frequency VARCHAR(20) NOT NULL DEFAULT 'monthly'
          CHECK (frequency IN ('weekly','monthly','quarterly','yearly')),
        next_due_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','paused','cancelled')),
        auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
        category VARCHAR(50) NOT NULL DEFAULT 'Entertainment',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_next_due ON subscriptions(next_due_date);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    `);
    
    // Create savings_transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS savings_transactions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_savings_goal_id ON savings_transactions(goal_id);
      CREATE INDEX IF NOT EXISTS idx_savings_user_id ON savings_transactions(user_id);
    `);
    
    res.json({ success: true, message: 'Subscriptions and savings_transactions tables created!' });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API routes
const API_VERSION = '/api/v1';

app.use(`${API_VERSION}/auth`, authRoutes);
app.use(`${API_VERSION}/phone`, phoneRoutes);
app.use(`${API_VERSION}/email`, emailRoutes);
app.use(`${API_VERSION}/expenses`, expenseRoutes);
app.use(`${API_VERSION}/income`, incomeRoutes);
app.use(`${API_VERSION}/budget`, budgetRoutes);
app.use(`${API_VERSION}/goals`, goalRoutes);
app.use(`${API_VERSION}/reports`, reportRoutes);
app.use(`${API_VERSION}/gamification`, gamificationRoutes);

// New feature routes (v2)
app.use(`${API_VERSION}/bills`, billsRoutes);
app.use(`${API_VERSION}/currency`, currencyRoutes);
app.use(`${API_VERSION}/challenges`, challengesRoutes);
app.use(`${API_VERSION}/achievements`, achievementsRoutes);
app.use(`${API_VERSION}/comparisons`, comparisonsRoutes);
app.use(`${API_VERSION}/backup`, backupRoutes);
app.use(`${API_VERSION}/export`, exportRoutes);
app.use(`${API_VERSION}/notifications`, notificationsRoutes);
app.use(`${API_VERSION}/gmail`, gmailRoutes);
app.use(`${API_VERSION}/subscriptions`, subscriptionsRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to KudiSave API',
    version: '2.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      health: '/health',
      auth: `${API_VERSION}/auth`,
      expenses: `${API_VERSION}/expenses`,
      income: `${API_VERSION}/income`,
      budget: `${API_VERSION}/budget`,
      goals: `${API_VERSION}/goals`,
      reports: `${API_VERSION}/reports`,
      gamification: `${API_VERSION}/gamification`,
      bills: `${API_VERSION}/bills`,
      currency: `${API_VERSION}/currency`,
      challenges: `${API_VERSION}/challenges`,
      achievements: `${API_VERSION}/achievements`,
      comparisons: `${API_VERSION}/comparisons`,
      backup: `${API_VERSION}/backup`,
      export: `${API_VERSION}/export`,
      notifications: `${API_VERSION}/notifications`,
      gmail: `${API_VERSION}/gmail`,
      subscriptions: `${API_VERSION}/subscriptions`
    }
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;
