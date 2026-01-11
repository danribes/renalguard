-- Migration: Add external notification emails table
-- Purpose: Store additional email addresses that receive all alerts

CREATE TABLE IF NOT EXISTS external_notification_emails (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_external_notification_emails_enabled ON external_notification_emails(enabled);

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 029: Created external_notification_emails table';
  RAISE NOTICE 'This table stores additional email addresses that receive all system alerts';
END $$;
