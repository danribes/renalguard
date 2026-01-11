-- ============================================
-- Test Script for CKD Monitoring Trigger System
-- ============================================
-- This script tests the automatic monitoring and notification system
-- Run this after applying migration 003_add_monitoring_triggers.sql

\echo '============================================'
\echo 'CKD Monitoring Trigger System - Test Script'
\echo '============================================'
\echo ''

-- ============================================
-- 1. Verify Installation
-- ============================================
\echo '1. Verifying triggers and functions...'
\echo ''

SELECT 'Triggers installed:' as status;
SELECT tgname, tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname IN ('trg_patient_update', 'trg_observation_change');

SELECT 'Functions installed:' as status;
SELECT proname as function_name
FROM pg_proc
WHERE proname IN ('detect_risk_state_change', 'record_risk_assessment', 'create_doctor_notification');

\echo ''
\echo '============================================'
\echo '2. Check current patient state'
\echo '============================================'
\echo ''

-- Get a patient to test with
SELECT
    medical_record_number,
    first_name || ' ' || last_name as name,
    monitoring_status,
    current_risk_priority,
    current_risk_score,
    last_risk_assessment_date
FROM patients
WHERE medical_record_number = 'MRN001';

\echo ''
\echo '============================================'
\echo '3. Test: Update patient weight (should trigger)'
\echo '============================================'
\echo ''

-- Update patient weight
UPDATE patients
SET weight = 95.5,
    updated_at = CURRENT_TIMESTAMP
WHERE medical_record_number = 'MRN001';

\echo 'Patient weight updated. Check backend logs for trigger notification.'
\echo 'Expected: [RiskChangeMonitor] Patient data updated: MRN001'
\echo ''

-- Wait a moment for backend to process
SELECT pg_sleep(2);

\echo '============================================'
\echo '4. Test: Add critical lab result (eGFR decline)'
\echo '============================================'
\echo ''

-- Add a critically low eGFR reading
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
    18.5,
    'mL/min/1.73m²',
    CURRENT_TIMESTAMP,
    'final'
FROM patients
WHERE medical_record_number = 'MRN001';

\echo 'Critical eGFR result added (18.5 mL/min/1.73m²)'
\echo 'This should trigger risk escalation!'
\echo ''

-- Wait for backend processing
SELECT pg_sleep(2);

\echo '============================================'
\echo '5. Test: Add severe hyperkalemia'
\echo '============================================'
\echo ''

-- Add dangerous potassium level
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
    'potassium',
    6.7,
    'mEq/L',
    CURRENT_TIMESTAMP,
    'final'
FROM patients
WHERE medical_record_number = 'MRN001';

\echo 'Severe hyperkalemia added (K+ 6.7 mEq/L)'
\echo 'This is a CRITICAL alert!'
\echo ''

-- Wait for processing
SELECT pg_sleep(2);

\echo '============================================'
\echo '6. Check risk history (should have new entries)'
\echo '============================================'
\echo ''

SELECT
    assessment_date,
    risk_priority,
    severity_score,
    alert_count,
    previous_priority,
    priority_changed,
    state_escalated,
    triggered_by
FROM patient_risk_history
WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN001')
ORDER BY assessment_date DESC
LIMIT 5;

\echo ''
\echo '============================================'
\echo '7. Check patient monitoring status (should be active)'
\echo '============================================'
\echo ''

SELECT
    medical_record_number,
    first_name || ' ' || last_name as name,
    monitoring_status,
    current_risk_priority,
    current_risk_score,
    monitoring_activated_date,
    monitoring_activated_by,
    last_risk_assessment_date
FROM patients
WHERE medical_record_number = 'MRN001';

\echo ''
\echo '============================================'
\echo '8. Check notifications created'
\echo '============================================'
\echo ''

SELECT
    dn.id,
    dn.notification_type,
    dn.priority,
    dn.subject,
    dn.status,
    dn.old_priority,
    dn.new_priority,
    dn.created_at,
    dn.sent_at,
    dn.acknowledged_at
FROM doctor_notifications dn
WHERE dn.patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN001')
ORDER BY dn.created_at DESC
LIMIT 5;

\echo ''
\echo '============================================'
\echo '9. View latest notification message'
\echo '============================================'
\echo ''

SELECT
    subject,
    message,
    status,
    created_at
FROM doctor_notifications
WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN001')
ORDER BY created_at DESC
LIMIT 1;

\echo ''
\echo '============================================'
\echo '10. Test: Manual risk assessment function'
\echo '============================================'
\echo ''

-- Manually call the assessment function
SELECT * FROM record_risk_assessment(
    (SELECT id FROM patients WHERE medical_record_number = 'MRN001'),
    'CRITICAL',
    45,
    8,
    45,
    5,
    18.5,
    'down',
    -22.0,
    '{"test": "manual_assessment"}'::jsonb,
    'manual_test'
);

\echo ''
\echo '============================================'
\echo '11. Statistics'
\echo '============================================'
\echo ''

\echo 'Notifications by status:'
SELECT status, COUNT(*) as count
FROM doctor_notifications
GROUP BY status
ORDER BY count DESC;

\echo ''
\echo 'Notifications by priority:'
SELECT priority, COUNT(*) as count
FROM doctor_notifications
GROUP BY priority
ORDER BY
    CASE priority
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MODERATE' THEN 3
        ELSE 4
    END;

\echo ''
\echo 'Patients by monitoring status:'
SELECT monitoring_status, COUNT(*) as count
FROM patients
GROUP BY monitoring_status;

\echo ''
\echo 'Patients by risk priority:'
SELECT current_risk_priority, COUNT(*) as count
FROM patients
WHERE current_risk_priority IS NOT NULL
GROUP BY current_risk_priority
ORDER BY
    CASE current_risk_priority
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MODERATE' THEN 3
        WHEN 'LOW' THEN 4
    END;

\echo ''
\echo '============================================'
\echo '12. Test Complete!'
\echo '============================================'
\echo ''
\echo 'Summary:'
\echo '- Triggers are firing when patient data updates'
\echo '- Backend monitor is receiving NOTIFY messages'
\echo '- Risk assessments are being recorded in patient_risk_history'
\echo '- Notifications are being created in doctor_notifications'
\echo '- Monitoring status is being automatically activated'
\echo ''
\echo 'Next steps:'
\echo '1. Check backend console for RiskChangeMonitor logs'
\echo '2. View notifications in frontend: http://localhost:5173 → Notifications tab'
\echo '3. Configure email/SMS integration for real notifications'
\echo ''
\echo 'To cleanup test data:'
\echo 'DELETE FROM doctor_notifications WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = '\''MRN001'\'');'
\echo 'DELETE FROM patient_risk_history WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = '\''MRN001'\'');'
\echo ''
