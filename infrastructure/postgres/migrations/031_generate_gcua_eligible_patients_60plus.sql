-- ============================================
-- Migration 031: Generate GCUA-Eligible Patients (Age 60+)
-- ============================================
-- This migration generates a comprehensive patient population for GCUA assessment:
-- - Ages 60+ (GCUA eligibility requirement)
-- - All demographic, clinical, and risk factor fields populated
-- - Realistic lab values and medication profiles
-- - Proper KDIGO classification alignment
-- ============================================

-- ============================================
-- STEP 1: Clear existing mock patients (optional - comment out to keep existing)
-- ============================================
DO $$
BEGIN
  -- Delete related records first due to foreign keys
  DELETE FROM patient_gcua_assessments WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN%'
  );

  DELETE FROM patient_medications WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN%'
  );

  DELETE FROM observations WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN%'
  );

  DELETE FROM conditions WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN%'
  );

  DELETE FROM patient_risk_factors WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN%'
  );

  DELETE FROM ckd_patient_data WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN%'
  );

  DELETE FROM non_ckd_patient_data WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN%'
  );

  DELETE FROM patient_health_state_comments WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN%'
  );

  DELETE FROM risk_assessments WHERE patient_id IN (
    SELECT id FROM patients WHERE medical_record_number LIKE 'MRN%'
  );

  -- Finally delete patients
  DELETE FROM patients WHERE medical_record_number LIKE 'MRN%';

  RAISE NOTICE 'Cleared existing mock patients';
END $$;

-- ============================================
-- STEP 2: Generate 1000 patients (Age 60+)
-- ============================================

DO $$
DECLARE
  v_patient_id UUID;
  v_mrn TEXT;
  v_age INTEGER;
  v_dob DATE;
  v_gender TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_ethnicity TEXT;
  v_race TEXT;

  -- Physical
  v_weight DECIMAL;
  v_height INTEGER;
  v_bmi DECIMAL;
  v_has_obesity BOOLEAN;

  -- Clinical flags
  v_has_diabetes BOOLEAN;
  v_diabetes_type TEXT;
  v_diabetes_duration INTEGER;
  v_diabetes_controlled BOOLEAN;
  v_hba1c DECIMAL;

  v_has_hypertension BOOLEAN;
  v_htn_controlled BOOLEAN;
  v_systolic INTEGER;
  v_diastolic INTEGER;

  v_has_cvd BOOLEAN;
  v_has_heart_failure BOOLEAN;
  v_has_coronary_artery_disease BOOLEAN;
  v_has_stroke_history BOOLEAN;
  v_has_peripheral_vascular_disease BOOLEAN;
  v_has_atrial_fibrillation BOOLEAN;

  -- Kidney-related
  v_has_autoimmune_disease BOOLEAN;
  v_autoimmune_type TEXT;
  v_has_recurrent_uti BOOLEAN;
  v_has_kidney_stones BOOLEAN;
  v_has_gout BOOLEAN;
  v_has_pkd BOOLEAN;
  v_has_metabolic_syndrome BOOLEAN;

  -- AKI History
  v_history_aki BOOLEAN;
  v_aki_episodes INTEGER;
  v_aki_severity TEXT;

  -- Family history
  v_family_history_ckd BOOLEAN;
  v_family_history_esrd BOOLEAN;
  v_family_history_diabetes BOOLEAN;
  v_family_history_hypertension BOOLEAN;
  v_family_history_pkd BOOLEAN;

  -- Lifestyle
  v_smoking_status TEXT;
  v_pack_years DECIMAL;
  v_quit_date DATE;
  v_physical_activity TEXT;
  v_exercise_minutes INTEGER;
  v_dietary_sodium TEXT;
  v_dietary_protein TEXT;
  v_fruit_veg_servings INTEGER;

  -- Medications
  v_on_ras_inhibitor BOOLEAN;
  v_on_sglt2i BOOLEAN;
  v_on_statin BOOLEAN;
  v_chronic_nsaid BOOLEAN;
  v_nsaid_months INTEGER;
  v_ppi_use BOOLEAN;
  v_ppi_months INTEGER;
  v_on_calcineurin BOOLEAN;
  v_on_lithium BOOLEAN;
  v_nephrotoxic_meds BOOLEAN;

  -- Lab values
  v_egfr DECIMAL;
  v_uacr DECIMAL;
  v_creatinine DECIMAL;
  v_bun DECIMAL;
  v_uric_acid DECIMAL;
  v_hemoglobin DECIMAL;
  v_potassium DECIMAL;
  v_calcium DECIMAL;
  v_phosphorus DECIMAL;
  v_albumin DECIMAL;
  v_ldl DECIMAL;
  v_hdl DECIMAL;
  v_triglycerides DECIMAL;

  -- eGFR trajectory
  v_egfr_decline DECIMAL;
  v_egfr_trend TEXT;

  -- CKD Classification
  v_has_ckd BOOLEAN;
  v_ckd_stage INTEGER;
  v_ckd_severity TEXT;
  v_gfr_category TEXT;
  v_alb_category TEXT;
  v_health_state TEXT;
  v_kdigo_risk TEXT;

  -- Patient category
  v_patient_category TEXT;
  v_is_monitored BOOLEAN;
  v_is_treated BOOLEAN;
  v_monitoring_device TEXT;
  v_monitoring_frequency TEXT;

  -- Risk scores
  v_risk_score DECIMAL;
  v_risk_tier TEXT;

  -- Name arrays
  first_names_male TEXT[] := ARRAY['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Donald', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Raymond', 'Gregory', 'Alexander', 'Frank', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Carl', 'Keith', 'Douglas', 'Terry', 'Gerald', 'Harold', 'Sean', 'Austin', 'Jose', 'Eugene', 'Albert', 'Ralph', 'Roy', 'Louis', 'Russell', 'Vincent', 'Philip', 'Bobby', 'Johnny', 'Bradley', 'Henry', 'Walter', 'Arthur', 'Fred', 'Lawrence', 'Roger', 'Joe', 'Peter', 'Howard', 'Wayne', 'Harry'];

  first_names_female TEXT[] := ARRAY['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Dorothy', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen', 'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine', 'Maria', 'Heather', 'Diane', 'Ruth', 'Julie', 'Joyce', 'Virginia', 'Victoria', 'Kelly', 'Lauren', 'Christina', 'Joan', 'Evelyn', 'Judith', 'Megan', 'Andrea', 'Cheryl', 'Hannah', 'Jacqueline', 'Martha', 'Gloria', 'Teresa', 'Ann', 'Sara', 'Madison', 'Frances', 'Kathryn', 'Janice', 'Jean', 'Abigail', 'Alice', 'Judy'];

  last_names TEXT[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson'];

  ethnicities TEXT[] := ARRAY['Caucasian', 'African American', 'Hispanic', 'Asian', 'Native American', 'Pacific Islander', 'Middle Eastern', 'Mixed'];

  monitoring_devices TEXT[] := ARRAY['Minuteful Kidney Kit', 'Healthy.io ACR Test', 'ScanWell Health', 'Dip.io Home Test', NULL];

BEGIN
  -- ============================================
  -- Generate 1000 patients
  -- ============================================
  FOR i IN 1..1000 LOOP
    v_patient_id := gen_random_uuid();
    v_mrn := 'MRN' || LPAD(i::TEXT, 6, '0');

    -- ============================================
    -- Determine patient category (distribution)
    -- ============================================
    IF i <= 250 THEN
      -- Low Risk Non-CKD: 25%
      v_patient_category := 'low_risk_non_ckd';
      v_has_ckd := false;
    ELSIF i <= 550 THEN
      -- Moderate Risk Non-CKD: 30%
      v_patient_category := 'moderate_risk_non_ckd';
      v_has_ckd := false;
    ELSIF i <= 700 THEN
      -- High Risk Non-CKD: 15%
      v_patient_category := 'high_risk_non_ckd';
      v_has_ckd := false;
    ELSIF i <= 780 THEN
      -- Mild CKD (Stage 1-2): 8%
      v_patient_category := 'mild_ckd';
      v_has_ckd := true;
    ELSIF i <= 950 THEN
      -- Moderate CKD (Stage 3): 17%
      v_patient_category := 'moderate_ckd';
      v_has_ckd := true;
    ELSIF i <= 985 THEN
      -- Severe CKD (Stage 4): 3.5%
      v_patient_category := 'severe_ckd';
      v_has_ckd := true;
    ELSE
      -- Kidney Failure (Stage 5): 1.5%
      v_patient_category := 'kidney_failure';
      v_has_ckd := true;
    END IF;

    -- ============================================
    -- Demographics (Age 60+)
    -- ============================================
    v_gender := CASE WHEN random() < 0.48 THEN 'male' ELSE 'female' END;

    -- Age distribution: 60-95, weighted toward 65-80
    v_age := CASE
      WHEN random() < 0.15 THEN 60 + floor(random() * 5)::INTEGER  -- 60-64: 15%
      WHEN random() < 0.50 THEN 65 + floor(random() * 10)::INTEGER -- 65-74: 35%
      WHEN random() < 0.85 THEN 75 + floor(random() * 10)::INTEGER -- 75-84: 35%
      ELSE 85 + floor(random() * 10)::INTEGER                      -- 85-94: 15%
    END;
    v_dob := CURRENT_DATE - (v_age * 365 + floor(random() * 365)::INTEGER);

    -- Height and weight (age-adjusted)
    v_height := CASE
      WHEN v_gender = 'male' THEN 165 + floor(random() * 20)::INTEGER - floor((v_age - 60) * 0.1)::INTEGER
      ELSE 152 + floor(random() * 18)::INTEGER - floor((v_age - 60) * 0.1)::INTEGER
    END;
    v_weight := CASE
      WHEN v_gender = 'male' THEN 65 + (random() * 45)
      ELSE 55 + (random() * 40)
    END;
    v_bmi := v_weight / ((v_height / 100.0) * (v_height / 100.0));
    v_has_obesity := v_bmi >= 30;

    -- Names
    v_first_name := CASE
      WHEN v_gender = 'male' THEN first_names_male[1 + floor(random() * array_length(first_names_male, 1))::INTEGER]
      ELSE first_names_female[1 + floor(random() * array_length(first_names_female, 1))::INTEGER]
    END;
    v_last_name := last_names[1 + floor(random() * array_length(last_names, 1))::INTEGER];

    -- Ethnicity (realistic US 60+ distribution using ranges)
    v_ethnicity := (
      SELECT CASE
        WHEN r < 12 THEN 'African American'      -- 12%
        WHEN r < 20 THEN 'Hispanic'               -- 8%
        WHEN r < 25 THEN 'Asian'                  -- 5%
        WHEN r = 25 THEN 'Native American'        -- 1%
        WHEN r = 26 THEN 'Pacific Islander'       -- 1%
        WHEN r < 29 THEN 'Mixed'                  -- 2%
        ELSE 'Caucasian'                          -- 71%
      END
      FROM (SELECT floor(random() * 100)::INTEGER AS r) AS rand_val
    );
    v_race := CASE v_ethnicity
      WHEN 'African American' THEN 'Black'
      WHEN 'Hispanic' THEN 'Hispanic/Latino'
      WHEN 'Asian' THEN 'Asian'
      WHEN 'Native American' THEN 'American Indian/Alaska Native'
      WHEN 'Pacific Islander' THEN 'Native Hawaiian/Pacific Islander'
      WHEN 'Mixed' THEN 'Two or More Races'
      ELSE 'White'
    END;

    -- ============================================
    -- Clinical variables based on category
    -- ============================================
    CASE v_patient_category
      -- LOW RISK NON-CKD
      WHEN 'low_risk_non_ckd' THEN
        v_has_diabetes := (random() < 0.12);
        v_has_hypertension := (random() < 0.35);
        v_has_cvd := (random() < 0.08);
        v_has_heart_failure := (random() < 0.03);
        v_has_coronary_artery_disease := (random() < 0.05);
        v_has_stroke_history := (random() < 0.02);
        v_has_peripheral_vascular_disease := (random() < 0.03);
        v_has_atrial_fibrillation := (random() < 0.05);
        v_history_aki := (random() < 0.02);
        v_family_history_esrd := (random() < 0.05);
        v_family_history_ckd := (random() < 0.08);

        -- Good kidney function
        v_egfr := 80 + (random() * 40); -- 80-120
        v_uacr := random() * 25; -- 0-25 (A1)
        v_creatinine := CASE WHEN v_gender = 'male' THEN 0.8 + (random() * 0.4) ELSE 0.6 + (random() * 0.3) END;
        v_egfr_decline := -0.5 + (random() * 1.0); -- Stable

        v_is_monitored := (random() < 0.05);
        v_is_treated := false;
        v_ckd_stage := NULL;
        v_ckd_severity := NULL;

      -- MODERATE RISK NON-CKD
      WHEN 'moderate_risk_non_ckd' THEN
        v_has_diabetes := (random() < 0.30);
        v_has_hypertension := (random() < 0.55);
        v_has_cvd := (random() < 0.15);
        v_has_heart_failure := (random() < 0.08);
        v_has_coronary_artery_disease := (random() < 0.12);
        v_has_stroke_history := (random() < 0.05);
        v_has_peripheral_vascular_disease := (random() < 0.08);
        v_has_atrial_fibrillation := (random() < 0.10);
        v_history_aki := (random() < 0.08);
        v_family_history_esrd := (random() < 0.12);
        v_family_history_ckd := (random() < 0.18);

        -- Moderate kidney function (still non-CKD)
        v_egfr := 70 + (random() * 35); -- 70-105
        v_uacr := 5 + (random() * 22); -- 5-27 (A1, borderline)
        v_creatinine := CASE WHEN v_gender = 'male' THEN 0.9 + (random() * 0.4) ELSE 0.7 + (random() * 0.35) END;
        v_egfr_decline := -1.0 + (random() * 1.5);

        v_is_monitored := (random() < 0.20);
        v_is_treated := false;
        v_ckd_stage := NULL;
        v_ckd_severity := NULL;

      -- HIGH RISK NON-CKD
      WHEN 'high_risk_non_ckd' THEN
        v_has_diabetes := (random() < 0.50);
        v_has_hypertension := (random() < 0.75);
        v_has_cvd := (random() < 0.30);
        v_has_heart_failure := (random() < 0.15);
        v_has_coronary_artery_disease := (random() < 0.22);
        v_has_stroke_history := (random() < 0.10);
        v_has_peripheral_vascular_disease := (random() < 0.15);
        v_has_atrial_fibrillation := (random() < 0.18);
        v_history_aki := (random() < 0.18);
        v_family_history_esrd := (random() < 0.22);
        v_family_history_ckd := (random() < 0.28);

        -- Borderline kidney function, some have proteinuria
        v_egfr := 62 + (random() * 35); -- 62-97 (G1-G2)
        -- Some have microalbuminuria (A2) but preserved eGFR = high risk non-CKD
        v_uacr := CASE WHEN random() < 0.40 THEN 30 + (random() * 200) ELSE random() * 28 END;
        v_creatinine := CASE WHEN v_gender = 'male' THEN 1.0 + (random() * 0.5) ELSE 0.8 + (random() * 0.4) END;
        v_egfr_decline := -1.5 + (random() * 2.5);

        v_is_monitored := (random() < 0.55);
        v_is_treated := false;
        v_ckd_stage := NULL;
        v_ckd_severity := NULL;

      -- MILD CKD (Stage 1-2)
      WHEN 'mild_ckd' THEN
        v_has_diabetes := (random() < 0.55);
        v_has_hypertension := (random() < 0.80);
        v_has_cvd := (random() < 0.25);
        v_has_heart_failure := (random() < 0.12);
        v_has_coronary_artery_disease := (random() < 0.18);
        v_has_stroke_history := (random() < 0.08);
        v_has_peripheral_vascular_disease := (random() < 0.12);
        v_has_atrial_fibrillation := (random() < 0.15);
        v_history_aki := (random() < 0.22);
        v_family_history_esrd := (random() < 0.28);
        v_family_history_ckd := (random() < 0.35);

        -- CKD Stage 1 or 2 (requires damage marker)
        IF random() < 0.4 THEN
          -- Stage 1: eGFR ≥90 + albuminuria
          v_egfr := 90 + (random() * 25);
          v_ckd_stage := 1;
        ELSE
          -- Stage 2: eGFR 60-89 + albuminuria
          v_egfr := 60 + (random() * 29);
          v_ckd_stage := 2;
        END IF;
        v_uacr := 30 + (random() * 270); -- A2-A3 (required for CKD diagnosis)
        v_creatinine := CASE WHEN v_gender = 'male' THEN 1.0 + (random() * 0.6) ELSE 0.8 + (random() * 0.5) END;
        v_egfr_decline := -1.0 + (random() * 3.0);
        v_ckd_severity := 'mild';

        v_is_monitored := (random() < 0.85);
        v_is_treated := (random() < 0.75);

      -- MODERATE CKD (Stage 3a/3b)
      WHEN 'moderate_ckd' THEN
        v_has_diabetes := (random() < 0.65);
        v_has_hypertension := (random() < 0.90);
        v_has_cvd := (random() < 0.40);
        v_has_heart_failure := (random() < 0.20);
        v_has_coronary_artery_disease := (random() < 0.28);
        v_has_stroke_history := (random() < 0.12);
        v_has_peripheral_vascular_disease := (random() < 0.18);
        v_has_atrial_fibrillation := (random() < 0.22);
        v_history_aki := (random() < 0.32);
        v_family_history_esrd := (random() < 0.32);
        v_family_history_ckd := (random() < 0.40);

        -- Stage 3a or 3b
        IF random() < 0.55 THEN
          v_egfr := 45 + (random() * 14); -- G3a: 45-59
          v_ckd_stage := 3;
        ELSE
          v_egfr := 30 + (random() * 14); -- G3b: 30-44
          v_ckd_stage := 3;
        END IF;
        v_uacr := 20 + (random() * 480); -- Variable albuminuria
        v_creatinine := CASE WHEN v_gender = 'male' THEN 1.4 + (random() * 1.0) ELSE 1.1 + (random() * 0.8) END;
        v_egfr_decline := -2.0 + (random() * 4.0);
        v_ckd_severity := 'moderate';

        v_is_monitored := (random() < 0.92);
        v_is_treated := (random() < 0.85);

      -- SEVERE CKD (Stage 4)
      WHEN 'severe_ckd' THEN
        v_has_diabetes := (random() < 0.72);
        v_has_hypertension := (random() < 0.95);
        v_has_cvd := (random() < 0.55);
        v_has_heart_failure := (random() < 0.32);
        v_has_coronary_artery_disease := (random() < 0.38);
        v_has_stroke_history := (random() < 0.18);
        v_has_peripheral_vascular_disease := (random() < 0.25);
        v_has_atrial_fibrillation := (random() < 0.28);
        v_history_aki := (random() < 0.48);
        v_family_history_esrd := (random() < 0.38);
        v_family_history_ckd := (random() < 0.45);

        v_egfr := 15 + (random() * 14); -- G4: 15-29
        v_uacr := 150 + (random() * 1350); -- Usually significant proteinuria
        v_creatinine := CASE WHEN v_gender = 'male' THEN 2.5 + (random() * 2.0) ELSE 2.0 + (random() * 1.8) END;
        v_egfr_decline := -3.5 + (random() * 5.0);
        v_ckd_stage := 4;
        v_ckd_severity := 'severe';

        v_is_monitored := (random() < 0.98);
        v_is_treated := (random() < 0.92);

      -- KIDNEY FAILURE (Stage 5)
      WHEN 'kidney_failure' THEN
        v_has_diabetes := (random() < 0.78);
        v_has_hypertension := true;
        v_has_cvd := (random() < 0.65);
        v_has_heart_failure := (random() < 0.42);
        v_has_coronary_artery_disease := (random() < 0.45);
        v_has_stroke_history := (random() < 0.22);
        v_has_peripheral_vascular_disease := (random() < 0.32);
        v_has_atrial_fibrillation := (random() < 0.35);
        v_history_aki := (random() < 0.60);
        v_family_history_esrd := (random() < 0.42);
        v_family_history_ckd := (random() < 0.50);

        v_egfr := 5 + (random() * 9); -- G5: <15
        v_uacr := 400 + (random() * 2100); -- Severe proteinuria
        v_creatinine := CASE WHEN v_gender = 'male' THEN 5.0 + (random() * 4.0) ELSE 4.0 + (random() * 3.5) END;
        v_egfr_decline := -5.0 + (random() * 5.0);
        v_ckd_stage := 5;
        v_ckd_severity := 'kidney_failure';

        v_is_monitored := true;
        v_is_treated := (random() < 0.95);
    END CASE;

    -- ============================================
    -- Diabetes details
    -- ============================================
    IF v_has_diabetes THEN
      v_diabetes_type := CASE WHEN random() < 0.92 THEN 'Type 2' ELSE 'Type 1' END;
      v_diabetes_duration := floor(random() * 25)::INTEGER + 1;
      v_diabetes_controlled := (random() < 0.60);
      v_hba1c := CASE
        WHEN v_diabetes_controlled THEN 5.8 + (random() * 1.3) -- 5.8-7.1%
        ELSE 7.5 + (random() * 4.0) -- 7.5-11.5%
      END;
    ELSE
      v_diabetes_type := NULL;
      v_diabetes_duration := NULL;
      v_diabetes_controlled := NULL;
      v_hba1c := 4.8 + (random() * 0.9); -- Non-diabetic: 4.8-5.7%
    END IF;

    -- ============================================
    -- Hypertension details
    -- ============================================
    IF v_has_hypertension THEN
      v_htn_controlled := (random() < 0.65);
      IF v_htn_controlled THEN
        v_systolic := 115 + floor(random() * 25)::INTEGER;
        v_diastolic := 68 + floor(random() * 17)::INTEGER;
      ELSE
        v_systolic := 145 + floor(random() * 35)::INTEGER;
        v_diastolic := 88 + floor(random() * 22)::INTEGER;
      END IF;
    ELSE
      v_htn_controlled := NULL;
      v_systolic := 105 + floor(random() * 25)::INTEGER;
      v_diastolic := 62 + floor(random() * 18)::INTEGER;
    END IF;

    -- ============================================
    -- Additional kidney conditions
    -- ============================================
    v_has_autoimmune_disease := (random() < 0.03);
    v_autoimmune_type := CASE
      WHEN v_has_autoimmune_disease THEN
        CASE floor(random() * 4)::INTEGER
          WHEN 0 THEN 'Lupus (SLE)'
          WHEN 1 THEN 'Rheumatoid Arthritis'
          WHEN 2 THEN 'Vasculitis'
          ELSE 'Sjogren Syndrome'
        END
      ELSE NULL
    END;
    v_has_recurrent_uti := (random() < 0.08);
    v_has_kidney_stones := (random() < 0.10);
    v_has_gout := (random() < 0.08);
    v_has_pkd := (random() < 0.01);
    v_has_metabolic_syndrome := v_has_obesity AND v_has_diabetes AND v_has_hypertension;

    -- ============================================
    -- AKI History details
    -- ============================================
    IF v_history_aki THEN
      v_aki_episodes := 1 + floor(random() * 3)::INTEGER;
      v_aki_severity := CASE floor(random() * 4)::INTEGER
        WHEN 0 THEN 'Stage 1'
        WHEN 1 THEN 'Stage 2'
        WHEN 2 THEN 'Stage 3'
        ELSE 'Required Dialysis'
      END;
    ELSE
      v_aki_episodes := 0;
      v_aki_severity := NULL;
    END IF;

    -- ============================================
    -- Family history
    -- ============================================
    v_family_history_diabetes := v_has_diabetes OR (random() < 0.25);
    v_family_history_hypertension := v_has_hypertension OR (random() < 0.35);
    v_family_history_pkd := v_has_pkd OR (random() < 0.01);

    -- ============================================
    -- Lifestyle factors
    -- ============================================
    v_smoking_status := CASE
      WHEN random() < 0.50 THEN 'Never'
      WHEN random() < 0.80 THEN 'Former'
      ELSE 'Current'
    END;

    IF v_smoking_status IN ('Former', 'Current') THEN
      v_pack_years := 5 + (random() * 45);
      v_quit_date := CASE WHEN v_smoking_status = 'Former' THEN CURRENT_DATE - (floor(random() * 7300)::INTEGER) ELSE NULL END;
    ELSE
      v_pack_years := 0;
      v_quit_date := NULL;
    END IF;

    v_physical_activity := CASE
      WHEN v_age > 80 THEN CASE WHEN random() < 0.6 THEN 'Sedentary' WHEN random() < 0.9 THEN 'Light' ELSE 'Moderate' END
      WHEN v_age > 70 THEN CASE WHEN random() < 0.4 THEN 'Sedentary' WHEN random() < 0.8 THEN 'Light' WHEN random() < 0.95 THEN 'Moderate' ELSE 'Active' END
      ELSE CASE WHEN random() < 0.25 THEN 'Sedentary' WHEN random() < 0.6 THEN 'Light' WHEN random() < 0.9 THEN 'Moderate' ELSE 'Active' END
    END;

    v_exercise_minutes := CASE v_physical_activity
      WHEN 'Sedentary' THEN floor(random() * 30)::INTEGER
      WHEN 'Light' THEN 30 + floor(random() * 60)::INTEGER
      WHEN 'Moderate' THEN 90 + floor(random() * 90)::INTEGER
      ELSE 180 + floor(random() * 120)::INTEGER
    END;

    v_dietary_sodium := CASE WHEN random() < 0.30 THEN 'Low' WHEN random() < 0.70 THEN 'Moderate' ELSE 'High' END;
    v_dietary_protein := CASE WHEN random() < 0.25 THEN 'Low' WHEN random() < 0.75 THEN 'Moderate' ELSE 'High' END;
    v_fruit_veg_servings := floor(random() * 8)::INTEGER;

    -- ============================================
    -- Medications
    -- ============================================
    v_on_ras_inhibitor := v_has_hypertension AND (random() < (CASE WHEN v_has_ckd THEN 0.85 ELSE 0.55 END));
    v_on_sglt2i := (v_has_diabetes OR v_has_heart_failure OR (v_has_ckd AND v_ckd_stage BETWEEN 2 AND 4)) AND (random() < 0.45);
    v_on_statin := (v_has_cvd OR v_has_diabetes OR v_age > 70) AND (random() < 0.65);
    v_chronic_nsaid := NOT v_has_ckd AND (random() < 0.12);
    v_nsaid_months := CASE WHEN v_chronic_nsaid THEN floor(random() * 60)::INTEGER + 6 ELSE NULL END;
    v_ppi_use := (random() < 0.25);
    v_ppi_months := CASE WHEN v_ppi_use THEN floor(random() * 48)::INTEGER + 3 ELSE NULL END;
    v_on_calcineurin := (random() < 0.01);
    v_on_lithium := (random() < 0.005);
    v_nephrotoxic_meds := v_chronic_nsaid OR v_on_calcineurin OR v_on_lithium;

    -- ============================================
    -- Additional lab values
    -- ============================================
    v_bun := CASE
      WHEN v_ckd_stage = 5 THEN 60 + (random() * 80)
      WHEN v_ckd_stage = 4 THEN 40 + (random() * 50)
      WHEN v_ckd_stage = 3 THEN 22 + (random() * 35)
      ELSE 10 + (random() * 18)
    END;

    v_uric_acid := CASE
      WHEN v_has_gout THEN 7.5 + (random() * 4.0)
      WHEN v_has_ckd THEN 6.0 + (random() * 3.0)
      ELSE 4.0 + (random() * 3.5)
    END;

    v_hemoglobin := CASE
      WHEN v_ckd_stage = 5 THEN 8.0 + (random() * 3.0)
      WHEN v_ckd_stage = 4 THEN 9.5 + (random() * 3.0)
      WHEN v_ckd_stage = 3 THEN 11.0 + (random() * 3.0)
      WHEN v_gender = 'male' THEN 13.5 + (random() * 3.5)
      ELSE 12.0 + (random() * 3.0)
    END;

    v_potassium := CASE
      WHEN v_ckd_stage >= 4 THEN 4.5 + (random() * 1.8)
      WHEN v_on_ras_inhibitor THEN 4.2 + (random() * 1.2)
      ELSE 3.8 + (random() * 1.0)
    END;

    v_calcium := CASE
      WHEN v_ckd_stage >= 4 THEN 8.0 + (random() * 1.5)
      ELSE 8.8 + (random() * 1.4)
    END;

    v_phosphorus := CASE
      WHEN v_ckd_stage = 5 THEN 5.5 + (random() * 3.0)
      WHEN v_ckd_stage = 4 THEN 4.5 + (random() * 2.0)
      ELSE 3.0 + (random() * 1.8)
    END;

    v_albumin := CASE
      WHEN v_uacr > 300 THEN 2.8 + (random() * 1.0)
      WHEN v_uacr > 30 THEN 3.2 + (random() * 1.0)
      ELSE 3.8 + (random() * 0.8)
    END;

    v_ldl := CASE
      WHEN v_on_statin THEN 50 + (random() * 50)
      WHEN v_has_diabetes THEN 100 + (random() * 80)
      ELSE 80 + (random() * 80)
    END;

    v_hdl := CASE
      WHEN v_gender = 'male' THEN 35 + (random() * 35)
      ELSE 45 + (random() * 40)
    END;

    v_triglycerides := CASE
      WHEN v_has_metabolic_syndrome THEN 200 + (random() * 250)
      WHEN v_has_diabetes THEN 150 + (random() * 150)
      ELSE 80 + (random() * 120)
    END;

    -- ============================================
    -- eGFR trend calculation
    -- ============================================
    v_egfr_trend := CASE
      WHEN v_egfr_decline < -5 THEN 'rapid_decline'
      WHEN v_egfr_decline < -3 THEN 'moderate_decline'
      WHEN v_egfr_decline < -1 THEN 'slow_decline'
      WHEN v_egfr_decline < 1 THEN 'stable'
      ELSE 'improving'
    END;

    -- ============================================
    -- KDIGO Classification
    -- ============================================
    v_gfr_category := CASE
      WHEN v_egfr >= 90 THEN 'G1'
      WHEN v_egfr >= 60 THEN 'G2'
      WHEN v_egfr >= 45 THEN 'G3a'
      WHEN v_egfr >= 30 THEN 'G3b'
      WHEN v_egfr >= 15 THEN 'G4'
      ELSE 'G5'
    END;

    v_alb_category := CASE
      WHEN v_uacr < 30 THEN 'A1'
      WHEN v_uacr <= 300 THEN 'A2'
      ELSE 'A3'
    END;

    v_health_state := v_gfr_category || '-' || v_alb_category;

    -- KDIGO risk level (per official matrix)
    v_kdigo_risk := CASE
      WHEN v_gfr_category IN ('G4', 'G5') THEN 'very_high'
      WHEN v_gfr_category = 'G3b' AND v_alb_category IN ('A2', 'A3') THEN 'very_high'
      WHEN v_gfr_category = 'G3a' AND v_alb_category = 'A3' THEN 'very_high'
      WHEN v_gfr_category = 'G3b' AND v_alb_category = 'A1' THEN 'high'
      WHEN v_gfr_category = 'G3a' AND v_alb_category = 'A2' THEN 'high'
      WHEN v_gfr_category IN ('G1', 'G2') AND v_alb_category = 'A3' THEN 'high'
      WHEN v_gfr_category = 'G3a' AND v_alb_category = 'A1' THEN 'moderate'
      WHEN v_gfr_category IN ('G1', 'G2') AND v_alb_category = 'A2' THEN 'moderate'
      ELSE 'low'
    END;

    -- Monitoring details
    v_monitoring_device := CASE WHEN v_is_monitored THEN monitoring_devices[1 + floor(random() * (array_length(monitoring_devices, 1) - 1))::INTEGER] ELSE NULL END;
    v_monitoring_frequency := CASE
      WHEN v_kdigo_risk = 'very_high' THEN 'monthly'
      WHEN v_kdigo_risk = 'high' THEN 'quarterly'
      WHEN v_kdigo_risk = 'moderate' THEN 'biannually'
      ELSE 'annually'
    END;

    -- Risk score (simplified calculation)
    v_risk_score := LEAST(100, (
      CASE WHEN v_has_diabetes THEN 15 ELSE 0 END +
      CASE WHEN v_has_hypertension THEN 10 ELSE 0 END +
      CASE WHEN v_has_cvd THEN 20 ELSE 0 END +
      CASE WHEN v_has_heart_failure THEN 25 ELSE 0 END +
      CASE WHEN v_history_aki THEN 15 ELSE 0 END +
      CASE WHEN v_egfr < 60 THEN 20 WHEN v_egfr < 90 THEN 5 ELSE 0 END +
      CASE WHEN v_uacr > 300 THEN 25 WHEN v_uacr > 30 THEN 10 ELSE 0 END +
      CASE WHEN v_age > 80 THEN 10 WHEN v_age > 70 THEN 5 ELSE 0 END
    ));

    v_risk_tier := CASE
      WHEN v_risk_score >= 75 THEN 'very_high'
      WHEN v_risk_score >= 50 THEN 'high'
      WHEN v_risk_score >= 25 THEN 'moderate'
      ELSE 'low'
    END;

    -- ============================================
    -- INSERT: Patient record
    -- ============================================
    INSERT INTO patients (
      id, medical_record_number, first_name, last_name, date_of_birth, gender,
      email, phone, weight, height, smoking_status, cvd_history, family_history_esrd,
      on_ras_inhibitor, on_sglt2i, nephrotoxic_meds, nephrologist_referral,
      diagnosis_date, last_visit_date, next_visit_date,
      home_monitoring_device, home_monitoring_active,
      ckd_treatment_active, ckd_treatment_type,
      ethnicity, race, has_obesity
    ) VALUES (
      v_patient_id, v_mrn, v_first_name, v_last_name, v_dob, v_gender,
      LOWER(v_first_name) || '.' || LOWER(v_last_name) || '@email.com',
      '+1-555-' || LPAD(floor(random() * 10000)::TEXT, 4, '0'),
      v_weight, v_height, v_smoking_status, v_has_cvd, v_family_history_esrd,
      v_on_ras_inhibitor, v_on_sglt2i, v_nephrotoxic_meds,
      v_kdigo_risk IN ('very_high', 'high'),
      CASE WHEN v_has_ckd THEN CURRENT_DATE - floor(random() * 1825)::INTEGER ELSE NULL END,
      CURRENT_DATE - floor(random() * 180)::INTEGER,
      CURRENT_DATE + floor(random() * 180)::INTEGER + 30,
      v_monitoring_device, v_is_monitored,
      v_is_treated, CASE WHEN v_is_treated THEN 'Nephrology care + medications' ELSE NULL END,
      v_ethnicity, v_race, v_has_obesity
    );

    -- ============================================
    -- INSERT: Patient risk factors
    -- ============================================
    INSERT INTO patient_risk_factors (
      patient_id, current_egfr, current_uacr,
      egfr_decline_rate, egfr_trend, last_egfr_assessment_date,
      uric_acid, hba1c,
      has_diabetes, diabetes_type, diabetes_duration_years, diabetes_controlled,
      has_hypertension, hypertension_controlled, average_bp_systolic, average_bp_diastolic,
      has_cvd, has_heart_failure, has_coronary_artery_disease, has_stroke_history, has_peripheral_vascular_disease,
      has_obesity, current_bmi, has_metabolic_syndrome,
      has_autoimmune_disease, autoimmune_disease_type, has_recurrent_uti, has_kidney_stones,
      has_gout, has_polycystic_kidney_disease,
      history_of_aki, aki_episodes_count, aki_severity,
      family_history_ckd, family_history_esrd, family_history_diabetes, family_history_hypertension, family_history_pkd,
      smoking_status, pack_years, quit_date,
      physical_activity_level, exercise_minutes_per_week,
      dietary_sodium_intake, dietary_protein_intake, fruit_vegetable_servings_daily,
      chronic_nsaid_use, nsaid_duration_months, ppi_use, ppi_duration_months,
      on_calcineurin_inhibitors, on_lithium, on_ras_inhibitor, on_sglt2i, on_statin,
      risk_score, risk_tier,
      last_assessment_date, next_assessment_due
    ) VALUES (
      v_patient_id, v_egfr, v_uacr,
      v_egfr_decline, v_egfr_trend, CURRENT_DATE - floor(random() * 90)::INTEGER,
      v_uric_acid, v_hba1c,
      v_has_diabetes, v_diabetes_type, v_diabetes_duration, v_diabetes_controlled,
      v_has_hypertension, v_htn_controlled, v_systolic, v_diastolic,
      v_has_cvd, v_has_heart_failure, v_has_coronary_artery_disease, v_has_stroke_history, v_has_peripheral_vascular_disease,
      v_has_obesity, v_bmi, v_has_metabolic_syndrome,
      v_has_autoimmune_disease, v_autoimmune_type, v_has_recurrent_uti, v_has_kidney_stones,
      v_has_gout, v_has_pkd,
      v_history_aki, v_aki_episodes, v_aki_severity,
      v_family_history_ckd, v_family_history_esrd, v_family_history_diabetes, v_family_history_hypertension, v_family_history_pkd,
      v_smoking_status, v_pack_years, v_quit_date,
      v_physical_activity, v_exercise_minutes,
      v_dietary_sodium, v_dietary_protein, v_fruit_veg_servings,
      v_chronic_nsaid, v_nsaid_months, v_ppi_use, v_ppi_months,
      v_on_calcineurin, v_on_lithium, v_on_ras_inhibitor, v_on_sglt2i, v_on_statin,
      v_risk_score, v_risk_tier,
      CURRENT_DATE, CURRENT_DATE + CASE v_kdigo_risk WHEN 'very_high' THEN 30 WHEN 'high' THEN 90 WHEN 'moderate' THEN 180 ELSE 365 END
    );

    -- ============================================
    -- INSERT: Observations (Lab results)
    -- ============================================
    -- eGFR
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'eGFR', v_egfr, 'mL/min/1.73m²', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- Creatinine
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'creatinine', v_creatinine, 'mg/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- uACR
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'uACR', v_uacr, 'mg/g', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- Blood Pressure
    INSERT INTO observations (patient_id, observation_type, value_text, unit, observation_date, status)
    VALUES (v_patient_id, 'blood_pressure', v_systolic || '/' || v_diastolic, 'mmHg', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- BUN
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'BUN', v_bun, 'mg/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- HbA1c (for all patients)
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'HbA1c', v_hba1c, '%', CURRENT_TIMESTAMP - (random() * INTERVAL '60 days'), 'final');

    -- Hemoglobin
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'hemoglobin', v_hemoglobin, 'g/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- Potassium
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'potassium', v_potassium, 'mEq/L', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- Calcium
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'calcium', v_calcium, 'mg/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- Phosphorus
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'phosphorus', v_phosphorus, 'mg/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- Albumin
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'albumin', v_albumin, 'g/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'), 'final');

    -- Uric Acid
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'uric_acid', v_uric_acid, 'mg/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '60 days'), 'final');

    -- LDL Cholesterol
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'LDL_cholesterol', v_ldl, 'mg/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '90 days'), 'final');

    -- HDL Cholesterol
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'HDL_cholesterol', v_hdl, 'mg/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '90 days'), 'final');

    -- Triglycerides
    INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
    VALUES (v_patient_id, 'triglycerides', v_triglycerides, 'mg/dL', CURRENT_TIMESTAMP - (random() * INTERVAL '90 days'), 'final');

    -- ============================================
    -- INSERT: CKD or Non-CKD tracking data
    -- ============================================
    IF v_has_ckd THEN
      INSERT INTO ckd_patient_data (
        patient_id, ckd_severity, ckd_stage,
        kdigo_gfr_category, kdigo_albuminuria_category, kdigo_health_state,
        is_monitored, monitoring_device, monitoring_frequency, last_monitoring_date,
        is_treated
      ) VALUES (
        v_patient_id, v_ckd_severity, v_ckd_stage,
        v_gfr_category, v_alb_category, v_health_state,
        v_is_monitored, v_monitoring_device, v_monitoring_frequency,
        CASE WHEN v_is_monitored THEN CURRENT_DATE - floor(random() * 30)::INTEGER ELSE NULL END,
        v_is_treated
      );
    ELSE
      INSERT INTO non_ckd_patient_data (
        patient_id, risk_level, kdigo_health_state,
        is_monitored, monitoring_device, monitoring_frequency, last_monitoring_date
      ) VALUES (
        v_patient_id,
        CASE v_patient_category
          WHEN 'low_risk_non_ckd' THEN 'low'
          WHEN 'moderate_risk_non_ckd' THEN 'moderate'
          ELSE 'high'
        END,
        v_health_state,
        v_is_monitored, v_monitoring_device, v_monitoring_frequency,
        CASE WHEN v_is_monitored THEN CURRENT_DATE - floor(random() * 30)::INTEGER ELSE NULL END
      );
    END IF;

    -- ============================================
    -- INSERT: Conditions (diagnoses)
    -- ============================================
    IF v_has_diabetes THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity)
      VALUES (v_patient_id,
        CASE v_diabetes_type WHEN 'Type 1' THEN 'E10' ELSE 'E11' END,
        'Diabetes Mellitus ' || v_diabetes_type,
        'active',
        CURRENT_DATE - (v_diabetes_duration * 365),
        CASE WHEN v_diabetes_controlled THEN 'moderate' ELSE 'severe' END
      );
    END IF;

    IF v_has_hypertension THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity)
      VALUES (v_patient_id, 'I10', 'Essential Hypertension', 'active',
        CURRENT_DATE - floor(random() * 5475)::INTEGER,
        CASE WHEN v_htn_controlled THEN 'mild' ELSE 'moderate' END
      );
    END IF;

    IF v_has_heart_failure THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity)
      VALUES (v_patient_id, 'I50.9', 'Heart Failure', 'active',
        CURRENT_DATE - floor(random() * 2190)::INTEGER,
        'moderate'
      );
    END IF;

    IF v_has_coronary_artery_disease THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity)
      VALUES (v_patient_id, 'I25.10', 'Coronary Artery Disease', 'active',
        CURRENT_DATE - floor(random() * 3650)::INTEGER,
        'moderate'
      );
    END IF;

    IF v_has_ckd AND v_ckd_stage IS NOT NULL THEN
      INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity)
      VALUES (v_patient_id,
        'N18.' || v_ckd_stage,
        'Chronic Kidney Disease Stage ' || v_ckd_stage,
        'active',
        CURRENT_DATE - floor(random() * 1825)::INTEGER,
        v_ckd_severity
      );
    END IF;

    -- ============================================
    -- INSERT: Medications
    -- ============================================
    IF v_on_ras_inhibitor THEN
      INSERT INTO patient_medications (
        patient_id, medication_name, medication_class, medication_type, dosage, frequency, route,
        indication, is_active, start_date, is_hypertension_medication, is_ras_inhibitor, is_cardioprotective
      ) VALUES (
        v_patient_id,
        CASE WHEN random() < 0.5 THEN 'Lisinopril' ELSE 'Losartan' END,
        CASE WHEN random() < 0.5 THEN 'ACE Inhibitor' ELSE 'ARB' END,
        'oral',
        CASE WHEN random() < 0.5 THEN '10mg' ELSE '20mg' END,
        'once daily', 'oral',
        'Hypertension/Renal Protection',
        true,
        CURRENT_DATE - floor(random() * 1825)::INTEGER,
        true, true, true
      );
    END IF;

    IF v_on_sglt2i THEN
      INSERT INTO patient_medications (
        patient_id, medication_name, medication_class, medication_type, dosage, frequency, route,
        indication, is_active, start_date, is_diabetes_medication, is_sglt2i, is_cardioprotective
      ) VALUES (
        v_patient_id,
        CASE floor(random() * 3)::INTEGER WHEN 0 THEN 'Empagliflozin (Jardiance)' WHEN 1 THEN 'Dapagliflozin (Farxiga)' ELSE 'Canagliflozin (Invokana)' END,
        'SGLT2 Inhibitor',
        'oral',
        CASE WHEN random() < 0.5 THEN '10mg' ELSE '25mg' END,
        'once daily', 'oral',
        'Diabetes/Cardiorenal Protection',
        true,
        CURRENT_DATE - floor(random() * 730)::INTEGER,
        v_has_diabetes, true, true
      );
    END IF;

    IF v_on_statin THEN
      INSERT INTO patient_medications (
        patient_id, medication_name, medication_class, medication_type, dosage, frequency, route,
        indication, is_active, start_date, is_cardioprotective
      ) VALUES (
        v_patient_id,
        CASE floor(random() * 3)::INTEGER WHEN 0 THEN 'Atorvastatin' WHEN 1 THEN 'Rosuvastatin' ELSE 'Simvastatin' END,
        'Statin',
        'oral',
        CASE WHEN random() < 0.3 THEN '10mg' WHEN random() < 0.7 THEN '20mg' ELSE '40mg' END,
        'once daily', 'oral',
        'Hyperlipidemia/CV Prevention',
        true,
        CURRENT_DATE - floor(random() * 2190)::INTEGER,
        true
      );
    END IF;

    IF v_has_diabetes AND NOT v_on_sglt2i THEN
      INSERT INTO patient_medications (
        patient_id, medication_name, medication_class, medication_type, dosage, frequency, route,
        indication, is_active, start_date, is_diabetes_medication
      ) VALUES (
        v_patient_id,
        'Metformin',
        'Biguanide',
        'oral',
        CASE WHEN random() < 0.5 THEN '500mg' ELSE '1000mg' END,
        'twice daily', 'oral',
        'Type 2 Diabetes',
        true,
        CURRENT_DATE - floor(random() * 2555)::INTEGER,
        true
      );
    END IF;

    IF v_chronic_nsaid THEN
      INSERT INTO patient_medications (
        patient_id, medication_name, medication_class, medication_type, dosage, frequency, route,
        indication, is_active, start_date, is_nephrotoxic
      ) VALUES (
        v_patient_id,
        CASE WHEN random() < 0.5 THEN 'Ibuprofen' ELSE 'Naproxen' END,
        'NSAID',
        'oral',
        CASE WHEN random() < 0.5 THEN '400mg' ELSE '500mg' END,
        'as needed', 'oral',
        'Pain/Inflammation',
        true,
        CURRENT_DATE - (v_nsaid_months * 30),
        true
      );
    END IF;

    -- Progress indicator every 100 patients
    IF i % 100 = 0 THEN
      RAISE NOTICE 'Generated % patients...', i;
    END IF;

  END LOOP;

  RAISE NOTICE 'Successfully generated 1000 patients (Age 60+) with complete data';
END $$;

-- ============================================
-- Summary statistics
-- ============================================
DO $$
DECLARE
  v_total INTEGER;
  v_non_ckd INTEGER;
  v_ckd INTEGER;
  v_avg_age DECIMAL;
  v_with_diabetes INTEGER;
  v_with_htn INTEGER;
  v_with_hf INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM patients WHERE medical_record_number LIKE 'MRN%';
  SELECT COUNT(*) INTO v_non_ckd FROM non_ckd_patient_data;
  SELECT COUNT(*) INTO v_ckd FROM ckd_patient_data;
  SELECT AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))) INTO v_avg_age FROM patients WHERE medical_record_number LIKE 'MRN%';
  SELECT COUNT(*) INTO v_with_diabetes FROM patient_risk_factors WHERE has_diabetes = true;
  SELECT COUNT(*) INTO v_with_htn FROM patient_risk_factors WHERE has_hypertension = true;
  SELECT COUNT(*) INTO v_with_hf FROM patient_risk_factors WHERE has_heart_failure = true;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'PATIENT GENERATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Patients: %', v_total;
  RAISE NOTICE 'Non-CKD Patients: %', v_non_ckd;
  RAISE NOTICE 'CKD Patients: %', v_ckd;
  RAISE NOTICE 'Average Age: % years', ROUND(v_avg_age, 1);
  RAISE NOTICE 'With Diabetes: %', v_with_diabetes;
  RAISE NOTICE 'With Hypertension: %', v_with_htn;
  RAISE NOTICE 'With Heart Failure: %', v_with_hf;
  RAISE NOTICE '========================================';
END $$;
