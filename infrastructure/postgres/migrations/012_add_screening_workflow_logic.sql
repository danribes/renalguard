-- ============================================
-- Migration 012: Conditional Screening Workflow (Tiered Risk Assessment)
-- Implements the 3-tier funnel system for risk stratification
-- Handles cases where primary labs (eGFR, uACR, HbA1c) are missing
-- ============================================

-- ============================================
-- 1. View: Patient Lab Completeness Status
-- Identifies which required labs are missing
-- ============================================

CREATE OR REPLACE VIEW v_patient_lab_completeness AS
SELECT
    p.id as patient_id,
    p.medical_record_number,
    p.first_name,
    p.last_name,

    -- Check for recent labs (within last 12 months)
    MAX(CASE WHEN o.observation_type = 'eGFR' AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
        THEN o.value_numeric ELSE NULL END) as recent_egfr,
    MAX(CASE WHEN o.observation_type = 'eGFR' AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
        THEN o.observation_date ELSE NULL END) as egfr_date,

    MAX(CASE WHEN o.observation_type = 'uACR' AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
        THEN o.value_numeric ELSE NULL END) as recent_uacr,
    MAX(CASE WHEN o.observation_type = 'uACR' AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
        THEN o.observation_date ELSE NULL END) as uacr_date,

    MAX(CASE WHEN o.observation_type = 'HbA1c' AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
        THEN o.value_numeric ELSE NULL END) as recent_hba1c,
    MAX(CASE WHEN o.observation_type = 'HbA1c' AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
        THEN o.observation_date ELSE NULL END) as hba1c_date,

    MAX(CASE WHEN o.observation_type = 'blood_pressure_systolic' AND o.observation_date >= CURRENT_DATE - INTERVAL '6 months'
        THEN o.value_numeric ELSE NULL END) as recent_bp_systolic,
    MAX(CASE WHEN o.observation_type = 'blood_pressure_diastolic' AND o.observation_date >= CURRENT_DATE - INTERVAL '6 months'
        THEN o.value_numeric ELSE NULL END) as recent_bp_diastolic,

    -- Completeness flags
    (MAX(CASE WHEN o.observation_type = 'eGFR' AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
        THEN 1 ELSE 0 END) = 1) as has_recent_egfr,
    (MAX(CASE WHEN o.observation_type = 'uACR' AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
        THEN 1 ELSE 0 END) = 1) as has_recent_uacr,
    (MAX(CASE WHEN o.observation_type = 'HbA1c' AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
        THEN 1 ELSE 0 END) = 1) as has_recent_hba1c,

    -- Patient risk factors
    p.has_diabetes,
    p.has_hypertension,
    p.has_heart_failure,
    p.has_cad,
    p.has_obesity,
    p.cvd_history,
    p.family_history_esrd,
    EXTRACT(YEAR FROM AGE(p.date_of_birth)) as age

FROM patients p
LEFT JOIN observations o ON p.id = o.patient_id
GROUP BY p.id, p.medical_record_number, p.first_name, p.last_name,
         p.has_diabetes, p.has_hypertension, p.has_heart_failure, p.has_cad,
         p.has_obesity, p.cvd_history, p.family_history_esrd, p.date_of_birth;

COMMENT ON VIEW v_patient_lab_completeness IS 'Shows which patients have recent labs and identifies missing data for screening';

-- ============================================
-- 2. View: Tier 1 - Population Triage (At-Risk Identification)
-- Identifies patients who should proceed to Tier 2 based on risk factors
-- ============================================

CREATE OR REPLACE VIEW v_tier1_at_risk_population AS
SELECT
    patient_id,
    medical_record_number,
    first_name,
    last_name,
    age,

    -- Risk factors present
    has_diabetes,
    has_hypertension,
    has_heart_failure,
    has_cad,
    has_obesity,
    cvd_history,
    family_history_esrd,

    -- Reason for being at-risk
    CASE
        WHEN has_diabetes THEN 'Diabetes'
        WHEN has_hypertension THEN 'Hypertension'
        WHEN age > 60 THEN 'Age > 60'
        WHEN has_heart_failure THEN 'Heart Failure'
        WHEN has_cad THEN 'Coronary Artery Disease'
        WHEN has_obesity THEN 'Obesity'
        WHEN cvd_history THEN 'Cardiovascular Disease History'
        WHEN family_history_esrd THEN 'Family History of ESRD'
        ELSE 'Unknown'
    END as primary_risk_factor,

    -- Count of risk factors
    (
        CASE WHEN has_diabetes THEN 1 ELSE 0 END +
        CASE WHEN has_hypertension THEN 1 ELSE 0 END +
        CASE WHEN age > 60 THEN 1 ELSE 0 END +
        CASE WHEN has_heart_failure THEN 1 ELSE 0 END +
        CASE WHEN has_cad THEN 1 ELSE 0 END +
        CASE WHEN has_obesity THEN 1 ELSE 0 END +
        CASE WHEN cvd_history THEN 1 ELSE 0 END +
        CASE WHEN family_history_esrd THEN 1 ELSE 0 END
    ) as risk_factor_count,

    -- Tier 1 decision
    'TIER_2' as next_tier

FROM v_patient_lab_completeness
WHERE
    has_diabetes = true
    OR has_hypertension = true
    OR age > 60
    OR has_heart_failure = true
    OR has_cad = true
    OR has_obesity = true
    OR cvd_history = true
    OR family_history_esrd = true;

COMMENT ON VIEW v_tier1_at_risk_population IS 'Tier 1: Identifies patients with ANY risk factor who need further screening';

-- ============================================
-- 3. View: Tier 2 - Lab Data Analysis
-- Determines screening status based on lab availability
-- ============================================

CREATE OR REPLACE VIEW v_tier2_lab_analysis AS
SELECT
    t1.patient_id,
    t1.medical_record_number,
    t1.first_name,
    t1.last_name,
    t1.age,
    t1.risk_factor_count,
    t1.primary_risk_factor,

    -- Lab completeness
    lc.has_recent_egfr,
    lc.has_recent_uacr,
    lc.has_recent_hba1c,
    lc.recent_egfr,
    lc.recent_uacr,
    lc.recent_hba1c,
    lc.egfr_date,
    lc.uacr_date,
    lc.hba1c_date,

    -- Determine which tier 3 branch
    CASE
        -- Branch A: Missing required labs
        WHEN NOT lc.has_recent_egfr OR NOT lc.has_recent_uacr THEN 'TIER_3_BRANCH_A'
        -- Branch A: Diabetes patient missing HbA1c
        WHEN t1.has_diabetes AND NOT lc.has_recent_hba1c THEN 'TIER_3_BRANCH_A'
        -- Branch B: All required labs present
        WHEN lc.has_recent_egfr AND lc.has_recent_uacr THEN 'TIER_3_BRANCH_B'
        ELSE 'TIER_3_BRANCH_A'
    END as tier3_branch,

    -- Missing data summary
    ARRAY_REMOVE(ARRAY[
        CASE WHEN NOT lc.has_recent_egfr THEN 'eGFR' END,
        CASE WHEN NOT lc.has_recent_uacr THEN 'uACR' END,
        CASE WHEN t1.has_diabetes AND NOT lc.has_recent_hba1c THEN 'HbA1c' END
    ], NULL) as missing_labs,

    -- Days since last screening
    CASE
        WHEN lc.egfr_date IS NOT NULL THEN CURRENT_DATE - lc.egfr_date::date
        ELSE NULL
    END as days_since_last_egfr

FROM v_tier1_at_risk_population t1
LEFT JOIN v_patient_lab_completeness lc ON t1.patient_id = lc.patient_id;

COMMENT ON VIEW v_tier2_lab_analysis IS 'Tier 2: Analyzes lab completeness and routes to Tier 3 branches';

-- ============================================
-- 4. View: Tier 3 - Final Risk Classification
-- Combines all tiers into final risk assessment
-- ============================================

CREATE OR REPLACE VIEW v_tier3_risk_classification AS
SELECT
    patient_id,
    medical_record_number,
    first_name,
    last_name,
    age,
    risk_factor_count,
    primary_risk_factor,
    tier3_branch,
    missing_labs,
    has_recent_egfr,
    recent_egfr,
    recent_uacr,
    recent_hba1c,

    -- Final risk level
    CASE
        -- Branch A: Missing data = HIGH RISK (Screening Needed)
        WHEN tier3_branch = 'TIER_3_BRANCH_A' THEN 'HIGH'

        -- Branch B: Analyze available labs
        WHEN tier3_branch = 'TIER_3_BRANCH_B' AND (recent_egfr < 60 OR recent_uacr > 30) THEN 'HIGH'
        WHEN tier3_branch = 'TIER_3_BRANCH_B' AND (recent_egfr >= 60 AND recent_uacr <= 30) THEN 'MEDIUM'

        ELSE 'MEDIUM'
    END as risk_level,

    -- Risk status
    CASE
        WHEN tier3_branch = 'TIER_3_BRANCH_A' THEN 'Screening Needed'
        WHEN tier3_branch = 'TIER_3_BRANCH_B' AND (recent_egfr < 60 OR recent_uacr > 30) THEN 'Abnormal Results Detected'
        WHEN tier3_branch = 'TIER_3_BRANCH_B' THEN 'Risk Factors Present, Labs Normal'
        ELSE 'Unknown'
    END as risk_status,

    -- AI Flag message
    CASE
        WHEN tier3_branch = 'TIER_3_BRANCH_A' THEN '⚠️ Risk assessment incomplete - missing required labs'
        WHEN tier3_branch = 'TIER_3_BRANCH_B' AND (recent_egfr < 60 OR recent_uacr > 30) THEN '🔴 Abnormal results detected - requires follow-up'
        WHEN tier3_branch = 'TIER_3_BRANCH_B' THEN '🟡 Risk factors present but labs are normal - continue monitoring'
        ELSE '⚠️ Unable to assess risk'
    END as ai_flag,

    -- AI Recommendation
    CASE
        WHEN tier3_branch = 'TIER_3_BRANCH_A' THEN
            'Order baseline ' || array_to_string(missing_labs, ', ') || ' tests. ' ||
            CASE WHEN risk_factor_count >= 3 THEN 'Multiple risk factors present - prioritize screening. ' ELSE '' END ||
            'Recommend fasting morning draw for optimal accuracy.'

        WHEN tier3_branch = 'TIER_3_BRANCH_B' AND recent_egfr < 60 THEN
            'eGFR < 60 detected (current: ' || recent_egfr || '). ' ||
            'Activate 3-month confirmation tracker. ' ||
            CASE
                WHEN recent_egfr < 30 THEN 'Consider nephrology referral (eGFR < 30). '
                WHEN recent_egfr < 45 THEN 'Monitor closely for progression. '
                ELSE ''
            END ||
            'Review medication list for nephrotoxins.'

        WHEN tier3_branch = 'TIER_3_BRANCH_B' AND recent_uacr > 30 THEN
            'Albuminuria detected (uACR: ' || recent_uacr || '). ' ||
            CASE
                WHEN recent_uacr > 300 THEN 'Severely increased albuminuria (A3). Start RAS inhibitor if not contraindicated. '
                WHEN recent_uacr > 30 THEN 'Moderately increased albuminuria (A2). Consider RAS inhibitor. '
                ELSE ''
            END ||
            'Repeat test in 3 months for confirmation.'

        WHEN tier3_branch = 'TIER_3_BRANCH_B' THEN
            'Re-screen in 12 months. Continue monitoring blood pressure and blood glucose control. ' ||
            'Encourage lifestyle modifications (diet, exercise, smoking cessation).'

        ELSE 'Unable to provide recommendation - insufficient data'
    END as ai_recommendation,

    -- Next action date
    CASE
        WHEN tier3_branch = 'TIER_3_BRANCH_A' THEN CURRENT_DATE + INTERVAL '2 weeks' -- Order labs soon
        WHEN tier3_branch = 'TIER_3_BRANCH_B' AND (recent_egfr < 60 OR recent_uacr > 30)
            THEN CURRENT_DATE + INTERVAL '3 months' -- Confirm abnormal results
        ELSE CURRENT_DATE + INTERVAL '12 months' -- Annual screening
    END as next_action_date,

    days_since_last_egfr

FROM v_tier2_lab_analysis;

COMMENT ON VIEW v_tier3_risk_classification IS 'Tier 3: Final risk classification with AI flags and recommendations';

-- ============================================
-- 5. Function: Get Patient Screening Status
-- Convenience function for quick patient lookup
-- ============================================

CREATE OR REPLACE FUNCTION get_patient_screening_status(p_patient_id UUID)
RETURNS TABLE (
    risk_level VARCHAR,
    risk_status VARCHAR,
    ai_flag TEXT,
    ai_recommendation TEXT,
    missing_labs TEXT[],
    next_action_date DATE,
    risk_factor_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t3.risk_level,
        t3.risk_status,
        t3.ai_flag,
        t3.ai_recommendation,
        t3.missing_labs,
        t3.next_action_date::date,
        t3.risk_factor_count
    FROM v_tier3_risk_classification t3
    WHERE t3.patient_id = p_patient_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_patient_screening_status IS 'Returns screening status and recommendations for a specific patient';

-- ============================================
-- 6. View: Patients Requiring Immediate Action
-- Dashboard view for doctors
-- ============================================

CREATE OR REPLACE VIEW v_patients_requiring_action AS
SELECT
    patient_id,
    medical_record_number,
    first_name,
    last_name,
    age,
    risk_level,
    risk_status,
    ai_flag,
    ai_recommendation,
    missing_labs,
    next_action_date,
    risk_factor_count,

    -- Priority score (higher = more urgent)
    (
        CASE WHEN risk_level = 'HIGH' THEN 100 ELSE 0 END +
        CASE WHEN next_action_date < CURRENT_DATE + INTERVAL '1 month' THEN 50 ELSE 0 END +
        (risk_factor_count * 10) +
        CASE WHEN array_length(missing_labs, 1) >= 2 THEN 20 ELSE 0 END
    ) as priority_score,

    -- Action category
    CASE
        WHEN array_length(missing_labs, 1) > 0 THEN 'ORDER_LABS'
        WHEN risk_status = 'Abnormal Results Detected' THEN 'CONFIRM_RESULTS'
        ELSE 'ROUTINE_MONITORING'
    END as action_category

FROM v_tier3_risk_classification
WHERE risk_level IN ('HIGH', 'MEDIUM')
ORDER BY priority_score DESC, next_action_date ASC;

COMMENT ON VIEW v_patients_requiring_action IS 'Patients requiring screening or follow-up, sorted by priority';

-- ============================================
-- 7. Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_observations_type_date
    ON observations(observation_type, observation_date DESC);

CREATE INDEX IF NOT EXISTS idx_observations_patient_type_date
    ON observations(patient_id, observation_type, observation_date DESC);
