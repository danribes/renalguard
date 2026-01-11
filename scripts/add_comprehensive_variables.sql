-- ===============================================================
-- ADDITIONAL DATABASE VARIABLES MIGRATION
-- Based on: CKD_Variables_Comprehensive_List.md
-- ===============================================================
-- This script adds missing variables that were not in the
-- initial database enhancement
-- ===============================================================

-- Add urine analysis variables to observations or as separate columns
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS appetite VARCHAR(10),  -- Good/Poor
ADD COLUMN IF NOT EXISTS pedal_edema BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS anemia BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chronic_nsaid_use_months INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS chronic_ppi_use_months INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS diabetes_duration_years INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_aki_episodes INTEGER DEFAULT 0;

-- Add additional comorbidity flags
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS has_type1_diabetes BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_type2_diabetes BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_essential_hypertension BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_renovascular_hypertension BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_hypertensive_ckd BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_mi BOOLEAN DEFAULT FALSE,  -- Myocardial Infarction
ADD COLUMN IF NOT EXISTS has_atrial_fibrillation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_stroke BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_peripheral_vascular_disease BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_hyperlipidemia BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_uti BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_kidney_stones BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_gout BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_polycystic_kidney_disease BOOLEAN DEFAULT FALSE;

-- Create urine_analysis table for detailed urine microscopy
CREATE TABLE IF NOT EXISTS urine_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    test_date DATE NOT NULL,
    blood_urea DECIMAL(6,2),  -- BUN in mg/dL
    specific_gravity DECIMAL(4,3),  -- e.g., 1.005-1.030
    albumin_level INTEGER CHECK (albumin_level BETWEEN 0 AND 5),  -- 0-5 scale
    sugar_level INTEGER CHECK (sugar_level BETWEEN 0 AND 5),  -- 0-5 scale
    rbc_status VARCHAR(20),  -- Normal/Abnormal
    pus_cells VARCHAR(20),  -- Normal/Abnormal
    pus_cell_clumps VARCHAR(20),  -- Present/Not Present
    bacteria VARCHAR(20),  -- Present/Not Present
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_urine_analysis_patient ON urine_analysis(patient_id);
CREATE INDEX IF NOT EXISTS idx_urine_analysis_date ON urine_analysis(test_date);

-- Create hematology table for detailed blood counts
CREATE TABLE IF NOT EXISTS hematology (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    test_date DATE NOT NULL,
    hemoglobin DECIMAL(4,1),  -- g/dL
    packed_cell_volume DECIMAL(4,1),  -- PCV in %
    rbc_count DECIMAL(4,2),  -- millions/cmm
    wbc_count DECIMAL(8,0),  -- cells/cumm
    platelet_count DECIMAL(6,0),  -- thousands/cmm
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hematology_patient ON hematology(patient_id);
CREATE INDEX IF NOT EXISTS idx_hematology_date ON hematology(test_date);

-- Update existing patients to set type1 vs type2 diabetes
UPDATE patients
SET has_type2_diabetes = has_diabetes
WHERE has_diabetes = TRUE;

-- Update hypertension subtypes
UPDATE patients
SET has_essential_hypertension = has_hypertension
WHERE has_hypertension = TRUE;

-- Set CKD-related hypertension for patients with both
UPDATE patients
SET has_hypertensive_ckd = TRUE
WHERE has_hypertension = TRUE AND ckd_diagnosed = TRUE;

-- Set anemia flag for patients with low hemoglobin
UPDATE patients p
SET anemia = TRUE
WHERE EXISTS (
    SELECT 1 FROM observations o
    WHERE o.patient_id = p.id
      AND o.observation_type = 'Hemoglobin'
      AND o.value_numeric < 12.0
);

-- Set hyperlipidemia flag for patients with high cholesterol
UPDATE patients p
SET has_hyperlipidemia = TRUE
WHERE EXISTS (
    SELECT 1 FROM observations o
    WHERE o.patient_id = p.id
      AND o.observation_type = 'Total Cholesterol'
      AND o.value_numeric >= 240
);

-- Set gout flag for patients on allopurinol or high uric acid
UPDATE patients p
SET has_gout = TRUE
WHERE EXISTS (
    SELECT 1 FROM observations o
    WHERE o.patient_id = p.id
      AND o.observation_type = 'Uric Acid'
      AND o.value_numeric >= 7.0
) OR EXISTS (
    SELECT 1 FROM prescriptions pr
    WHERE pr.patient_id = p.id
      AND pr.medication_name = 'Allopurinol'
      AND pr.status = 'active'
);

-- Add new observation types that are commonly needed
-- These will be populated in the data generation script

SELECT 'Additional variables migration complete!' as status;

-- Verification queries
SELECT
    'Patients table columns' as metric,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'patients';

SELECT
    'New tables created' as metric,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_name IN ('urine_analysis', 'hematology');
