-- Migration: Expand phenotype_type column to accommodate 'Moderate' and 'Low' values
-- The original VARCHAR(5) can only hold 'I', 'II', 'III', 'IV' but not 'Moderate' (8 chars)

-- Step 1: Drop the views that depend on phenotype_type
DROP VIEW IF EXISTS gcua_population_statistics;
DROP VIEW IF EXISTS gcua_high_risk_patients;

-- Step 2: Expand phenotype_type in patient_gcua_assessments table
ALTER TABLE patient_gcua_assessments
ALTER COLUMN phenotype_type TYPE VARCHAR(10);

-- Step 3: Expand gcua_phenotype in patient_risk_factors table
ALTER TABLE patient_risk_factors
ALTER COLUMN gcua_phenotype TYPE VARCHAR(10);

-- Step 4: Recreate gcua_population_statistics view
CREATE OR REPLACE VIEW gcua_population_statistics AS
SELECT
    phenotype_type,
    phenotype_name,
    phenotype_tag,
    COUNT(*) as patient_count,
    ROUND(AVG(module1_five_year_risk), 2) as avg_renal_risk,
    ROUND(AVG(module2_ten_year_risk), 2) as avg_cvd_risk,
    ROUND(AVG(module3_five_year_mortality), 2) as avg_mortality_risk,
    ROUND(AVG(benefit_ratio), 2) as avg_benefit_ratio,
    COUNT(CASE WHEN confidence_level = 'high' THEN 1 END) as high_confidence_count,
    COUNT(CASE WHEN confidence_level = 'moderate' THEN 1 END) as moderate_confidence_count,
    COUNT(CASE WHEN confidence_level = 'low' THEN 1 END) as low_confidence_count
FROM patient_gcua_assessments
WHERE is_eligible = true
  AND assessed_at = (
      SELECT MAX(assessed_at)
      FROM patient_gcua_assessments pga2
      WHERE pga2.patient_id = patient_gcua_assessments.patient_id
  )
GROUP BY phenotype_type, phenotype_name, phenotype_tag
ORDER BY
    CASE phenotype_type
        WHEN 'I' THEN 1
        WHEN 'II' THEN 2
        WHEN 'III' THEN 3
        WHEN 'IV' THEN 4
        WHEN 'Moderate' THEN 5
        WHEN 'Low' THEN 6
    END;

COMMENT ON VIEW gcua_population_statistics IS 'Population-level statistics for GCUA phenotypes (Silent Hunter dashboard)';

-- Step 5: Recreate gcua_high_risk_patients view
CREATE OR REPLACE VIEW gcua_high_risk_patients AS
SELECT
    p.id as patient_id,
    p.medical_record_number as mrn,
    p.first_name || ' ' || p.last_name as patient_name,
    EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as age,
    p.gender,
    ga.phenotype_type,
    ga.phenotype_name,
    ga.phenotype_tag,
    ga.phenotype_color,
    ga.module1_five_year_risk as renal_risk,
    ga.module1_risk_category as renal_risk_category,
    ga.module2_ten_year_risk as cvd_risk,
    ga.module2_risk_category as cvd_risk_category,
    ga.module3_five_year_mortality as mortality_risk,
    ga.module3_risk_category as mortality_risk_category,
    ga.benefit_ratio,
    ga.benefit_ratio_interpretation,
    ga.phenotype_treatment_recommendations as treatment_recommendations,
    ga.kdigo_screening_recommendation,
    ga.cystatin_c_recommended,
    ga.confidence_level,
    ga.missing_data,
    ga.assessed_at
FROM patients p
INNER JOIN patient_gcua_assessments ga ON p.id = ga.patient_id
WHERE ga.is_eligible = true
  AND ga.phenotype_type IN ('I', 'II')
  AND ga.assessed_at = (
      SELECT MAX(assessed_at)
      FROM patient_gcua_assessments ga2
      WHERE ga2.patient_id = p.id
  )
ORDER BY ga.benefit_ratio DESC, ga.module1_five_year_risk DESC;

COMMENT ON VIEW gcua_high_risk_patients IS 'High-risk GCUA patients (Phenotype I & II) requiring priority intervention';

-- Verification
SELECT 'Migration complete: Expanded phenotype_type columns to VARCHAR(10) and recreated views' AS status;
