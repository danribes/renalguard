-- ===============================================================
-- POPULATE 500 PATIENTS WITH COMPREHENSIVE CKD DATA
-- Based on: Unified_CKD_Complete_Specification_Enhanced_v3
-- ===============================================================
-- This script generates 500 realistic patients with:
-- - Demographics and vital signs
-- - Comprehensive lab values
-- - Comorbidities and conditions
-- - Medications and prescriptions
-- - Refill history for adherence tracking
-- - Risk assessments
-- ===============================================================

DO $$
DECLARE
    v_patient_id UUID;
    v_age INTEGER;
    v_has_diabetes BOOLEAN;
    v_has_hypertension BOOLEAN;
    v_has_heart_failure BOOLEAN;
    v_has_obesity BOOLEAN;
    v_weight DECIMAL;
    v_height INTEGER;
    v_bmi DECIMAL;
    v_egfr DECIMAL;
    v_uacr DECIMAL;
    v_creatinine DECIMAL;
    v_hba1c DECIMAL;
    v_sbp INTEGER;
    v_dbp INTEGER;
    v_first_names TEXT[] := ARRAY['James', 'Mary', 'Robert', 'Patricia', 'Michael', 'Jennifer', 'William', 'Linda', 'David', 'Barbara',
                                   'Richard', 'Elizabeth', 'Joseph', 'Susan', 'Thomas', 'Jessica', 'Charles', 'Sarah', 'Christopher', 'Karen',
                                   'Daniel', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra',
                                   'Steven', 'Ashley', 'Paul', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna', 'Kenneth', 'Michelle'];
    v_last_names TEXT[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
                                  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
                                  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
    v_prescription_id UUID;
    v_med_name TEXT;
    v_med_class TEXT;
    v_days_supply INTEGER;
    v_refill_date DATE;
    v_patient_counter INTEGER := 0;
    v_batch_size INTEGER := 50;
BEGIN
    RAISE NOTICE 'Starting population of 500 patients...';

    -- Generate 500 patients
    FOR i IN 1..500 LOOP
        v_patient_id := gen_random_uuid();
        v_patient_counter := v_patient_counter + 1;

        -- Progress notification every 50 patients
        IF v_patient_counter % v_batch_size = 0 THEN
            RAISE NOTICE 'Processed % patients...', v_patient_counter;
        END IF;

        -- Generate demographics
        v_age := 40 + floor(random() * 45)::INTEGER;  -- Ages 40-85
        v_height := 160 + floor(random() * 30)::INTEGER;  -- 160-190 cm
        v_weight := 60 + (random() * 60);  -- 60-120 kg
        v_bmi := v_weight / ((v_height / 100.0) ^ 2);
        v_has_obesity := v_bmi >= 30;

        -- Determine comorbidities (correlated with age and BMI)
        v_has_diabetes := (random() < 0.45) OR (v_age > 60 AND random() < 0.6) OR (v_bmi > 32 AND random() < 0.55);
        v_has_hypertension := (random() < 0.60) OR (v_age > 65 AND random() < 0.75) OR v_has_diabetes;
        v_has_heart_failure := (v_age > 70 AND random() < 0.15) OR (v_has_diabetes AND v_has_hypertension AND random() < 0.10);

        -- Generate vital signs
        v_sbp := 110 + floor(random() * 70)::INTEGER;  -- 110-180 mmHg
        v_dbp := 70 + floor(random() * 30)::INTEGER;   -- 70-100 mmHg

        -- If hypertensive, increase BP
        IF v_has_hypertension THEN
            v_sbp := v_sbp + 15 + floor(random() * 20)::INTEGER;
            v_dbp := v_dbp + 10 + floor(random() * 15)::INTEGER;
        END IF;

        -- Generate lab values based on comorbidities
        -- eGFR: Lower if diabetes/hypertension/age
        v_egfr := 90 - (CASE WHEN v_has_diabetes THEN 15 ELSE 0 END)
                     - (CASE WHEN v_has_hypertension THEN 10 ELSE 0 END)
                     - ((v_age - 40) * 0.5)
                     + (random() * 30 - 15);
        v_egfr := GREATEST(15, LEAST(120, v_egfr));  -- Clamp between 15-120

        -- uACR: Higher if diabetes/CKD
        IF v_has_diabetes OR v_egfr < 60 THEN
            v_uacr := 30 + (random() * 400);  -- Likely proteinuria
        ELSE
            v_uacr := 5 + (random() * 40);   -- Normal to mild
        END IF;

        -- Creatinine (inversely related to eGFR)
        v_creatinine := 0.7 + (120 - v_egfr) / 100.0 + (random() * 0.3);

        -- HbA1c (elevated if diabetic)
        IF v_has_diabetes THEN
            v_hba1c := 6.5 + (random() * 3.5);  -- 6.5-10% (diabetic range)
        ELSE
            v_hba1c := 5.0 + (random() * 1.0);  -- 5-6% (normal)
        END IF;

        -- Insert patient
        INSERT INTO patients (
            id,
            medical_record_number,
            first_name,
            last_name,
            date_of_birth,
            gender,
            email,
            phone,
            weight,
            height,
            bmi,
            systolic_bp,
            diastolic_bp,
            bp_control_status,
            heart_rate,
            oxygen_saturation,
            smoking_status,
            has_diabetes,
            has_hypertension,
            has_heart_failure,
            has_cad,
            has_aki_history,
            has_obesity,
            has_metabolic_syndrome,
            cvd_history,
            family_history_esrd,
            on_ras_inhibitor,
            on_sglt2i,
            resistant_hypertension,
            antihypertensive_count,
            ckd_diagnosed,
            monitoring_status,
            current_risk_score,
            last_visit_date,
            next_visit_date
        ) VALUES (
            v_patient_id,
            'MRN' || lpad(i::text, 6, '0'),
            v_first_names[1 + floor(random() * array_length(v_first_names, 1))::int],
            v_last_names[1 + floor(random() * array_length(v_last_names, 1))::int],
            (CURRENT_DATE - (v_age * 365 + floor(random() * 365)::int))::date,
            CASE WHEN random() < 0.48 THEN 'male' ELSE 'female' END,
            'patient' || i || '@example.com',
            '555-' || lpad(floor(random() * 10000)::text, 4, '0') || '-' || lpad(floor(random() * 10000)::text, 4, '0'),
            v_weight,
            v_height,
            v_bmi,
            v_sbp,
            v_dbp,
            CASE WHEN v_sbp >= 140 OR v_dbp >= 90 THEN 'Uncontrolled' ELSE 'Controlled' END,
            60 + floor(random() * 40)::INTEGER,  -- Heart rate 60-100
            95 + (random() * 5),  -- O2 sat 95-100%
            CASE
                WHEN random() < 0.50 THEN 'Never'
                WHEN random() < 0.85 THEN 'Former'
                ELSE 'Current'
            END,
            v_has_diabetes,
            v_has_hypertension,
            v_has_heart_failure,
            v_has_heart_failure AND random() < 0.4,  -- CAD
            v_age > 65 AND random() < 0.12,  -- AKI history
            v_has_obesity,
            v_has_obesity AND v_has_hypertension AND v_has_diabetes,
            v_has_heart_failure OR (random() < 0.15),
            random() < 0.18,  -- Family history ESRD
            v_has_hypertension OR (v_egfr < 60 AND v_uacr >= 30),  -- On RAS inhibitor
            v_has_diabetes AND v_egfr >= 20 AND v_egfr < 75 AND v_uacr >= 30,  -- On SGLT2i
            v_sbp >= 160 AND v_has_hypertension,  -- Resistant HTN
            CASE
                WHEN v_has_hypertension AND v_sbp >= 160 THEN 3 + floor(random() * 2)::INTEGER
                WHEN v_has_hypertension THEN 1 + floor(random() * 2)::INTEGER
                ELSE 0
            END,
            v_egfr < 60 OR v_uacr >= 30,  -- CKD diagnosed
            CASE WHEN v_egfr < 60 THEN 'active' ELSE 'inactive' END,
            floor(random() * 100)::INTEGER,
            CURRENT_DATE - (floor(random() * 90)::INTEGER),  -- Last visit within 3 months
            CURRENT_DATE + (30 + floor(random() * 120)::INTEGER)  -- Next visit 1-5 months
        );

        -- ============================================
        -- Insert observations (labs)
        -- ============================================

        -- eGFR (multiple measurements over past 12 months)
        FOR j IN 0..3 LOOP
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
            VALUES (
                v_patient_id,
                'eGFR',
                v_egfr + (random() * 10 - 5) - (j * (random() * 2)),  -- Slight decline over time
                'mL/min/1.73m²',
                CURRENT_DATE - ((j * 90 + floor(random() * 30)::INTEGER)),
                'final'
            );
        END LOOP;

        -- uACR
        FOR j IN 0..3 LOOP
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
            VALUES (
                v_patient_id,
                'uACR',
                v_uacr + (random() * 50 - 25),
                'mg/g',
                CURRENT_DATE - ((j * 90 + floor(random() * 30)::INTEGER)),
                'final'
            );
        END LOOP;

        -- Serum Creatinine
        INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
        VALUES (v_patient_id, 'Creatinine', v_creatinine, 'mg/dL', CURRENT_DATE - floor(random() * 90)::INTEGER, 'final');

        -- Potassium
        INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
        VALUES (v_patient_id, 'Potassium', 3.5 + (random() * 1.5), 'mEq/L', CURRENT_DATE - floor(random() * 90)::INTEGER, 'final');

        -- HbA1c (if diabetic)
        IF v_has_diabetes THEN
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
            VALUES (v_patient_id, 'HbA1c', v_hba1c, '%', CURRENT_DATE - floor(random() * 90)::INTEGER, 'final');
        END IF;

        -- Lipid panel
        INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status) VALUES
        (v_patient_id, 'Total Cholesterol', 150 + (random() * 100), 'mg/dL', CURRENT_DATE - floor(random() * 180)::INTEGER, 'final'),
        (v_patient_id, 'LDL', 70 + (random() * 100), 'mg/dL', CURRENT_DATE - floor(random() * 180)::INTEGER, 'final'),
        (v_patient_id, 'HDL', 35 + (random() * 40), 'mg/dL', CURRENT_DATE - floor(random() * 180)::INTEGER, 'final'),
        (v_patient_id, 'Triglycerides', 80 + (random() * 200), 'mg/dL', CURRENT_DATE - floor(random() * 180)::INTEGER, 'final');

        -- Additional labs
        INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status) VALUES
        (v_patient_id, 'Hemoglobin', 11.5 + (random() * 4.5), 'g/dL', CURRENT_DATE - floor(random() * 90)::INTEGER, 'final'),
        (v_patient_id, 'Albumin', 3.0 + (random() * 1.5), 'g/dL', CURRENT_DATE - floor(random() * 90)::INTEGER, 'final'),
        (v_patient_id, 'Calcium', 8.5 + (random() * 1.5), 'mg/dL', CURRENT_DATE - floor(random() * 90)::INTEGER, 'final'),
        (v_patient_id, 'Phosphorus', 2.5 + (random() * 2.0), 'mg/dL', CURRENT_DATE - floor(random() * 90)::INTEGER, 'final'),
        (v_patient_id, 'Uric Acid', 4.0 + (random() * 5.0), 'mg/dL', CURRENT_DATE - floor(random() * 180)::INTEGER, 'final');

        -- ============================================
        -- Insert conditions
        -- ============================================

        IF v_has_diabetes THEN
            INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity)
            VALUES (
                v_patient_id,
                'E11.22',
                'Type 2 Diabetes Mellitus with Diabetic Chronic Kidney Disease',
                'active',
                (CURRENT_DATE - ((2 + floor(random() * 8)::INTEGER) * 365))::date,
                CASE WHEN v_hba1c > 9 THEN 'severe' WHEN v_hba1c > 7.5 THEN 'moderate' ELSE 'mild' END
            );
        END IF;

        IF v_has_hypertension THEN
            INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity)
            VALUES (
                v_patient_id,
                'I12.9',
                'Hypertensive Chronic Kidney Disease',
                'active',
                (CURRENT_DATE - ((3 + floor(random() * 10)::INTEGER) * 365))::date,
                CASE WHEN v_sbp >= 160 THEN 'severe' WHEN v_sbp >= 140 THEN 'moderate' ELSE 'mild' END
            );
        END IF;

        IF v_has_heart_failure THEN
            INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity)
            VALUES (
                v_patient_id,
                'I50.9',
                'Heart Failure, Unspecified',
                'active',
                (CURRENT_DATE - ((1 + floor(random() * 5)::INTEGER) * 365))::date,
                'moderate'
            );
        END IF;

        IF v_egfr < 60 OR v_uacr >= 30 THEN
            INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity)
            VALUES (
                v_patient_id,
                CASE
                    WHEN v_egfr >= 60 THEN 'N18.2'  -- Stage 2
                    WHEN v_egfr >= 45 THEN 'N18.31' -- Stage 3a
                    WHEN v_egfr >= 30 THEN 'N18.32' -- Stage 3b
                    WHEN v_egfr >= 15 THEN 'N18.4'  -- Stage 4
                    ELSE 'N18.5'                     -- Stage 5
                END,
                CASE
                    WHEN v_egfr >= 60 THEN 'Chronic Kidney Disease, Stage 2'
                    WHEN v_egfr >= 45 THEN 'Chronic Kidney Disease, Stage 3a'
                    WHEN v_egfr >= 30 THEN 'Chronic Kidney Disease, Stage 3b'
                    WHEN v_egfr >= 15 THEN 'Chronic Kidney Disease, Stage 4'
                    ELSE 'Chronic Kidney Disease, Stage 5'
                END,
                'active',
                (CURRENT_DATE - ((1 + floor(random() * 3)::INTEGER) * 365))::date,
                CASE WHEN v_egfr < 30 THEN 'severe' WHEN v_egfr < 60 THEN 'moderate' ELSE 'mild' END
            );
        END IF;

        -- ============================================
        -- Insert prescriptions and refills
        -- ============================================

        -- RAS Inhibitor (if indicated)
        IF v_has_hypertension OR (v_egfr < 60 AND v_uacr >= 30) THEN
            v_med_name := CASE floor(random() * 3)::INTEGER
                WHEN 0 THEN 'Lisinopril'
                WHEN 1 THEN 'Losartan'
                ELSE 'Valsartan'
            END;
            v_med_class := CASE WHEN v_med_name = 'Lisinopril' THEN 'ACEi' ELSE 'ARB' END;

            INSERT INTO prescriptions (
                patient_id, medication_name, generic_name, medication_class,
                prescribed_date, dosage, frequency, quantity_per_fill, days_supply,
                refills_authorized, refills_remaining, status
            ) VALUES (
                v_patient_id, v_med_name, v_med_name, v_med_class,
                CURRENT_DATE - floor(random() * 730)::INTEGER,
                '10mg', 'Once daily', 30, 30, 11, floor(random() * 12)::INTEGER, 'active'
            )
            RETURNING id INTO v_prescription_id;

            -- Generate 12 months of refills
            FOR j IN 1..12 LOOP
                v_refill_date := CURRENT_DATE - ((12 - j) * 30 + floor(random() * 10 - 5)::INTEGER);

                -- Simulate occasional missed refills (10% chance)
                IF random() > 0.10 THEN
                    INSERT INTO refills (
                        prescription_id, patient_id, fill_date, quantity_dispensed,
                        days_supply, fill_status, cost_patient
                    ) VALUES (
                        v_prescription_id, v_patient_id, v_refill_date, 30, 30,
                        'completed', 5 + (random() * 20)
                    );
                END IF;
            END LOOP;
        END IF;

        -- SGLT2i (Jardiance) if indicated
        IF v_has_diabetes AND v_egfr >= 20 AND v_egfr < 75 AND v_uacr >= 30 THEN
            INSERT INTO prescriptions (
                patient_id, medication_name, generic_name, medication_class,
                prescribed_date, dosage, frequency, quantity_per_fill, days_supply,
                refills_authorized, refills_remaining, status
            ) VALUES (
                v_patient_id, 'Jardiance', 'Empagliflozin', 'SGLT2i',
                CURRENT_DATE - floor(random() * 365)::INTEGER,
                '10mg', 'Once daily', 30, 30, 11, floor(random() * 12)::INTEGER, 'active'
            )
            RETURNING id INTO v_prescription_id;

            -- Generate refills
            FOR j IN 1..12 LOOP
                v_refill_date := CURRENT_DATE - ((12 - j) * 30 + floor(random() * 10 - 5)::INTEGER);

                -- Simulate suboptimal adherence (15% miss rate)
                IF random() > 0.15 THEN
                    INSERT INTO refills (
                        prescription_id, patient_id, fill_date, quantity_dispensed,
                        days_supply, fill_status, cost_patient
                    ) VALUES (
                        v_prescription_id, v_patient_id, v_refill_date, 30, 30,
                        'completed', 25 + (random() * 50)
                    );
                END IF;
            END LOOP;
        END IF;

        -- Statin (most CKD patients should be on one)
        IF v_egfr < 60 OR v_age > 50 THEN
            INSERT INTO prescriptions (
                patient_id, medication_name, generic_name, medication_class,
                prescribed_date, dosage, frequency, quantity_per_fill, days_supply,
                refills_authorized, refills_remaining, status
            ) VALUES (
                v_patient_id, 'Atorvastatin', 'Atorvastatin', 'Statin',
                CURRENT_DATE - floor(random() * 730)::INTEGER,
                '20mg', 'Once daily', 30, 30, 11, floor(random() * 12)::INTEGER, 'active'
            )
            RETURNING id INTO v_prescription_id;

            -- Good adherence for statins (90%)
            FOR j IN 1..12 LOOP
                v_refill_date := CURRENT_DATE - ((12 - j) * 30 + floor(random() * 10 - 5)::INTEGER);

                IF random() > 0.10 THEN
                    INSERT INTO refills (
                        prescription_id, patient_id, fill_date, quantity_dispensed,
                        days_supply, fill_status, cost_patient
                    ) VALUES (
                        v_prescription_id, v_patient_id, v_refill_date, 30, 30,
                        'completed', 3 + (random() * 10)
                    );
                END IF;
            END LOOP;
        END IF;

        -- Diuretic (if hypertensive or heart failure)
        IF v_has_heart_failure OR (v_has_hypertension AND v_sbp >= 150) THEN
            INSERT INTO prescriptions (
                patient_id, medication_name, generic_name, medication_class,
                prescribed_date, dosage, frequency, quantity_per_fill, days_supply,
                refills_authorized, refills_remaining, status
            ) VALUES (
                v_patient_id,
                CASE WHEN v_has_heart_failure THEN 'Furosemide' ELSE 'Hydrochlorothiazide' END,
                CASE WHEN v_has_heart_failure THEN 'Furosemide' ELSE 'Hydrochlorothiazide' END,
                CASE WHEN v_has_heart_failure THEN 'Loop Diuretic' ELSE 'Thiazide' END,
                CURRENT_DATE - floor(random() * 730)::INTEGER,
                CASE WHEN v_has_heart_failure THEN '40mg' ELSE '25mg' END,
                'Once daily', 30, 30, 11, floor(random() * 12)::INTEGER, 'active'
            );
        END IF;

        -- Metformin (if diabetic and eGFR >30)
        IF v_has_diabetes AND v_egfr >= 30 THEN
            INSERT INTO prescriptions (
                patient_id, medication_name, generic_name, medication_class,
                prescribed_date, dosage, frequency, quantity_per_fill, days_supply,
                refills_authorized, refills_remaining, status
            ) VALUES (
                v_patient_id, 'Metformin', 'Metformin', 'Biguanide',
                CURRENT_DATE - floor(random() * 730)::INTEGER,
                '1000mg', 'Twice daily', 60, 30, 11, floor(random() * 12)::INTEGER, 'active'
            );
        END IF;

    END LOOP;

    RAISE NOTICE 'Successfully populated 500 patients with comprehensive data!';

END $$;

-- ===============================================================
-- VERIFICATION QUERIES
-- ===============================================================

-- Count patients
SELECT
    'Total Patients' as metric,
    COUNT(*) as count
FROM patients;

-- Count by CKD status
SELECT
    'Patients with CKD' as metric,
    COUNT(*) as count
FROM patients
WHERE ckd_diagnosed = TRUE;

-- Count observations
SELECT
    'Total Observations' as metric,
    COUNT(*) as count
FROM observations;

-- Count prescriptions
SELECT
    'Total Prescriptions' as metric,
    COUNT(*) as count
FROM prescriptions;

-- Count refills
SELECT
    'Total Refills' as metric,
    COUNT(*) as count
FROM refills;

-- Summary by condition
SELECT
    condition_name,
    COUNT(*) as patient_count
FROM conditions
GROUP BY condition_name
ORDER BY patient_count DESC;

-- Summary by medication class
SELECT
    medication_class,
    COUNT(DISTINCT patient_id) as patient_count
FROM prescriptions
GROUP BY medication_class
ORDER BY patient_count DESC;

-- eGFR distribution
SELECT
    CASE
        WHEN value_numeric >= 90 THEN 'G1 (≥90)'
        WHEN value_numeric >= 60 THEN 'G2 (60-89)'
        WHEN value_numeric >= 45 THEN 'G3a (45-59)'
        WHEN value_numeric >= 30 THEN 'G3b (30-44)'
        WHEN value_numeric >= 15 THEN 'G4 (15-29)'
        ELSE 'G5 (<15)'
    END as gfr_category,
    COUNT(*) as count
FROM (
    SELECT DISTINCT ON (patient_id) value_numeric
    FROM observations
    WHERE observation_type = 'eGFR'
    ORDER BY patient_id, observation_date DESC
) recent_egfr
GROUP BY gfr_category
ORDER BY
    CASE
        WHEN gfr_category = 'G1 (≥90)' THEN 1
        WHEN gfr_category = 'G2 (60-89)' THEN 2
        WHEN gfr_category = 'G3a (45-59)' THEN 3
        WHEN gfr_category = 'G3b (30-44)' THEN 4
        WHEN gfr_category = 'G4 (15-29)' THEN 5
        ELSE 6
    END;

SELECT 'Data population complete! Database ready for MCP server integration.' as status;
