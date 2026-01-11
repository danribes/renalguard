-- ============================================
-- CKD Patient Monitoring System
-- Migration: Add monitoring status, risk history, and automatic triggers
-- ============================================

-- ============================================
-- 1. Add monitoring status fields to patients table
-- ============================================

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS monitoring_status VARCHAR(20) DEFAULT 'inactive' CHECK (monitoring_status IN ('active', 'inactive', 'paused')),
ADD COLUMN IF NOT EXISTS current_risk_priority VARCHAR(20),
ADD COLUMN IF NOT EXISTS current_risk_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_risk_assessment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS monitoring_activated_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS monitoring_activated_by VARCHAR(100);

-- Create index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_patients_monitoring_status ON patients(monitoring_status);
CREATE INDEX IF NOT EXISTS idx_patients_risk_priority ON patients(current_risk_priority);

-- ============================================
-- 2. Patient Risk History Table
-- Tracks all risk state changes over time
-- ============================================

CREATE TABLE IF NOT EXISTS patient_risk_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assessment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Risk metrics
    risk_priority VARCHAR(20) NOT NULL, -- CRITICAL, HIGH, MODERATE, LOW
    risk_score INTEGER NOT NULL,
    alert_count INTEGER NOT NULL,
    severity_score INTEGER NOT NULL,

    -- Patient clinical snapshot
    ckd_stage INTEGER,
    egfr DECIMAL(5, 2),
    egfr_trend VARCHAR(20),
    egfr_change DECIMAL(5, 2),

    -- State change detection
    previous_priority VARCHAR(20),
    priority_changed BOOLEAN DEFAULT FALSE,
    state_escalated BOOLEAN DEFAULT FALSE, -- Changed to worse priority
    state_improved BOOLEAN DEFAULT FALSE,  -- Changed to better priority

    -- Alert details (stored as JSON)
    alerts_json JSONB,

    -- Metadata
    triggered_by VARCHAR(50) DEFAULT 'auto_scan', -- auto_scan, manual_review, data_update
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_history_patient_id ON patient_risk_history(patient_id);
CREATE INDEX idx_risk_history_date ON patient_risk_history(assessment_date);
CREATE INDEX idx_risk_history_priority ON patient_risk_history(risk_priority);
CREATE INDEX idx_risk_history_changed ON patient_risk_history(priority_changed);

-- ============================================
-- 3. Notifications Table
-- Tracks all notifications sent to doctors
-- ============================================

CREATE TABLE IF NOT EXISTS doctor_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    risk_history_id UUID REFERENCES patient_risk_history(id) ON DELETE SET NULL,

    -- Notification details
    notification_type VARCHAR(50) NOT NULL, -- state_change, critical_alert, monitoring_required
    priority VARCHAR(20) NOT NULL, -- CRITICAL, HIGH, MODERATE

    -- Message content
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    -- Recipient
    doctor_email VARCHAR(100),
    doctor_name VARCHAR(100),

    -- State tracking
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, read, acknowledged, failed

    -- Alert details
    old_priority VARCHAR(20),
    new_priority VARCHAR(20),
    alert_summary JSONB,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT
);

CREATE INDEX idx_notifications_patient_id ON doctor_notifications(patient_id);
CREATE INDEX idx_notifications_status ON doctor_notifications(status);
CREATE INDEX idx_notifications_priority ON doctor_notifications(priority);
CREATE INDEX idx_notifications_sent_at ON doctor_notifications(sent_at);

-- ============================================
-- 4. Function: Detect Risk State Changes
-- Called when patient data is updated
-- ============================================

CREATE OR REPLACE FUNCTION detect_risk_state_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_id UUID;
    should_notify BOOLEAN := FALSE;
BEGIN
    -- Log that trigger was fired
    RAISE NOTICE 'Risk state change detector triggered for patient: %', NEW.medical_record_number;

    -- Send a notification to the backend via NOTIFY
    -- The backend will listen for this and run the risk assessment
    PERFORM pg_notify(
        'patient_data_updated',
        json_build_object(
            'patient_id', NEW.id,
            'mrn', NEW.medical_record_number,
            'table', TG_TABLE_NAME,
            'timestamp', CURRENT_TIMESTAMP
        )::text
    );

    RAISE NOTICE 'Notification sent via pg_notify for patient %', NEW.medical_record_number;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Function: Process Risk Assessment Result
-- Called by backend after risk assessment is complete
-- ============================================

CREATE OR REPLACE FUNCTION record_risk_assessment(
    p_patient_id UUID,
    p_risk_priority VARCHAR(20),
    p_risk_score INTEGER,
    p_alert_count INTEGER,
    p_severity_score INTEGER,
    p_ckd_stage INTEGER,
    p_egfr DECIMAL(5, 2),
    p_egfr_trend VARCHAR(20),
    p_egfr_change DECIMAL(5, 2),
    p_alerts_json JSONB,
    p_triggered_by VARCHAR(50) DEFAULT 'auto_scan'
) RETURNS TABLE (
    priority_changed BOOLEAN,
    state_escalated BOOLEAN,
    requires_notification BOOLEAN,
    old_priority VARCHAR(20),
    new_priority VARCHAR(20)
) AS $$
DECLARE
    v_previous_priority VARCHAR(20);
    v_previous_risk_score INTEGER;
    v_priority_changed BOOLEAN := FALSE;
    v_state_escalated BOOLEAN := FALSE;
    v_state_improved BOOLEAN := FALSE;
    v_requires_notification BOOLEAN := FALSE;
    v_risk_history_id UUID;
BEGIN
    -- Get current risk state from patients table
    SELECT current_risk_priority, current_risk_score
    INTO v_previous_priority, v_previous_risk_score
    FROM patients
    WHERE id = p_patient_id;

    -- Detect state changes
    IF v_previous_priority IS NOT NULL AND v_previous_priority != p_risk_priority THEN
        v_priority_changed := TRUE;

        -- Check if escalated (got worse)
        IF (v_previous_priority = 'LOW' AND p_risk_priority IN ('MODERATE', 'HIGH', 'CRITICAL')) OR
           (v_previous_priority = 'MODERATE' AND p_risk_priority IN ('HIGH', 'CRITICAL')) OR
           (v_previous_priority = 'HIGH' AND p_risk_priority = 'CRITICAL') THEN
            v_state_escalated := TRUE;
            v_requires_notification := TRUE;
        END IF;

        -- Check if improved (got better)
        IF (v_previous_priority = 'CRITICAL' AND p_risk_priority IN ('HIGH', 'MODERATE', 'LOW')) OR
           (v_previous_priority = 'HIGH' AND p_risk_priority IN ('MODERATE', 'LOW')) OR
           (v_previous_priority = 'MODERATE' AND p_risk_priority = 'LOW') THEN
            v_state_improved := TRUE;
            -- Also notify on improvement, but lower priority
            v_requires_notification := TRUE;
        END IF;
    END IF;

    -- First assessment or entering high-risk state
    IF v_previous_priority IS NULL AND p_risk_priority IN ('CRITICAL', 'HIGH') THEN
        v_requires_notification := TRUE;
        v_state_escalated := TRUE;
    END IF;

    -- Insert into risk history
    INSERT INTO patient_risk_history (
        patient_id,
        assessment_date,
        risk_priority,
        risk_score,
        alert_count,
        severity_score,
        ckd_stage,
        egfr,
        egfr_trend,
        egfr_change,
        previous_priority,
        priority_changed,
        state_escalated,
        state_improved,
        alerts_json,
        triggered_by
    ) VALUES (
        p_patient_id,
        CURRENT_TIMESTAMP,
        p_risk_priority,
        p_risk_score,
        p_alert_count,
        p_severity_score,
        p_ckd_stage,
        p_egfr,
        p_egfr_trend,
        p_egfr_change,
        v_previous_priority,
        v_priority_changed,
        v_state_escalated,
        v_state_improved,
        p_alerts_json,
        p_triggered_by
    ) RETURNING id INTO v_risk_history_id;

    -- Update patients table with current risk state
    UPDATE patients
    SET
        current_risk_priority = p_risk_priority,
        current_risk_score = p_risk_score,
        last_risk_assessment_date = CURRENT_TIMESTAMP,
        -- Activate monitoring if state escalated to HIGH or CRITICAL
        monitoring_status = CASE
            WHEN p_risk_priority IN ('CRITICAL', 'HIGH') AND monitoring_status = 'inactive'
            THEN 'active'
            ELSE monitoring_status
        END,
        monitoring_activated_date = CASE
            WHEN p_risk_priority IN ('CRITICAL', 'HIGH') AND monitoring_status = 'inactive'
            THEN CURRENT_TIMESTAMP
            ELSE monitoring_activated_date
        END,
        monitoring_activated_by = CASE
            WHEN p_risk_priority IN ('CRITICAL', 'HIGH') AND monitoring_status = 'inactive'
            THEN 'auto_trigger'
            ELSE monitoring_activated_by
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_patient_id;

    -- Return results
    RETURN QUERY SELECT
        v_priority_changed,
        v_state_escalated,
        v_requires_notification,
        v_previous_priority,
        p_risk_priority;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Create Triggers on Patient Data Changes
-- ============================================

-- Trigger on patients table updates
DROP TRIGGER IF EXISTS trg_patient_update ON patients;
CREATE TRIGGER trg_patient_update
    AFTER UPDATE ON patients
    FOR EACH ROW
    WHEN (
        -- Only trigger if clinical data changed
        OLD.weight IS DISTINCT FROM NEW.weight OR
        OLD.height IS DISTINCT FROM NEW.height OR
        OLD.smoking_status IS DISTINCT FROM NEW.smoking_status OR
        OLD.on_ras_inhibitor IS DISTINCT FROM NEW.on_ras_inhibitor OR
        OLD.on_sglt2i IS DISTINCT FROM NEW.on_sglt2i OR
        OLD.nephrotoxic_meds IS DISTINCT FROM NEW.nephrotoxic_meds OR
        OLD.nephrologist_referral IS DISTINCT FROM NEW.nephrologist_referral
    )
    EXECUTE FUNCTION detect_risk_state_change();

-- Trigger on observations table inserts/updates
DROP TRIGGER IF EXISTS trg_observation_change ON observations;
CREATE TRIGGER trg_observation_change
    AFTER INSERT OR UPDATE ON observations
    FOR EACH ROW
    EXECUTE FUNCTION detect_risk_state_change();

-- ============================================
-- 7. Function: Get Patient Risk Trend
-- Useful for analysis
-- ============================================

CREATE OR REPLACE FUNCTION get_patient_risk_trend(p_patient_id UUID, p_days INTEGER DEFAULT 90)
RETURNS TABLE (
    assessment_date TIMESTAMP,
    risk_priority VARCHAR(20),
    risk_score INTEGER,
    egfr DECIMAL(5, 2),
    priority_changed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        prh.assessment_date,
        prh.risk_priority,
        prh.risk_score,
        prh.egfr,
        prh.priority_changed
    FROM patient_risk_history prh
    WHERE prh.patient_id = p_patient_id
        AND prh.assessment_date >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
    ORDER BY prh.assessment_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Create notification function
-- ============================================

CREATE OR REPLACE FUNCTION create_doctor_notification(
    p_patient_id UUID,
    p_risk_history_id UUID,
    p_notification_type VARCHAR(50),
    p_priority VARCHAR(20),
    p_subject VARCHAR(200),
    p_message TEXT,
    p_old_priority VARCHAR(20) DEFAULT NULL,
    p_new_priority VARCHAR(20) DEFAULT NULL,
    p_alert_summary JSONB DEFAULT NULL,
    p_doctor_email VARCHAR(100) DEFAULT 'doctor@hospital.com'
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO doctor_notifications (
        patient_id,
        risk_history_id,
        notification_type,
        priority,
        subject,
        message,
        doctor_email,
        old_priority,
        new_priority,
        alert_summary,
        status
    ) VALUES (
        p_patient_id,
        p_risk_history_id,
        p_notification_type,
        p_priority,
        p_subject,
        p_message,
        p_doctor_email,
        p_old_priority,
        p_new_priority,
        p_alert_summary,
        'pending'
    ) RETURNING id INTO v_notification_id;

    -- Notify the backend that a notification needs to be sent
    PERFORM pg_notify(
        'send_doctor_notification',
        json_build_object(
            'notification_id', v_notification_id,
            'priority', p_priority,
            'patient_id', p_patient_id
        )::text
    );

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. Comments for documentation
-- ============================================

COMMENT ON TABLE patient_risk_history IS 'Tracks all risk assessments and state changes over time';
COMMENT ON TABLE doctor_notifications IS 'Stores all notifications sent to doctors about patient state changes';
COMMENT ON FUNCTION detect_risk_state_change() IS 'Trigger function that fires when patient clinical data changes';
COMMENT ON FUNCTION record_risk_assessment IS 'Records a risk assessment and detects state changes';
COMMENT ON FUNCTION create_doctor_notification IS 'Creates a notification for the doctor about a patient state change';

-- ============================================
-- 10. Grant permissions (commented out for Render compatibility)
-- ============================================
-- Note: On Render, the connection user has full access to tables it creates.
-- These grants are only needed for local dev with separate healthcare_user role.
-- GRANT SELECT, INSERT, UPDATE ON patient_risk_history TO healthcare_user;
-- GRANT SELECT, INSERT, UPDATE ON doctor_notifications TO healthcare_user;

-- ============================================
-- End of Migration
-- ============================================

SELECT 'Migration 003: Monitoring triggers installed successfully' AS status;
