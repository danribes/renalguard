-- Migration: Add Email notification tables
-- Purpose: Enable email notifications for patient status changes

-- Table for Email configuration
CREATE TABLE IF NOT EXISTS email_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  doctor_email VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT false,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_user VARCHAR(255),
  smtp_password VARCHAR(255),
  from_email VARCHAR(255),
  from_name VARCHAR(255) DEFAULT 'CKD Analyzer System',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_config CHECK (id = 1)
);

-- Table for Email message logs
CREATE TABLE IF NOT EXISTS email_messages (
  id SERIAL PRIMARY KEY,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  email_message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient message history queries
CREATE INDEX IF NOT EXISTS idx_email_messages_to ON email_messages(to_email, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status, sent_at DESC);

-- Add comments
COMMENT ON TABLE email_config IS 'Email notification configuration';
COMMENT ON TABLE email_messages IS 'Log of email messages sent to doctors';
COMMENT ON COLUMN email_config.doctor_email IS 'Email address to receive notifications';
COMMENT ON COLUMN email_config.enabled IS 'Whether email notifications are enabled';
COMMENT ON COLUMN email_config.smtp_host IS 'SMTP server hostname (optional, uses test account if not set)';
COMMENT ON COLUMN email_config.smtp_port IS 'SMTP server port (587 for TLS, 465 for SSL)';
COMMENT ON COLUMN email_messages.email_message_id IS 'Email message ID from SMTP server for tracking';
