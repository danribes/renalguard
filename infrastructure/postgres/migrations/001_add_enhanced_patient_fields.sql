-- Migration: Add enhanced patient fields
-- This adds all the fields required for the enhanced CKD patient card

-- Add anthropometric fields to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS weight DECIMAL(5, 2); -- kg
ALTER TABLE patients ADD COLUMN IF NOT EXISTS height INTEGER; -- cm

-- Add smoking status
ALTER TABLE patients ADD COLUMN IF NOT EXISTS smoking_status VARCHAR(20) DEFAULT 'Unknown';
-- Values: 'Never', 'Former', 'Current', 'Unknown'

-- Add clinical history flags
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cvd_history BOOLEAN DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS family_history_esrd BOOLEAN DEFAULT false;

-- Add medication flags
ALTER TABLE patients ADD COLUMN IF NOT EXISTS on_ras_inhibitor BOOLEAN DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS on_sglt2i BOOLEAN DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nephrotoxic_meds BOOLEAN DEFAULT false;

-- Add referral status
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nephrologist_referral BOOLEAN DEFAULT false;

-- Add clinical timeline
ALTER TABLE patients ADD COLUMN IF NOT EXISTS diagnosis_date DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_visit_date DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS next_visit_date DATE;

-- Add new observation types for comprehensive lab tracking
-- We'll store these in the observations table:
-- - BUN (blood urea nitrogen)
-- - hemoglobin
-- - potassium
-- - calcium
-- - phosphorus
-- - albumin
-- - LDL cholesterol
-- - HDL cholesterol
-- - eGFR_trend (stored as text: 'up', 'down', 'stable')
-- - eGFR_change_percent (stored as numeric)
-- - proteinuria_category (stored as text: 'A1', 'A2', 'A3')

-- Add comorbidities tracking
-- We'll enhance the conditions table to support this

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_patients_weight ON patients(weight);
CREATE INDEX IF NOT EXISTS idx_patients_smoking_status ON patients(smoking_status);
CREATE INDEX IF NOT EXISTS idx_patients_cvd_history ON patients(cvd_history);
CREATE INDEX IF NOT EXISTS idx_patients_nephrologist_referral ON patients(nephrologist_referral);
CREATE INDEX IF NOT EXISTS idx_patients_next_visit ON patients(next_visit_date);

COMMENT ON COLUMN patients.weight IS 'Patient weight in kilograms';
COMMENT ON COLUMN patients.height IS 'Patient height in centimeters';
COMMENT ON COLUMN patients.smoking_status IS 'Smoking status: Never, Former, Current, Unknown';
COMMENT ON COLUMN patients.cvd_history IS 'History of cardiovascular disease';
COMMENT ON COLUMN patients.family_history_esrd IS 'Family history of end-stage renal disease';
COMMENT ON COLUMN patients.on_ras_inhibitor IS 'Currently on RAS inhibitor medication';
COMMENT ON COLUMN patients.on_sglt2i IS 'Currently on SGLT2 inhibitor medication';
COMMENT ON COLUMN patients.nephrotoxic_meds IS 'Currently on nephrotoxic medications';
COMMENT ON COLUMN patients.nephrologist_referral IS 'Has been referred to nephrologist';
COMMENT ON COLUMN patients.diagnosis_date IS 'Date of CKD diagnosis';
COMMENT ON COLUMN patients.last_visit_date IS 'Date of last clinical visit';
COMMENT ON COLUMN patients.next_visit_date IS 'Date of next scheduled visit';
