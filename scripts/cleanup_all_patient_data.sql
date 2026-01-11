-- ===============================================================
-- SAFE DATA CLEANUP - DELETE ALL PATIENT RECORDS
-- ===============================================================
-- This script safely deletes ALL patient data from the database
-- while preserving the database schema (tables, columns, indexes).
--
-- USE CASE: You want to start fresh with new patient data
--
-- WHAT IT DOES:
-- ✓ Deletes all patient records and related data
-- ✓ Preserves database structure (tables remain)
-- ✓ Preserves reference data (medications table)
-- ✓ Respects foreign key constraints (deletes in correct order)
-- ✓ Shows counts before and after deletion
--
-- WHAT IT DOES NOT DO:
-- ✗ Does NOT drop tables
-- ✗ Does NOT delete the database
-- ✗ Does NOT affect database schema
--
-- AFTER RUNNING THIS SCRIPT:
-- You can re-run populate_1001_patients_verified.sql to generate
-- fresh data with no duplicates and proper gender-name concordance.
-- ===============================================================

-- Show current state BEFORE deletion
\echo ''
\echo '========================================='
\echo 'CURRENT DATABASE STATE (BEFORE CLEANUP)'
\echo '========================================='

SELECT 'Patients' as table_name, COUNT(*) as record_count FROM patients
UNION ALL
SELECT 'Observations', COUNT(*) FROM observations
UNION ALL
SELECT 'Conditions', COUNT(*) FROM conditions
UNION ALL
SELECT 'Prescriptions', COUNT(*) FROM prescriptions
UNION ALL
SELECT 'Refills', COUNT(*) FROM refills
UNION ALL
SELECT 'Urine Analysis', COUNT(*) FROM urine_analysis
UNION ALL
SELECT 'Hematology', COUNT(*) FROM hematology
UNION ALL
SELECT 'Risk Assessments', COUNT(*) FROM risk_assessments
UNION ALL
SELECT 'Treatment Recommendations', COUNT(*) FROM treatment_recommendations
UNION ALL
SELECT 'Adherence Monitoring', COUNT(*) FROM adherence_monitoring
ORDER BY table_name;

\echo ''
\echo '========================================='
\echo 'STARTING DATA CLEANUP...'
\echo '========================================='

-- Start transaction for safety
BEGIN;

-- Delete in correct order (respecting foreign key constraints)

-- 1. Delete refills first (references prescriptions and patients)
DELETE FROM refills;
\echo 'Deleted all refills'

-- 2. Delete prescriptions (references patients)
DELETE FROM prescriptions;
\echo 'Deleted all prescriptions'

-- 3. Delete observations (references patients)
DELETE FROM observations;
\echo 'Deleted all observations'

-- 4. Delete conditions (references patients)
DELETE FROM conditions;
\echo 'Deleted all conditions'

-- 5. Delete urine analysis (references patients)
DELETE FROM urine_analysis;
\echo 'Deleted all urine analysis records'

-- 6. Delete hematology (references patients)
DELETE FROM hematology;
\echo 'Deleted all hematology records'

-- 7. Delete risk assessments (references patients)
DELETE FROM risk_assessments WHERE patient_id IS NOT NULL;
\echo 'Deleted all risk assessments'

-- 8. Delete treatment recommendations (references patients)
DELETE FROM treatment_recommendations WHERE patient_id IS NOT NULL;
\echo 'Deleted all treatment recommendations'

-- 9. Delete adherence monitoring (references patients)
DELETE FROM adherence_monitoring WHERE patient_id IS NOT NULL;
\echo 'Deleted all adherence monitoring records'

-- 10. Delete CKD patient data (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ckd_patient_data') THEN
        DELETE FROM ckd_patient_data;
        RAISE NOTICE 'Deleted all CKD patient data';
    END IF;
END $$;

-- 11. Delete non-CKD patient data (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'non_ckd_patient_data') THEN
        DELETE FROM non_ckd_patient_data;
        RAISE NOTICE 'Deleted all non-CKD patient data';
    END IF;
END $$;

-- 12. Finally, delete patients (the main table)
DELETE FROM patients;
\echo 'Deleted all patients'

-- Commit the transaction
COMMIT;

\echo ''
\echo '========================================='
\echo 'CLEANUP COMPLETED SUCCESSFULLY!'
\echo '========================================='

-- Show current state AFTER deletion
\echo ''
\echo '========================================='
\echo 'DATABASE STATE (AFTER CLEANUP)'
\echo '========================================='

SELECT 'Patients' as table_name, COUNT(*) as record_count FROM patients
UNION ALL
SELECT 'Observations', COUNT(*) FROM observations
UNION ALL
SELECT 'Conditions', COUNT(*) FROM conditions
UNION ALL
SELECT 'Prescriptions', COUNT(*) FROM prescriptions
UNION ALL
SELECT 'Refills', COUNT(*) FROM refills
UNION ALL
SELECT 'Urine Analysis', COUNT(*) FROM urine_analysis
UNION ALL
SELECT 'Hematology', COUNT(*) FROM hematology
ORDER BY table_name;

\echo ''
\echo '========================================='
\echo 'ALL PATIENT DATA HAS BEEN DELETED'
\echo '========================================='
\echo ''
\echo 'Database schema is preserved (tables still exist).'
\echo 'Reference data (medications table) is preserved.'
\echo ''
\echo 'NEXT STEPS:'
\echo '1. Run: psql "$DATABASE_URL" -f populate_1001_patients_verified.sql'
\echo '2. Wait 10-15 minutes for 1001 patients to be generated'
\echo '3. Verify no duplicates and proper gender-name concordance'
\echo ''
\echo 'All counts should now be 0 (zero).'
\echo '========================================='
