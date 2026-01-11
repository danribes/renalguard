-- Migration: Add monitoring and treatment tracking columns to patients table
-- Created: 2025-11-12

-- Add home monitoring columns
ALTER TABLE patients ADD COLUMN IF NOT EXISTS home_monitoring_device VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS home_monitoring_active BOOLEAN DEFAULT false;

-- Add CKD treatment tracking columns
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ckd_treatment_active BOOLEAN DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS ckd_treatment_type VARCHAR(100);

-- Update existing NULL values to defaults
UPDATE patients SET home_monitoring_active = false WHERE home_monitoring_active IS NULL;
UPDATE patients SET ckd_treatment_active = false WHERE ckd_treatment_active IS NULL;

-- Verification
SELECT 'Migration complete: Added monitoring and treatment columns' AS status;
