-- ===============================================================
-- COMPLETE DATABASE SETUP - MASTER SCRIPT
-- ===============================================================
-- This is the master script that runs all database enhancements
-- in the correct order to create a complete CKD management system
--
-- Based on: Unified_CKD_Complete_Specification_Enhanced_v3
-- ===============================================================
--
-- IMPORTANT: Run these scripts in order!
--
-- Step 1: Schema enhancement (adds new tables and columns)
-- Step 2: Update existing patients (if any)
-- Step 3: Populate 500 patients with comprehensive data
--
-- Total execution time: 5-10 minutes
-- ===============================================================

\echo '==============================================================='
\echo 'STEP 1: Enhancing database schema...'
\echo '==============================================================='
\i enhance_database_schema.sql

\echo ''
\echo '==============================================================='
\echo 'STEP 2: Updating existing patients...'
\echo '==============================================================='
\i update_existing_patients.sql

\echo ''
\echo '==============================================================='
\echo 'STEP 3: Populating 500 patients...'
\echo '==============================================================='
\i populate_500_patients.sql

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
ORDER BY data_type;

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

SELECT '=== TOP MEDICATIONS ===' as summary;

SELECT
    medication_class,
    COUNT(DISTINCT patient_id) as patients_on_medication,
    ROUND(100.0 * COUNT(DISTINCT patient_id) / (SELECT COUNT(*) FROM patients), 1) as percentage
FROM prescriptions
GROUP BY medication_class
ORDER BY patients_on_medication DESC
LIMIT 10;

\echo ''
\echo '==============================================================='
\echo 'DATABASE SETUP COMPLETE!'
\echo '==============================================================='
\echo 'The database now contains:'
\echo '- Enhanced schema with all specification variables'
\echo '- 500+ patients with comprehensive demographics'
\echo '- Complete vital signs and lab observations'
\echo '- Comorbidities and conditions (ICD-10 coded)'
\echo '- Medications and prescriptions'
\echo '- 12 months of refill history for adherence tracking'
\echo ''
\echo 'The database is now ready for the MCP server v2.0!'
\echo '==============================================================='
