-- Migration: Remove unclassified patients (patients without CKD or non-CKD classification)
-- This migration ensures all patients in the database have proper classification
-- Date: 2025-11-21

-- Step 1: Identify and display unclassified patients (for logging/verification)
DO $$
DECLARE
    unclassified_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unclassified_count
    FROM patients p
    LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
    LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
    WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL;

    RAISE NOTICE 'Found % unclassified patients to remove', unclassified_count;
END $$;

-- Step 2: Delete unclassified patients
-- All related records will be automatically deleted due to CASCADE constraints
DELETE FROM patients
WHERE id IN (
    SELECT p.id
    FROM patients p
    LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
    LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
    WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL
);

-- Step 3: Verify deletion
DO $$
DECLARE
    remaining_unclassified INTEGER;
    total_patients INTEGER;
    ckd_patients INTEGER;
    non_ckd_patients INTEGER;
BEGIN
    -- Check for any remaining unclassified patients
    SELECT COUNT(*) INTO remaining_unclassified
    FROM patients p
    LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
    LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
    WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL;

    -- Get updated counts
    SELECT COUNT(*) INTO total_patients FROM patients;
    SELECT COUNT(*) INTO ckd_patients FROM ckd_patient_data;
    SELECT COUNT(*) INTO non_ckd_patients FROM non_ckd_patient_data;

    RAISE NOTICE '=== Migration Complete ===';
    RAISE NOTICE 'Remaining unclassified patients: %', remaining_unclassified;
    RAISE NOTICE 'Total patients: %', total_patients;
    RAISE NOTICE 'CKD patients: %', ckd_patients;
    RAISE NOTICE 'Non-CKD patients: %', non_ckd_patients;
    RAISE NOTICE 'Sum (CKD + Non-CKD): %', ckd_patients + non_ckd_patients;

    -- Verify total matches classification breakdown
    IF total_patients = (ckd_patients + non_ckd_patients) AND remaining_unclassified = 0 THEN
        RAISE NOTICE 'SUCCESS: All patients are properly classified';
    ELSE
        RAISE EXCEPTION 'ERROR: Patient counts do not match. Investigation required.';
    END IF;
END $$;
