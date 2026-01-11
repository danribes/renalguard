-- ============================================
-- Migration 030: Geriatric Cardiorenal Unified Assessment (GCUA)
-- Implements comprehensive cardiorenal risk stratification for adults 60+
-- ============================================

-- ============================================
-- 1. Create GCUA Assessment Table
-- ============================================

CREATE TABLE IF NOT EXISTS patient_gcua_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- ========================================
    -- ELIGIBILITY
    -- ========================================
    is_eligible BOOLEAN NOT NULL DEFAULT false,
    eligibility_reason TEXT,

    -- ========================================
    -- MODULE 1: NELSON/CKD-PC INCIDENT CKD (2019)
    -- 5-year probability of developing CKD (eGFR < 60)
    -- ========================================
    module1_five_year_risk DECIMAL(5, 2),  -- Percentage 0-100
    module1_risk_category VARCHAR(20),  -- 'low', 'moderate', 'high', 'very_high'
    module1_components JSONB,  -- Array of component strings
    module1_interpretation TEXT,
    module1_c_statistic DECIMAL(4, 3),  -- 0.845 non-diabetic, 0.801 diabetic

    -- ========================================
    -- MODULE 2: AHA PREVENT CVD RISK (2024)
    -- 10-year cardiovascular disease event risk
    -- ========================================
    module2_ten_year_risk DECIMAL(5, 2),  -- Percentage 0-100
    module2_risk_category VARCHAR(20),  -- 'low', 'borderline', 'intermediate', 'high'
    module2_heart_age INTEGER,
    module2_components JSONB,
    module2_interpretation TEXT,
    module2_c_statistic DECIMAL(4, 3),  -- ~0.80

    -- ========================================
    -- MODULE 3: BANSAL GERIATRIC MORTALITY (2015)
    -- 5-year all-cause mortality (competing risk)
    -- ========================================
    module3_five_year_mortality DECIMAL(5, 2),  -- Percentage 0-100
    module3_risk_category VARCHAR(20),  -- 'low', 'moderate', 'high', 'very_high'
    module3_points INTEGER,
    module3_components JSONB,
    module3_interpretation TEXT,

    -- ========================================
    -- PHENOTYPE ASSIGNMENT
    -- ========================================
    phenotype_type VARCHAR(5),  -- 'I', 'II', 'III', 'IV'
    phenotype_name VARCHAR(50),  -- 'Accelerated Ager', 'Silent Renal', 'Vascular Dominant', 'The Senescent'
    phenotype_tag VARCHAR(30),  -- 'High Priority', 'Kidney Specific', 'Heart Specific', 'De-escalate'
    phenotype_color VARCHAR(10),  -- 'red', 'orange', 'yellow', 'gray'
    phenotype_description TEXT,
    phenotype_clinical_strategy JSONB,  -- Array of strategy strings
    phenotype_treatment_recommendations JSONB,  -- Object with sglt2i, ras, statin, bp, monitoring

    -- ========================================
    -- BENEFIT ANALYSIS
    -- ========================================
    benefit_ratio DECIMAL(5, 2),  -- Cardiorenal Risk / Non-Cardiorenal Death Risk
    benefit_ratio_interpretation TEXT,

    -- ========================================
    -- DATA QUALITY
    -- ========================================
    data_completeness INTEGER,  -- Percentage 0-100
    missing_data JSONB,  -- Array of missing data fields
    confidence_level VARCHAR(10),  -- 'high', 'moderate', 'low'

    -- ========================================
    -- KDIGO ALIGNMENT
    -- ========================================
    kdigo_screening_recommendation TEXT,
    cystatin_c_recommended BOOLEAN DEFAULT false,

    -- ========================================
    -- INPUT DATA SNAPSHOT (for audit trail)
    -- ========================================
    input_age INTEGER,
    input_sex VARCHAR(10),
    input_egfr DECIMAL(5, 2),
    input_uacr DECIMAL(10, 2),
    input_systolic_bp INTEGER,
    input_bmi DECIMAL(5, 2),
    input_has_diabetes BOOLEAN,
    input_has_hypertension BOOLEAN,
    input_has_cvd BOOLEAN,
    input_has_heart_failure BOOLEAN,
    input_has_atrial_fibrillation BOOLEAN,
    input_smoking_status VARCHAR(20),
    input_frailty_score INTEGER,
    input_nt_probnp DECIMAL(10, 2),
    input_hba1c DECIMAL(4, 2),

    -- ========================================
    -- METADATA
    -- ========================================
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assessed_by VARCHAR(100),  -- System or user who triggered assessment
    version VARCHAR(10) DEFAULT '1.0',  -- GCUA version
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_gcua_patient_id ON patient_gcua_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_gcua_phenotype_type ON patient_gcua_assessments(phenotype_type);
CREATE INDEX IF NOT EXISTS idx_gcua_phenotype_name ON patient_gcua_assessments(phenotype_name);
CREATE INDEX IF NOT EXISTS idx_gcua_module1_risk ON patient_gcua_assessments(module1_risk_category);
CREATE INDEX IF NOT EXISTS idx_gcua_module2_risk ON patient_gcua_assessments(module2_risk_category);
CREATE INDEX IF NOT EXISTS idx_gcua_module3_risk ON patient_gcua_assessments(module3_risk_category);
CREATE INDEX IF NOT EXISTS idx_gcua_is_eligible ON patient_gcua_assessments(is_eligible);
CREATE INDEX IF NOT EXISTS idx_gcua_assessed_at ON patient_gcua_assessments(assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gcua_confidence ON patient_gcua_assessments(confidence_level);

-- Unique constraint: one active assessment per patient
-- (we keep history but mark only latest as active via assessed_at)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcua_patient_latest
    ON patient_gcua_assessments(patient_id, assessed_at DESC);

COMMENT ON TABLE patient_gcua_assessments IS 'Geriatric Cardiorenal Unified Assessment (GCUA) results for adults 60+ with eGFR > 60';
COMMENT ON COLUMN patient_gcua_assessments.module1_five_year_risk IS '5-year probability of incident CKD (eGFR < 60) per Nelson/CKD-PC 2019';
COMMENT ON COLUMN patient_gcua_assessments.module2_ten_year_risk IS '10-year CVD event risk per AHA PREVENT 2024';
COMMENT ON COLUMN patient_gcua_assessments.module3_five_year_mortality IS '5-year all-cause mortality per Bansal 2015 (competing risk)';
COMMENT ON COLUMN patient_gcua_assessments.phenotype_type IS 'I=Accelerated Ager, II=Silent Renal, III=Vascular Dominant, IV=Senescent';
COMMENT ON COLUMN patient_gcua_assessments.benefit_ratio IS 'Cardiorenal event risk / Non-cardiorenal death risk. Higher = more likely to benefit from intervention';

-- ============================================
-- 2. Add GCUA-specific Fields to Patient Risk Factors
-- ============================================

ALTER TABLE patient_risk_factors
ADD COLUMN IF NOT EXISTS gcua_phenotype VARCHAR(5),
ADD COLUMN IF NOT EXISTS gcua_phenotype_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS gcua_benefit_ratio DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS gcua_last_assessment_date DATE,
ADD COLUMN IF NOT EXISTS gcua_next_assessment_due DATE,
ADD COLUMN IF NOT EXISTS gcua_confidence_level VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_risk_factors_gcua_phenotype ON patient_risk_factors(gcua_phenotype);

COMMENT ON COLUMN patient_risk_factors.gcua_phenotype IS 'GCUA Phenotype: I (Accelerated Ager), II (Silent Renal), III (Vascular Dominant), IV (Senescent)';
COMMENT ON COLUMN patient_risk_factors.gcua_benefit_ratio IS 'GCUA Benefit Ratio: Higher values indicate greater benefit from intervention';

-- ============================================
-- 3. Create GCUA Population Statistics View
-- ============================================

CREATE OR REPLACE VIEW gcua_population_statistics AS
SELECT
    phenotype_type,
    phenotype_name,
    phenotype_tag,
    COUNT(*) as patient_count,
    ROUND(AVG(module1_five_year_risk), 2) as avg_renal_risk,
    ROUND(AVG(module2_ten_year_risk), 2) as avg_cvd_risk,
    ROUND(AVG(module3_five_year_mortality), 2) as avg_mortality_risk,
    ROUND(AVG(benefit_ratio), 2) as avg_benefit_ratio,
    COUNT(CASE WHEN confidence_level = 'high' THEN 1 END) as high_confidence_count,
    COUNT(CASE WHEN confidence_level = 'moderate' THEN 1 END) as moderate_confidence_count,
    COUNT(CASE WHEN confidence_level = 'low' THEN 1 END) as low_confidence_count
FROM patient_gcua_assessments
WHERE is_eligible = true
  AND assessed_at = (
      SELECT MAX(assessed_at)
      FROM patient_gcua_assessments pga2
      WHERE pga2.patient_id = patient_gcua_assessments.patient_id
  )
GROUP BY phenotype_type, phenotype_name, phenotype_tag
ORDER BY
    CASE phenotype_type
        WHEN 'I' THEN 1
        WHEN 'II' THEN 2
        WHEN 'III' THEN 3
        WHEN 'IV' THEN 4
    END;

COMMENT ON VIEW gcua_population_statistics IS 'Population-level statistics for GCUA phenotypes (Silent Hunter dashboard)';

-- ============================================
-- 4. Create GCUA High-Risk Patient View
-- ============================================

CREATE OR REPLACE VIEW gcua_high_risk_patients AS
SELECT
    p.id as patient_id,
    p.medical_record_number as mrn,
    p.first_name || ' ' || p.last_name as patient_name,
    EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as age,
    p.gender,
    ga.phenotype_type,
    ga.phenotype_name,
    ga.phenotype_tag,
    ga.phenotype_color,
    ga.module1_five_year_risk as renal_risk,
    ga.module1_risk_category as renal_risk_category,
    ga.module2_ten_year_risk as cvd_risk,
    ga.module2_risk_category as cvd_risk_category,
    ga.module3_five_year_mortality as mortality_risk,
    ga.module3_risk_category as mortality_risk_category,
    ga.benefit_ratio,
    ga.benefit_ratio_interpretation,
    ga.phenotype_treatment_recommendations as treatment_recommendations,
    ga.kdigo_screening_recommendation,
    ga.cystatin_c_recommended,
    ga.confidence_level,
    ga.missing_data,
    ga.assessed_at
FROM patients p
JOIN patient_gcua_assessments ga ON p.id = ga.patient_id
WHERE ga.is_eligible = true
  AND (ga.phenotype_type = 'I' OR ga.phenotype_type = 'II')  -- Accelerated Ager or Silent Renal
  AND ga.assessed_at = (
      SELECT MAX(assessed_at)
      FROM patient_gcua_assessments pga2
      WHERE pga2.patient_id = p.id
  )
ORDER BY
    CASE ga.phenotype_type WHEN 'I' THEN 1 WHEN 'II' THEN 2 END,
    ga.module1_five_year_risk DESC;

COMMENT ON VIEW gcua_high_risk_patients IS 'GCUA high-priority patients: Accelerated Agers and Silent Renal phenotypes';

-- ============================================
-- 5. Create GCUA Missing uACR View (Silent Hunter)
-- ============================================

CREATE OR REPLACE VIEW gcua_missing_uacr_patients AS
SELECT
    p.id as patient_id,
    p.medical_record_number as mrn,
    p.first_name || ' ' || p.last_name as patient_name,
    EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as age,
    p.gender,
    rf.current_egfr,
    rf.has_diabetes,
    rf.has_hypertension,
    rf.has_cvd,
    CASE
        WHEN rf.has_diabetes AND rf.has_hypertension THEN 'Very High'
        WHEN rf.has_diabetes OR rf.has_hypertension THEN 'High'
        WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= 75 THEN 'Elevated'
        ELSE 'Moderate'
    END as estimated_risk_without_uacr,
    'Order uACR to unlock full GCUA risk profile' as action_required
FROM patients p
LEFT JOIN patient_risk_factors rf ON p.id = rf.patient_id
WHERE EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= 60
  AND (rf.current_egfr IS NULL OR rf.current_egfr > 60)
  AND rf.current_uacr IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM observations o
      WHERE o.patient_id = p.id
        AND o.observation_type = 'uACR'
        AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
  )
ORDER BY
    CASE
        WHEN rf.has_diabetes AND rf.has_hypertension THEN 1
        WHEN rf.has_diabetes OR rf.has_hypertension THEN 2
        WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= 75 THEN 3
        ELSE 4
    END,
    EXTRACT(YEAR FROM AGE(p.date_of_birth)) DESC;

COMMENT ON VIEW gcua_missing_uacr_patients IS 'Patients eligible for GCUA but missing uACR - Silent Hunter data audit';

-- ============================================
-- 6. Create Function to Get Latest GCUA Assessment
-- ============================================

CREATE OR REPLACE FUNCTION get_latest_gcua_assessment(p_patient_id UUID)
RETURNS TABLE (
    patient_id UUID,
    is_eligible BOOLEAN,
    phenotype_type VARCHAR(5),
    phenotype_name VARCHAR(50),
    phenotype_tag VARCHAR(30),
    phenotype_color VARCHAR(10),
    renal_risk DECIMAL(5, 2),
    cvd_risk DECIMAL(5, 2),
    mortality_risk DECIMAL(5, 2),
    benefit_ratio DECIMAL(5, 2),
    confidence_level VARCHAR(10),
    treatment_recommendations JSONB,
    assessed_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ga.patient_id,
        ga.is_eligible,
        ga.phenotype_type,
        ga.phenotype_name,
        ga.phenotype_tag,
        ga.phenotype_color,
        ga.module1_five_year_risk,
        ga.module2_ten_year_risk,
        ga.module3_five_year_mortality,
        ga.benefit_ratio,
        ga.confidence_level,
        ga.phenotype_treatment_recommendations,
        ga.assessed_at
    FROM patient_gcua_assessments ga
    WHERE ga.patient_id = p_patient_id
    ORDER BY ga.assessed_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_latest_gcua_assessment IS 'Retrieves the most recent GCUA assessment for a patient';

-- ============================================
-- 7. Create Trigger to Update Risk Factors on GCUA Assessment
-- ============================================

CREATE OR REPLACE FUNCTION update_risk_factors_from_gcua()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE patient_risk_factors
    SET
        gcua_phenotype = NEW.phenotype_type,
        gcua_phenotype_name = NEW.phenotype_name,
        gcua_benefit_ratio = NEW.benefit_ratio,
        gcua_last_assessment_date = NEW.assessed_at::DATE,
        gcua_next_assessment_due = CASE
            WHEN NEW.phenotype_type = 'I' THEN NEW.assessed_at::DATE + INTERVAL '3 months'
            WHEN NEW.phenotype_type = 'II' THEN NEW.assessed_at::DATE + INTERVAL '6 months'
            WHEN NEW.phenotype_type = 'III' THEN NEW.assessed_at::DATE + INTERVAL '12 months'
            WHEN NEW.phenotype_type = 'IV' THEN NULL  -- No scheduled follow-up
            ELSE NEW.assessed_at::DATE + INTERVAL '12 months'
        END,
        gcua_confidence_level = NEW.confidence_level,
        updated_at = CURRENT_TIMESTAMP
    WHERE patient_id = NEW.patient_id;

    -- Insert if not exists
    IF NOT FOUND THEN
        INSERT INTO patient_risk_factors (
            patient_id,
            gcua_phenotype,
            gcua_phenotype_name,
            gcua_benefit_ratio,
            gcua_last_assessment_date,
            gcua_next_assessment_due,
            gcua_confidence_level
        ) VALUES (
            NEW.patient_id,
            NEW.phenotype_type,
            NEW.phenotype_name,
            NEW.benefit_ratio,
            NEW.assessed_at::DATE,
            CASE
                WHEN NEW.phenotype_type = 'I' THEN NEW.assessed_at::DATE + INTERVAL '3 months'
                WHEN NEW.phenotype_type = 'II' THEN NEW.assessed_at::DATE + INTERVAL '6 months'
                WHEN NEW.phenotype_type = 'III' THEN NEW.assessed_at::DATE + INTERVAL '12 months'
                ELSE NULL
            END,
            NEW.confidence_level
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_risk_factors_from_gcua ON patient_gcua_assessments;
CREATE TRIGGER trg_update_risk_factors_from_gcua
    AFTER INSERT ON patient_gcua_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_risk_factors_from_gcua();

-- ============================================
-- 8. Grant Permissions (commented out for Render compatibility)
-- ============================================
-- Note: On Render, the connection user has full access to tables it creates.
-- GRANT SELECT, INSERT, UPDATE, DELETE ON patient_gcua_assessments TO healthcare_user;
-- GRANT SELECT ON gcua_population_statistics TO healthcare_user;
-- GRANT SELECT ON gcua_high_risk_patients TO healthcare_user;
-- GRANT SELECT ON gcua_missing_uacr_patients TO healthcare_user;

-- ============================================
-- Migration Complete
-- ============================================

SELECT 'Migration 030: GCUA Risk Assessment installed successfully' AS status;
SELECT 'Geriatric Cardiorenal Unified Assessment ready for clinical use' AS info;
SELECT 'Phenotypes: I (Accelerated Ager), II (Silent Renal), III (Vascular Dominant), IV (Senescent)' AS phenotypes;
