-- Migration 026: Remove ALL unclassified patients
-- This migration removes patients that are not in either ckd_patient_data or non_ckd_patient_data
-- This ensures database integrity and removes the 200 unclassified patients
-- Date: 2025-11-24

DO $$
DECLARE
    unclassified_count INTEGER;
    total_before INTEGER;
    total_after INTEGER;
    ckd_count INTEGER;
    non_ckd_count INTEGER;
BEGIN
    -- Get initial counts
    SELECT COUNT(*) INTO total_before FROM patients;

    SELECT COUNT(*) INTO unclassified_count
    FROM patients p
    LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
    LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
    WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL;

    RAISE NOTICE '=== Starting Unclassified Patient Cleanup ===';
    RAISE NOTICE 'Total patients: %', total_before;
    RAISE NOTICE 'Unclassified patients found: %', unclassified_count;

    -- Delete all unclassified patients
    -- All related records will be automatically deleted due to CASCADE constraints
    DELETE FROM patients
    WHERE id IN (
        SELECT p.id
        FROM patients p
        LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
        LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
        WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL
    );

    -- Get final counts
    SELECT COUNT(*) INTO total_after FROM patients;
    SELECT COUNT(*) INTO ckd_count FROM ckd_patient_data;
    SELECT COUNT(*) INTO non_ckd_count FROM non_ckd_patient_data;

    RAISE NOTICE '=== Cleanup Complete ===';
    RAISE NOTICE 'Deleted: % unclassified patients', unclassified_count;
    RAISE NOTICE 'Remaining patients: %', total_after;
    RAISE NOTICE 'CKD patients: %', ckd_count;
    RAISE NOTICE 'Non-CKD patients: %', non_ckd_count;
    RAISE NOTICE 'Total classified: %', (ckd_count + non_ckd_count);

    -- Final verification
    IF total_after = (ckd_count + non_ckd_count) THEN
        RAISE NOTICE '✓ SUCCESS: All patients are properly classified';
    ELSE
        RAISE WARNING '⚠ WARNING: Database integrity issue - counts do not match';
    END IF;
END $$;
