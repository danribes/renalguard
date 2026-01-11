-- ===============================================================
-- FIX DUPLICATE PATIENT NAMES
-- ===============================================================
-- This script helps identify and resolve duplicate patient names

-- ===============================================================
-- STEP 1: IDENTIFY DUPLICATES
-- ===============================================================

-- Check how many duplicates exist
SELECT
    'Duplicate Name Combinations' as metric,
    COUNT(*) as duplicate_name_combos
FROM (
    SELECT first_name, last_name, COUNT(*) as dup_count
    FROM patients
    GROUP BY first_name, last_name
    HAVING COUNT(*) > 1
) dup;

-- List all duplicate names with counts
SELECT
    first_name,
    last_name,
    COUNT(*) as occurrences,
    STRING_AGG(id::text, ', ') as patient_ids
FROM patients
GROUP BY first_name, last_name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, first_name, last_name;

-- Total patient count
SELECT
    'Total Patients' as metric,
    COUNT(*) as count
FROM patients;

-- ===============================================================
-- STEP 2: ANALYZE THE PROBLEM
-- ===============================================================

-- Check if we have more than 500 patients (script ran multiple times)
SELECT
    CASE
        WHEN COUNT(*) > 500 THEN 'Script was run multiple times - ' || COUNT(*) || ' patients found'
        WHEN COUNT(*) = 500 THEN 'Exactly 500 patients - possible race condition'
        ELSE 'Less than 500 patients - ' || COUNT(*) || ' found'
    END as diagnosis
FROM patients;

-- Check date distribution (might reveal multiple runs)
SELECT
    DATE_TRUNC('hour', last_visit_date) as visit_hour,
    COUNT(*) as patient_count
FROM patients
GROUP BY DATE_TRUNC('hour', last_visit_date)
ORDER BY patient_count DESC
LIMIT 10;

-- ===============================================================
-- STEP 3: FIX OPTION 1 - DELETE ALL AND START FRESH (RECOMMENDED)
-- ===============================================================

-- DANGER: This deletes ALL patients and related data
-- Uncomment the lines below ONLY if you want to delete everything

-- BEGIN;

-- DELETE FROM refills;
-- DELETE FROM prescriptions;
-- DELETE FROM observations;
-- DELETE FROM conditions;
-- DELETE FROM urine_analysis;
-- DELETE FROM hematology;
-- DELETE FROM patients;

-- COMMIT;

-- After running the above, re-run: populate_500_patients_fixed.sql

-- ===============================================================
-- STEP 4: FIX OPTION 2 - KEEP OLDEST, DELETE DUPLICATES
-- ===============================================================

-- This approach keeps the oldest patient record for each name combination
-- and deletes newer duplicates

-- STEP 4A: Identify which patients to keep (oldest for each name)
WITH ranked_patients AS (
    SELECT
        id,
        first_name,
        last_name,
        medical_record_number,
        date_of_birth,
        ROW_NUMBER() OVER (
            PARTITION BY first_name, last_name
            ORDER BY medical_record_number ASC  -- Oldest MRN = first created
        ) as rn
    FROM patients
),
patients_to_delete AS (
    SELECT id
    FROM ranked_patients
    WHERE rn > 1  -- Keep only the first (oldest) record
)
SELECT
    'Patients to delete' as action,
    COUNT(*) as count
FROM patients_to_delete;

-- STEP 4B: Preview which patients will be deleted
WITH ranked_patients AS (
    SELECT
        id,
        first_name,
        last_name,
        medical_record_number,
        gender,
        ROW_NUMBER() OVER (
            PARTITION BY first_name, last_name
            ORDER BY medical_record_number ASC
        ) as rn
    FROM patients
)
SELECT
    first_name,
    last_name,
    medical_record_number,
    gender,
    'WILL BE DELETED' as status
FROM ranked_patients
WHERE rn > 1
ORDER BY first_name, last_name, medical_record_number;

-- STEP 4C: Actually delete the duplicates
-- DANGER: This permanently deletes duplicate patient records
-- Uncomment the lines below to execute

-- BEGIN;

-- -- Delete related records first (foreign key constraints)
-- WITH ranked_patients AS (
--     SELECT
--         id,
--         first_name,
--         last_name,
--         medical_record_number,
--         ROW_NUMBER() OVER (
--             PARTITION BY first_name, last_name
--             ORDER BY medical_record_number ASC
--         ) as rn
--     FROM patients
-- ),
-- patients_to_delete AS (
--     SELECT id
--     FROM ranked_patients
--     WHERE rn > 1
-- )
-- DELETE FROM refills
-- WHERE patient_id IN (SELECT id FROM patients_to_delete);

-- WITH ranked_patients AS (
--     SELECT
--         id,
--         first_name,
--         last_name,
--         medical_record_number,
--         ROW_NUMBER() OVER (
--             PARTITION BY first_name, last_name
--             ORDER BY medical_record_number ASC
--         ) as rn
--     FROM patients
-- ),
-- patients_to_delete AS (
--     SELECT id
--     FROM ranked_patients
--     WHERE rn > 1
-- )
-- DELETE FROM prescriptions
-- WHERE patient_id IN (SELECT id FROM patients_to_delete);

-- WITH ranked_patients AS (
--     SELECT
--         id,
--         first_name,
--         last_name,
--         medical_record_number,
--         ROW_NUMBER() OVER (
--             PARTITION BY first_name, last_name
--             ORDER BY medical_record_number ASC
--         ) as rn
--     FROM patients
-- ),
-- patients_to_delete AS (
--     SELECT id
--     FROM ranked_patients
--     WHERE rn > 1
-- )
-- DELETE FROM observations
-- WHERE patient_id IN (SELECT id FROM patients_to_delete);

-- WITH ranked_patients AS (
--     SELECT
--         id,
--         first_name,
--         last_name,
--         medical_record_number,
--         ROW_NUMBER() OVER (
--             PARTITION BY first_name, last_name
--             ORDER BY medical_record_number ASC
--         ) as rn
--     FROM patients
-- ),
-- patients_to_delete AS (
--     SELECT id
--     FROM ranked_patients
--     WHERE rn > 1
-- )
-- DELETE FROM conditions
-- WHERE patient_id IN (SELECT id FROM patients_to_delete);

-- WITH ranked_patients AS (
--     SELECT
--         id,
--         first_name,
--         last_name,
--         medical_record_number,
--         ROW_NUMBER() OVER (
--             PARTITION BY first_name, last_name
--             ORDER BY medical_record_number ASC
--         ) as rn
--     FROM patients
-- ),
-- patients_to_delete AS (
--     SELECT id
--     FROM patients_to_delete
--     WHERE rn > 1
-- )
-- DELETE FROM urine_analysis
-- WHERE patient_id IN (SELECT id FROM patients_to_delete);

-- WITH ranked_patients AS (
--     SELECT
--         id,
--         first_name,
--         last_name,
--         medical_record_number,
--         ROW_NUMBER() OVER (
--             PARTITION BY first_name, last_name
--             ORDER BY medical_record_number ASC
--         ) as rn
--     FROM patients
-- ),
-- patients_to_delete AS (
--     SELECT id
--     FROM ranked_patients
--     WHERE rn > 1
-- )
-- DELETE FROM hematology
-- WHERE patient_id IN (SELECT id FROM patients_to_delete);

-- -- Finally, delete the duplicate patients
-- WITH ranked_patients AS (
--     SELECT
--         id,
--         first_name,
--         last_name,
--         medical_record_number,
--         ROW_NUMBER() OVER (
--             PARTITION BY first_name, last_name
--             ORDER BY medical_record_number ASC
--         ) as rn
--     FROM patients
-- )
-- DELETE FROM patients
-- WHERE id IN (
--     SELECT id
--     FROM ranked_patients
--     WHERE rn > 1
-- );

-- COMMIT;

-- ===============================================================
-- STEP 5: VERIFY THE FIX
-- ===============================================================

-- Check for remaining duplicates
SELECT
    'Remaining Duplicates' as metric,
    COUNT(*) as count
FROM (
    SELECT first_name, last_name, COUNT(*) as dup_count
    FROM patients
    GROUP BY first_name, last_name
    HAVING COUNT(*) > 1
) dup;

-- Final patient count
SELECT
    'Final Patient Count' as metric,
    COUNT(*) as count
FROM patients;

-- Check gender distribution
SELECT
    gender,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM patients), 1) as percentage
FROM patients
GROUP BY gender;

-- ===============================================================
-- INSTRUCTIONS
-- ===============================================================

/*
HOW TO USE THIS SCRIPT:

1. First, run STEP 1 and STEP 2 (already uncommented) to diagnose the problem
   In your Codespace terminal:
   psql "$DATABASE_URL" -f fix_duplicate_names.sql

2. Based on the diagnosis, choose one option:

   OPTION 1 (RECOMMENDED): Delete everything and start fresh
   - Uncomment the DELETE queries in STEP 3
   - Run the script again
   - Then re-run: psql "$DATABASE_URL" -f populate_500_patients_fixed.sql

   OPTION 2: Keep oldest patients, delete newer duplicates
   - Uncomment the DELETE queries in STEP 4C
   - Run the script again
   - This preserves the first 500 patients created

3. After fixing, run STEP 5 (already uncommented) to verify

NOTE: The script has been run multiple times if you see >500 patients.
      This is the most common cause of duplicates.
*/
