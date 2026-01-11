-- ================================================================
-- Generate 200 Mock Patient Records with Comprehensive Clinical Data
-- ================================================================
-- This script generates diverse patient demographics, observations,
-- and conditions representing various CKD stages and risk levels

-- Function to generate random UUID v4
CREATE OR REPLACE FUNCTION random_uuid() RETURNS uuid AS $$
BEGIN
  RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- Insert 200 mock patients with diverse demographics
DO $$
DECLARE
  v_patient_id uuid;
  v_age integer;
  v_gender text;
  v_has_diabetes boolean;
  v_has_hypertension boolean;
  v_has_cvd boolean;
  v_weight decimal;
  v_height integer;
  v_bmi decimal;
  v_egfr decimal;
  v_uacr decimal;
  v_creatinine decimal;
  v_smoking text;
  v_ckd_stage integer;
  v_diagnosis_years integer;
  v_first_name text;
  v_last_name text;
  v_risk_level integer;

  -- Name arrays for random generation
  first_names_male text[] := ARRAY['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Donald', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Raymond', 'Gregory', 'Alexander', 'Frank', 'Patrick', 'Raymond', 'Jack', 'Dennis', 'Jerry'];
  first_names_female text[] := ARRAY['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Dorothy', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen', 'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather'];
  last_names text[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];

BEGIN
  -- Generate 200 patients
  FOR i IN 1..200 LOOP
    v_patient_id := random_uuid();

    -- Random demographics
    v_gender := CASE WHEN random() < 0.5 THEN 'male' ELSE 'female' END;
    v_age := 40 + floor(random() * 46)::integer; -- Ages 40-85
    v_height := CASE
      WHEN v_gender = 'male' THEN 165 + floor(random() * 25)::integer
      ELSE 155 + floor(random() * 25)::integer
    END;
    v_weight := 55 + (random() * 60); -- 55-115 kg
    v_bmi := v_weight / ((v_height / 100.0) * (v_height / 100.0));

    -- Generate name
    v_first_name := CASE
      WHEN v_gender = 'male' THEN first_names_male[1 + floor(random() * array_length(first_names_male, 1))::integer]
      ELSE first_names_female[1 + floor(random() * array_length(first_names_female, 1))::integer]
    END;
    v_last_name := last_names[1 + floor(random() * array_length(last_names, 1))::integer];

    -- Risk factor distribution (realistic prevalence)
    v_has_diabetes := random() < 0.30; -- 30% have diabetes
    v_has_hypertension := random() < 0.45; -- 45% have hypertension
    v_has_cvd := random() < 0.20; -- 20% have CVD history

    -- Smoking status
    v_smoking := CASE
      WHEN random() < 0.50 THEN 'Never'
      WHEN random() < 0.70 THEN 'Former'
      ELSE 'Current'
    END;

    -- Determine risk level and adjust labs accordingly
    -- Tier 1: ~40% - Low risk (normal labs, no/few risk factors)
    -- Tier 2: ~35% - Moderate risk (one risk factor, borderline labs)
    -- Tier 3: ~25% - High risk (multiple risk factors or abnormal labs)

    IF random() < 0.40 THEN
      -- Tier 1: Low risk
      v_risk_level := 1;
      v_egfr := 75 + (random() * 30); -- eGFR 75-105
      v_uacr := random() * 25; -- uACR 0-25
      v_creatinine := 0.8 + (random() * 0.4); -- Creatinine 0.8-1.2
      v_ckd_stage := 0; -- No CKD or Stage 1
    ELSIF random() < 0.75 THEN
      -- Tier 2: Moderate risk
      v_risk_level := 2;
      v_egfr := 50 + (random() * 35); -- eGFR 50-85
      v_uacr := 25 + (random() * 75); -- uACR 25-100
      v_creatinine := 1.0 + (random() * 0.8); -- Creatinine 1.0-1.8
      v_ckd_stage := CASE
        WHEN v_egfr >= 60 THEN 2
        WHEN v_egfr >= 45 THEN 3
        ELSE 3
      END;
    ELSE
      -- Tier 3: High risk
      v_risk_level := 3;
      v_egfr := 15 + (random() * 45); -- eGFR 15-60
      v_uacr := 100 + (random() * 400); -- uACR 100-500
      v_creatinine := 1.5 + (random() * 2.5); -- Creatinine 1.5-4.0
      v_ckd_stage := CASE
        WHEN v_egfr >= 45 THEN 3
        WHEN v_egfr >= 30 THEN 3
        WHEN v_egfr >= 15 THEN 4
        ELSE 5
      END;
      -- High risk patients more likely to have risk factors
      v_has_diabetes := v_has_diabetes OR random() < 0.5;
      v_has_hypertension := v_has_hypertension OR random() < 0.6;
    END IF;

    v_diagnosis_years := CASE
      WHEN v_ckd_stage >= 3 THEN floor(random() * 8)::integer
      WHEN v_ckd_stage = 2 THEN floor(random() * 5)::integer
      ELSE 0
    END;

    -- Insert patient
    INSERT INTO patients (
      id, medical_record_number, first_name, last_name,
      date_of_birth, gender, email, phone,
      weight, height, smoking_status, cvd_history, family_history_esrd,
      on_ras_inhibitor, on_sglt2i, nephrotoxic_meds, nephrologist_referral,
      diagnosis_date, last_visit_date, next_visit_date
    ) VALUES (
      v_patient_id,
      'MRN' || lpad((i + 100)::text, 5, '0'),
      v_first_name,
      v_last_name,
      (CURRENT_DATE - (v_age * 365 + floor(random() * 365)::integer))::date,
      v_gender,
      lower(v_first_name) || '.' || lower(v_last_name) || '@email.com',
      '+1-555-' || lpad(floor(random() * 10000)::text, 4, '0'),
      v_weight,
      v_height,
      v_smoking,
      v_has_cvd,
      random() < 0.10, -- 10% family history of ESRD
      v_has_diabetes OR v_has_hypertension, -- RAS inhibitor if DM or HTN
      v_has_diabetes AND random() < 0.30, -- 30% of diabetics on SGLT2i
      random() < 0.15, -- 15% on nephrotoxic meds
      v_ckd_stage >= 4 AND random() < 0.70, -- 70% of stage 4+ have nephro referral
      CASE WHEN v_diagnosis_years > 0 THEN (CURRENT_DATE - (v_diagnosis_years * 365))::date ELSE NULL END,
      (CURRENT_DATE - floor(random() * 90)::integer)::date, -- Last visit 0-90 days ago
      (CURRENT_DATE + (30 + floor(random() * 120)::integer))::date -- Next visit 30-150 days from now
    );

    -- Insert comprehensive observations
    -- Kidney Function Panel
    INSERT INTO observations (patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, notes) VALUES
      (v_patient_id, 'eGFR', v_egfr, NULL, 'mL/min/1.73m²', CURRENT_TIMESTAMP - interval '1 day', 'final',
        CASE
          WHEN v_egfr < 15 THEN 'Stage 5 CKD - Kidney failure'
          WHEN v_egfr < 30 THEN 'Stage 4 CKD - Severe decrease'
          WHEN v_egfr < 45 THEN 'Stage 3b CKD'
          WHEN v_egfr < 60 THEN 'Stage 3a CKD'
          WHEN v_egfr < 90 THEN 'Stage 2 CKD - Mild decrease'
          ELSE 'Normal kidney function'
        END),
      (v_patient_id, 'eGFR_trend', NULL,
        CASE
          WHEN v_risk_level = 3 AND random() < 0.6 THEN 'down'
          WHEN v_risk_level = 1 THEN 'stable'
          ELSE CASE WHEN random() < 0.7 THEN 'stable' ELSE 'down' END
        END,
        NULL, CURRENT_TIMESTAMP - interval '1 day', 'final', NULL),
      (v_patient_id, 'eGFR_change_percent',
        CASE
          WHEN v_risk_level = 3 THEN -(3 + random() * 12) -- High risk: -3% to -15%
          WHEN v_risk_level = 2 THEN -(random() * 5) -- Moderate risk: 0% to -5%
          ELSE (random() * 4 - 2) -- Low risk: -2% to +2%
        END,
        NULL, '%', CURRENT_TIMESTAMP - interval '1 day', 'final', NULL),
      (v_patient_id, 'serum_creatinine', v_creatinine, NULL, 'mg/dL', CURRENT_TIMESTAMP - interval '1 day', 'final',
        CASE WHEN v_creatinine > 1.5 THEN 'Elevated' ELSE 'Normal' END),
      (v_patient_id, 'BUN', 10 + (v_creatinine - 0.8) * 25 + random() * 10, NULL, 'mg/dL', CURRENT_TIMESTAMP - interval '1 day', 'final', NULL),
      (v_patient_id, 'uACR', v_uacr, NULL, 'mg/g', CURRENT_TIMESTAMP - interval '1 day', 'final',
        CASE
          WHEN v_uacr >= 300 THEN 'Severely increased albuminuria (A3)'
          WHEN v_uacr >= 30 THEN 'Moderately increased albuminuria (A2)'
          ELSE 'Normal albuminuria (A1)'
        END),
      (v_patient_id, 'proteinuria_category', NULL,
        CASE WHEN v_uacr >= 300 THEN 'A3' WHEN v_uacr >= 30 THEN 'A2' ELSE 'A1' END,
        NULL, CURRENT_TIMESTAMP - interval '1 day', 'final', NULL);

    -- Hematology & Minerals
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status, notes) VALUES
      (v_patient_id, 'hemoglobin',
        CASE
          WHEN v_ckd_stage >= 4 THEN 9 + random() * 3 -- Stage 4+: 9-12 (anemia common)
          WHEN v_ckd_stage = 3 THEN 11 + random() * 3 -- Stage 3: 11-14
          ELSE 12 + random() * 4 -- Normal: 12-16
        END,
        'g/dL', CURRENT_TIMESTAMP - interval '1 day', 'final',
        CASE WHEN v_ckd_stage >= 4 THEN 'CKD-related anemia' ELSE NULL END),
      (v_patient_id, 'potassium',
        CASE
          WHEN v_ckd_stage >= 4 THEN 4.5 + random() * 1.5 -- Stage 4+: 4.5-6.0 (hyperkalemia risk)
          ELSE 3.5 + random() * 1.2 -- Normal: 3.5-4.7
        END,
        'mEq/L', CURRENT_TIMESTAMP - interval '1 day', 'final',
        CASE WHEN v_ckd_stage >= 4 AND random() < 0.4 THEN 'Hyperkalemia risk' ELSE NULL END),
      (v_patient_id, 'calcium', 8.5 + random() * 1.5, 'mg/dL', CURRENT_TIMESTAMP - interval '1 day', 'final', NULL),
      (v_patient_id, 'phosphorus',
        CASE
          WHEN v_ckd_stage >= 4 THEN 4.5 + random() * 2 -- Elevated in advanced CKD
          ELSE 2.5 + random() * 2
        END,
        'mg/dL', CURRENT_TIMESTAMP - interval '1 day', 'final', NULL),
      (v_patient_id, 'albumin', 3.0 + random() * 1.5, 'g/dL', CURRENT_TIMESTAMP - interval '1 day', 'final', NULL);

    -- Metabolic & Cardiovascular Panel
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status, notes) VALUES
      (v_patient_id, 'HbA1c',
        CASE
          WHEN v_has_diabetes THEN 6.5 + random() * 2.5 -- Diabetics: 6.5-9.0%
          ELSE 4.5 + random() * 1.0 -- Non-diabetics: 4.5-5.5%
        END,
        '%', CURRENT_TIMESTAMP - interval '30 days', 'final',
        CASE WHEN v_has_diabetes AND random() < 0.3 THEN 'Suboptimal control' ELSE NULL END),
      (v_patient_id, 'blood_pressure_systolic',
        CASE
          WHEN v_has_hypertension THEN 130 + random() * 30 -- HTN: 130-160
          ELSE 110 + random() * 20 -- Normal: 110-130
        END,
        'mmHg', CURRENT_TIMESTAMP - interval '1 day', 'final', NULL),
      (v_patient_id, 'blood_pressure_diastolic',
        CASE
          WHEN v_has_hypertension THEN 85 + random() * 15 -- HTN: 85-100
          ELSE 70 + random() * 15 -- Normal: 70-85
        END,
        'mmHg', CURRENT_TIMESTAMP - interval '1 day', 'final', NULL),
      (v_patient_id, 'LDL_cholesterol', 80 + random() * 100, 'mg/dL', CURRENT_TIMESTAMP - interval '60 days', 'final', NULL),
      (v_patient_id, 'HDL_cholesterol', 30 + random() * 40, 'mg/dL', CURRENT_TIMESTAMP - interval '60 days', 'final', NULL),
      (v_patient_id, 'BMI', v_bmi, 'kg/m²', CURRENT_TIMESTAMP - interval '1 day', 'final',
        CASE
          WHEN v_bmi >= 30 THEN 'Obese'
          WHEN v_bmi >= 25 THEN 'Overweight'
          ELSE 'Normal weight'
        END);

    -- Insert conditions
    IF v_has_diabetes THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
      VALUES (v_patient_id, 'E11.9', 'Type 2 Diabetes Mellitus', 'active',
        (CURRENT_DATE - (floor(random() * 3650)::integer + 365)), CURRENT_TIMESTAMP,
        CASE WHEN random() < 0.3 THEN 'severe' WHEN random() < 0.6 THEN 'moderate' ELSE 'mild' END);
    END IF;

    IF v_has_hypertension THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
      VALUES (v_patient_id, 'I10', 'Essential Hypertension', 'active',
        (CURRENT_DATE - (floor(random() * 3650)::integer + 365)), CURRENT_TIMESTAMP,
        CASE WHEN random() < 0.2 THEN 'severe' WHEN random() < 0.5 THEN 'moderate' ELSE 'mild' END);
    END IF;

    IF v_has_cvd THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
      VALUES (v_patient_id, 'I25.10', 'Coronary Artery Disease', 'active',
        (CURRENT_DATE - (floor(random() * 2920)::integer + 730)), CURRENT_TIMESTAMP, 'moderate');
    END IF;

    IF v_ckd_stage >= 2 THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
      VALUES (v_patient_id, 'N18.' || v_ckd_stage::text,
        'Chronic Kidney Disease, Stage ' || v_ckd_stage::text,
        'active',
        CASE WHEN v_diagnosis_years > 0 THEN (CURRENT_DATE - (v_diagnosis_years * 365))::date ELSE CURRENT_DATE END,
        CURRENT_TIMESTAMP,
        CASE
          WHEN v_ckd_stage >= 4 THEN 'severe'
          WHEN v_ckd_stage = 3 THEN 'moderate'
          ELSE 'mild'
        END);
    END IF;

  END LOOP;

  RAISE NOTICE 'Successfully generated 200 mock patients with comprehensive clinical data';
END $$;

-- Clean up function
DROP FUNCTION IF EXISTS random_uuid();
