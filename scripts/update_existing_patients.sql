-- ===============================================================
-- UPDATE EXISTING PATIENTS WITH ENHANCED DATA
-- ===============================================================
-- This script updates existing patients in the database
-- with new vital signs, comorbidity flags, and calculated fields
-- ===============================================================

DO $$
DECLARE
    v_patient RECORD;
    v_weight DECIMAL;
    v_height INTEGER;
    v_bmi DECIMAL;
    v_age INTEGER;
    v_egfr DECIMAL;
    v_uacr DECIMAL;
    v_has_diabetes BOOLEAN;
    v_has_hypertension BOOLEAN;
    v_sbp INTEGER;
    v_dbp INTEGER;
    v_updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting update of existing patients...';

    FOR v_patient IN
        SELECT id, weight, height, date_of_birth,
               systolic_bp, has_diabetes, has_hypertension
        FROM patients
        WHERE systolic_bp IS NULL  -- Only update patients without enhanced data
    LOOP
        v_updated_count := v_updated_count + 1;

        -- Calculate age
        v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_patient.date_of_birth));

        -- Use existing or generate weight/height
        v_weight := COALESCE(v_patient.weight, 60 + (random() * 60));
        v_height := COALESCE(v_patient.height, 160 + floor(random() * 30)::INTEGER);
        v_bmi := v_weight / ((v_height / 100.0) ^ 2);

        -- Get most recent eGFR and uACR if available
        SELECT value_numeric INTO v_egfr
        FROM observations
        WHERE patient_id = v_patient.id
          AND observation_type = 'eGFR'
        ORDER BY observation_date DESC
        LIMIT 1;

        SELECT value_numeric INTO v_uacr
        FROM observations
        WHERE patient_id = v_patient.id
          AND observation_type = 'uACR'
        ORDER BY observation_date DESC
        LIMIT 1;

        -- Infer diabetes from conditions or HbA1c
        v_has_diabetes := EXISTS (
            SELECT 1 FROM conditions
            WHERE patient_id = v_patient.id
              AND condition_code LIKE 'E11%'
              AND clinical_status = 'active'
        ) OR EXISTS (
            SELECT 1 FROM observations
            WHERE patient_id = v_patient.id
              AND observation_type = 'HbA1c'
              AND value_numeric >= 6.5
        );

        -- Infer hypertension from conditions
        v_has_hypertension := EXISTS (
            SELECT 1 FROM conditions
            WHERE patient_id = v_patient.id
              AND (condition_code LIKE 'I10%' OR condition_code LIKE 'I12%' OR condition_code LIKE 'I13%')
              AND clinical_status = 'active'
        );

        -- Generate blood pressure
        v_sbp := 110 + floor(random() * 70)::INTEGER;
        v_dbp := 70 + floor(random() * 30)::INTEGER;

        IF v_has_hypertension THEN
            v_sbp := v_sbp + 20 + floor(random() * 20)::INTEGER;
            v_dbp := v_dbp + 10 + floor(random() * 15)::INTEGER;
        END IF;

        -- Update patient record
        UPDATE patients SET
            weight = v_weight,
            height = v_height,
            bmi = v_bmi,
            systolic_bp = v_sbp,
            diastolic_bp = v_dbp,
            bp_control_status = CASE WHEN v_sbp >= 140 OR v_dbp >= 90 THEN 'Uncontrolled' ELSE 'Controlled' END,
            heart_rate = 60 + floor(random() * 40)::INTEGER,
            oxygen_saturation = 95 + (random() * 5),
            has_diabetes = v_has_diabetes,
            has_hypertension = v_has_hypertension,
            has_heart_failure = EXISTS (
                SELECT 1 FROM conditions
                WHERE patient_id = v_patient.id
                  AND condition_code LIKE 'I50%'
                  AND clinical_status = 'active'
            ),
            has_cad = FALSE,  -- Default, can be updated based on conditions
            has_obesity = v_bmi >= 30,
            has_metabolic_syndrome = v_has_diabetes AND v_has_hypertension AND v_bmi >= 30,
            resistant_hypertension = v_sbp >= 160 AND v_has_hypertension,
            antihypertensive_count = CASE
                WHEN v_sbp >= 160 AND v_has_hypertension THEN 3 + floor(random() * 2)::INTEGER
                WHEN v_has_hypertension THEN 1 + floor(random() * 2)::INTEGER
                ELSE 0
            END,
            ckd_diagnosed = COALESCE(v_egfr < 60 OR v_uacr >= 30, FALSE),
            monitoring_status = CASE WHEN v_egfr < 60 THEN 'active' ELSE 'inactive' END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_patient.id;

        -- Add missing lab observations if not present
        IF NOT EXISTS (SELECT 1 FROM observations WHERE patient_id = v_patient.id AND observation_type = 'Potassium') THEN
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date)
            VALUES (v_patient.id, 'Potassium', 3.5 + (random() * 1.5), 'mEq/L', CURRENT_DATE - floor(random() * 90)::INTEGER);
        END IF;

        IF v_has_diabetes AND NOT EXISTS (SELECT 1 FROM observations WHERE patient_id = v_patient.id AND observation_type = 'HbA1c') THEN
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date)
            VALUES (v_patient.id, 'HbA1c', 6.5 + (random() * 3.5), '%', CURRENT_DATE - floor(random() * 90)::INTEGER);
        END IF;

        -- Add lipid panel if missing
        IF NOT EXISTS (SELECT 1 FROM observations WHERE patient_id = v_patient.id AND observation_type = 'Total Cholesterol') THEN
            INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date) VALUES
            (v_patient.id, 'Total Cholesterol', 150 + (random() * 100), 'mg/dL', CURRENT_DATE - floor(random() * 180)::INTEGER),
            (v_patient.id, 'LDL', 70 + (random() * 100), 'mg/dL', CURRENT_DATE - floor(random() * 180)::INTEGER),
            (v_patient.id, 'HDL', 35 + (random() * 40), 'mg/dL', CURRENT_DATE - floor(random() * 180)::INTEGER),
            (v_patient.id, 'Triglycerides', 80 + (random() * 200), 'mg/dL', CURRENT_DATE - floor(random() * 180)::INTEGER);
        END IF;

        IF v_updated_count % 20 = 0 THEN
            RAISE NOTICE 'Updated % patients...', v_updated_count;
        END IF;

    END LOOP;

    RAISE NOTICE 'Successfully updated % existing patients!', v_updated_count;

END $$;

-- Verify updates
SELECT
    'Patients with enhanced vital signs' as metric,
    COUNT(*) as count
FROM patients
WHERE systolic_bp IS NOT NULL;

SELECT
    'Patients with comorbidity flags' as metric,
    COUNT(*) as count
FROM patients
WHERE has_diabetes IS NOT NULL;

SELECT 'Existing patient update complete!' as status;
