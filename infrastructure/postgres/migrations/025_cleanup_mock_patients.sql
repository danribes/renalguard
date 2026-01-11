-- Migration 025: Clean up mock patients and unclassified patients
-- This migration removes:
-- 1. All patients with MRN- prefix (mock patients from disabled migrations)
-- 2. All unclassified patients (not in ckd_patient_data or non_ckd_patient_data)
-- Date: 2025-11-24

DO $$
DECLARE
    mrn_deleted_count INTEGER;
    unclassified_deleted_count INTEGER;
    total_before INTEGER;
    total_after INTEGER;
    ckd_count INTEGER;
    non_ckd_count INTEGER;
BEGIN
    -- Get initial counts
    SELECT COUNT(*) INTO total_before FROM patients;

    RAISE NOTICE '=== Starting Patient Cleanup ===';
    RAISE NOTICE 'Total patients before cleanup: %', total_before;

    -- Step 1: Delete all mock patients with MRN- prefix
    DELETE FROM patients
    WHERE medical_record_number LIKE 'MRN-%';

    GET DIAGNOSTICS mrn_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % patients with MRN- prefix', mrn_deleted_count;

    -- Step 2: Delete all unclassified patients
    -- (patients not in ckd_patient_data or non_ckd_patient_data)
    DELETE FROM patients
    WHERE id IN (
        SELECT p.id
        FROM patients p
        LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
        LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
        WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL
    );

    GET DIAGNOSTICS unclassified_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % unclassified patients', unclassified_deleted_count;

    -- Get final counts
    SELECT COUNT(*) INTO total_after FROM patients;
    SELECT COUNT(*) INTO ckd_count FROM ckd_patient_data;
    SELECT COUNT(*) INTO non_ckd_count FROM non_ckd_patient_data;

    RAISE NOTICE '=== Cleanup Complete ===';
    RAISE NOTICE 'Total deleted: %', (mrn_deleted_count + unclassified_deleted_count);
    RAISE NOTICE 'Remaining patients: %', total_after;
    RAISE NOTICE 'CKD patients: %', ckd_count;
    RAISE NOTICE 'Non-CKD patients: %', non_ckd_count;
    RAISE NOTICE 'Classified total: %', (ckd_count + non_ckd_count);

    -- Verify all patients are classified
    IF total_after != (ckd_count + non_ckd_count) THEN
        RAISE WARNING 'WARNING: % patients remain unclassified!', (total_after - ckd_count - non_ckd_count);
    ELSE
        RAISE NOTICE 'SUCCESS: All patients are properly classified';
    END IF;
END $$;
