-- ===============================================================
-- POPULATE COMPREHENSIVE VARIABLES
-- Based on: CKD_Variables_Comprehensive_List.md
-- ===============================================================
-- This script populates the newly added variables with realistic
-- data for all existing patients
-- ===============================================================

DO $$
DECLARE
    v_patient RECORD;
    v_counter INTEGER := 0;
    v_has_diabetes BOOLEAN;
    v_has_hypertension BOOLEAN;
    v_egfr DECIMAL;
    v_hemoglobin DECIMAL;
    v_age INTEGER;
BEGIN
    RAISE NOTICE 'Starting population of comprehensive variables...';

    FOR v_patient IN
        SELECT id, has_diabetes, has_hypertension, date_of_birth
        FROM patients
    LOOP
        v_counter := v_counter + 1;

        v_has_diabetes := v_patient.has_diabetes;
        v_has_hypertension := v_patient.has_hypertension;
        v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_patient.date_of_birth));

        -- Get most recent eGFR
        SELECT value_numeric INTO v_egfr
        FROM observations
        WHERE patient_id = v_patient.id
          AND observation_type = 'eGFR'
        ORDER BY observation_date DESC
        LIMIT 1;

        -- Get most recent Hemoglobin
        SELECT value_numeric INTO v_hemoglobin
        FROM observations
        WHERE patient_id = v_patient.id
          AND observation_type = 'Hemoglobin'
        ORDER BY observation_date DESC
        LIMIT 1;

        -- ============================================
        -- Update patient-level variables
        -- ============================================

        UPDATE patients SET
            -- Clinical symptoms
            appetite = CASE
                WHEN v_egfr < 30 OR v_hemoglobin < 10 THEN 'Poor'
                WHEN v_egfr < 45 AND random() < 0.3 THEN 'Poor'
                ELSE 'Good'
            END,
            pedal_edema = CASE
                WHEN v_egfr < 30 THEN random() < 0.6
                WHEN v_egfr < 45 THEN random() < 0.3
                ELSE random() < 0.1
            END,
            anemia = v_hemoglobin < 12.0,

            -- Medication history
            chronic_nsaid_use_months = CASE
                WHEN random() < 0.15 THEN floor(random() * 24 + 6)::INTEGER
                ELSE 0
            END,
            chronic_ppi_use_months = CASE
                WHEN v_age > 60 AND random() < 0.25 THEN floor(random() * 36 + 12)::INTEGER
                ELSE 0
            END,

            -- Disease duration
            diabetes_duration_years = CASE
                WHEN v_has_diabetes THEN floor(random() * 15 + 1)::INTEGER
                ELSE 0
            END,
            previous_aki_episodes = CASE
                WHEN v_age > 65 AND random() < 0.15 THEN floor(random() * 3 + 1)::INTEGER
                WHEN random() < 0.05 THEN 1
                ELSE 0
            END,

            -- Diabetes subtypes (95% Type 2, 5% Type 1)
            has_type1_diabetes = v_has_diabetes AND random() < 0.05,
            has_type2_diabetes = v_has_diabetes AND random() >= 0.05,

            -- Hypertension subtypes
            has_essential_hypertension = v_has_hypertension AND random() < 0.90,
            has_renovascular_hypertension = v_has_hypertension AND random() < 0.10,
            has_hypertensive_ckd = v_has_hypertension AND v_egfr < 60,

            -- Cardiovascular conditions (age and risk factor dependent)
            has_mi = v_age > 60 AND (v_has_diabetes OR v_has_hypertension) AND random() < 0.08,
            has_atrial_fibrillation = v_age > 70 AND random() < 0.12,
            has_stroke = v_age > 65 AND (v_has_hypertension OR v_has_diabetes) AND random() < 0.06,
            has_peripheral_vascular_disease = v_age > 60 AND v_has_diabetes AND random() < 0.10,

            -- Metabolic conditions
            has_hyperlipidemia = v_age > 50 AND random() < 0.55,
            has_gout = v_age > 50 AND random() < 0.12,

            -- Kidney-related conditions
            has_uti = random() < 0.08,
            has_kidney_stones = random() < 0.10,
            has_polycystic_kidney_disease = random() < 0.02  -- Rare

        WHERE id = v_patient.id;

        -- ============================================
        -- Insert urine analysis (1-2 tests per patient)
        -- ============================================

        FOR i IN 1..(1 + floor(random() * 2)::INTEGER) LOOP
            INSERT INTO urine_analysis (
                patient_id,
                test_date,
                blood_urea,
                specific_gravity,
                albumin_level,
                sugar_level,
                rbc_status,
                pus_cells,
                pus_cell_clumps,
                bacteria
            ) VALUES (
                v_patient.id,
                CURRENT_DATE - (i * 180 + floor(random() * 30)::INTEGER),
                -- BUN (Blood Urea Nitrogen): Higher if CKD
                CASE
                    WHEN v_egfr < 30 THEN 50 + (random() * 70)
                    WHEN v_egfr < 60 THEN 25 + (random() * 35)
                    ELSE 8 + (random() * 18)
                END,
                -- Specific gravity: Lower in CKD (dilute urine)
                CASE
                    WHEN v_egfr < 30 THEN 1.005 + (random() * 0.010)
                    ELSE 1.010 + (random() * 0.020)
                END,
                -- Albumin level (0-5): Higher if proteinuria
                CASE
                    WHEN v_egfr < 60 AND random() < 0.6 THEN floor(random() * 3 + 2)::INTEGER
                    WHEN random() < 0.2 THEN 1
                    ELSE 0
                END,
                -- Sugar level (0-5): Higher if diabetic
                CASE
                    WHEN v_has_diabetes AND random() < 0.4 THEN floor(random() * 3 + 1)::INTEGER
                    ELSE 0
                END,
                -- RBC in urine: Abnormal if hematuria
                CASE
                    WHEN v_egfr < 45 AND random() < 0.25 THEN 'Abnormal'
                    WHEN random() < 0.10 THEN 'Abnormal'
                    ELSE 'Normal'
                END,
                -- Pus cells: Abnormal if UTI
                CASE
                    WHEN random() < 0.12 THEN 'Abnormal'
                    ELSE 'Normal'
                END,
                -- Pus cell clumps: Present if severe UTI
                CASE
                    WHEN random() < 0.05 THEN 'Present'
                    ELSE 'Not Present'
                END,
                -- Bacteria: Present if UTI
                CASE
                    WHEN random() < 0.12 THEN 'Present'
                    ELSE 'Not Present'
                END
            );
        END LOOP;

        -- ============================================
        -- Insert hematology data (1-2 tests per patient)
        -- ============================================

        FOR i IN 1..(1 + floor(random() * 2)::INTEGER) LOOP
            v_hemoglobin := CASE
                WHEN v_egfr < 30 THEN 9.0 + (random() * 3.0)  -- Anemia in advanced CKD
                WHEN v_egfr < 60 THEN 11.0 + (random() * 3.0)
                ELSE 12.0 + (random() * 4.0)
            END;

            INSERT INTO hematology (
                patient_id,
                test_date,
                hemoglobin,
                packed_cell_volume,
                rbc_count,
                wbc_count,
                platelet_count
            ) VALUES (
                v_patient.id,
                CURRENT_DATE - (i * 180 + floor(random() * 30)::INTEGER),
                v_hemoglobin,
                -- PCV: Approximately 3x hemoglobin
                v_hemoglobin * 3.0 + (random() * 2.0 - 1.0),
                -- RBC count: Lower if anemic
                CASE
                    WHEN v_hemoglobin < 11 THEN 3.5 + (random() * 1.0)
                    ELSE 4.2 + (random() * 1.3)
                END,
                -- WBC count: Normal range with some variation
                4500 + floor(random() * 6500)::INTEGER,
                -- Platelet count: Normal range
                150000 + floor(random() * 250000)::INTEGER
            );
        END LOOP;

        -- ============================================
        -- Add additional observations (if not already present)
        -- ============================================

        -- Blood Urea (BUN)
        IF NOT EXISTS (
            SELECT 1 FROM observations
            WHERE patient_id = v_patient.id AND observation_type = 'BUN'
        ) THEN
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date)
            VALUES (
                v_patient.id,
                'BUN',
                CASE
                    WHEN v_egfr < 30 THEN 50 + (random() * 70)
                    WHEN v_egfr < 60 THEN 25 + (random() * 35)
                    ELSE 8 + (random() * 18)
                END,
                'mg/dL',
                CURRENT_DATE - floor(random() * 90)::INTEGER
            );
        END IF;

        -- Blood Glucose Random (if diabetic and not already present)
        IF v_has_diabetes AND NOT EXISTS (
            SELECT 1 FROM observations
            WHERE patient_id = v_patient.id AND observation_type = 'Blood Glucose Random'
        ) THEN
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date)
            VALUES (
                v_patient.id,
                'Blood Glucose Random',
                120 + (random() * 180),  -- 120-300 mg/dL range
                'mg/dL',
                CURRENT_DATE - floor(random() * 90)::INTEGER
            );
        END IF;

        -- Sodium
        IF NOT EXISTS (
            SELECT 1 FROM observations
            WHERE patient_id = v_patient.id AND observation_type = 'Sodium'
        ) THEN
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date)
            VALUES (
                v_patient.id,
                'Sodium',
                136 + (random() * 9),  -- 136-145 mEq/L
                'mEq/L',
                CURRENT_DATE - floor(random() * 90)::INTEGER
            );
        END IF;

        -- Bicarbonate (HCO3) - Lower in advanced CKD (metabolic acidosis)
        IF NOT EXISTS (
            SELECT 1 FROM observations
            WHERE patient_id = v_patient.id AND observation_type = 'Bicarbonate'
        ) THEN
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date)
            VALUES (
                v_patient.id,
                'Bicarbonate',
                CASE
                    WHEN v_egfr < 30 THEN 16 + (random() * 6)  -- Metabolic acidosis
                    WHEN v_egfr < 60 THEN 20 + (random() * 6)
                    ELSE 22 + (random() * 6)  -- Normal: 22-28 mEq/L
                END,
                'mEq/L',
                CURRENT_DATE - floor(random() * 90)::INTEGER
            );
        END IF;

        IF v_counter % 50 = 0 THEN
            RAISE NOTICE 'Processed % patients...', v_counter;
        END IF;

    END LOOP;

    RAISE NOTICE 'Successfully populated comprehensive variables for % patients!', v_counter;

END $$;

-- ===============================================================
-- VERIFICATION QUERIES
-- ===============================================================

-- Count patients with each condition
SELECT
    'Anemia' as condition,
    COUNT(*) FILTER (WHERE anemia = TRUE) as patient_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE anemia = TRUE) / COUNT(*), 1) as percentage
FROM patients
UNION ALL
SELECT
    'Type 2 Diabetes',
    COUNT(*) FILTER (WHERE has_type2_diabetes = TRUE),
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_type2_diabetes = TRUE) / COUNT(*), 1)
FROM patients
UNION ALL
SELECT
    'Hypertensive CKD',
    COUNT(*) FILTER (WHERE has_hypertensive_ckd = TRUE),
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_hypertensive_ckd = TRUE) / COUNT(*), 1)
FROM patients
UNION ALL
SELECT
    'Hyperlipidemia',
    COUNT(*) FILTER (WHERE has_hyperlipidemia = TRUE),
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_hyperlipidemia = TRUE) / COUNT(*), 1)
FROM patients
UNION ALL
SELECT
    'Gout',
    COUNT(*) FILTER (WHERE has_gout = TRUE),
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_gout = TRUE) / COUNT(*), 1)
FROM patients
UNION ALL
SELECT
    'Pedal Edema',
    COUNT(*) FILTER (WHERE pedal_edema = TRUE),
    ROUND(100.0 * COUNT(*) FILTER (WHERE pedal_edema = TRUE) / COUNT(*), 1)
FROM patients
UNION ALL
SELECT
    'Poor Appetite',
    COUNT(*) FILTER (WHERE appetite = 'Poor'),
    ROUND(100.0 * COUNT(*) FILTER (WHERE appetite = 'Poor') / COUNT(*), 1)
FROM patients;

-- Count urine analysis tests
SELECT
    'Urine Analysis Tests' as metric,
    COUNT(*) as count
FROM urine_analysis;

-- Count hematology tests
SELECT
    'Hematology Tests' as metric,
    COUNT(*) as count
FROM hematology;

-- Count new observations
SELECT
    observation_type,
    COUNT(*) as count
FROM observations
WHERE observation_type IN ('BUN', 'Blood Glucose Random', 'Sodium', 'Bicarbonate')
GROUP BY observation_type
ORDER BY observation_type;

SELECT 'Comprehensive variables population complete!' as status;
