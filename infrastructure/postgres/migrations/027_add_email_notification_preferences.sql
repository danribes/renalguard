-- Migration 027: Add email notification preferences
-- Adds configurable notification options for different types of events
-- Date: 2025-11-24

-- Add notification preference columns to email_config table
ALTER TABLE email_config
ADD COLUMN IF NOT EXISTS notify_ckd_transitions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_lab_updates BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_significant_changes BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_clinical_alerts BOOLEAN DEFAULT true;

-- Add comments for new columns
COMMENT ON COLUMN email_config.notify_ckd_transitions IS 'Send email when patient transitions between CKD and Non-CKD status';
COMMENT ON COLUMN email_config.notify_lab_updates IS 'Send email for all lab updates regardless of significance';
COMMENT ON COLUMN email_config.notify_significant_changes IS 'Send email when lab values change significantly (>10% eGFR decline or >30% uACR increase)';
COMMENT ON COLUMN email_config.notify_clinical_alerts IS 'Send email for clinical alerts (rapid progression, severe values, etc.)';

-- Update existing config row if it exists
UPDATE email_config
SET
  notify_ckd_transitions = true,
  notify_lab_updates = false,
  notify_significant_changes = true,
  notify_clinical_alerts = true
WHERE id = 1;

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Email notification preferences added:';
  RAISE NOTICE '  - CKD Transitions: Enabled by default';
  RAISE NOTICE '  - All Lab Updates: Disabled by default';
  RAISE NOTICE '  - Significant Changes: Enabled by default';
  RAISE NOTICE '  - Clinical Alerts: Enabled by default';
END $$;
