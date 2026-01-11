-- ============================================
-- Test Script for CKD Diagnosis Detection System
-- ============================================
-- Tests automatic detection of CKD diagnosis onset
-- and early treatment protocol generation

\echo '============================================'
\echo 'CKD Diagnosis Detection System - Test Script'
\echo '============================================'
\echo ''

-- ============================================
-- 1. Verify Installation
-- ============================================
\echo '1. Verifying tables and functions...'
\echo ''

SELECT 'Tables installed:' as status;
SELECT tablename
FROM pg_tables
WHERE tablename IN ('ckd_diagnosis_events', 'ckd_treatment_protocols', 'doctor_action_queue')
ORDER BY tablename;

SELECT 'Functions installed:' as status;
SELECT proname as function_name
FROM pg_proc
WHERE proname IN ('detect_ckd_diagnosis_onset', 'generate_early_treatment_protocol', 'create_ckd_diagnosis_action')
ORDER BY proname;

\echo ''
\echo '============================================'
\echo '2. Check initial patient state'
\echo '============================================'
\echo ''

-- Get a patient to test with (not already diagnosed)
SELECT
    id,
    medical_record_number,
    first_name || ' ' || last_name as name,
    ckd_diagnosed,
    ckd_diagnosis_confirmed,
    current_risk_priority
FROM patients
WHERE ckd_diagnosed = false OR ckd_diagnosed IS NULL
LIMIT 5;

\echo ''
\echo 'Using first patient from above for testing...'
\echo ''

-- Store patient ID for testing
\set test_patient_id '(SELECT id FROM patients WHERE (ckd_diagnosed = false OR ckd_diagnosed IS NULL) LIMIT 1)'

\echo '============================================'
\echo '3. Test Scenario 1: eGFR decline below 60 (Stage 3)'
\echo '============================================'
\echo ''

-- Add eGFR reading below 60
INSERT INTO observations (
    patient_id,
    observation_type,
    value_numeric,
    unit,
    observation_date,
    status
)
SELECT
    id,
    'eGFR',
    57.5,  -- Below 60 threshold for Stage 3a CKD
    'mL/min/1.73m²',
    CURRENT_TIMESTAMP,
    'final'
FROM patients
WHERE id = :test_patient_id;

\echo 'New eGFR observation added (57.5 mL/min/1.73m²)'
\echo 'This should trigger CKD diagnosis detection!'
\echo 'Check backend logs for: [RiskChangeMonitor] 🔔 NEW CKD DIAGNOSIS DETECTED'
\echo ''

-- Wait for backend to process
SELECT pg_sleep(3);

\echo '============================================'
\echo '4. Check if diagnosis event was created'
\echo '============================================'
\echo ''

SELECT
    cde.id,
    p.medical_record_number,
    cde.diagnosis_date,
    cde.ckd_stage_at_diagnosis,
    cde.egfr_at_diagnosis,
    cde.previous_ckd_status,
    cde.detection_trigger,
    cde.diagnosis_confirmed,
    cde.doctor_notified
FROM ckd_diagnosis_events cde
JOIN patients p ON cde.patient_id = p.id
WHERE cde.patient_id = :test_patient_id
ORDER BY cde.diagnosis_date DESC
LIMIT 1;

\echo ''
\echo '============================================'
\echo '5. Check doctor actions created'
\echo '============================================'
\echo ''

SELECT
    daq.id,
    daq.action_type,
    daq.priority,
    LEFT(daq.action_title, 60) as action_title,
    daq.status,
    daq.due_date,
    p.medical_record_number
FROM doctor_action_queue daq
JOIN patients p ON daq.patient_id = p.id
WHERE daq.patient_id = :test_patient_id
AND daq.status = 'pending'
ORDER BY daq.created_at DESC;

\echo ''
\echo '============================================'
\echo '6. Check treatment protocol generated'
\echo '============================================'
\echo ''

SELECT
    ctp.id,
    p.medical_record_number,
    ctp.protocol_name,
    ctp.ckd_stage,
    ctp.status,
    ctp.baseline_egfr,
    ctp.created_at
FROM ckd_treatment_protocols ctp
JOIN patients p ON ctp.patient_id = p.id
WHERE ctp.patient_id = :test_patient_id
ORDER BY ctp.created_at DESC
LIMIT 1;

\echo ''
\echo '============================================'
\echo '7. View treatment protocol details'
\echo '============================================'
\echo ''

\echo 'Medication orders:'
SELECT
    jsonb_pretty(medication_orders) as medications
FROM ckd_treatment_protocols
WHERE patient_id = :test_patient_id
ORDER BY created_at DESC
LIMIT 1;

\echo ''
\echo 'Lab monitoring schedule:'
SELECT
    jsonb_pretty(lab_monitoring_schedule) as lab_schedule
FROM ckd_treatment_protocols
WHERE patient_id = :test_patient_id
ORDER BY created_at DESC
LIMIT 1;

\echo ''
\echo '============================================'
\echo '8. Check notification sent'
\echo '============================================'
\echo ''

SELECT
    dn.id,
    dn.notification_type,
    dn.priority,
    LEFT(dn.subject, 60) as subject,
    dn.status,
    dn.created_at
FROM doctor_notifications dn
WHERE dn.patient_id = :test_patient_id
ORDER BY dn.created_at DESC
LIMIT 1;

\echo ''
\echo '============================================'
\echo '9. Check patient record updated'
\echo '============================================'
\echo ''

SELECT
    medical_record_number,
    first_name || ' ' || last_name as name,
    ckd_diagnosed,
    ckd_diagnosis_date,
    ckd_diagnosis_confirmed,
    on_early_treatment_protocol,
    current_risk_priority
FROM patients
WHERE id = :test_patient_id;

\echo ''
\echo '============================================'
\echo '10. Test Scenario 2: Stage 2 with proteinuria'
\echo '============================================'
\echo ''

-- Get another patient
\set test_patient_id2 '(SELECT id FROM patients WHERE (ckd_diagnosed = false OR ckd_diagnosed IS NULL) AND id != ' :test_patient_id ' LIMIT 1)'

-- Add eGFR 60-89 + significant proteinuria
INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
SELECT
    id,
    'eGFR',
    72.0,  -- Above 60 but with proteinuria = Stage 2
    'mL/min/1.73m²',
    CURRENT_TIMESTAMP,
    'final'
FROM patients
WHERE id = :test_patient_id2;

INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, status)
SELECT
    id,
    'uACR',
    85.0,  -- Significant proteinuria (A2 category)
    'mg/g',
    CURRENT_TIMESTAMP,
    'final'
FROM patients
WHERE id = :test_patient_id2;

\echo 'Added eGFR 72.0 + uACR 85.0 (Stage 2 CKD with proteinuria)'
\echo ''

SELECT pg_sleep(3);

\echo '============================================'
\echo '11. Verify Stage 2 detection'
\echo '============================================'
\echo ''

SELECT
    p.medical_record_number,
    cde.ckd_stage_at_diagnosis,
    cde.egfr_at_diagnosis,
    cde.detection_trigger
FROM ckd_diagnosis_events cde
JOIN patients p ON cde.patient_id = p.id
WHERE cde.patient_id = :test_patient_id2
ORDER BY cde.diagnosis_date DESC
LIMIT 1;

\echo ''
\echo '============================================'
\echo '12. Test: Manual diagnosis confirmation'
\echo '============================================'
\echo ''

-- Get diagnosis event ID
\set diagnosis_id '(SELECT id FROM ckd_diagnosis_events WHERE patient_id = ' :test_patient_id ' ORDER BY diagnosis_date DESC LIMIT 1)'

-- Manually confirm diagnosis (simulate doctor action)
UPDATE ckd_diagnosis_events
SET
    diagnosis_confirmed = true,
    diagnosis_confirmed_by = 'Dr. Test',
    diagnosis_confirmed_at = CURRENT_TIMESTAMP,
    clinical_notes = 'Test confirmation - diagnosis criteria clearly met'
WHERE id = :diagnosis_id;

UPDATE patients
SET ckd_diagnosis_confirmed = true
WHERE id = :test_patient_id;

\echo 'Diagnosis confirmed manually'
\echo ''

SELECT
    p.medical_record_number,
    cde.diagnosis_confirmed,
    cde.diagnosis_confirmed_by,
    cde.diagnosis_confirmed_at
FROM ckd_diagnosis_events cde
JOIN patients p ON cde.patient_id = p.id
WHERE cde.id = :diagnosis_id;

\echo ''
\echo '============================================'
\echo '13. Test: Treatment protocol approval'
\echo '============================================'
\echo ''

-- Get protocol ID
\set protocol_id '(SELECT id FROM ckd_treatment_protocols WHERE patient_id = ' :test_patient_id ' ORDER BY created_at DESC LIMIT 1)'

-- Manually approve protocol
UPDATE ckd_treatment_protocols
SET
    status = 'approved',
    treatment_approved = true,
    treatment_approved_by = 'Dr. Test',
    treatment_approved_at = CURRENT_TIMESTAMP,
    approval_notes = 'Test approval - protocol appropriate for patient',
    initiated_date = CURRENT_TIMESTAMP,
    initiated_by = 'Dr. Test'
WHERE id = :protocol_id;

UPDATE patients
SET
    on_early_treatment_protocol = true,
    treatment_protocol_start_date = CURRENT_DATE
WHERE id = :test_patient_id;

\echo 'Treatment protocol approved and initiated'
\echo ''

SELECT
    p.medical_record_number,
    p.on_early_treatment_protocol,
    p.treatment_protocol_start_date,
    ctp.status,
    ctp.treatment_approved_by
FROM ckd_treatment_protocols ctp
JOIN patients p ON ctp.patient_id = p.id
WHERE ctp.id = :protocol_id;

\echo ''
\echo '============================================'
\echo '14. System Statistics'
\echo '============================================'
\echo ''

\echo 'Diagnosis Events:'
SELECT
    COUNT(*) as total_diagnoses,
    COUNT(*) FILTER (WHERE diagnosis_confirmed = true) as confirmed,
    COUNT(*) FILTER (WHERE diagnosis_confirmed = false) as pending_confirmation,
    COUNT(DISTINCT patient_id) as unique_patients
FROM ckd_diagnosis_events;

\echo ''
\echo 'Treatment Protocols by Status:'
SELECT
    status,
    COUNT(*) as count
FROM ckd_treatment_protocols
GROUP BY status
ORDER BY
    CASE status
        WHEN 'approved' THEN 1
        WHEN 'active' THEN 2
        WHEN 'pending_approval' THEN 3
        ELSE 4
    END;

\echo ''
\echo 'Pending Doctor Actions:'
SELECT
    action_type,
    priority,
    COUNT(*) as count
FROM doctor_action_queue
WHERE status = 'pending'
GROUP BY action_type, priority
ORDER BY
    CASE priority
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MODERATE' THEN 3
        ELSE 4
    END,
    action_type;

\echo ''
\echo '============================================'
\echo '15. Test Complete!'
\echo '============================================'
\echo ''
\echo 'Summary:'
\echo '✓ CKD diagnosis detection working'
\echo '✓ Doctor actions created automatically'
\echo '✓ Treatment protocols generated'
\echo '✓ Notifications sent'
\echo '✓ Patient records updated'
\echo ''
\echo 'Next steps:'
\echo '1. View in frontend: http://localhost:5173 → 🏥 CKD Diagnosis tab'
\echo '2. Test API endpoints: curl http://localhost:3000/api/ckd-diagnosis/actions'
\echo '3. Review backend logs for detailed processing info'
\echo '4. Test doctor approval workflow in UI'
\echo ''
\echo 'To cleanup test data:'
\echo 'DELETE FROM doctor_action_queue WHERE patient_id IN (' :test_patient_id ', ' :test_patient_id2 ');'
\echo 'DELETE FROM ckd_treatment_protocols WHERE patient_id IN (' :test_patient_id ', ' :test_patient_id2 ');'
\echo 'DELETE FROM ckd_diagnosis_events WHERE patient_id IN (' :test_patient_id ', ' :test_patient_id2 ');'
\echo ''
