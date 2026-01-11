-- ============================================
-- Fix for Observation Trigger Error
-- ============================================
-- Migration 018: Fixes the detect_risk_state_change function
-- that was trying to access NEW.medical_record_number on observations table

CREATE OR REPLACE FUNCTION detect_risk_state_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_id UUID;
    should_notify BOOLEAN := FALSE;
    v_patient_mrn VARCHAR(50);
    v_patient_id UUID;
BEGIN
    -- Determine patient_id based on which table triggered this
    IF TG_TABLE_NAME = 'patients' THEN
        v_patient_id := NEW.id;
        v_patient_mrn := NEW.medical_record_number;
    ELSIF TG_TABLE_NAME = 'observations' THEN
        v_patient_id := NEW.patient_id;
        -- Get MRN from patients table
        SELECT medical_record_number INTO v_patient_mrn
        FROM patients
        WHERE id = NEW.patient_id;
    ELSE
        -- For other tables, try to get from NEW.patient_id
        v_patient_id := NEW.patient_id;
        SELECT medical_record_number INTO v_patient_mrn
        FROM patients
        WHERE id = NEW.patient_id;
    END IF;

    -- Log that trigger was fired
    RAISE NOTICE 'Risk state change detector triggered for patient: %', v_patient_mrn;

    -- Send a notification to the backend via NOTIFY
    -- The backend will listen for this and run the risk assessment
    PERFORM pg_notify(
        'patient_data_updated',
        json_build_object(
            'patient_id', v_patient_id,
            'mrn', v_patient_mrn,
            'table', TG_TABLE_NAME,
            'timestamp', CURRENT_TIMESTAMP
        )::text
    );

    RAISE NOTICE 'Notification sent via pg_notify for patient %', v_patient_mrn;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_risk_state_change IS 'Fixed version that properly handles triggers from different tables';

SELECT 'Observation trigger fix applied successfully!' AS status;
