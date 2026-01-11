-- Migration: Add month tracking to observations for 12-month history simulation
-- Purpose: Enable tracking of lab values across 12 monthly cycles for AI assessment

-- Add month_number column to observations table
ALTER TABLE observations
ADD COLUMN IF NOT EXISTS month_number INTEGER DEFAULT 1 CHECK (month_number >= 1 AND month_number <= 12);

-- Create index for efficient month-based queries
CREATE INDEX IF NOT EXISTS idx_observations_month ON observations(patient_id, month_number, observation_type);

-- Add comment explaining the column
COMMENT ON COLUMN observations.month_number IS 'Month number (1-12) for tracking historical lab values. Month 12 represents the most recent values.';

-- Update existing observations to be in month 1 (baseline)
-- This ensures all existing data has a valid month_number
UPDATE observations
SET month_number = 1
WHERE month_number IS NULL;

-- Make the column NOT NULL now that all existing rows have a value
ALTER TABLE observations
ALTER COLUMN month_number SET NOT NULL;
