-- ====================================================================
-- MASTER INITIALIZATION SCRIPT
-- Complete Progression Tracking System Setup
-- ====================================================================
-- This script performs the complete setup of the CKD progression
-- tracking system:
-- 1. Creates progression tracking tables
-- 2. Generates 24 months of longitudinal data for all patients
-- 3. Detects and records state transitions
-- 4. Shows summary statistics
--
-- Run this script after your database is initialized with patients.
-- ====================================================================

\echo ''
\echo '===================================================================='
\echo '    CKD PROGRESSION TRACKING SYSTEM - INITIALIZATION'
\echo '===================================================================='
\echo ''
\echo 'This will set up the complete progression tracking system with:'
\echo '  - KDIGO health state history tracking'
\echo '  - State transition detection'
\echo '  - Automated monitoring alerts'
\echo '  - Action recommendations'
\echo ''
\echo 'Starting initialization...'
\echo ''

-- ====================================================================
-- STEP 1: Create Progression Tracking Tables
-- ====================================================================

\echo '======================================================================'
\echo 'STEP 1: Creating progression tracking database tables...'
\echo '======================================================================'
\echo ''

\i infrastructure/postgres/migrations/005_add_kdigo_progression_tracking.sql

\echo ''
\echo 'Tables created successfully!'
\echo ''

-- ====================================================================
-- STEP 2: Generate 24 Months of Longitudinal Data
-- ====================================================================

\echo '======================================================================'
\echo 'STEP 2: Generating 24 months of longitudinal data...'
\echo '======================================================================'
\echo ''
\echo 'This will create realistic progression patterns for all patients.'
\echo 'Please wait, this may take a few minutes...'
\echo ''

-- Generate baseline (Cycle 0)
INSERT INTO health_state_history (
    patient_id,
    measured_at,
    cycle_number,
    egfr_value,
    uacr_value,
    gfr_category,
    albuminuria_category,
    health_state,
    risk_level,
    risk_color,
    ckd_stage,
    ckd_stage_name,
    requires_nephrology_referral,
    requires_dialysis_planning,
    recommend_ras_inhibitor,
    recommend_sglt2i,
    target_bp,
    monitoring_frequency
)
SELECT
    p.id AS patient_id,
    NOW() - INTERVAL '24 months' AS measured_at,
    0 AS cycle_number,

    -- Get most recent eGFR or generate
    COALESCE(
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'eGFR'
         ORDER BY observation_date DESC LIMIT 1),
        45.0 + (random() * 40)
    ) AS egfr_value,

    -- Get most recent uACR or generate
    COALESCE(
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'uACR'
         ORDER BY observation_date DESC LIMIT 1),
        CASE
            WHEN random() < 0.4 THEN 10.0 + (random() * 20)
            WHEN random() < 0.8 THEN 40.0 + (random() * 200)
            ELSE 350.0 + (random() * 400)
        END
    ) AS uacr_value,

    -- Classifications (simplified - will be refined by monitoring service)
    CASE
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 90 THEN 'G1'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 60 THEN 'G2'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 45 THEN 'G3a'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 30 THEN 'G3b'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 15 THEN 'G4'
        ELSE 'G5'
    END AS gfr_category,

    CASE
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) < 30 THEN 'A1'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) <= 300 THEN 'A2'
        ELSE 'A3'
    END AS albuminuria_category,

    CONCAT(
        CASE
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 90 THEN 'G1'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 60 THEN 'G2'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 45 THEN 'G3a'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 30 THEN 'G3b'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 15 THEN 'G4'
            ELSE 'G5'
        END,
        '-',
        CASE
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) < 30 THEN 'A1'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) <= 300 THEN 'A2'
            ELSE 'A3'
        END
    ) AS health_state,

    'moderate' AS risk_level,
    'yellow' AS risk_color,
    3 AS ckd_stage,
    'CKD Stage 3' AS ckd_stage_name,
    false, false, false, false,
    '<140/90 mmHg' AS target_bp,
    'Every 6-12 months' AS monitoring_frequency

FROM patients p
WHERE p.id IN (SELECT id FROM patients LIMIT 230);

\echo 'Baseline measurements created.'
\echo ''

-- Generate 24 months of progression data
DO $$
DECLARE
    v_patient RECORD;
    v_cycle INTEGER;
    v_baseline_egfr DECIMAL;
    v_baseline_uacr DECIMAL;
    v_current_egfr DECIMAL;
    v_current_uacr DECIMAL;
    v_progression_type VARCHAR(20);
    v_decline_rate DECIMAL;
    v_uacr_change_rate DECIMAL;
    v_monthly_variation DECIMAL;
    v_gfr_cat VARCHAR(5);
    v_alb_cat VARCHAR(5);
    v_health_state VARCHAR(10);
    v_risk_level VARCHAR(20);
    v_risk_color VARCHAR(10);
    v_patient_count INTEGER := 0;
BEGIN
    FOR v_patient IN
        SELECT p.id FROM patients p LIMIT 230
    LOOP
        v_patient_count := v_patient_count + 1;

        SELECT egfr_value, uacr_value
        INTO v_baseline_egfr, v_baseline_uacr
        FROM health_state_history
        WHERE patient_id = v_patient.id AND cycle_number = 0;

        -- Assign progression pattern
        CASE
            WHEN random() < 0.30 THEN
                v_progression_type := 'progressive';
                v_decline_rate := -(3.0 + (random() * 3.0)) / 12.0;
                v_uacr_change_rate := (5.0 + (random() * 15.0)) / 12.0;
            WHEN random() < 0.80 THEN
                v_progression_type := 'stable';
                v_decline_rate := -(0.5 + (random() * 1.0)) / 12.0;
                v_uacr_change_rate := (random() * 3.0) / 12.0;
            WHEN random() < 0.95 THEN
                v_progression_type := 'improving';
                v_decline_rate := (0.5 + (random() * 1.5)) / 12.0;
                v_uacr_change_rate := -(5.0 + (random() * 10.0)) / 12.0;
            ELSE
                v_progression_type := 'rapid';
                v_decline_rate := -(8.0 + (random() * 4.0)) / 12.0;
                v_uacr_change_rate := (20.0 + (random() * 30.0)) / 12.0;
        END CASE;

        v_current_egfr := v_baseline_egfr;
        v_current_uacr := v_baseline_uacr;

        FOR v_cycle IN 1..24 LOOP
            v_monthly_variation := (random() * 2.0) - 1.0;
            v_current_egfr := GREATEST(5.0, v_current_egfr + v_decline_rate + v_monthly_variation);
            v_current_uacr := GREATEST(5.0, v_current_uacr + v_uacr_change_rate + (random() * 10.0 - 5.0));

            v_gfr_cat := CASE
                WHEN v_current_egfr >= 90 THEN 'G1'
                WHEN v_current_egfr >= 60 THEN 'G2'
                WHEN v_current_egfr >= 45 THEN 'G3a'
                WHEN v_current_egfr >= 30 THEN 'G3b'
                WHEN v_current_egfr >= 15 THEN 'G4'
                ELSE 'G5'
            END;

            v_alb_cat := CASE
                WHEN v_current_uacr < 30 THEN 'A1'
                WHEN v_current_uacr <= 300 THEN 'A2'
                ELSE 'A3'
            END;

            v_health_state := v_gfr_cat || '-' || v_alb_cat;

            v_risk_level := CASE
                WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A1' THEN 'low'
                WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A2' THEN 'moderate'
                WHEN v_gfr_cat = 'G3a' AND v_alb_cat = 'A1' THEN 'moderate'
                WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A3' THEN 'high'
                WHEN v_gfr_cat = 'G3a' AND v_alb_cat = 'A2' THEN 'high'
                WHEN v_gfr_cat = 'G3b' AND v_alb_cat = 'A1' THEN 'high'
                ELSE 'very_high'
            END;

            v_risk_color := CASE v_risk_level
                WHEN 'low' THEN 'green'
                WHEN 'moderate' THEN 'yellow'
                WHEN 'high' THEN 'orange'
                ELSE 'red'
            END;

            INSERT INTO health_state_history (
                patient_id, measured_at, cycle_number, egfr_value, uacr_value,
                gfr_category, albuminuria_category, health_state,
                risk_level, risk_color, ckd_stage, ckd_stage_name,
                requires_nephrology_referral, requires_dialysis_planning,
                recommend_ras_inhibitor, recommend_sglt2i,
                target_bp, monitoring_frequency
            ) VALUES (
                v_patient.id,
                NOW() - INTERVAL '24 months' + (v_cycle || ' months')::INTERVAL,
                v_cycle, v_current_egfr, v_current_uacr,
                v_gfr_cat, v_alb_cat, v_health_state,
                v_risk_level, v_risk_color,
                CASE
                    WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A1' THEN NULL
                    WHEN v_gfr_cat = 'G1' THEN 1
                    WHEN v_gfr_cat = 'G2' THEN 2
                    WHEN v_gfr_cat IN ('G3a', 'G3b') THEN 3
                    WHEN v_gfr_cat = 'G4' THEN 4
                    ELSE 5
                END,
                CASE
                    WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A1' THEN 'Not CKD'
                    WHEN v_gfr_cat = 'G1' THEN 'CKD Stage 1'
                    WHEN v_gfr_cat = 'G2' THEN 'CKD Stage 2'
                    WHEN v_gfr_cat = 'G3a' THEN 'CKD Stage 3a'
                    WHEN v_gfr_cat = 'G3b' THEN 'CKD Stage 3b'
                    WHEN v_gfr_cat = 'G4' THEN 'CKD Stage 4'
                    ELSE 'CKD Stage 5 (ESRD)'
                END,
                v_gfr_cat IN ('G3b', 'G4', 'G5') OR v_alb_cat = 'A3',
                v_gfr_cat IN ('G4', 'G5'),
                v_alb_cat IN ('A2', 'A3'),
                v_alb_cat IN ('A2', 'A3') AND v_current_egfr >= 20,
                CASE WHEN v_alb_cat = 'A1' THEN '<140/90 mmHg' ELSE '<130/80 mmHg' END,
                CASE v_risk_level
                    WHEN 'low' THEN 'Annually'
                    WHEN 'moderate' THEN 'Every 6-12 months'
                    WHEN 'high' THEN 'Every 3-6 months'
                    ELSE 'Every 1-3 months'
                END
            );
        END LOOP;

        IF v_patient_count % 50 = 0 THEN
            RAISE NOTICE 'Processed % patients...', v_patient_count;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '✓ Generated 24-month progression data for % patients!', v_patient_count;
END $$;

\echo ''
\echo 'Longitudinal data generated successfully!'
\echo ''

-- ====================================================================
-- STEP 3: Detect State Transitions
-- ====================================================================

\echo '======================================================================'
\echo 'STEP 3: Detecting state transitions...'
\echo '======================================================================'
\echo ''

\i scripts/detect_state_transitions.sql

\echo ''
\echo '======================================================================'
\echo 'INITIALIZATION COMPLETE!'
\echo '======================================================================'
\echo ''
\echo 'The progression tracking system is now fully operational.'
\echo ''
\echo 'To generate alerts and recommendations, use the API endpoint:'
\echo '  POST /api/progression/run-monitoring'
\echo ''
\echo 'Or run from psql:'
\echo '  \\i scripts/generate_alerts_and_recommendations.sql'
\echo ''
\echo 'Next steps:'
\echo '  1. Visit the frontend to view patient progression dashboards'
\echo '  2. Check active alerts: GET /api/progression/alerts'
\echo '  3. Review recommendations: GET /api/progression/recommendations'
\echo '  4. View progression summary: GET /api/progression/summary'
\echo ''
\echo '======================================================================'
