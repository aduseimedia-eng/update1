const app = require('./src/app');
const { pool } = require('./src/config/database');
const { initScheduledTasks } = require('./src/scheduledTasks');
// Only load .env in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const PORT = process.env.PORT || 5000;

// Start HTTP server immediately (don't wait for DB)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          🏦 KudiSave API Server Running           ║
║                                                           ║
║  Environment: ${(process.env.NODE_ENV || 'development').toUpperCase().padEnd(15, ' ')} Port: ${PORT.toString().padStart(5, ' ')}          ║
║                                                           ║
║  🚀 Server:     http://0.0.0.0:${PORT}                       ║
║  📊 Health:     http://0.0.0.0:${PORT}/health                ║
║  🔐 API:        http://0.0.0.0:${PORT}/api/v1                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Test database connection after server is listening (with retries)
  connectWithRetry(5, 5000);
});

// Database connection with retry logic
async function connectWithRetry(maxRetries, delayMs) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('✅ Database connected successfully');
      console.log('📅 Database time:', res.rows[0].now);
      
      // Run any pending migrations
      await runStartupMigrations();
      
      // Initialize scheduled email tasks after DB is ready
      initScheduledTasks();
      return;
    } catch (err) {
      console.error(`❌ Failed to connect to database (attempt ${attempt}/${maxRetries}):`, err.message);
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error('⚠️  All database connection attempts failed. Server is running but DB is unavailable.');
      }
    }
  }
}

// Run startup migrations (idempotent)
async function runStartupMigrations() {
  console.log('🔄 Running startup migrations...');
  try {
    // Add email notification tracking columns (idempotent)
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_budget_alert_threshold INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_milestone_notified INTEGER DEFAULT 0');
    await pool.query('ALTER TABLE bill_reminders ADD COLUMN IF NOT EXISTS last_reminder_sent DATE');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_bill_reminders_due_date ON bill_reminders(due_date)');
    console.log('✅ Migrations completed');
  } catch (err) {
    console.error('⚠️  Migration warning:', err.message);
    // Don't fail startup on migration errors - they may already exist
  }
}

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🛑 Received shutdown signal, closing server gracefully...');
  
  server.close(() => {
    console.log('👋 Server closed');
    
    pool.end(() => {
      console.log('🔌 Database connection pool closed');
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});
