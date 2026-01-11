-- ============================================
-- Migration 010: Adjust Patient Distribution to Real-World Prevalence
-- ============================================
-- This migration generates a patient population that reflects real-world prevalence:
-- - Low/Moderate Risk Non-CKD: 24.5%
-- - High Risk Non-CKD: 40% (60% monitored)
-- - Mild CKD (Stages 1-2): 8%
-- - Moderate CKD (Stage 3): 25%
-- - Severe CKD (Stage 4): 2%
-- - Kidney Failure (Stage 5): 0.5%
-- - 90% of CKD patients monitored
-- - 80% of CKD patients treated
-- ============================================

-- First, delete existing mock patients (keep any real ones if they exist)
DO $$
BEGIN
  -- Delete observations first due to foreign key
  DELETE FROM observations WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN-%'
  );

  -- Delete conditions
  DELETE FROM conditions WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN-%'
  );

  -- Delete risk factors
  DELETE FROM patient_risk_factors WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN-%'
  );

  -- Delete CKD patient data
  DELETE FROM ckd_patient_data WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN-%'
  );

  -- Delete non-CKD patient data
  DELETE FROM non_ckd_patient_data WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN-%'
  );

  -- Finally delete patients
  DELETE FROM patients WHERE medical_record_number LIKE 'MRN-%';

  RAISE NOTICE 'Cleared existing mock patients';
END $$;

-- ============================================
-- Generate 1000 patients with realistic distribution
-- ============================================

DO $$
DECLARE
  v_patient_id uuid;
  v_age integer;
  v_gender text;
  v_has_diabetes boolean;
  v_diabetes_type text;
  v_diabetes_duration integer;
  v_diabetes_controlled boolean;
  v_has_hypertension boolean;
  v_htn_controlled boolean;
  v_has_cvd boolean;
  v_has_heart_failure boolean;
  v_has_obesity boolean;
  v_weight decimal;
  v_height integer;
  v_bmi decimal;
  v_egfr decimal;
  v_uacr decimal;
  v_creatinine decimal;
  v_bun decimal;
  v_hba1c decimal;
  v_smoking text;
  v_pack_years decimal;
  v_ckd_stage integer;
  v_ckd_severity text;
  v_has_ckd boolean;
  v_first_name text;
  v_last_name text;
  v_ethnicity text;
  v_race text;
  v_risk_category text;
  v_patient_category text;
  v_is_monitored boolean;
  v_is_treated boolean;
  v_monitoring_device text;
  v_monitoring_frequency text;
  v_gfr_category text;
  v_alb_category text;
  v_health_state text;
  v_kdigo_risk text;
  v_systolic integer;
  v_diastolic integer;
  v_egfr_decline decimal;
  v_history_aki boolean;
  v_family_history_esrd boolean;
  v_on_ras_inhibitor boolean;
  v_on_sglt2i boolean;
  v_on_nephrotoxic boolean;
  v_risk_score decimal;
  v_risk_tier text;

  -- Counters for distribution
  v_category_counter integer;

  -- Name arrays
  first_names_male text[] := ARRAY['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Donald', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Raymond', 'Gregory', 'Alexander', 'Frank', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Carl', 'Keith', 'Douglas', 'Terry', 'Gerald', 'Harold', 'Sean', 'Austin', 'Jose', 'Eugene', 'Albert'];
  first_names_female text[] := ARRAY['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Dorothy', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen', 'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather', 'Diane', 'Ruth', 'Julie', 'Joyce', 'Virginia', 'Victoria', 'Kelly', 'Lauren', 'Christina', 'Joan'];
  last_names text[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];

BEGIN
  -- ============================================
  -- Generate patients by category
  -- ============================================

  FOR i IN 1..1000 LOOP
    v_patient_id := gen_random_uuid();

    -- Determine patient category based on prevalence
    v_category_counter := i;

    IF i <= 245 THEN
      -- Low/Moderate Risk Non-CKD: 24.5% (patients 1-245)
      v_patient_category := 'low_moderate_non_ckd';
      v_has_ckd := false;
      v_is_monitored := false;
      v_is_treated := false;

    ELSIF i <= 645 THEN
      -- High Risk Non-CKD: 40% (patients 246-645 = 400 patients)
      v_patient_category := 'high_risk_non_ckd';
      v_has_ckd := false;
      -- 60% of high risk non-CKD are monitored
      v_is_monitored := ((i - 245) <= 240); -- First 240 of 400
      v_is_treated := false;

    ELSIF i <= 725 THEN
      -- Mild CKD: 8% (patients 646-725 = 80 patients)
      v_patient_category := 'mild_ckd';
      v_has_ckd := true;
      v_ckd_stage := CASE WHEN random() < 0.5 THEN 1 ELSE 2 END;

    ELSIF i <= 975 THEN
      -- Moderate CKD: 25% (patients 726-975 = 250 patients)
      v_patient_category := 'moderate_ckd';
      v_has_ckd := true;
      v_ckd_stage := 3;

    ELSIF i <= 995 THEN
      -- Severe CKD: 2% (patients 976-995 = 20 patients)
      v_patient_category := 'severe_ckd';
      v_has_ckd := true;
      v_ckd_stage := 4;

    ELSE
      -- Kidney Failure: 0.5% (patients 996-1000 = 5 patients)
      v_patient_category := 'kidney_failure';
      v_has_ckd := true;
      v_ckd_stage := 5;
    END IF;

    -- For CKD patients: 90% monitored, 80% treated
    IF v_has_ckd THEN
      v_is_monitored := (random() < 0.90);
      v_is_treated := (random() < 0.80);
    END IF;

    -- ============================================
    -- Generate demographics
    -- ============================================

    v_gender := CASE WHEN random() < 0.48 THEN 'male' ELSE 'female' END;
    v_age := 35 + floor(random() * 55)::integer; -- Ages 35-89

    -- Height and weight
    v_height := CASE
      WHEN v_gender = 'male' THEN 165 + floor(random() * 25)::integer
      ELSE 155 + floor(random() * 25)::integer
    END;
    v_weight := 55 + (random() * 65); -- 55-120 kg
    v_bmi := v_weight / ((v_height / 100.0) * (v_height / 100.0));
    v_has_obesity := v_bmi >= 30;

    -- Generate name
    v_first_name := CASE
      WHEN v_gender = 'male' THEN first_names_male[1 + floor(random() * array_length(first_names_male, 1))::integer]
      ELSE first_names_female[1 + floor(random() * array_length(first_names_female, 1))::integer]
    END;
    v_last_name := last_names[1 + floor(random() * array_length(last_names, 1))::integer];

    -- Ethnicity (realistic US distribution)
    CASE floor(random() * 10)::integer
      WHEN 0, 1 THEN
        v_ethnicity := 'African American';
        v_race := 'Black';
      WHEN 2 THEN
        v_ethnicity := 'Hispanic';
        v_race := 'Hispanic/Latino';
      WHEN 3 THEN
        v_ethnicity := 'Asian';
        v_race := 'Asian';
      ELSE
        v_ethnicity := 'Caucasian';
        v_race := 'White';
    END CASE;

    -- ============================================
    -- Generate clinical data based on category
    -- ============================================

    CASE v_patient_category

      -- LOW/MODERATE RISK NON-CKD
      WHEN 'low_moderate_non_ckd' THEN
        -- Mostly healthy, few risk factors
        v_has_diabetes := (random() < 0.10); -- 10% have diabetes
        v_has_hypertension := (random() < 0.25); -- 25% have HTN
        v_has_cvd := (random() < 0.05); -- 5% have CVD
        v_has_heart_failure := false;
        v_history_aki := false;
        v_family_history_esrd := (random() < 0.05);

        -- Normal/near-normal labs
        v_egfr := 75 + (random() * 35); -- eGFR 75-110
        v_uacr := random() * 25; -- uACR 0-25 (A1)
        v_creatinine := 0.7 + (random() * 0.5); -- Creatinine 0.7-1.2
        v_bun := 8 + (random() * 12); -- BUN 8-20
        v_egfr_decline := -0.5 + (random() * 1.5); -- Stable or minimal decline

        v_ckd_stage := 0;
        v_ckd_severity := null;

        -- Medications
        v_on_ras_inhibitor := v_has_hypertension AND (random() < 0.30);
        v_on_sglt2i := false;
        v_on_nephrotoxic := (random() < 0.10);

      -- HIGH RISK NON-CKD
      WHEN 'high_risk_non_ckd' THEN
        -- Multiple risk factors, borderline labs
        v_has_diabetes := (random() < 0.45); -- 45% have diabetes
        v_has_hypertension := (random() < 0.70); -- 70% have HTN
        v_has_cvd := (random() < 0.25); -- 25% have CVD
        v_has_heart_failure := (random() < 0.10);
        v_history_aki := (random() < 0.15);
        v_family_history_esrd := (random() < 0.20);

        -- Borderline labs, high uACR but preserved eGFR
        v_egfr := 65 + (random() * 30); -- eGFR 65-95 (G1-G2)
        v_uacr := 30 + (random() * 350); -- uACR 30-380 (A2-A3)
        v_creatinine := 0.9 + (random() * 0.6); -- Creatinine 0.9-1.5
        v_bun := 12 + (random() * 18); -- BUN 12-30
        v_egfr_decline := -1.0 + (random() * 2.5); -- Some showing decline

        v_ckd_stage := 0;
        v_ckd_severity := null;

        -- Higher medication use
        v_on_ras_inhibitor := v_has_hypertension AND (random() < 0.60);
        v_on_sglt2i := v_has_diabetes AND (random() < 0.25);
        v_on_nephrotoxic := (random() < 0.20);

      -- MILD CKD (Stages 1-2)
      WHEN 'mild_ckd' THEN
        -- Stage 1: eGFR ≥90 + albuminuria
        -- Stage 2: eGFR 60-89 + albuminuria
        v_has_diabetes := (random() < 0.50);
        v_has_hypertension := (random() < 0.75);
        v_has_cvd := (random() < 0.20);
        v_has_heart_failure := (random() < 0.05);
        v_history_aki := (random() < 0.20);
        v_family_history_esrd := (random() < 0.25);

        IF v_ckd_stage = 1 THEN
          v_egfr := 90 + (random() * 20); -- eGFR 90-110
          v_uacr := 30 + (random() * 200); -- uACR 30-230 (A2-A3)
        ELSE -- Stage 2
          v_egfr := 60 + (random() * 29); -- eGFR 60-89
          v_uacr := 30 + (random() * 250); -- uACR 30-280 (A2-A3)
        END IF;

        v_creatinine := 1.0 + (random() * 0.7); -- Creatinine 1.0-1.7
        v_bun := 15 + (random() * 15); -- BUN 15-30
        v_egfr_decline := -0.5 + (random() * 3.0); -- -0.5 to -3.5 ml/min/year
        v_ckd_severity := 'mild';

        v_on_ras_inhibitor := (random() < 0.75);
        v_on_sglt2i := v_has_diabetes AND (random() < 0.40);
        v_on_nephrotoxic := (random() < 0.15);

      -- MODERATE CKD (Stage 3)
      WHEN 'moderate_ckd' THEN
        v_has_diabetes := (random() < 0.60);
        v_has_hypertension := (random() < 0.85);
        v_has_cvd := (random() < 0.35);
        v_has_heart_failure := (random() < 0.15);
        v_history_aki := (random() < 0.30);
        v_family_history_esrd := (random() < 0.30);

        -- Stage 3a or 3b
        IF random() < 0.6 THEN
          v_egfr := 45 + (random() * 14); -- eGFR 45-59 (G3a)
          v_gfr_category := 'G3a';
        ELSE
          v_egfr := 30 + (random() * 14); -- eGFR 30-44 (G3b)
          v_gfr_category := 'G3b';
        END IF;

        v_uacr := 15 + (random() * 500); -- uACR 15-515 (A1-A3)
        v_creatinine := 1.3 + (random() * 1.2); -- Creatinine 1.3-2.5
        v_bun := 20 + (random() * 30); -- BUN 20-50
        v_egfr_decline := -1.5 + (random() * 4.5); -- -1.5 to -6.0 ml/min/year
        v_ckd_severity := 'moderate';

        v_on_ras_inhibitor := (random() < 0.85);
        v_on_sglt2i := v_has_diabetes AND (random() < 0.60);
        v_on_nephrotoxic := (random() < 0.10);

      -- SEVERE CKD (Stage 4)
      WHEN 'severe_ckd' THEN
        v_has_diabetes := (random() < 0.70);
        v_has_hypertension := (random() < 0.95);
        v_has_cvd := (random() < 0.50);
        v_has_heart_failure := (random() < 0.30);
        v_history_aki := (random() < 0.50);
        v_family_history_esrd := (random() < 0.35);

        v_egfr := 15 + (random() * 14); -- eGFR 15-29 (G4)
        v_uacr := 100 + (random() * 1400); -- uACR 100-1500 (A2-A3)
        v_creatinine := 2.5 + (random() * 2.5); -- Creatinine 2.5-5.0
        v_bun := 40 + (random() * 60); -- BUN 40-100
        v_egfr_decline := -3.0 + (random() * 5.0); -- -3.0 to -8.0 ml/min/year
        v_ckd_severity := 'severe';
        v_gfr_category := 'G4';

        v_on_ras_inhibitor := (random() < 0.90);
        v_on_sglt2i := v_has_diabetes AND (random() < 0.70);
        v_on_nephrotoxic := false; -- Avoid in severe CKD

      -- KIDNEY FAILURE (Stage 5)
      WHEN 'kidney_failure' THEN
        v_has_diabetes := (random() < 0.75);
        v_has_hypertension := true; -- Almost all have HTN
        v_has_cvd := (random() < 0.60);
        v_has_heart_failure := (random() < 0.40);
        v_history_aki := (random() < 0.60);
        v_family_history_esrd := (random() < 0.40);

        v_egfr := 5 + (random() * 9); -- eGFR 5-14 (G5)
        v_uacr := 300 + (random() * 2200); -- uACR 300-2500 (A3)
        v_creatinine := 5.0 + (random() * 5.0); -- Creatinine 5.0-10.0
        v_bun := 80 + (random() * 100); -- BUN 80-180
        v_egfr_decline := -5.0 + (random() * 5.0); -- Severe decline
        v_ckd_severity := 'kidney_failure';
        v_gfr_category := 'G5';

        v_on_ras_inhibitor := (random() < 0.80);
        v_on_sglt2i := false; -- Not used in Stage 5
        v_on_nephrotoxic := false;
    END CASE;

    -- ============================================
    -- Additional clinical variables
    -- ============================================

    -- Diabetes details
    IF v_has_diabetes THEN
      v_diabetes_type := CASE WHEN random() < 0.90 THEN 'Type 2' ELSE 'Type 1' END;
      v_diabetes_duration := floor(random() * 20)::integer + 1;
      v_diabetes_controlled := (random() < 0.65);
      v_hba1c := CASE
        WHEN v_diabetes_controlled THEN 5.7 + (random() * 1.5) -- 5.7-7.2
        ELSE 7.5 + (random() * 3.5) -- 7.5-11.0
      END;
    ELSE
      v_diabetes_type := null;
      v_diabetes_duration := null;
      v_diabetes_controlled := null;
      v_hba1c := 4.5 + (random() * 1.2); -- Non-diabetic range
    END IF;

    -- Hypertension control
    IF v_has_hypertension THEN
      v_htn_controlled := (random() < 0.70);
      IF v_htn_controlled THEN
        v_systolic := 110 + floor(random() * 30)::integer; -- 110-139
        v_diastolic := 65 + floor(random() * 25)::integer; -- 65-89
      ELSE
        v_systolic := 140 + floor(random() * 40)::integer; -- 140-179
        v_diastolic := 85 + floor(random() * 30)::integer; -- 85-114
      END IF;
    ELSE
      v_htn_controlled := null;
      v_systolic := 100 + floor(random() * 30)::integer; -- 100-129
      v_diastolic := 60 + floor(random() * 20)::integer; -- 60-79
    END IF;

    -- Smoking
    v_smoking := CASE
      WHEN random() < 0.55 THEN 'Never'
      WHEN random() < 0.80 THEN 'Former'
      ELSE 'Current'
    END;

    IF v_smoking IN ('Former', 'Current') THEN
      v_pack_years := random() * 40;
    ELSE
      v_pack_years := 0;
    END IF;

    -- Calculate KDIGO classification for all patients
    IF v_egfr >= 90 THEN
      v_gfr_category := 'G1';
    ELSIF v_egfr >= 60 THEN
      v_gfr_category := 'G2';
    ELSIF v_egfr >= 45 THEN
      v_gfr_category := 'G3a';
    ELSIF v_egfr >= 30 THEN
      v_gfr_category := 'G3b';
    ELSIF v_egfr >= 15 THEN
      v_gfr_category := 'G4';
    ELSE
      v_gfr_category := 'G5';
    END IF;

    IF v_uacr < 30 THEN
      v_alb_category := 'A1';
    ELSIF v_uacr <= 300 THEN
      v_alb_category := 'A2';
    ELSE
      v_alb_category := 'A3';
    END IF;

    v_health_state := v_gfr_category || '-' || v_alb_category;

    -- Determine KDIGO risk level
    IF v_gfr_category IN ('G4', 'G5') OR
       (v_gfr_category = 'G3b' AND v_alb_category IN ('A2', 'A3')) OR
       (v_gfr_category = 'G3a' AND v_alb_category = 'A3') THEN
      v_kdigo_risk := 'very_high';
    ELSIF v_gfr_category = 'G3b' OR
          (v_gfr_category = 'G3a' AND v_alb_category = 'A2') OR
          (v_gfr_category IN ('G1', 'G2') AND v_alb_category = 'A3') THEN
      v_kdigo_risk := 'high';
    ELSIF v_gfr_category = 'G3a' OR
          (v_gfr_category IN ('G1', 'G2') AND v_alb_category = 'A2') THEN
      v_kdigo_risk := 'moderate';
    ELSE
      v_kdigo_risk := 'low';
    END IF;

    -- Monitoring device for monitored patients
    IF v_is_monitored THEN
      v_monitoring_device := 'Minuteful Kidney';
      v_monitoring_frequency := CASE v_kdigo_risk
        WHEN 'very_high' THEN 'monthly'
        WHEN 'high' THEN 'quarterly'
        WHEN 'moderate' THEN 'biannually'
        ELSE 'annually'
      END;
    ELSE
      v_monitoring_device := null;
      v_monitoring_frequency := null;
    END IF;

    -- Determine risk category label
    IF NOT v_has_ckd THEN
      v_risk_category := CASE v_kdigo_risk
        WHEN 'low', 'moderate' THEN
          CASE WHEN v_patient_category = 'low_moderate_non_ckd' THEN 'Low Risk' ELSE 'Moderate Risk' END
        ELSE 'High Risk'
      END;
    ELSE
      v_risk_category := CASE v_ckd_severity
        WHEN 'mild' THEN 'Mild CKD'
        WHEN 'moderate' THEN 'Moderate CKD'
        WHEN 'severe' THEN 'Severe CKD'
        WHEN 'kidney_failure' THEN 'Kidney Failure'
        ELSE 'Unknown'
      END;
    END IF;

    -- ============================================
    -- Insert patient record
    -- ============================================

    INSERT INTO patients (
      id, medical_record_number, first_name, last_name,
      date_of_birth, gender, phone, email,
      address, city, state, zip_code,
      weight, height, bmi,
      smoking_status, cvd_history, family_history_esrd,
      ckd_diagnosis, ckd_diagnosis_date, ckd_stage,
      treatment_status, monitoring_status,
      monitoring_device, monitoring_frequency,
      risk_priority, ethnicity, race
    ) VALUES (
      v_patient_id,
      'MRN-' || lpad(i::text, 6, '0'),
      v_first_name,
      v_last_name,
      CURRENT_DATE - (v_age * 365 + floor(random() * 365)::integer),
      v_gender,
      '555-' || lpad(floor(random() * 10000000)::text, 7, '0'),
      lower(v_first_name) || '.' || lower(v_last_name) || '@email.com',
      floor(random() * 9999)::text || ' ' || (ARRAY['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Park Blvd'])[1 + floor(random() * 5)::integer],
      (ARRAY['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'])[1 + floor(random() * 10)::integer],
      (ARRAY['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA'])[1 + floor(random() * 10)::integer],
      lpad(floor(random() * 100000)::text, 5, '0'),
      v_weight,
      v_height,
      v_bmi,
      v_smoking,
      v_has_cvd,
      v_family_history_esrd,
      v_has_ckd,
      CASE WHEN v_has_ckd THEN CURRENT_DATE - floor(random() * 1095)::integer ELSE null END,
      CASE WHEN v_has_ckd THEN v_ckd_stage ELSE null END,
      CASE WHEN v_is_treated THEN 'on_treatment' ELSE 'not_treated' END,
      CASE WHEN v_is_monitored THEN 'active' ELSE 'not_monitored' END,
      v_monitoring_device,
      v_monitoring_frequency,
      v_risk_category,
      v_ethnicity,
      v_race
    );

    -- ============================================
    -- Insert observations (lab results)
    -- ============================================

    -- Recent labs (within last 3 months)
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES
      (v_patient_id, 'eGFR', v_egfr, 'mL/min/1.73m²', CURRENT_DATE - floor(random() * 90)::integer, 'final'),
      (v_patient_id, 'uACR', v_uacr, 'mg/g', CURRENT_DATE - floor(random() * 90)::integer, 'final'),
      (v_patient_id, 'Creatinine', v_creatinine, 'mg/dL', CURRENT_DATE - floor(random() * 90)::integer, 'final'),
      (v_patient_id, 'BUN', v_bun, 'mg/dL', CURRENT_DATE - floor(random() * 90)::integer, 'final'),
      (v_patient_id, 'BP_Systolic', v_systolic, 'mmHg', CURRENT_DATE - floor(random() * 30)::integer, 'final'),
      (v_patient_id, 'BP_Diastolic', v_diastolic, 'mmHg', CURRENT_DATE - floor(random() * 30)::integer, 'final');

    IF v_has_diabetes THEN
      INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
      VALUES (v_patient_id, 'HbA1c', v_hba1c, '%', CURRENT_DATE - floor(random() * 90)::integer, 'final');
    END IF;

    -- Historical labs (6-24 months ago) for trajectory calculation
    FOR j IN 1..4 LOOP
      INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
      VALUES (
        v_patient_id,
        'eGFR',
        v_egfr + (v_egfr_decline * -1 * (j * 0.25)) + (random() * 3 - 1.5), -- Add trend + noise
        'mL/min/1.73m²',
        CURRENT_DATE - (90 * j + floor(random() * 60)::integer)::integer,
        'final'
      );
    END LOOP;

    -- ============================================
    -- Insert conditions
    -- ============================================

    IF v_has_diabetes THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date)
      VALUES (v_patient_id, 'E11.9', v_diabetes_type || ' Diabetes Mellitus', 'active', CURRENT_DATE - (v_diabetes_duration * 365)::integer);
    END IF;

    IF v_has_hypertension THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date)
      VALUES (v_patient_id, 'I10', 'Essential Hypertension', 'active', CURRENT_DATE - floor(random() * 3650)::integer);
    END IF;

    IF v_has_cvd THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date)
      VALUES (v_patient_id, 'I25.10', 'Coronary Artery Disease', 'active', CURRENT_DATE - floor(random() * 2555)::integer);
    END IF;

    IF v_has_ckd THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, severity, onset_date)
      VALUES (
        v_patient_id,
        'N18.' || v_ckd_stage,
        'Chronic Kidney Disease Stage ' || v_ckd_stage,
        'active',
        v_ckd_severity,
        CURRENT_DATE - floor(random() * 1095)::integer
      );
    END IF;

    -- ============================================
    -- Insert risk factors
    -- ============================================

    INSERT INTO patient_risk_factors (
      patient_id,
      current_egfr, current_uacr,
      egfr_decline_rate, egfr_trend,
      hba1c,
      has_diabetes, diabetes_type, diabetes_duration_years, diabetes_controlled,
      has_hypertension, hypertension_controlled,
      average_bp_systolic, average_bp_diastolic,
      has_cvd, has_heart_failure,
      has_obesity, current_bmi,
      history_of_aki, aki_episodes_count,
      family_history_ckd, family_history_esrd,
      smoking_status, pack_years,
      chronic_nsaid_use,
      on_ras_inhibitor, on_sglt2i,
      last_assessment_date
    ) VALUES (
      v_patient_id,
      v_egfr, v_uacr,
      v_egfr_decline,
      CASE
        WHEN v_egfr_decline > 0 THEN 'improving'
        WHEN v_egfr_decline > -3 THEN 'stable'
        WHEN v_egfr_decline > -5 THEN 'slow_decline'
        ELSE 'rapid_decline'
      END,
      v_hba1c,
      v_has_diabetes, v_diabetes_type, v_diabetes_duration, v_diabetes_controlled,
      v_has_hypertension, v_htn_controlled,
      v_systolic, v_diastolic,
      v_has_cvd, v_has_heart_failure,
      v_has_obesity, v_bmi,
      v_history_aki, CASE WHEN v_history_aki THEN floor(random() * 3)::integer + 1 ELSE 0 END,
      v_family_history_esrd, v_family_history_esrd,
      v_smoking, v_pack_years,
      v_on_nephrotoxic,
      v_on_ras_inhibitor, v_on_sglt2i,
      CURRENT_DATE
    );

    -- ============================================
    -- Insert CKD/Non-CKD specific data
    -- ============================================

    IF v_has_ckd THEN
      INSERT INTO ckd_patient_data (
        patient_id,
        kdigo_gfr_category,
        kdigo_albuminuria_category,
        kdigo_health_state,
        severity,
        monitoring_device,
        monitoring_frequency,
        treatment_status
      ) VALUES (
        v_patient_id,
        v_gfr_category,
        v_alb_category,
        v_health_state,
        v_ckd_severity,
        v_monitoring_device,
        v_monitoring_frequency,
        CASE WHEN v_is_treated THEN 'on_treatment' ELSE 'not_treated' END
      );
    ELSE
      INSERT INTO non_ckd_patient_data (
        patient_id,
        risk_level,
        kdigo_health_state,
        monitoring_status
      ) VALUES (
        v_patient_id,
        CASE v_patient_category
          WHEN 'low_moderate_non_ckd' THEN
            CASE WHEN random() < 0.5 THEN 'low' ELSE 'moderate' END
          ELSE 'high'
        END,
        v_health_state,
        CASE WHEN v_is_monitored THEN 'active' ELSE 'not_monitored' END
      );
    END IF;

  END LOOP;

  RAISE NOTICE 'Successfully generated 1000 patients with real-world prevalence distribution';

END $$;

-- ============================================
-- Calculate risk scores for all patients
-- ============================================

DO $$
DECLARE
  v_patient RECORD;
  v_risk_score DECIMAL;
  v_risk_tier TEXT;
BEGIN
  FOR v_patient IN SELECT id FROM patients WHERE medical_record_number LIKE 'MRN-%' LOOP
    -- Calculate risk score
    SELECT calculate_ckd_risk_score(v_patient.id) INTO v_risk_score;
    SELECT get_risk_tier(v_risk_score) INTO v_risk_tier;

    -- Update risk factors
    UPDATE patient_risk_factors
    SET
      risk_score = v_risk_score,
      risk_tier = v_risk_tier,
      next_assessment_due = CASE
        WHEN v_risk_tier = 'very_high' THEN CURRENT_DATE + INTERVAL '1 month'
        WHEN v_risk_tier = 'high' THEN CURRENT_DATE + INTERVAL '3 months'
        WHEN v_risk_tier = 'moderate' THEN CURRENT_DATE + INTERVAL '6 months'
        ELSE CURRENT_DATE + INTERVAL '12 months'
      END
    WHERE patient_id = v_patient.id;
  END LOOP;

  RAISE NOTICE 'Risk scores calculated for all patients';
END $$;

-- ============================================
-- Verification Query
-- ============================================

SELECT
  'Real-World Prevalence Distribution Verification' as report_title;

SELECT
  CASE
    WHEN nckd.risk_level IN ('low', 'moderate') THEN 'Low/Moderate Risk Non-CKD'
    WHEN nckd.risk_level = 'high' THEN 'High Risk Non-CKD'
    WHEN ckd.severity = 'mild' THEN 'Mild CKD (Stages 1-2)'
    WHEN ckd.severity = 'moderate' THEN 'Moderate CKD (Stage 3)'
    WHEN ckd.severity = 'severe' THEN 'Severe CKD (Stage 4)'
    WHEN ckd.severity = 'kidney_failure' THEN 'Kidney Failure (Stage 5)'
    ELSE 'Other'
  END as category,
  COUNT(*) as patient_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM patients WHERE medical_record_number LIKE 'MRN-%'), 2) as percentage,
  COUNT(CASE WHEN p.monitoring_status = 'active' THEN 1 END) as monitored_count,
  ROUND(COUNT(CASE WHEN p.monitoring_status = 'active' THEN 1 END) * 100.0 / COUNT(*), 1) as percent_monitored,
  COUNT(CASE WHEN p.treatment_status = 'on_treatment' THEN 1 END) as treated_count,
  ROUND(COUNT(CASE WHEN p.treatment_status = 'on_treatment' THEN 1 END) * 100.0 / COUNT(*), 1) as percent_treated
FROM patients p
LEFT JOIN ckd_patient_data ckd ON p.id = ckd.patient_id
LEFT JOIN non_ckd_patient_data nckd ON p.id = nckd.patient_id
WHERE p.medical_record_number LIKE 'MRN-%'
GROUP BY category
ORDER BY
  CASE category
    WHEN 'Low/Moderate Risk Non-CKD' THEN 1
    WHEN 'High Risk Non-CKD' THEN 2
    WHEN 'Mild CKD (Stages 1-2)' THEN 3
    WHEN 'Moderate CKD (Stage 3)' THEN 4
    WHEN 'Severe CKD (Stage 4)' THEN 5
    WHEN 'Kidney Failure (Stage 5)' THEN 6
    ELSE 7
  END;

-- ============================================
-- Migration Complete
-- ============================================

SELECT 'Migration 010: Patient distribution adjusted to real-world prevalence' AS status;
SELECT 'Total patients: 1000' AS info;
