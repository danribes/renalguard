-- ===============================================================
-- COMPLETE DATABASE SETUP V2 - MASTER SCRIPT
-- ===============================================================
-- This is the master script that runs all database enhancements
-- including the comprehensive variable list from CKD_Variables_Comprehensive_List.md
--
-- Based on:
-- - Unified_CKD_Complete_Specification_Enhanced_v3.docx
-- - CKD_Variables_Comprehensive_List.md
-- ===============================================================
--
-- Run these scripts in order:
-- 1. Schema enhancement (adds tables and columns)
-- 2. Additional comprehensive variables (urine, hematology, etc.)
-- 3. Update existing patients (if any)
-- 4. Populate 500 patients with comprehensive data
-- 5. Populate comprehensive variables (urine, hematology, symptoms)
--
-- Total execution time: 8-15 minutes
-- ===============================================================

\echo '==============================================================='
\echo 'COMPLETE DATABASE SETUP V2'
\echo 'Including all 180+ variables from comprehensive specification'
\echo '==============================================================='

\echo ''
\echo '==============================================================='
\echo 'STEP 1: Enhancing database schema...'
\echo '==============================================================='
\i enhance_database_schema.sql

\echo ''
\echo '==============================================================='
\echo 'STEP 2: Adding comprehensive variables...'
\echo '==============================================================='
\i add_comprehensive_variables.sql

\echo ''
\echo '==============================================================='
\echo 'STEP 3: Updating existing patients...'
\echo '==============================================================='
\i update_existing_patients.sql

\echo ''
\echo '==============================================================='
\echo 'STEP 4: Populating 500 patients...'
\echo '==============================================================='
\i populate_500_patients.sql

\echo ''
\echo '==============================================================='
\echo 'STEP 5: Populating comprehensive variables...'
\echo '==============================================================='
\i populate_comprehensive_variables.sql

\echo ''
\echo '==============================================================='
\echo 'FINAL VERIFICATION'
\echo '==============================================================='

-- Show comprehensive summary
SELECT '=== PATIENT SUMMARY ===' as summary;

SELECT
    COUNT(*) as total_patients,
    COUNT(*) FILTER (WHERE ckd_diagnosed = TRUE) as with_ckd,
    COUNT(*) FILTER (WHERE has_diabetes = TRUE) as with_diabetes,
    COUNT(*) FILTER (WHERE has_hypertension = TRUE) as with_hypertension,
    COUNT(*) FILTER (WHERE anemia = TRUE) as with_anemia,
    COUNT(*) FILTER (WHERE pedal_edema = TRUE) as with_edema,
    COUNT(*) FILTER (WHERE on_sglt2i = TRUE) as on_sglt2i,
    COUNT(*) FILTER (WHERE on_ras_inhibitor = TRUE) as on_ras_inhibitor
FROM patients;

SELECT '=== DATA COMPLETENESS ===' as summary;

SELECT
    'Observations' as data_type,
    COUNT(*) as total_records
FROM observations
UNION ALL
SELECT
    'Conditions',
    COUNT(*)
FROM conditions
UNION ALL
SELECT
    'Prescriptions',
    COUNT(*)
FROM prescriptions
UNION ALL
SELECT
    'Refills',
    COUNT(*)
FROM refills
UNION ALL
SELECT
    'Urine Analysis',
    COUNT(*)
FROM urine_analysis
UNION ALL
SELECT
    'Hematology',
    COUNT(*)
FROM hematology
ORDER BY data_type;

SELECT '=== CONDITION PREVALENCE ===' as summary;

SELECT
    condition_name,
    COUNT(*) as patient_count,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM patients), 1) as percentage
FROM conditions
GROUP BY condition_name
ORDER BY patient_count DESC
LIMIT 10;

SELECT '=== MEDICATION COVERAGE ===' as summary;

SELECT
    medication_class,
    COUNT(DISTINCT patient_id) as patients_on_medication,
    ROUND(100.0 * COUNT(DISTINCT patient_id) / (SELECT COUNT(*) FROM patients), 1) as percentage
FROM prescriptions
GROUP BY medication_class
ORDER BY patients_on_medication DESC;

SELECT '=== EGFR DISTRIBUTION ===' as summary;

SELECT
    CASE
        WHEN value_numeric >= 90 THEN 'G1 (≥90)'
        WHEN value_numeric >= 60 THEN 'G2 (60-89)'
        WHEN value_numeric >= 45 THEN 'G3a (45-59)'
        WHEN value_numeric >= 30 THEN 'G3b (30-44)'
        WHEN value_numeric >= 15 THEN 'G4 (15-29)'
        ELSE 'G5 (<15)'
    END as gfr_category,
    COUNT(*) as patient_count,
    ROUND(AVG(value_numeric), 1) as avg_egfr
FROM (
    SELECT DISTINCT ON (patient_id) patient_id, value_numeric
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

SELECT '=== CLINICAL SYMPTOMS ===' as summary;

SELECT
    'Anemia' as symptom,
    COUNT(*) FILTER (WHERE anemia = TRUE) as patient_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE anemia = TRUE) / COUNT(*), 1) as percentage
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

SELECT '=== URINE ANALYSIS FINDINGS ===' as summary;

SELECT
    'Abnormal RBC' as finding,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM urine_analysis), 1) as percentage
FROM urine_analysis
WHERE rbc_status = 'Abnormal'
UNION ALL
SELECT
    'Abnormal Pus Cells',
    COUNT(*),
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM urine_analysis), 1)
FROM urine_analysis
WHERE pus_cells = 'Abnormal'
UNION ALL
SELECT
    'Bacteria Present',
    COUNT(*),
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM urine_analysis), 1)
FROM urine_analysis
WHERE bacteria = 'Present'
UNION ALL
SELECT
    'Albumin Positive (>0)',
    COUNT(*),
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM urine_analysis), 1)
FROM urine_analysis
WHERE albumin_level > 0
UNION ALL
SELECT
    'Sugar Positive (>0)',
    COUNT(*),
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM urine_analysis), 1)
FROM urine_analysis
WHERE sugar_level > 0;

\echo ''
\echo '==============================================================='
\echo 'DATABASE SETUP COMPLETE - VERSION 2!'
\echo '==============================================================='
\echo 'The database now contains:'
\echo '- Enhanced schema with 180+ variables'
\echo '- 500+ patients with comprehensive demographics'
\echo '- Complete vital signs and lab observations'
\echo '- Comorbidities and conditions (ICD-10 coded)'
\echo '- Medications and prescriptions'
\echo '- 12 months of refill history for adherence tracking'
\echo '- Urine analysis with microscopy findings'
\echo '- Hematology data with CBC parameters'
\echo '- Clinical symptoms (appetite, edema, anemia)'
\echo '- Additional metabolic markers (BUN, sodium, bicarbonate)'
\echo ''
\echo 'Total Variables Implemented: 180+'
\echo 'Data Points per Patient: 50+'
\echo ''
\echo 'The database is now ready for the MCP server v2.0!'
\echo 'All tools (Phase 1-4) have complete data support.'
\echo '==============================================================='
