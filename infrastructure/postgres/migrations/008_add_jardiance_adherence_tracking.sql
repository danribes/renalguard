-- ============================================
-- Migration 008: Jardiance Adherence Tracking System
-- Implements complete medication adherence monitoring
-- Based on Minuteful Kidney Variable Dictionary
-- ============================================

-- ============================================
-- 1. Add Comorbidity Flags to Patients Table
-- ============================================

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS has_diabetes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_hypertension BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_heart_failure BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_cad BOOLEAN DEFAULT false;

-- Create indexes for quick filtering
CREATE INDEX IF NOT EXISTS idx_patients_has_diabetes ON patients(has_diabetes);
CREATE INDEX IF NOT EXISTS idx_patients_has_hypertension ON patients(has_hypertension);

COMMENT ON COLUMN patients.has_diabetes IS 'Computed flag: Patient has Type 1 or Type 2 Diabetes';
COMMENT ON COLUMN patients.has_hypertension IS 'Computed flag: Patient has Essential Hypertension';
COMMENT ON COLUMN patients.has_heart_failure IS 'Computed flag: Patient has Heart Failure';
COMMENT ON COLUMN patients.has_cad IS 'Computed flag: Patient has Coronary Artery Disease';

-- ============================================
-- 2. Jardiance Prescriptions Table
-- ============================================

CREATE TABLE IF NOT EXISTS jardiance_prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Prescription details
    prescribed BOOLEAN DEFAULT true,
    currently_taking BOOLEAN DEFAULT true,
    medication VARCHAR(100) NOT NULL, -- "Jardiance (empagliflozin) 10mg" or "25mg"
    dosage VARCHAR(20) NOT NULL, -- "10mg", "25mg"

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE, -- NULL if currently active

    -- Prescriber information
    prescriber_name VARCHAR(100),
    prescriber_npi VARCHAR(20),

    -- Indication
    indication VARCHAR(100), -- "CKD with diabetes", "CKD without diabetes", "Heart failure"

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT check_dosage CHECK (dosage IN ('10mg', '25mg'))
);

CREATE INDEX idx_jardiance_prescriptions_patient_id ON jardiance_prescriptions(patient_id);
CREATE INDEX idx_jardiance_prescriptions_active ON jardiance_prescriptions(currently_taking) WHERE currently_taking = true;
CREATE INDEX idx_jardiance_prescriptions_dates ON jardiance_prescriptions(start_date, end_date);

COMMENT ON TABLE jardiance_prescriptions IS 'Tracks all Jardiance prescriptions for patients';
COMMENT ON COLUMN jardiance_prescriptions.currently_taking IS 'TRUE if patient is actively taking this prescription';
COMMENT ON COLUMN jardiance_prescriptions.end_date IS 'NULL for active prescriptions, set date when discontinued';

-- ============================================
-- 3. Jardiance Refills Table
-- ============================================

CREATE TABLE IF NOT EXISTS jardiance_refills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES jardiance_prescriptions(id) ON DELETE CASCADE,

    -- Refill details
    refill_date DATE NOT NULL,
    days_supply INTEGER NOT NULL, -- Usually 30 or 90 days
    quantity INTEGER NOT NULL, -- Number of tablets

    -- Expected vs actual
    expected_refill_date DATE, -- When we expected them to refill
    gap_days INTEGER, -- Calculated: actual refill date - expected refill date (positive = late)

    -- Pharmacy information
    pharmacy_name VARCHAR(100),
    pharmacy_npi VARCHAR(20),

    -- Cost information (optional)
    copay_amount DECIMAL(10, 2),
    cost_barrier_reported BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_days_supply CHECK (days_supply BETWEEN 7 AND 365),
    CONSTRAINT check_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_jardiance_refills_prescription_id ON jardiance_refills(prescription_id);
CREATE INDEX idx_jardiance_refills_date ON jardiance_refills(refill_date);
CREATE INDEX idx_jardiance_refills_gap ON jardiance_refills(gap_days) WHERE gap_days > 7;

COMMENT ON TABLE jardiance_refills IS 'Tracks every refill event for Jardiance prescriptions';
COMMENT ON COLUMN jardiance_refills.gap_days IS 'Days between expected and actual refill. Positive = late, Negative = early';
COMMENT ON COLUMN jardiance_refills.expected_refill_date IS 'Calculated as previous_refill_date + days_supply';

-- ============================================
-- 4. Jardiance Adherence Metrics Table
-- ============================================

CREATE TABLE IF NOT EXISTS jardiance_adherence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES jardiance_prescriptions(id) ON DELETE CASCADE,

    -- Assessment period
    assessment_date DATE NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    period_days INTEGER NOT NULL, -- Usually 30, 90, or 180 days

    -- Primary adherence metrics
    mpr DECIMAL(5, 2) NOT NULL, -- Medication Possession Ratio (0.00 to 100.00)
    pdc DECIMAL(5, 2) NOT NULL, -- Proportion of Days Covered (0.00 to 100.00)

    -- Adherence category
    category VARCHAR(20) NOT NULL, -- 'High' (≥80%), 'Medium' (60-79%), 'Low' (<60%)

    -- Supporting data
    total_refills INTEGER NOT NULL,
    total_days_supply INTEGER NOT NULL,
    total_quantity INTEGER NOT NULL,

    -- Gap analysis
    total_gap_days INTEGER DEFAULT 0,
    max_gap_days INTEGER DEFAULT 0,
    gap_count INTEGER DEFAULT 0, -- Number of gaps > 7 days

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_mpr_range CHECK (mpr BETWEEN 0 AND 100),
    CONSTRAINT check_pdc_range CHECK (pdc BETWEEN 0 AND 100),
    CONSTRAINT check_category CHECK (category IN ('High', 'Medium', 'Low')),
    CONSTRAINT check_period_dates CHECK (period_end_date >= period_start_date),
    CONSTRAINT check_period_days CHECK (period_days = (period_end_date - period_start_date + 1))
);

CREATE INDEX idx_jardiance_adherence_prescription_id ON jardiance_adherence(prescription_id);
CREATE INDEX idx_jardiance_adherence_date ON jardiance_adherence(assessment_date);
CREATE INDEX idx_jardiance_adherence_category ON jardiance_adherence(category);
CREATE INDEX idx_jardiance_adherence_mpr ON jardiance_adherence(mpr);

COMMENT ON TABLE jardiance_adherence IS 'Computed adherence metrics over specific time periods';
COMMENT ON COLUMN jardiance_adherence.mpr IS 'MPR = (Total days supply / Days in period) × 100';
COMMENT ON COLUMN jardiance_adherence.pdc IS 'PDC = (Days with medication available / Days in period) × 100';
COMMENT ON COLUMN jardiance_adherence.category IS 'High: MPR≥80%, Medium: 60-79%, Low: <60%';

-- ============================================
-- 5. Adherence Barriers Table
-- ============================================

CREATE TABLE IF NOT EXISTS adherence_barriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES jardiance_prescriptions(id) ON DELETE CASCADE,

    -- Barrier details
    barrier_type VARCHAR(50) NOT NULL,
    barrier_description TEXT,

    -- Status
    identified_date DATE NOT NULL,
    resolved BOOLEAN DEFAULT false,
    resolution_date DATE,
    resolution_notes TEXT,

    -- Severity
    severity VARCHAR(20), -- 'Low', 'Medium', 'High', 'Critical'

    -- Intervention tracking
    intervention_required BOOLEAN DEFAULT false,
    intervention_type VARCHAR(100),
    intervention_date DATE,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_barrier_type CHECK (barrier_type IN (
        'Cost concerns',
        'Forgetfulness',
        'Side effects',
        'Access/Transportation',
        'Complex regimen',
        'Lack of symptoms',
        'Health literacy',
        'Depression/Mental health',
        'Pharmacy issues',
        'Insurance issues',
        'Other'
    )),
    CONSTRAINT check_resolution_dates CHECK (
        resolution_date IS NULL OR resolution_date >= identified_date
    ),
    CONSTRAINT check_severity CHECK (severity IN ('Low', 'Medium', 'High', 'Critical'))
);

CREATE INDEX idx_adherence_barriers_prescription_id ON adherence_barriers(prescription_id);
CREATE INDEX idx_adherence_barriers_type ON adherence_barriers(barrier_type);
CREATE INDEX idx_adherence_barriers_resolved ON adherence_barriers(resolved) WHERE resolved = false;
CREATE INDEX idx_adherence_barriers_severity ON adherence_barriers(severity);

COMMENT ON TABLE adherence_barriers IS 'Tracks identified barriers to medication adherence and their resolution';
COMMENT ON COLUMN adherence_barriers.barrier_type IS 'Standardized barrier categories from Variable Dictionary';
COMMENT ON COLUMN adherence_barriers.resolved IS 'TRUE when barrier has been addressed';

-- ============================================
-- 6. Helper Functions
-- ============================================

-- Function to calculate MPR for a prescription over a period
CREATE OR REPLACE FUNCTION calculate_jardiance_mpr(
    p_prescription_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS DECIMAL(5, 2) AS $$
DECLARE
    v_total_days_supply INTEGER;
    v_period_days INTEGER;
    v_mpr DECIMAL(5, 2);
BEGIN
    -- Calculate total days supply from refills in period
    SELECT COALESCE(SUM(days_supply), 0)
    INTO v_total_days_supply
    FROM jardiance_refills
    WHERE prescription_id = p_prescription_id
      AND refill_date BETWEEN p_start_date AND p_end_date;

    -- Calculate period length
    v_period_days := p_end_date - p_start_date + 1;

    -- Calculate MPR
    IF v_period_days > 0 THEN
        v_mpr := LEAST((v_total_days_supply::DECIMAL / v_period_days) * 100, 100.00);
    ELSE
        v_mpr := 0;
    END IF;

    RETURN v_mpr;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_jardiance_mpr IS 'Calculates Medication Possession Ratio for a prescription over a date range';

-- Function to determine adherence category from MPR
CREATE OR REPLACE FUNCTION get_adherence_category(p_mpr DECIMAL)
RETURNS VARCHAR(20) AS $$
BEGIN
    IF p_mpr >= 80 THEN
        RETURN 'High';
    ELSIF p_mpr >= 60 THEN
        RETURN 'Medium';
    ELSE
        RETURN 'Low';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_adherence_category IS 'Converts MPR percentage to adherence category (High/Medium/Low)';

-- Function to get latest adherence for a prescription
CREATE OR REPLACE FUNCTION get_latest_adherence(p_prescription_id UUID)
RETURNS TABLE (
    mpr DECIMAL(5, 2),
    pdc DECIMAL(5, 2),
    category VARCHAR(20),
    assessment_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ja.mpr,
        ja.pdc,
        ja.category,
        ja.assessment_date
    FROM jardiance_adherence ja
    WHERE ja.prescription_id = p_prescription_id
    ORDER BY ja.assessment_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_latest_adherence IS 'Returns most recent adherence metrics for a prescription';

-- Function to get active barriers for a prescription
CREATE OR REPLACE FUNCTION get_active_barriers(p_prescription_id UUID)
RETURNS TABLE (
    barrier_type VARCHAR(50),
    identified_date DATE,
    severity VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ab.barrier_type,
        ab.identified_date,
        ab.severity
    FROM adherence_barriers ab
    WHERE ab.prescription_id = p_prescription_id
      AND ab.resolved = false
    ORDER BY
        CASE ab.severity
            WHEN 'Critical' THEN 1
            WHEN 'High' THEN 2
            WHEN 'Medium' THEN 3
            WHEN 'Low' THEN 4
            ELSE 5
        END,
        ab.identified_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_barriers IS 'Returns all unresolved barriers for a prescription, ordered by severity';

-- ============================================
-- 7. Trigger to Update Comorbidity Flags
-- ============================================

CREATE OR REPLACE FUNCTION update_comorbidity_flags()
RETURNS TRIGGER AS $$
BEGIN
    -- Update patient comorbidity flags based on conditions table
    UPDATE patients p
    SET
        has_diabetes = EXISTS (
            SELECT 1 FROM conditions c
            WHERE c.patient_id = NEW.patient_id
              AND c.clinical_status = 'active'
              AND (c.condition_code LIKE 'E11%' OR c.condition_code LIKE 'E10%')
        ),
        has_hypertension = EXISTS (
            SELECT 1 FROM conditions c
            WHERE c.patient_id = NEW.patient_id
              AND c.clinical_status = 'active'
              AND c.condition_code = 'I10'
        ),
        has_heart_failure = EXISTS (
            SELECT 1 FROM conditions c
            WHERE c.patient_id = NEW.patient_id
              AND c.clinical_status = 'active'
              AND c.condition_code LIKE 'I50%'
        ),
        has_cad = EXISTS (
            SELECT 1 FROM conditions c
            WHERE c.patient_id = NEW.patient_id
              AND c.clinical_status = 'active'
              AND c.condition_code LIKE 'I25%'
        )
    WHERE p.id = NEW.patient_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on conditions table
DROP TRIGGER IF EXISTS trg_update_comorbidity_flags ON conditions;
CREATE TRIGGER trg_update_comorbidity_flags
    AFTER INSERT OR UPDATE ON conditions
    FOR EACH ROW
    EXECUTE FUNCTION update_comorbidity_flags();

COMMENT ON FUNCTION update_comorbidity_flags IS 'Automatically updates patient comorbidity flags when conditions are added/modified';

-- ============================================
-- 8. View: Complete Patient Adherence Summary
-- ============================================

CREATE OR REPLACE VIEW patient_jardiance_summary AS
SELECT
    p.id as patient_id,
    p.medical_record_number as mrn,
    p.first_name || ' ' || p.last_name as patient_name,
    p.has_diabetes,
    p.has_hypertension,
    p.on_ras_inhibitor,

    -- Prescription info
    jp.id as prescription_id,
    jp.currently_taking,
    jp.medication,
    jp.dosage,
    jp.start_date as prescription_start_date,
    jp.end_date as prescription_end_date,

    -- Latest adherence
    la.mpr as latest_mpr,
    la.pdc as latest_pdc,
    la.category as adherence_category,
    la.assessment_date as last_assessment_date,

    -- Refill info
    (SELECT COUNT(*) FROM jardiance_refills jr WHERE jr.prescription_id = jp.id) as total_refills,
    (SELECT MAX(refill_date) FROM jardiance_refills jr WHERE jr.prescription_id = jp.id) as last_refill_date,
    (SELECT AVG(gap_days) FROM jardiance_refills jr WHERE jr.prescription_id = jp.id AND gap_days > 0) as avg_refill_gap,

    -- Barriers
    (SELECT COUNT(*) FROM adherence_barriers ab WHERE ab.prescription_id = jp.id AND ab.resolved = false) as active_barriers_count,
    (SELECT string_agg(barrier_type, ', ') FROM adherence_barriers ab WHERE ab.prescription_id = jp.id AND ab.resolved = false) as active_barriers

FROM patients p
LEFT JOIN jardiance_prescriptions jp ON p.id = jp.patient_id AND jp.currently_taking = true
LEFT JOIN LATERAL (
    SELECT mpr, pdc, category, assessment_date
    FROM jardiance_adherence ja
    WHERE ja.prescription_id = jp.id
    ORDER BY assessment_date DESC
    LIMIT 1
) la ON true
WHERE jp.id IS NOT NULL OR p.on_sglt2i = true;

COMMENT ON VIEW patient_jardiance_summary IS 'Complete summary of patient Jardiance prescriptions and adherence metrics';

-- ============================================
-- 9. Grant Permissions (commented out for Render compatibility)
-- ============================================
-- Note: On Render, the connection user has full access to tables it creates.
-- GRANT SELECT, INSERT, UPDATE, DELETE ON jardiance_prescriptions TO healthcare_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON jardiance_refills TO healthcare_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON jardiance_adherence TO healthcare_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON adherence_barriers TO healthcare_user;
-- GRANT SELECT ON patient_jardiance_summary TO healthcare_user;

-- ============================================
-- 10. Initialize Comorbidity Flags for Existing Patients
-- ============================================

-- Update comorbidity flags for all existing patients
UPDATE patients p
SET
    has_diabetes = EXISTS (
        SELECT 1 FROM conditions c
        WHERE c.patient_id = p.id
          AND c.clinical_status = 'active'
          AND (c.condition_code LIKE 'E11%' OR c.condition_code LIKE 'E10%')
    ),
    has_hypertension = EXISTS (
        SELECT 1 FROM conditions c
        WHERE c.patient_id = p.id
          AND c.clinical_status = 'active'
          AND c.condition_code = 'I10'
    ),
    has_heart_failure = EXISTS (
        SELECT 1 FROM conditions c
        WHERE c.patient_id = p.id
          AND c.clinical_status = 'active'
          AND c.condition_code LIKE 'I50%'
    ),
    has_cad = EXISTS (
        SELECT 1 FROM conditions c
        WHERE c.patient_id = p.id
          AND c.clinical_status = 'active'
          AND c.condition_code LIKE 'I25%'
    );

-- ============================================
-- Migration Complete
-- ============================================

SELECT 'Migration 008: Jardiance Adherence Tracking installed successfully' AS status;
SELECT 'Tables created: jardiance_prescriptions, jardiance_refills, jardiance_adherence, adherence_barriers' AS info;
SELECT 'Comorbidity flags added to patients table' AS info;
SELECT 'Helper functions and views created' AS info;
