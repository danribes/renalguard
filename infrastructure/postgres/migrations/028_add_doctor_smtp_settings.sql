-- Migration: Add SMTP settings to doctors table
-- Purpose: Allow each doctor to have their own email configuration

-- Add SMTP configuration columns to doctors table
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255),
ADD COLUMN IF NOT EXISTS smtp_port INTEGER,
ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(255),
ADD COLUMN IF NOT EXISTS smtp_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS from_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS from_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS smtp_enabled BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_doctors_smtp_enabled ON doctors(smtp_enabled);

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 028: Added SMTP settings columns to doctors table';
  RAISE NOTICE 'Columns added: smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name, smtp_enabled';
END $$;
