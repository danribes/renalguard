-- ============================================
-- Populate Treatment Flags for CKD Patients
-- ============================================
-- Migration 019: Sets ckd_treatment_active and medication flags for CKD patients
-- who should be on treatment based on KDIGO guidelines

-- Step 1: Get latest eGFR and uACR for each patient to determine CKD status
WITH latest_labs AS (
  SELECT DISTINCT ON (patient_id)
    patient_id,
    (SELECT value_numeric FROM observations o1
     WHERE o1.patient_id = observations.patient_id
       AND o1.observation_type = 'eGFR'
     ORDER BY o1.observation_date DESC LIMIT 1) as latest_egfr,
    (SELECT value_numeric FROM observations o2
     WHERE o2.patient_id = observations.patient_id
       AND o2.observation_type = 'uACR'
     ORDER BY o2.observation_date DESC LIMIT 1) as latest_uacr
  FROM observations
),
ckd_patients AS (
  SELECT
    p.id,
    ll.latest_egfr,
    ll.latest_uacr,
    CASE
      WHEN ll.latest_egfr < 60 OR ll.latest_uacr >= 30 THEN true
      ELSE false
    END as has_ckd,
    CASE
      WHEN ll.latest_egfr < 30 THEN 'severe' -- Stage 4-5
      WHEN ll.latest_egfr < 60 THEN 'moderate' -- Stage 3
      ELSE 'mild'
    END as ckd_severity
  FROM patients p
  LEFT JOIN latest_labs ll ON p.id = ll.patient_id
)
-- Step 2: Update CKD patients to have treatment active with appropriate medications
UPDATE patients
SET
  ckd_treatment_active = true,
  on_ras_inhibitor = true,  -- RAS inhibitors are first-line for CKD
  on_sglt2i = CASE
    WHEN ckd.ckd_severity IN ('moderate', 'severe') AND ckd.latest_egfr >= 20 THEN true
    ELSE false
  END,
  ckd_treatment_type = 'RAS Inhibitor + SGLT2i Combination'
FROM ckd_patients ckd
WHERE patients.id = ckd.id
  AND ckd.has_ckd = true
  AND ckd.latest_egfr IS NOT NULL;

-- Step 3: Log the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM patients
  WHERE ckd_treatment_active = true;

  RAISE NOTICE '✓ Updated % CKD patients with treatment flags', updated_count;
END $$;

SELECT 'CKD patient treatment flags populated successfully!' AS status;
