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
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.CORS_ORIGIN || '').split(',')
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
