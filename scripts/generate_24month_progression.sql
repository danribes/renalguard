-- ====================================================================
-- Generate 24 Months of Longitudinal CKD Progression Data
-- ====================================================================
-- This script creates realistic progression data for all 230 patients
-- showing various progression patterns over 24 monthly cycles:
-- - Progressive decliners (30%): Steady worsening
-- - Stable patients (50%): Minimal change
-- - Improvers (15%): Treatment response
-- - Rapid progressors (5%): Fast decline requiring intervention
-- ====================================================================

\echo 'Starting 24-month longitudinal data generation...'
\echo ''

-- First, ensure we have the progression tracking tables
\i infrastructure/postgres/migrations/005_add_kdigo_progression_tracking.sql

\echo ''
\echo 'Generating baseline measurements (Cycle 0)...'

-- ====================================================================
-- STEP 1: Create baseline measurements (Cycle 0) from existing data
-- ====================================================================
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

    -- Get most recent eGFR
    COALESCE(
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'eGFR'
         ORDER BY observation_date DESC LIMIT 1),
        60.0 + (random() * 40)  -- Default if no eGFR
    ) AS egfr_value,

    -- Get most recent uACR or assign based on risk profile
    COALESCE(
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'uACR'
         ORDER BY observation_date DESC LIMIT 1),
        CASE
            WHEN random() < 0.5 THEN 15.0 + (random() * 15)    -- A1: <30
            WHEN random() < 0.85 THEN 50.0 + (random() * 200)  -- A2: 30-300
            ELSE 350.0 + (random() * 500)                       -- A3: >300
        END
    ) AS uacr_value,

    -- Classify GFR category (will be calculated based on eGFR)
    CASE
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 90 THEN 'G1'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 60 THEN 'G2'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 45 THEN 'G3a'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 30 THEN 'G3b'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 15 THEN 'G4'
        ELSE 'G5'
    END AS gfr_category,

    -- Classify albuminuria category
    CASE
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) < 30 THEN 'A1'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) <= 300 THEN 'A2'
        ELSE 'A3'
    END AS albuminuria_category,

    -- Combined health state
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

    -- Risk level (simplified - will be refined by application logic)
    'moderate' AS risk_level,
    'yellow' AS risk_color,
    3 AS ckd_stage,
    'CKD Stage 3' AS ckd_stage_name,
    false AS requires_nephrology_referral,
    false AS requires_dialysis_planning,
    false AS recommend_ras_inhibitor,
    false AS recommend_sglt2i,
    '<140/90 mmHg' AS target_bp,
    'Every 6-12 months' AS monitoring_frequency

FROM patients p
WHERE p.id IN (SELECT id FROM patients LIMIT 230);

\echo 'Baseline measurements created for all patients.'
\echo ''
\echo 'Generating monthly progression data (Cycles 1-24)...'
\echo 'This will take a few moments...'
\echo ''

-- ====================================================================
-- STEP 2: Generate 24 months of progression data
-- ====================================================================
-- For each patient, create monthly measurements with realistic progression

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
    v_total_patients INTEGER;
BEGIN
    -- Get total patient count
    SELECT COUNT(*) INTO v_total_patients FROM patients;

    -- Loop through each patient
    FOR v_patient IN
        SELECT p.id, p.medical_record_number
        FROM patients p
        WHERE p.id IN (SELECT id FROM patients LIMIT 230)
        ORDER BY p.medical_record_number
    LOOP
        v_patient_count := v_patient_count + 1;

        -- Get baseline values
        SELECT egfr_value, uacr_value
        INTO v_baseline_egfr, v_baseline_uacr
        FROM health_state_history
        WHERE patient_id = v_patient.id AND cycle_number = 0;

        -- Determine progression pattern for this patient
        -- 30% progressive decliners, 50% stable, 15% improvers, 5% rapid progressors
        CASE
            WHEN random() < 0.30 THEN
                -- Progressive decliner: -3 to -6 mL/min/year
                v_progression_type := 'progressive';
                v_decline_rate := -(3.0 + (random() * 3.0)) / 12.0; -- Monthly decline
                v_uacr_change_rate := (5.0 + (random() * 15.0)) / 12.0; -- Monthly increase

            WHEN random() < 0.80 THEN
                -- Stable: -0.5 to -1.5 mL/min/year
                v_progression_type := 'stable';
                v_decline_rate := -(0.5 + (random() * 1.0)) / 12.0;
                v_uacr_change_rate := (random() * 3.0) / 12.0;

            WHEN random() < 0.95 THEN
                -- Improver (treatment response): slight improvement
                v_progression_type := 'improving';
                v_decline_rate := (0.5 + (random() * 1.5)) / 12.0; -- Positive = improving
                v_uacr_change_rate := -(5.0 + (random() * 10.0)) / 12.0; -- Decreasing

            ELSE
                -- Rapid progressor: -8 to -12 mL/min/year
                v_progression_type := 'rapid';
                v_decline_rate := -(8.0 + (random() * 4.0)) / 12.0;
                v_uacr_change_rate := (20.0 + (random() * 30.0)) / 12.0;
        END CASE;

        -- Initialize current values
        v_current_egfr := v_baseline_egfr;
        v_current_uacr := v_baseline_uacr;

        -- Generate data for cycles 1-24
        FOR v_cycle IN 1..24 LOOP
            -- Add monthly decline + random variation (-1 to +1)
            v_monthly_variation := (random() * 2.0) - 1.0;
            v_current_egfr := GREATEST(5.0, v_current_egfr + v_decline_rate + v_monthly_variation);

            -- Update uACR with variation
            v_current_uacr := GREATEST(5.0, v_current_uacr + v_uacr_change_rate + (random() * 10.0 - 5.0));

            -- Classify GFR category
            v_gfr_cat := CASE
                WHEN v_current_egfr >= 90 THEN 'G1'
                WHEN v_current_egfr >= 60 THEN 'G2'
                WHEN v_current_egfr >= 45 THEN 'G3a'
                WHEN v_current_egfr >= 30 THEN 'G3b'
                WHEN v_current_egfr >= 15 THEN 'G4'
                ELSE 'G5'
            END;

            -- Classify albuminuria category
            v_alb_cat := CASE
                WHEN v_current_uacr < 30 THEN 'A1'
                WHEN v_current_uacr <= 300 THEN 'A2'
                ELSE 'A3'
            END;

            -- Combined health state
            v_health_state := v_gfr_cat || '-' || v_alb_cat;

            -- Determine risk level (KDIGO matrix)
            v_risk_level := CASE
                WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A1' THEN 'low'
                WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A2' THEN 'moderate'
                WHEN v_gfr_cat = 'G3a' AND v_alb_cat = 'A1' THEN 'moderate'
                WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A3' THEN 'high'
                WHEN v_gfr_cat = 'G3a' AND v_alb_cat = 'A2' THEN 'high'
                WHEN v_gfr_cat = 'G3b' AND v_alb_cat = 'A1' THEN 'high'
                ELSE 'very_high'
            END;

            -- Risk color
            v_risk_color := CASE v_risk_level
                WHEN 'low' THEN 'green'
                WHEN 'moderate' THEN 'yellow'
                WHEN 'high' THEN 'orange'
                ELSE 'red'
            END;

            -- Insert monthly record
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
            ) VALUES (
                v_patient.id,
                NOW() - INTERVAL '24 months' + (v_cycle || ' months')::INTERVAL,
                v_cycle,
                v_current_egfr,
                v_current_uacr,
                v_gfr_cat,
                v_alb_cat,
                v_health_state,
                v_risk_level,
                v_risk_color,
                CASE
                    WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A1' THEN NULL
                    WHEN v_gfr_cat = 'G1' OR (v_gfr_cat = 'G2' AND v_alb_cat != 'A1') THEN 1
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
        END LOOP; -- End cycles loop

        -- Progress indicator every 10 patients
        IF v_patient_count % 10 = 0 THEN
            RAISE NOTICE 'Processed % of % patients...', v_patient_count, v_total_patients;
        END IF;

    END LOOP; -- End patients loop

    RAISE NOTICE '';
    RAISE NOTICE '24-month progression data generated for % patients!', v_patient_count;

END $$;

\echo ''
\echo '======================================================================'
\echo 'Data generation complete!'
\echo '======================================================================'
\echo ''

-- Show summary statistics
SELECT
    'Baseline (Month 0)' AS timepoint,
    COUNT(*) AS total_measurements,
    ROUND(AVG(egfr_value), 2) AS avg_egfr,
    ROUND(AVG(uacr_value), 2) AS avg_uacr,
    COUNT(CASE WHEN risk_level = 'low' THEN 1 END) AS low_risk,
    COUNT(CASE WHEN risk_level = 'moderate' THEN 1 END) AS moderate_risk,
    COUNT(CASE WHEN risk_level = 'high' THEN 1 END) AS high_risk,
    COUNT(CASE WHEN risk_level = 'very_high' THEN 1 END) AS very_high_risk
FROM health_state_history
WHERE cycle_number = 0

UNION ALL

SELECT
    'Month 12' AS timepoint,
    COUNT(*) AS total_measurements,
    ROUND(AVG(egfr_value), 2) AS avg_egfr,
    ROUND(AVG(uacr_value), 2) AS avg_uacr,
    COUNT(CASE WHEN risk_level = 'low' THEN 1 END) AS low_risk,
    COUNT(CASE WHEN risk_level = 'moderate' THEN 1 END) AS moderate_risk,
    COUNT(CASE WHEN risk_level = 'high' THEN 1 END) AS high_risk,
    COUNT(CASE WHEN risk_level = 'very_high' THEN 1 END) AS very_high_risk
FROM health_state_history
WHERE cycle_number = 12

UNION ALL

SELECT
    'Month 24 (Current)' AS timepoint,
    COUNT(*) AS total_measurements,
    ROUND(AVG(egfr_value), 2) AS avg_egfr,
    ROUND(AVG(uacr_value), 2) AS avg_uacr,
    COUNT(CASE WHEN risk_level = 'low' THEN 1 END) AS low_risk,
    COUNT(CASE WHEN risk_level = 'moderate' THEN 1 END) AS moderate_risk,
    COUNT(CASE WHEN risk_level = 'high' THEN 1 END) AS high_risk,
    COUNT(CASE WHEN risk_level = 'very_high' THEN 1 END) AS very_high_risk
FROM health_state_history
WHERE cycle_number = 24;

\echo ''
\echo 'Total records created:'
SELECT COUNT(*) AS total_records FROM health_state_history;

\echo ''
\echo 'Next steps:'
\echo '1. Run the state transition detection algorithm'
\echo '2. Generate alerts for patients who crossed thresholds'
\echo '3. Create action recommendations'
\echo ''
