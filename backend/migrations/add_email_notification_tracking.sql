-- Migration: Add email notification tracking columns
-- Run this to add columns needed for automatic email notifications

-- Track last budget alert threshold sent to user
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_budget_alert_threshold INTEGER DEFAULT 0;

-- Track last milestone notification sent for each goal
ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_milestone_notified INTEGER DEFAULT 0;

-- Track last reminder sent for bills
ALTER TABLE bill_reminders ADD COLUMN IF NOT EXISTS last_reminder_sent DATE;

-- Create index for faster bill reminder queries
CREATE INDEX IF NOT EXISTS idx_bill_reminders_due_date ON bill_reminders(due_date) WHERE is_active = TRUE;

-- Log completion
DO $$ BEGIN RAISE NOTICE 'Email notification tracking columns added successfully'; END $$;
