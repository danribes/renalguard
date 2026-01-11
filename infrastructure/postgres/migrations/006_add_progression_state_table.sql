-- Migration: Add patient_progression_state table
-- Purpose: Store progression parameters for consistent dynamic generation
-- Date: 2025-11-11

-- Drop existing table if it exists
DROP TABLE IF EXISTS patient_progression_state CASCADE;

-- Create patient_progression_state table
CREATE TABLE patient_progression_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    progression_type VARCHAR(20) NOT NULL CHECK (progression_type IN ('progressive', 'stable', 'improving', 'rapid')),
    baseline_egfr DECIMAL(5, 2) NOT NULL,
    baseline_uacr DECIMAL(8, 2) NOT NULL,
    egfr_decline_rate DECIMAL(6, 4) NOT NULL,  -- mL/min per month (can be negative for decline, positive for improvement)
    uacr_change_rate DECIMAL(6, 4) NOT NULL,   -- Decimal percentage change per month (e.g., 0.03 = 3% increase)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Ensure one progression state per patient
    UNIQUE(patient_id)
);

-- Create indexes
CREATE INDEX idx_progression_state_patient ON patient_progression_state(patient_id);
CREATE INDEX idx_progression_state_type ON patient_progression_state(progression_type);

-- Add comments
COMMENT ON TABLE patient_progression_state IS 'Stores consistent progression parameters for each patient to ensure realistic dynamic cycle generation';
COMMENT ON COLUMN patient_progression_state.progression_type IS 'Type of progression: progressive (30%), stable (50%), improving (15%), rapid (5%)';
COMMENT ON COLUMN patient_progression_state.egfr_decline_rate IS 'eGFR change per month in mL/min (negative = decline, positive = improvement)';
COMMENT ON COLUMN patient_progression_state.uacr_change_rate IS 'uACR percentage change per month (e.g., 0.03 = 3% increase per month)';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON patient_progression_state TO PUBLIC;
