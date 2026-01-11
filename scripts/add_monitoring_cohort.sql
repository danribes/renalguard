-- Add 25 Additional Patients with Longitudinal Monitoring Data
-- Creates realistic uACR and eGFR progression patterns over 12-24 months

-- Insert 25 new patients with varied risk profiles
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
  smoking_status,
  cvd_history,
  family_history_esrd,
  on_ras_inhibitor,
  on_sglt2i,
  nephrotoxic_meds,
  nephrologist_referral,
  diagnosis_date,
  last_visit_date,
  next_visit_date,
  created_at,
  updated_at
)
VALUES
-- High-risk monitoring cohort (10 patients) - Monthly/Quarterly monitoring
(gen_random_uuid(), 'MRN00301', 'Patricia', 'Anderson', '1958-03-15', 'female', 'patricia.anderson@email.com', '555-0301', 78.5, 165, 'former', true, false, true, false, false, false, '2023-06-15', '2025-10-15', '2025-12-15', NOW(), NOW()),
(gen_random_uuid(), 'MRN00302', 'Robert', 'Martinez', '1962-07-22', 'male', 'robert.martinez@email.com', '555-0302', 92.3, 178, 'current', true, true, true, true, false, true, '2023-08-20', '2025-10-20', '2025-12-20', NOW(), NOW()),
(gen_random_uuid(), 'MRN00303', 'Linda', 'Garcia', '1965-11-08', 'female', 'linda.garcia@email.com', '555-0303', 85.2, 162, 'never', false, true, true, true, false, false, '2023-05-10', '2025-10-10', '2025-12-10', NOW(), NOW()),
(gen_random_uuid(), 'MRN00304', 'James', 'Rodriguez', '1959-01-30', 'male', 'james.rodriguez@email.com', '555-0304', 98.7, 175, 'former', true, false, true, false, false, false, '2023-07-05', '2025-10-25', '2025-12-25', NOW(), NOW()),
(gen_random_uuid(), 'MRN00305', 'Mary', 'Wilson', '1961-05-18', 'female', 'mary.wilson@email.com', '555-0305', 82.1, 168, 'never', true, true, true, true, false, true, '2023-09-12', '2025-10-12', '2025-12-12', NOW(), NOW()),
(gen_random_uuid(), 'MRN00306', 'David', 'Lee', '1963-09-25', 'male', 'david.lee@email.com', '555-0306', 89.5, 172, 'current', false, false, false, false, true, false, '2023-04-18', '2025-10-18', '2025-12-18', NOW(), NOW()),
(gen_random_uuid(), 'MRN00307', 'Susan', 'Taylor', '1960-12-03', 'female', 'susan.taylor@email.com', '555-0307', 76.8, 163, 'former', true, false, true, true, false, false, '2023-06-28', '2025-10-28', '2025-12-28', NOW(), NOW()),
(gen_random_uuid(), 'MRN00308', 'Michael', 'Brown', '1964-02-14', 'male', 'michael.brown@email.com', '555-0308', 95.2, 180, 'never', true, true, true, false, false, true, '2023-08-08', '2025-10-08', '2025-12-08', NOW(), NOW()),
(gen_random_uuid(), 'MRN00309', 'Nancy', 'Davis', '1966-04-20', 'female', 'nancy.davis@email.com', '555-0309', 80.3, 160, 'former', false, true, true, true, false, false, '2023-05-22', '2025-10-22', '2025-12-22', NOW(), NOW()),
(gen_random_uuid(), 'MRN00310', 'Christopher', 'Miller', '1957-08-11', 'male', 'chris.miller@email.com', '555-0310', 91.7, 176, 'current', true, false, true, false, true, true, '2023-07-15', '2025-10-15', '2025-12-15', NOW(), NOW()),

-- Moderate-risk monitoring cohort (10 patients) - Quarterly/Semi-annual monitoring
(gen_random_uuid(), 'MRN00311', 'Elizabeth', 'Moore', '1968-06-05', 'female', 'elizabeth.moore@email.com', '555-0311', 72.5, 165, 'never', false, false, true, false, false, false, '2023-09-01', '2025-09-15', '2026-03-15', NOW(), NOW()),
(gen_random_uuid(), 'MRN00312', 'Daniel', 'Jackson', '1970-10-12', 'male', 'daniel.jackson@email.com', '555-0312', 86.4, 174, 'former', true, false, true, true, false, false, '2023-06-10', '2025-09-10', '2026-03-10', NOW(), NOW()),
(gen_random_uuid(), 'MRN00313', 'Karen', 'White', '1967-03-28', 'female', 'karen.white@email.com', '555-0313', 79.2, 162, 'never', false, true, false, false, false, false, '2023-08-20', '2025-09-20', '2026-03-20', NOW(), NOW()),
(gen_random_uuid(), 'MRN00314', 'Paul', 'Harris', '1969-11-15', 'male', 'paul.harris@email.com', '555-0314', 88.9, 177, 'current', true, false, true, false, false, false, '2023-07-05', '2025-09-25', '2026-03-25', NOW(), NOW()),
(gen_random_uuid(), 'MRN00315', 'Sandra', 'Martin', '1971-01-22', 'female', 'sandra.martin@email.com', '555-0315', 74.6, 161, 'never', false, false, false, true, false, false, '2023-05-18', '2025-09-18', '2026-03-18', NOW(), NOW()),
(gen_random_uuid(), 'MRN00316', 'Steven', 'Thompson', '1966-07-08', 'male', 'steven.thompson@email.com', '555-0316', 93.1, 179, 'former', true, true, true, true, false, false, '2023-09-12', '2025-09-12', '2026-03-12', NOW(), NOW()),
(gen_random_uuid(), 'MRN00317', 'Donna', 'Garcia', '1968-09-30', 'female', 'donna.garcia@email.com', '555-0317', 77.8, 164, 'never', false, false, true, false, false, false, '2023-06-22', '2025-09-22', '2026-03-22', NOW(), NOW()),
(gen_random_uuid(), 'MRN00318', 'Kevin', 'Martinez', '1970-12-18', 'male', 'kevin.martinez@email.com', '555-0318', 90.5, 175, 'current', true, false, true, false, true, false, '2023-08-08', '2025-09-08', '2026-03-08', NOW(), NOW()),
(gen_random_uuid(), 'MRN00319', 'Carol', 'Robinson', '1969-04-25', 'female', 'carol.robinson@email.com', '555-0319', 81.2, 166, 'former', false, true, false, true, false, false, '2023-07-28', '2025-09-28', '2026-03-28', NOW(), NOW()),
(gen_random_uuid(), 'MRN00320', 'George', 'Clark', '1967-02-10', 'male', 'george.clark@email.com', '555-0320', 87.3, 173, 'never', true, false, true, true, false, false, '2023-05-15', '2025-09-15', '2026-03-15', NOW(), NOW()),

-- Lower-risk monitoring cohort (5 patients) - Annual monitoring
(gen_random_uuid(), 'MRN00321', 'Michelle', 'Lewis', '1972-08-14', 'female', 'michelle.lewis@email.com', '555-0321', 70.5, 163, 'never', false, false, false, false, false, false, '2024-01-10', '2025-08-10', '2026-08-10', NOW(), NOW()),
(gen_random_uuid(), 'MRN00322', 'Kenneth', 'Walker', '1974-05-20', 'male', 'kenneth.walker@email.com', '555-0322', 84.2, 176, 'former', false, false, true, false, false, false, '2024-02-15', '2025-08-15', '2026-08-15', NOW(), NOW()),
(gen_random_uuid(), 'MRN00323', 'Laura', 'Hall', '1973-11-08', 'female', 'laura.hall@email.com', '555-0323', 73.8, 160, 'never', false, false, false, false, false, false, '2024-03-20', '2025-08-20', '2026-08-20', NOW(), NOW()),
(gen_random_uuid(), 'MRN00324', 'Brian', 'Allen', '1971-09-28', 'male', 'brian.allen@email.com', '555-0324', 89.1, 178, 'never', false, true, false, false, false, false, '2024-01-25', '2025-08-25', '2026-08-25', NOW(), NOW()),
(gen_random_uuid(), 'MRN00325', 'Jennifer', 'Young', '1975-03-12', 'female', 'jennifer.young@email.com', '555-0325', 76.3, 162, 'former', false, false, false, true, false, false, '2024-02-28', '2025-08-28', '2026-08-28', NOW(), NOW());

-- Create longitudinal observation data showing monitoring evolution
-- HIGH-RISK COHORT: Monthly/Quarterly monitoring with progressive patterns

-- Patient MRN00301: Progressive albuminuria (showing worsening)
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00301'),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  -- Baseline (24 months ago)
  ('uacr', 45.2, 'mg/g', '2023-06-15'::date),
  ('serum_creatinine', 1.3, 'mg/dL', '2023-06-15'::date),
  -- 18 months ago
  ('uacr', 62.8, 'mg/g', '2023-09-15'::date),
  ('serum_creatinine', 1.35, 'mg/dL', '2023-09-15'::date),
  -- 15 months ago
  ('uacr', 78.5, 'mg/g', '2023-12-15'::date),
  ('serum_creatinine', 1.42, 'mg/dL', '2023-12-15'::date),
  -- 12 months ago
  ('uacr', 95.3, 'mg/g', '2024-03-15'::date),
  ('serum_creatinine', 1.48, 'mg/dL', '2024-03-15'::date),
  -- 9 months ago
  ('uacr', 112.7, 'mg/g', '2024-06-15'::date),
  ('serum_creatinine', 1.55, 'mg/dL', '2024-06-15'::date),
  -- 6 months ago
  ('uacr', 135.2, 'mg/g', '2024-09-15'::date),
  ('serum_creatinine', 1.63, 'mg/dL', '2024-09-15'::date),
  -- 3 months ago
  ('uacr', 158.4, 'mg/g', '2024-12-15'::date),
  ('serum_creatinine', 1.71, 'mg/dL', '2024-12-15'::date),
  -- Most recent (1 month ago)
  ('uacr', 182.6, 'mg/g', '2025-01-15'::date),
  ('serum_creatinine', 1.79, 'mg/dL', '2025-01-15'::date)
) AS t(obs_type, value, unit, obs_date);

-- Patient MRN00302: Severe albuminuria with treatment (showing improvement)
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00302'),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  -- Baseline (20 months ago) - severe
  ('uacr', 420.5, 'mg/g', '2023-08-20'::date),
  ('serum_creatinine', 2.1, 'mg/dL', '2023-08-20'::date),
  -- Started treatment (17 months ago)
  ('uacr', 395.2, 'mg/g', '2023-11-20'::date),
  ('serum_creatinine', 2.05, 'mg/dL', '2023-11-20'::date),
  -- 14 months ago - improving
  ('uacr', 352.8, 'mg/g', '2024-02-20'::date),
  ('serum_creatinine', 1.98, 'mg/dL', '2024-02-20'::date),
  -- 11 months ago
  ('uacr', 298.4, 'mg/g', '2024-05-20'::date),
  ('serum_creatinine', 1.92, 'mg/dL', '2024-05-20'::date),
  -- 8 months ago
  ('uacr', 245.7, 'mg/g', '2024-08-20'::date),
  ('serum_creatinine', 1.87, 'mg/dL', '2024-08-20'::date),
  -- 5 months ago
  ('uacr', 198.3, 'mg/g', '2024-11-20'::date),
  ('serum_creatinine', 1.82, 'mg/dL', '2024-11-20'::date),
  -- 2 months ago - stable
  ('uacr', 175.6, 'mg/g', '2025-02-20'::date),
  ('serum_creatinine', 1.78, 'mg/dL', '2025-02-20'::date)
) AS t(obs_type, value, unit, obs_date);

-- Patient MRN00303: Moderate stable albuminuria
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00303'),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  ('uacr', 152.3, 'mg/g', '2023-05-10'::date),
  ('serum_creatinine', 1.42, 'mg/dL', '2023-05-10'::date),
  ('uacr', 148.7, 'mg/g', '2023-08-10'::date),
  ('serum_creatinine', 1.44, 'mg/dL', '2023-08-10'::date),
  ('uacr', 155.2, 'mg/g', '2023-11-10'::date),
  ('serum_creatinine', 1.46, 'mg/dL', '2023-11-10'::date),
  ('uacr', 149.8, 'mg/g', '2024-02-10'::date),
  ('serum_creatinine', 1.45, 'mg/dL', '2024-02-10'::date),
  ('uacr', 158.4, 'mg/g', '2024-05-10'::date),
  ('serum_creatinine', 1.48, 'mg/dL', '2024-05-10'::date),
  ('uacr', 153.6, 'mg/g', '2024-08-10'::date),
  ('serum_creatinine', 1.47, 'mg/dL', '2024-08-10'::date),
  ('uacr', 151.2, 'mg/g', '2024-11-10'::date),
  ('serum_creatinine', 1.49, 'mg/dL', '2024-11-10'::date),
  ('uacr', 156.8, 'mg/g', '2025-02-10'::date),
  ('serum_creatinine', 1.50, 'mg/dL', '2025-02-10'::date)
) AS t(obs_type, value, unit, obs_date);

-- Patient MRN00304: Early progression
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00304'),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  ('uacr', 38.5, 'mg/g', '2023-07-05'::date),
  ('serum_creatinine', 1.25, 'mg/dL', '2023-07-05'::date),
  ('uacr', 52.3, 'mg/g', '2023-10-05'::date),
  ('serum_creatinine', 1.28, 'mg/dL', '2023-10-05'::date),
  ('uacr', 68.7, 'mg/g', '2024-01-05'::date),
  ('serum_creatinine', 1.32, 'mg/dL', '2024-01-05'::date),
  ('uacr', 89.2, 'mg/g', '2024-04-05'::date),
  ('serum_creatinine', 1.37, 'mg/dL', '2024-04-05'::date),
  ('uacr', 112.5, 'mg/g', '2024-07-05'::date),
  ('serum_creatinine', 1.43, 'mg/dL', '2024-07-05'::date),
  ('uacr', 138.4, 'mg/g', '2024-10-05'::date),
  ('serum_creatinine', 1.49, 'mg/dL', '2024-10-05'::date),
  ('uacr', 165.8, 'mg/g', '2025-01-05'::date),
  ('serum_creatinine', 1.56, 'mg/dL', '2025-01-05'::date)
) AS t(obs_type, value, unit, obs_date);

-- Patient MRN00305: Fluctuating albuminuria
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00305'),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  ('uacr', 285.3, 'mg/g', '2023-09-12'::date),
  ('serum_creatinine', 1.68, 'mg/dL', '2023-09-12'::date),
  ('uacr', 312.7, 'mg/g', '2023-12-12'::date),
  ('serum_creatinine', 1.72, 'mg/dL', '2023-12-12'::date),
  ('uacr', 268.5, 'mg/g', '2024-03-12'::date),
  ('serum_creatinine', 1.70, 'mg/dL', '2024-03-12'::date),
  ('uacr', 295.8, 'mg/g', '2024-06-12'::date),
  ('serum_creatinine', 1.74, 'mg/dL', '2024-06-12'::date),
  ('uacr', 258.2, 'mg/g', '2024-09-12'::date),
  ('serum_creatinine', 1.71, 'mg/dL', '2024-09-12'::date),
  ('uacr', 278.6, 'mg/g', '2024-12-12'::date),
  ('serum_creatinine', 1.73, 'mg/dL', '2024-12-12'::date)
) AS t(obs_type, value, unit, obs_date);

-- Continue with remaining high-risk patients (MRN00306-310)
-- Patient MRN00306: Nephrotic range, improving with treatment
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00306'),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  ('uacr', 580.5, 'mg/g', '2023-04-18'::date),
  ('serum_creatinine', 2.35, 'mg/dL', '2023-04-18'::date),
  ('uacr', 498.2, 'mg/g', '2023-07-18'::date),
  ('serum_creatinine', 2.28, 'mg/dL', '2023-07-18'::date),
  ('uacr', 425.7, 'mg/g', '2023-10-18'::date),
  ('serum_creatinine', 2.20, 'mg/dL', '2023-10-18'::date),
  ('uacr', 368.4, 'mg/g', '2024-01-18'::date),
  ('serum_creatinine', 2.12, 'mg/dL', '2024-01-18'::date),
  ('uacr', 315.6, 'mg/g', '2024-04-18'::date),
  ('serum_creatinine', 2.05, 'mg/dL', '2024-04-18'::date),
  ('uacr', 278.3, 'mg/g', '2024-07-18'::date),
  ('serum_creatinine', 1.98, 'mg/dL', '2024-07-18'::date),
  ('uacr', 245.8, 'mg/g', '2024-10-18'::date),
  ('serum_creatinine', 1.92, 'mg/dL', '2024-10-18'::date)
) AS t(obs_type, value, unit, obs_date);

-- Patient MRN00307-310: Add similar patterns
-- MRN00307: Microalbuminuria progressing to macroalbuminuria
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00307'),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  ('uacr', 28.5, 'mg/g', '2023-06-28'::date),
  ('serum_creatinine', 1.18, 'mg/dL', '2023-06-28'::date),
  ('uacr', 42.3, 'mg/g', '2023-09-28'::date),
  ('serum_creatinine', 1.22, 'mg/dL', '2023-09-28'::date),
  ('uacr', 58.7, 'mg/g', '2023-12-28'::date),
  ('serum_creatinine', 1.26, 'mg/dL', '2023-12-28'::date),
  ('uacr', 78.4, 'mg/g', '2024-03-28'::date),
  ('serum_creatinine', 1.31, 'mg/dL', '2024-03-28'::date),
  ('uacr', 102.5, 'mg/g', '2024-06-28'::date),
  ('serum_creatinine', 1.36, 'mg/dL', '2024-06-28'::date),
  ('uacr', 128.6, 'mg/g', '2024-09-28'::date),
  ('serum_creatinine', 1.42, 'mg/dL', '2024-09-28'::date),
  ('uacr', 156.2, 'mg/g', '2024-12-28'::date),
  ('serum_creatinine', 1.48, 'mg/dL', '2024-12-28'::date)
) AS t(obs_type, value, unit, obs_date);

-- MODERATE-RISK COHORT: Quarterly/Semi-annual monitoring

-- Patient MRN00311: Stable microalbuminuria
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00311'),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  ('uacr', 42.5, 'mg/g', '2023-09-01'::date),
  ('serum_creatinine', 1.15, 'mg/dL', '2023-09-01'::date),
  ('uacr', 45.8, 'mg/g', '2023-12-01'::date),
  ('serum_creatinine', 1.17, 'mg/dL', '2023-12-01'::date),
  ('uacr', 48.2, 'mg/g', '2024-03-01'::date),
  ('serum_creatinine', 1.18, 'mg/dL', '2024-03-01'::date),
  ('uacr', 51.3, 'mg/g', '2024-06-01'::date),
  ('serum_creatinine', 1.20, 'mg/dL', '2024-06-01'::date),
  ('uacr', 54.7, 'mg/g', '2024-09-01'::date),
  ('serum_creatinine', 1.22, 'mg/dL', '2024-09-01'::date),
  ('uacr', 58.2, 'mg/g', '2024-12-01'::date),
  ('serum_creatinine', 1.24, 'mg/dL', '2024-12-01'::date)
) AS t(obs_type, value, unit, obs_date);

-- Patient MRN00312: Improving with ACEi
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00312'),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  ('uacr', 185.4, 'mg/g', '2023-06-10'::date),
  ('serum_creatinine', 1.52, 'mg/dL', '2023-06-10'::date),
  ('uacr', 162.8, 'mg/g', '2023-09-10'::date),
  ('serum_creatinine', 1.48, 'mg/dL', '2023-09-10'::date),
  ('uacr', 138.5, 'mg/g', '2023-12-10'::date),
  ('serum_creatinine', 1.45, 'mg/dL', '2023-12-10'::date),
  ('uacr', 118.2, 'mg/g', '2024-03-10'::date),
  ('serum_creatinine', 1.42, 'mg/dL', '2024-03-10'::date),
  ('uacr', 105.7, 'mg/g', '2024-06-10'::date),
  ('serum_creatinine', 1.40, 'mg/dL', '2024-06-10'::date),
  ('uacr', 95.3, 'mg/g', '2024-09-10'::date),
  ('serum_creatinine', 1.38, 'mg/dL', '2024-09-10'::date)
) AS t(obs_type, value, unit, obs_date);

-- Patient MRN00313-320: Add moderate patterns (semi-annual)
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = mrn),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  -- MRN00313: Mild stable
  ('MRN00313', 'uacr', 32.5, 'mg/g', '2023-08-20'::date),
  ('MRN00313', 'serum_creatinine', 1.08, 'mg/dL', '2023-08-20'::date),
  ('MRN00313', 'uacr', 35.2, 'mg/g', '2024-02-20'::date),
  ('MRN00313', 'serum_creatinine', 1.10, 'mg/dL', '2024-02-20'::date),
  ('MRN00313', 'uacr', 38.7, 'mg/g', '2024-08-20'::date),
  ('MRN00313', 'serum_creatinine', 1.12, 'mg/dL', '2024-08-20'::date),

  -- MRN00314: Moderate fluctuating
  ('MRN00314', 'uacr', 125.8, 'mg/g', '2023-07-05'::date),
  ('MRN00314', 'serum_creatinine', 1.38, 'mg/dL', '2023-07-05'::date),
  ('MRN00314', 'uacr', 142.3, 'mg/g', '2024-01-05'::date),
  ('MRN00314', 'serum_creatinine', 1.42, 'mg/dL', '2024-01-05'::date),
  ('MRN00314', 'uacr', 135.7, 'mg/g', '2024-07-05'::date),
  ('MRN00314', 'serum_creatinine', 1.40, 'mg/dL', '2024-07-05'::date),

  -- MRN00315: Low stable
  ('MRN00315', 'uacr', 22.3, 'mg/g', '2023-05-18'::date),
  ('MRN00315', 'serum_creatinine', 0.98, 'mg/dL', '2023-05-18'::date),
  ('MRN00315', 'uacr', 24.8, 'mg/g', '2023-11-18'::date),
  ('MRN00315', 'serum_creatinine', 1.00, 'mg/dL', '2023-11-18'::date),
  ('MRN00315', 'uacr', 27.2, 'mg/g', '2024-05-18'::date),
  ('MRN00315', 'serum_creatinine', 1.02, 'mg/dL', '2024-05-18'::date),
  ('MRN00315', 'uacr', 29.5, 'mg/g', '2024-11-18'::date),
  ('MRN00315', 'serum_creatinine', 1.04, 'mg/dL', '2024-11-18'::date)
) AS t(mrn, obs_type, value, unit, obs_date);

-- LOW-RISK COHORT: Annual monitoring

-- Patient MRN00321-325: Annual measurements
INSERT INTO observations (id, patient_id, observation_type, value_numeric, value_text, unit, observation_date, status, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = mrn),
  obs_type,
  value,
  NULL,
  unit,
  obs_date,
  'final',
  NOW()
FROM (VALUES
  -- MRN00321
  ('MRN00321', 'uacr', 18.5, 'mg/g', '2024-01-10'::date),
  ('MRN00321', 'serum_creatinine', 0.92, 'mg/dL', '2024-01-10'::date),
  ('MRN00321', 'uacr', 21.2, 'mg/g', '2025-01-10'::date),
  ('MRN00321', 'serum_creatinine', 0.94, 'mg/dL', '2025-01-10'::date),

  -- MRN00322
  ('MRN00322', 'uacr', 25.8, 'mg/g', '2024-02-15'::date),
  ('MRN00322', 'serum_creatinine', 1.05, 'mg/dL', '2024-02-15'::date),
  ('MRN00322', 'uacr', 28.3, 'mg/g', '2025-02-15'::date),
  ('MRN00322', 'serum_creatinine', 1.07, 'mg/dL', '2025-02-15'::date),

  -- MRN00323
  ('MRN00323', 'uacr', 15.2, 'mg/g', '2024-03-20'::date),
  ('MRN00323', 'serum_creatinine', 0.88, 'mg/dL', '2024-03-20'::date),
  ('MRN00323', 'uacr', 17.8, 'mg/g', '2025-03-20'::date),
  ('MRN00323', 'serum_creatinine', 0.90, 'mg/dL', '2025-03-20'::date),

  -- MRN00324
  ('MRN00324', 'uacr', 32.5, 'mg/g', '2024-01-25'::date),
  ('MRN00324', 'serum_creatinine', 1.12, 'mg/dL', '2024-01-25'::date),
  ('MRN00324', 'uacr', 35.7, 'mg/g', '2025-01-25'::date),
  ('MRN00324', 'serum_creatinine', 1.14, 'mg/dL', '2025-01-25'::date),

  -- MRN00325
  ('MRN00325', 'uacr', 28.2, 'mg/g', '2024-02-28'::date),
  ('MRN00325', 'serum_creatinine', 1.02, 'mg/dL', '2024-02-28'::date),
  ('MRN00325', 'uacr', 30.5, 'mg/g', '2025-02-28'::date),
  ('MRN00325', 'serum_creatinine', 1.04, 'mg/dL', '2025-02-28'::date)
) AS t(mrn, obs_type, value, unit, obs_date);

-- Create conditions for the new patients
INSERT INTO conditions (id, patient_id, condition_code, condition_name, onset_date, clinical_status, severity, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = mrn),
  condition_code,
  condition_name,
  onset_date,
  'active',
  severity,
  NOW()
FROM (VALUES
  ('MRN00301', 'E11.9', 'Type 2 Diabetes Mellitus', '2018-03-10'::date, 'moderate'),
  ('MRN00301', 'I10', 'Essential Hypertension', '2016-05-15'::date, 'moderate'),
  ('MRN00302', 'E11.9', 'Type 2 Diabetes Mellitus', '2015-08-20'::date, 'severe'),
  ('MRN00302', 'I10', 'Essential Hypertension', '2014-02-10'::date, 'severe'),
  ('MRN00303', 'I10', 'Essential Hypertension', '2019-01-15'::date, 'moderate'),
  ('MRN00304', 'E11.9', 'Type 2 Diabetes Mellitus', '2020-07-05'::date, 'moderate'),
  ('MRN00305', 'E11.9', 'Type 2 Diabetes Mellitus', '2017-09-12'::date, 'severe'),
  ('MRN00305', 'I10', 'Essential Hypertension', '2016-09-12'::date, 'moderate'),
  ('MRN00306', 'E11.9', 'Type 2 Diabetes Mellitus', '2019-04-18'::date, 'moderate'),
  ('MRN00307', 'I10', 'Essential Hypertension', '2020-06-28'::date, 'mild'),
  ('MRN00311', 'I10', 'Essential Hypertension', '2021-09-01'::date, 'mild'),
  ('MRN00312', 'E11.9', 'Type 2 Diabetes Mellitus', '2020-06-10'::date, 'moderate'),
  ('MRN00312', 'I10', 'Essential Hypertension', '2019-06-10'::date, 'moderate'),
  ('MRN00314', 'E11.9', 'Type 2 Diabetes Mellitus', '2021-07-05'::date, 'moderate'),
  ('MRN00316', 'E11.9', 'Type 2 Diabetes Mellitus', '2020-09-12'::date, 'moderate'),
  ('MRN00316', 'I10', 'Essential Hypertension', '2019-09-12'::date, 'moderate'),
  ('MRN00318', 'I10', 'Essential Hypertension', '2021-08-08'::date, 'moderate'),
  ('MRN00320', 'E11.9', 'Type 2 Diabetes Mellitus', '2020-05-15'::date, 'moderate'),
  ('MRN00324', 'I10', 'Essential Hypertension', '2022-01-25'::date, 'mild')
) AS t(mrn, condition_code, condition_name, onset_date, severity);
