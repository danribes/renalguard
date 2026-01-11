-- ============================================
-- Migration 011: General Medications Table & Additional Fallback Variables
-- Completes the fallback system for risk stratification when primary labs are missing
-- ============================================

-- ============================================
-- 1. Add has_obesity flag to patients table for quick queries
-- ============================================

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS has_obesity BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_patients_has_obesity ON patients(has_obesity);

COMMENT ON COLUMN patients.has_obesity IS 'Computed flag: Patient has BMI >= 30';

-- ============================================
-- 2. Create General Medications Table
-- Tracks all medications (not just Jardiance)
-- ============================================

CREATE TABLE IF NOT EXISTS patient_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Medication details
    medication_name VARCHAR(200) NOT NULL, -- Generic or brand name
    medication_class VARCHAR(100), -- 'ACE Inhibitor', 'ARB', 'Beta Blocker', 'SGLT2i', 'Metformin', etc.
    medication_type VARCHAR(50), -- 'oral', 'injectable', 'topical', 'IV', etc.

    -- Dosage
    dosage VARCHAR(100), -- e.g., "10mg", "500mg twice daily"
    frequency VARCHAR(50), -- 'once daily', 'twice daily', 'as needed', etc.
    route VARCHAR(20), -- 'oral', 'IV', 'subcutaneous', 'topical'

    -- Clinical use
    indication VARCHAR(200), -- What is this medication treating?
    is_active BOOLEAN DEFAULT true,

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE, -- NULL if currently active

    -- Prescriber
    prescriber_name VARCHAR(100),
    prescriber_npi VARCHAR(20),

    -- Clinical flags for risk assessment
    is_nephrotoxic BOOLEAN DEFAULT false, -- NSAIDs, aminoglycosides, etc.
    is_diabetes_medication BOOLEAN DEFAULT false, -- Metformin, Insulin, etc.
    is_hypertension_medication BOOLEAN DEFAULT false, -- ACE-I, ARB, CCB, etc.
    is_cardioprotective BOOLEAN DEFAULT false, -- Statins, Aspirin, etc.
    is_ras_inhibitor BOOLEAN DEFAULT false, -- ACE-I or ARB
    is_sglt2i BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_timestamp,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_medication_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Indexes for performance
CREATE INDEX idx_patient_medications_patient_id ON patient_medications(patient_id);
CREATE INDEX idx_patient_medications_active ON patient_medications(is_active) WHERE is_active = true;
CREATE INDEX idx_patient_medications_class ON patient_medications(medication_class);
CREATE INDEX idx_patient_medications_nephrotoxic ON patient_medications(is_nephrotoxic) WHERE is_nephrotoxic = true;
CREATE INDEX idx_patient_medications_diabetes ON patient_medications(is_diabetes_medication) WHERE is_diabetes_medication = true;
CREATE INDEX idx_patient_medications_hypertension ON patient_medications(is_hypertension_medication) WHERE is_hypertension_medication = true;

COMMENT ON TABLE patient_medications IS 'Comprehensive medication tracking for all patients';
COMMENT ON COLUMN patient_medications.is_nephrotoxic IS 'TRUE for NSAIDs, aminoglycosides, contrast agents, calcineurin inhibitors, etc.';
COMMENT ON COLUMN patient_medications.is_diabetes_medication IS 'TRUE for Metformin, Insulin, Sulfonylureas, GLP-1 agonists, etc.';
COMMENT ON COLUMN patient_medications.is_hypertension_medication IS 'TRUE for ACE-I, ARB, Beta Blockers, CCB, Diuretics, etc.';

-- ============================================
-- 3. Function to compute has_obesity from BMI
-- ============================================

CREATE OR REPLACE FUNCTION compute_patient_obesity_status()
RETURNS TRIGGER AS $$
DECLARE
    v_bmi DECIMAL(5,2);
BEGIN
    -- Calculate BMI if height and weight are available
    IF NEW.height IS NOT NULL AND NEW.weight IS NOT NULL AND NEW.height > 0 THEN
        -- BMI = weight (kg) / (height (m))^2
        -- height is stored in cm, so divide by 100 to get meters
        v_bmi := NEW.weight / POWER(NEW.height / 100.0, 2);

        -- Obesity is BMI >= 30
        NEW.has_obesity := (v_bmi >= 30);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically compute has_obesity
CREATE TRIGGER trigger_compute_obesity_status
    BEFORE INSERT OR UPDATE OF weight, height
    ON patients
    FOR EACH ROW
    EXECUTE FUNCTION compute_patient_obesity_status();

COMMENT ON FUNCTION compute_patient_obesity_status() IS 'Automatically computes has_obesity flag based on BMI (>= 30)';

-- ============================================
-- 4. Function to update patient medication flags from medications table
-- ============================================

CREATE OR REPLACE FUNCTION update_patient_medication_flags()
RETURNS TRIGGER AS $$
BEGIN
    -- Update on_ras_inhibitor flag
    UPDATE patients
    SET on_ras_inhibitor = EXISTS (
        SELECT 1 FROM patient_medications
        WHERE patient_id = NEW.patient_id
        AND is_active = true
        AND is_ras_inhibitor = true
    )
    WHERE id = NEW.patient_id;

    -- Update on_sglt2i flag
    UPDATE patients
    SET on_sglt2i = EXISTS (
        SELECT 1 FROM patient_medications
        WHERE patient_id = NEW.patient_id
        AND is_active = true
        AND is_sglt2i = true
    )
    WHERE id = NEW.patient_id;

    -- Update nephrotoxic_meds flag
    UPDATE patients
    SET nephrotoxic_meds = EXISTS (
        SELECT 1 FROM patient_medications
        WHERE patient_id = NEW.patient_id
        AND is_active = true
        AND is_nephrotoxic = true
    )
    WHERE id = NEW.patient_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep patient flags in sync with medications
CREATE TRIGGER trigger_update_medication_flags
    AFTER INSERT OR UPDATE OF is_active, is_ras_inhibitor, is_sglt2i, is_nephrotoxic
    ON patient_medications
    FOR EACH ROW
    EXECUTE FUNCTION update_patient_medication_flags();

COMMENT ON FUNCTION update_patient_medication_flags() IS 'Keeps patient medication flags synchronized with medications table';

-- ============================================
-- 5. Create view for medication-inferred diagnoses
-- ============================================

CREATE OR REPLACE VIEW v_medication_inferred_diagnoses AS
SELECT
    patient_id,

    -- Diabetes inference (use BOOL_OR for boolean aggregation)
    BOOL_OR(is_diabetes_medication) as medication_suggests_diabetes,

    -- Hypertension inference
    BOOL_OR(is_hypertension_medication) as medication_suggests_hypertension,

    -- List of active medications
    array_agg(
        medication_name ORDER BY start_date DESC
    ) FILTER (WHERE is_active = true) as active_medications,

    -- Count of nephrotoxic medications
    COUNT(*) FILTER (WHERE is_nephrotoxic = true AND is_active = true) as nephrotoxic_med_count

FROM patient_medications
GROUP BY patient_id;

COMMENT ON VIEW v_medication_inferred_diagnoses IS 'Infers potential diagnoses from medication patterns when labs/diagnoses are missing';

-- ============================================
-- 6. Insert common medication classifications
-- This is a reference for medication_class values
-- ============================================

COMMENT ON COLUMN patient_medications.medication_class IS
'Common values:
Diabetes: Metformin, Insulin, Sulfonylurea, DPP-4 Inhibitor, GLP-1 Agonist, SGLT2i
Hypertension: ACE Inhibitor, ARB, Beta Blocker, Calcium Channel Blocker, Diuretic, Alpha Blocker
Cardio: Statin, Antiplatelet, Anticoagulant
Nephrotoxic: NSAID, Aminoglycoside, Calcineurin Inhibitor, Contrast Agent, Lithium, PPI
Kidney Protective: RAS Inhibitor, SGLT2i, MRA (Mineralocorticoid Receptor Antagonist)';

-- ============================================
-- 7. Update existing patients' obesity status
-- ============================================

UPDATE patients
SET has_obesity = (
    CASE
        WHEN weight IS NOT NULL AND height IS NOT NULL AND height > 0
        THEN (weight / POWER(height / 100.0, 2)) >= 30
        ELSE false
    END
)
WHERE weight IS NOT NULL AND height IS NOT NULL;
