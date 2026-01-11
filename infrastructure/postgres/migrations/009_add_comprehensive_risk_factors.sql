-- ============================================
-- Migration 009: Comprehensive CKD Risk Factors Tracking
-- Implements complete risk stratification based on clinical evidence
-- ============================================

-- ============================================
-- 1. Add Missing Demographic Fields to Patients Table
-- ============================================

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS ethnicity VARCHAR(50),
ADD COLUMN IF NOT EXISTS race VARCHAR(50);

-- Create index for ethnicity-based queries
CREATE INDEX IF NOT EXISTS idx_patients_ethnicity ON patients(ethnicity);
CREATE INDEX IF NOT EXISTS idx_patients_race ON patients(race);

COMMENT ON COLUMN patients.ethnicity IS 'Patient ethnicity: African American, Hispanic/Latino, Asian, Caucasian, Native American, Other';
COMMENT ON COLUMN patients.race IS 'Patient race classification for risk adjustment';

-- ============================================
-- 2. Create Comprehensive Risk Factors Table
-- ============================================

CREATE TABLE IF NOT EXISTS patient_risk_factors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,

    -- ========================================
    -- LABORATORY MARKERS
    -- ========================================
    current_egfr DECIMAL(5, 2),
    current_uacr DECIMAL(10, 2),

    -- eGFR Trajectory (calculated from historical data)
    egfr_decline_rate DECIMAL(5, 2), -- mL/min/1.73m²/year
    egfr_trend VARCHAR(20), -- 'stable', 'slow_decline', 'rapid_decline', 'improving'
    last_egfr_assessment_date DATE,

    -- Other labs
    uric_acid DECIMAL(5, 2), -- mg/dL
    hba1c DECIMAL(4, 2), -- % (for diabetics)

    -- ========================================
    -- COMORBIDITIES (Detailed)
    -- ========================================

    -- Diabetes
    has_diabetes BOOLEAN DEFAULT false,
    diabetes_type VARCHAR(20), -- 'Type 1', 'Type 2', 'Gestational', null
    diabetes_duration_years INTEGER,
    diabetes_controlled BOOLEAN,

    -- Hypertension
    has_hypertension BOOLEAN DEFAULT false,
    hypertension_controlled BOOLEAN,
    average_bp_systolic INTEGER,
    average_bp_diastolic INTEGER,

    -- Cardiovascular Disease (Detailed)
    has_cvd BOOLEAN DEFAULT false,
    has_heart_failure BOOLEAN DEFAULT false,
    has_coronary_artery_disease BOOLEAN DEFAULT false,
    has_stroke_history BOOLEAN DEFAULT false,
    has_peripheral_vascular_disease BOOLEAN DEFAULT false,

    -- Obesity/Metabolic
    has_obesity BOOLEAN DEFAULT false,
    current_bmi DECIMAL(5, 2),
    has_metabolic_syndrome BOOLEAN DEFAULT false,

    -- Kidney-Related Conditions
    has_autoimmune_disease BOOLEAN DEFAULT false,
    autoimmune_disease_type VARCHAR(100), -- 'Lupus (SLE)', 'Rheumatoid Arthritis', 'Vasculitis', etc.
    has_recurrent_uti BOOLEAN DEFAULT false,
    has_kidney_stones BOOLEAN DEFAULT false,
    kidney_stones_recurrent BOOLEAN DEFAULT false,
    has_gout BOOLEAN DEFAULT false,
    has_polycystic_kidney_disease BOOLEAN DEFAULT false,

    -- ========================================
    -- HISTORY
    -- ========================================

    -- Acute Kidney Injury History
    history_of_aki BOOLEAN DEFAULT false,
    aki_episodes_count INTEGER DEFAULT 0,
    last_aki_date DATE,
    aki_severity VARCHAR(20), -- 'Stage 1', 'Stage 2', 'Stage 3', 'Required Dialysis'

    -- Family History
    family_history_ckd BOOLEAN DEFAULT false,
    family_history_esrd BOOLEAN DEFAULT false,
    family_history_diabetes BOOLEAN DEFAULT false,
    family_history_hypertension BOOLEAN DEFAULT false,
    family_history_pkd BOOLEAN DEFAULT false,

    -- ========================================
    -- LIFESTYLE FACTORS
    -- ========================================

    -- Smoking
    smoking_status VARCHAR(20), -- 'Never', 'Former', 'Current'
    pack_years DECIMAL(5, 2),
    quit_date DATE,

    -- Physical Activity
    physical_activity_level VARCHAR(20), -- 'Sedentary', 'Light', 'Moderate', 'Active'
    exercise_minutes_per_week INTEGER,

    -- Diet
    dietary_sodium_intake VARCHAR(20), -- 'Low', 'Moderate', 'High'
    dietary_protein_intake VARCHAR(20), -- 'Low', 'Moderate', 'High'
    fruit_vegetable_servings_daily INTEGER,

    -- ========================================
    -- MEDICATIONS & EXPOSURES
    -- ========================================

    -- Nephrotoxic Medications
    chronic_nsaid_use BOOLEAN DEFAULT false,
    nsaid_duration_months INTEGER,
    ppi_use BOOLEAN DEFAULT false,
    ppi_duration_months INTEGER,
    on_calcineurin_inhibitors BOOLEAN DEFAULT false,
    on_lithium BOOLEAN DEFAULT false,

    -- Protective Medications
    on_ras_inhibitor BOOLEAN DEFAULT false,
    on_sglt2i BOOLEAN DEFAULT false,
    on_statin BOOLEAN DEFAULT false,

    -- ========================================
    -- CALCULATED RISK METRICS
    -- ========================================

    -- Overall Risk Score (0-100)
    risk_score DECIMAL(5, 2),
    risk_tier VARCHAR(20), -- 'low', 'moderate', 'high', 'very_high'

    -- Component Scores
    laboratory_risk_score DECIMAL(5, 2),
    comorbidity_risk_score DECIMAL(5, 2),
    demographic_risk_score DECIMAL(5, 2),
    lifestyle_risk_score DECIMAL(5, 2),
    medication_risk_score DECIMAL(5, 2),

    -- Progression Risk
    progression_risk VARCHAR(20), -- 'low', 'moderate', 'high'
    estimated_years_to_esrd DECIMAL(5, 2), -- null if low risk

    -- ========================================
    -- METADATA
    -- ========================================
    last_assessment_date DATE,
    next_assessment_due DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comprehensive indexes
CREATE INDEX IF NOT EXISTS idx_risk_factors_patient_id ON patient_risk_factors(patient_id);
CREATE INDEX IF NOT EXISTS idx_risk_factors_risk_tier ON patient_risk_factors(risk_tier);
CREATE INDEX IF NOT EXISTS idx_risk_factors_risk_score ON patient_risk_factors(risk_score);
CREATE INDEX IF NOT EXISTS idx_risk_factors_diabetes ON patient_risk_factors(has_diabetes);
CREATE INDEX IF NOT EXISTS idx_risk_factors_aki_history ON patient_risk_factors(history_of_aki);
CREATE INDEX IF NOT EXISTS idx_risk_factors_egfr_decline ON patient_risk_factors(egfr_decline_rate);

COMMENT ON TABLE patient_risk_factors IS 'Comprehensive CKD risk factors for evidence-based risk stratification';
COMMENT ON COLUMN patient_risk_factors.egfr_decline_rate IS 'Rate of eGFR decline in mL/min/1.73m²/year. >5 is rapid decline';
COMMENT ON COLUMN patient_risk_factors.risk_score IS 'Overall risk score 0-100 based on weighted factors';
COMMENT ON COLUMN patient_risk_factors.risk_tier IS 'Risk stratification: low, moderate, high, very_high';

-- ============================================
-- 3. Create eGFR Trajectory Calculation Function
-- ============================================

CREATE OR REPLACE FUNCTION calculate_egfr_trajectory(p_patient_id UUID, p_months INTEGER DEFAULT 12)
RETURNS TABLE (
    decline_rate DECIMAL(5, 2),
    trend VARCHAR(20),
    data_points INTEGER
) AS $$
DECLARE
    v_decline_rate DECIMAL(5, 2);
    v_trend VARCHAR(20);
    v_count INTEGER;
BEGIN
    -- Calculate linear regression slope for eGFR over time
    -- Simplified: average change per year
    WITH egfr_data AS (
        SELECT
            value_numeric as egfr,
            observation_date,
            EXTRACT(EPOCH FROM (observation_date - LAG(observation_date) OVER (ORDER BY observation_date))) / (365.25 * 24 * 60 * 60) as years_diff,
            value_numeric - LAG(value_numeric) OVER (ORDER BY observation_date) as egfr_change
        FROM observations
        WHERE patient_id = p_patient_id
          AND observation_type = 'eGFR'
          AND observation_date >= CURRENT_DATE - (p_months || ' months')::INTERVAL
        ORDER BY observation_date
    ),
    annual_change AS (
        SELECT
            AVG(CASE WHEN years_diff > 0 THEN egfr_change / years_diff ELSE NULL END) as avg_annual_change,
            COUNT(*) as point_count
        FROM egfr_data
        WHERE years_diff IS NOT NULL
    )
    SELECT
        ROUND(COALESCE(avg_annual_change, 0), 2) as rate,
        point_count
    INTO v_decline_rate, v_count
    FROM annual_change;

    -- Determine trend
    IF v_decline_rate IS NULL OR v_count < 2 THEN
        v_trend := 'insufficient_data';
    ELSIF v_decline_rate > 0 THEN
        v_trend := 'improving';
    ELSIF v_decline_rate > -3 THEN
        v_trend := 'stable';
    ELSIF v_decline_rate > -5 THEN
        v_trend := 'slow_decline';
    ELSE
        v_trend := 'rapid_decline';
    END IF;

    RETURN QUERY SELECT v_decline_rate, v_trend, v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_egfr_trajectory IS 'Calculates eGFR decline rate and trend over specified months';

-- ============================================
-- 4. Create Risk Score Calculation Function
-- ============================================

CREATE OR REPLACE FUNCTION calculate_ckd_risk_score(p_patient_id UUID)
RETURNS DECIMAL(5, 2) AS $$
DECLARE
    v_score DECIMAL(5, 2) := 0;
    v_patient RECORD;
    v_risk_factors RECORD;
    v_latest_egfr DECIMAL(5, 2);
    v_latest_uacr DECIMAL(10, 2);
    v_age INTEGER;
BEGIN
    -- Get patient data
    SELECT * INTO v_patient
    FROM patients
    WHERE id = p_patient_id;

    -- Get risk factors
    SELECT * INTO v_risk_factors
    FROM patient_risk_factors
    WHERE patient_id = p_patient_id;

    -- Get latest lab values
    SELECT value_numeric INTO v_latest_egfr
    FROM observations
    WHERE patient_id = p_patient_id AND observation_type = 'eGFR'
    ORDER BY observation_date DESC
    LIMIT 1;

    SELECT value_numeric INTO v_latest_uacr
    FROM observations
    WHERE patient_id = p_patient_id AND observation_type = 'uACR'
    ORDER BY observation_date DESC
    LIMIT 1;

    -- Calculate age
    v_age := EXTRACT(YEAR FROM AGE(v_patient.date_of_birth));

    -- ========================================
    -- LABORATORY RISK (40% of total)
    -- ========================================

    -- uACR (20 points)
    IF v_latest_uacr >= 300 THEN
        v_score := v_score + 20;
    ELSIF v_latest_uacr >= 30 THEN
        v_score := v_score + 12;
    ELSIF v_latest_uacr >= 10 THEN
        v_score := v_score + 6;
    END IF;

    -- eGFR (15 points)
    IF v_latest_egfr < 30 THEN
        v_score := v_score + 15;
    ELSIF v_latest_egfr < 45 THEN
        v_score := v_score + 12;
    ELSIF v_latest_egfr < 60 THEN
        v_score := v_score + 8;
    ELSIF v_latest_egfr < 90 THEN
        v_score := v_score + 4;
    END IF;

    -- eGFR Decline Rate (5 points)
    IF v_risk_factors.egfr_decline_rate < -5 THEN
        v_score := v_score + 5;
    ELSIF v_risk_factors.egfr_decline_rate < -3 THEN
        v_score := v_score + 3;
    END IF;

    -- ========================================
    -- COMORBIDITY RISK (35% of total)
    -- ========================================

    -- Diabetes (15 points)
    IF v_risk_factors.has_diabetes THEN
        v_score := v_score + 10;
        IF NOT v_risk_factors.diabetes_controlled THEN
            v_score := v_score + 5;
        END IF;
    END IF;

    -- Hypertension (8 points)
    IF v_risk_factors.has_hypertension THEN
        v_score := v_score + 5;
        IF NOT v_risk_factors.hypertension_controlled THEN
            v_score := v_score + 3;
        END IF;
    END IF;

    -- CVD (7 points)
    IF v_risk_factors.has_cvd THEN
        v_score := v_score + 7;
    END IF;

    -- AKI History (5 points)
    IF v_risk_factors.history_of_aki THEN
        v_score := v_score + 5;
    END IF;

    -- ========================================
    -- DEMOGRAPHIC RISK (15% of total)
    -- ========================================

    -- Age (10 points)
    IF v_age >= 75 THEN
        v_score := v_score + 10;
    ELSIF v_age >= 65 THEN
        v_score := v_score + 6;
    ELSIF v_age >= 60 THEN
        v_score := v_score + 3;
    END IF;

    -- Ethnicity (5 points)
    IF v_patient.ethnicity IN ('African American', 'Black') THEN
        v_score := v_score + 5;
    ELSIF v_patient.ethnicity IN ('Hispanic', 'Latino', 'Native American') THEN
        v_score := v_score + 3;
    END IF;

    -- ========================================
    -- LIFESTYLE RISK (5% of total)
    -- ========================================

    -- Smoking (3 points)
    IF v_risk_factors.smoking_status = 'Current' THEN
        v_score := v_score + 3;
    ELSIF v_risk_factors.smoking_status = 'Former' AND v_risk_factors.pack_years > 20 THEN
        v_score := v_score + 1;
    END IF;

    -- Obesity (2 points)
    IF v_risk_factors.has_obesity THEN
        v_score := v_score + 2;
    END IF;

    -- ========================================
    -- MEDICATION RISK (5% of total)
    -- ========================================

    -- Nephrotoxic medications (3 points)
    IF v_risk_factors.chronic_nsaid_use THEN
        v_score := v_score + 2;
    END IF;
    IF v_risk_factors.ppi_use THEN
        v_score := v_score + 1;
    END IF;

    -- Protective medications (reduce score up to -2 points)
    IF v_risk_factors.on_ras_inhibitor THEN
        v_score := v_score - 1;
    END IF;
    IF v_risk_factors.on_sglt2i THEN
        v_score := v_score - 1;
    END IF;

    -- Cap score between 0 and 100
    v_score := GREATEST(0, LEAST(100, v_score));

    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_ckd_risk_score IS 'Calculates comprehensive CKD risk score (0-100) based on weighted evidence-based factors';

-- ============================================
-- 5. Create Risk Tier Classification Function
-- ============================================

CREATE OR REPLACE FUNCTION get_risk_tier(p_risk_score DECIMAL)
RETURNS VARCHAR(20) AS $$
BEGIN
    IF p_risk_score >= 75 THEN
        RETURN 'very_high';
    ELSIF p_risk_score >= 50 THEN
        RETURN 'high';
    ELSIF p_risk_score >= 25 THEN
        RETURN 'moderate';
    ELSE
        RETURN 'low';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_risk_tier IS 'Converts risk score to tier: low (<25), moderate (25-49), high (50-74), very_high (≥75)';

-- ============================================
-- 6. Create Comprehensive Risk Assessment View
-- ============================================

CREATE OR REPLACE VIEW patient_risk_assessment AS
SELECT
    p.id as patient_id,
    p.medical_record_number as mrn,
    p.first_name || ' ' || p.last_name as patient_name,
    EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as age,
    p.gender,
    p.ethnicity,

    -- Latest labs
    rf.current_egfr,
    rf.current_uacr,
    rf.egfr_decline_rate,
    rf.egfr_trend,

    -- Major comorbidities
    rf.has_diabetes,
    rf.diabetes_controlled,
    rf.has_hypertension,
    rf.hypertension_controlled,
    rf.has_cvd,
    rf.history_of_aki,

    -- Risk metrics
    rf.risk_score,
    rf.risk_tier,
    rf.progression_risk,

    -- Recommendations
    CASE
        WHEN rf.risk_tier = 'very_high' THEN 'Monthly monitoring with nephrologist'
        WHEN rf.risk_tier = 'high' THEN 'Quarterly monitoring, consider nephrology referral'
        WHEN rf.risk_tier = 'moderate' THEN 'Semi-annual monitoring'
        ELSE 'Annual monitoring'
    END as monitoring_recommendation,

    rf.last_assessment_date,
    rf.next_assessment_due

FROM patients p
LEFT JOIN patient_risk_factors rf ON p.id = rf.patient_id;

COMMENT ON VIEW patient_risk_assessment IS 'Comprehensive view of patient risk factors and recommendations';

-- ============================================
-- 7. Create Trigger to Update Risk Factors
-- ============================================

CREATE OR REPLACE FUNCTION update_risk_factors_from_observations()
RETURNS TRIGGER AS $$
BEGIN
    -- Update current_egfr and current_uacr when new observations are added
    IF NEW.observation_type = 'eGFR' THEN
        UPDATE patient_risk_factors
        SET
            current_egfr = NEW.value_numeric,
            last_assessment_date = NEW.observation_date,
            updated_at = CURRENT_TIMESTAMP
        WHERE patient_id = NEW.patient_id;
    ELSIF NEW.observation_type = 'uACR' THEN
        UPDATE patient_risk_factors
        SET
            current_uacr = NEW.value_numeric,
            last_assessment_date = NEW.observation_date,
            updated_at = CURRENT_TIMESTAMP
        WHERE patient_id = NEW.patient_id;
    ELSIF NEW.observation_type = 'HbA1c' THEN
        UPDATE patient_risk_factors
        SET
            hba1c = NEW.value_numeric,
            updated_at = CURRENT_TIMESTAMP
        WHERE patient_id = NEW.patient_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_risk_factors_from_obs ON observations;
CREATE TRIGGER trg_update_risk_factors_from_obs
    AFTER INSERT OR UPDATE ON observations
    FOR EACH ROW
    EXECUTE FUNCTION update_risk_factors_from_observations();

-- ============================================
-- 8. Grant Permissions (commented out for Render compatibility)
-- ============================================
-- Note: On Render, the connection user has full access to tables it creates.
-- GRANT SELECT, INSERT, UPDATE, DELETE ON patient_risk_factors TO healthcare_user;
-- GRANT SELECT ON patient_risk_assessment TO healthcare_user;

-- ============================================
-- Migration Complete
-- ============================================

SELECT 'Migration 009: Comprehensive CKD Risk Factors installed successfully' AS status;
SELECT 'Risk stratification system ready for evidence-based assessment' AS info;
