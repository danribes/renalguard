-- ============================================
-- RENDER.COM DATABASE INITIALIZATION SCRIPT
-- ============================================
-- This script initializes the complete CKD Risk Screening System database
-- Copy and paste this entire file into Render's PostgreSQL Shell
--
-- What this script does:
-- 1. Creates all tables and schema
-- 2. Loads 205 mock patients with comprehensive clinical data
-- 3. Adds monitoring triggers for automatic risk detection
-- 4. Adds CKD diagnosis detection system
-- 5. Verifies data loaded correctly
--
-- Estimated run time: 30-60 seconds
-- ============================================

-- ============================================
-- SECTION 1: Base Schema and Extensions
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SET timezone = 'UTC';

\echo '✓ Extensions created'

-- ============================================
-- SECTION 2: Core Tables
-- ============================================

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_record_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    -- Enhanced fields
    weight DECIMAL(5, 2),
    height INTEGER,
    smoking_status VARCHAR(20),
    cvd_history BOOLEAN DEFAULT false,
    family_history_esrd BOOLEAN DEFAULT false,
    on_ras_inhibitor BOOLEAN DEFAULT false,
    on_sglt2i BOOLEAN DEFAULT false,
    nephrotoxic_meds BOOLEAN DEFAULT false,
    nephrologist_referral BOOLEAN DEFAULT false,
    diagnosis_date DATE,
    last_visit_date DATE,
    next_visit_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clinical observations (lab results)
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    observation_type VARCHAR(50) NOT NULL,
    value_numeric DECIMAL(10, 2),
    value_text VARCHAR(100),
    unit VARCHAR(20),
    observation_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'final',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clinical conditions (diagnoses)
CREATE TABLE IF NOT EXISTS conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    condition_code VARCHAR(20) NOT NULL,
    condition_name VARCHAR(200) NOT NULL,
    clinical_status VARCHAR(20) NOT NULL,
    onset_date DATE,
    recorded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk assessments (AI-generated)
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    risk_score DECIMAL(3, 2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    recommendations TEXT[],
    reasoning TEXT,
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

\echo '✓ Core tables created'

-- ============================================
-- SECTION 3: Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_observations_patient_id ON observations(patient_id);
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(observation_type);
CREATE INDEX IF NOT EXISTS idx_observations_date ON observations(observation_date);
CREATE INDEX IF NOT EXISTS idx_conditions_patient_id ON conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_conditions_status ON conditions(clinical_status);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_patient_id ON risk_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_weight ON patients(weight);
CREATE INDEX IF NOT EXISTS idx_patients_smoking_status ON patients(smoking_status);
CREATE INDEX IF NOT EXISTS idx_patients_cvd_history ON patients(cvd_history);
CREATE INDEX IF NOT EXISTS idx_patients_nephrologist_referral ON patients(nephrologist_referral);
CREATE INDEX IF NOT EXISTS idx_patients_next_visit ON patients(next_visit_date);

\echo '✓ Indexes created'

-- ============================================
-- SECTION 4: Monitoring System Tables
-- ============================================

-- Add monitoring fields to patients
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS monitoring_status VARCHAR(20) DEFAULT 'inactive' CHECK (monitoring_status IN ('active', 'inactive', 'paused')),
ADD COLUMN IF NOT EXISTS current_risk_priority VARCHAR(20),
ADD COLUMN IF NOT EXISTS current_risk_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_risk_assessment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS monitoring_activated_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS monitoring_activated_by VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_patients_monitoring_status ON patients(monitoring_status);
CREATE INDEX IF NOT EXISTS idx_patients_risk_priority ON patients(current_risk_priority);

-- Patient Risk History Table
CREATE TABLE IF NOT EXISTS patient_risk_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assessment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    risk_priority VARCHAR(20) NOT NULL,
    risk_score INTEGER NOT NULL,
    alert_count INTEGER NOT NULL,
    severity_score INTEGER NOT NULL,
    ckd_stage INTEGER,
    egfr DECIMAL(5, 2),
    egfr_trend VARCHAR(20),
    egfr_change DECIMAL(5, 2),
    previous_priority VARCHAR(20),
    priority_changed BOOLEAN DEFAULT FALSE,
    state_escalated BOOLEAN DEFAULT FALSE,
    state_improved BOOLEAN DEFAULT FALSE,
    alerts_json JSONB,
    triggered_by VARCHAR(50) DEFAULT 'auto_scan',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_history_patient_id ON patient_risk_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_date ON patient_risk_history(assessment_date);
CREATE INDEX IF NOT EXISTS idx_risk_history_priority ON patient_risk_history(risk_priority);
CREATE INDEX IF NOT EXISTS idx_risk_history_changed ON patient_risk_history(priority_changed);

-- Notifications Table
CREATE TABLE IF NOT EXISTS doctor_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    risk_history_id UUID REFERENCES patient_risk_history(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    doctor_email VARCHAR(100),
    doctor_name VARCHAR(100),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    old_priority VARCHAR(20),
    new_priority VARCHAR(20),
    alert_summary JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON doctor_notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON doctor_notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON doctor_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON doctor_notifications(sent_at);

\echo '✓ Monitoring tables created'

-- ============================================
-- SECTION 5: CKD Diagnosis Detection Tables
-- ============================================

CREATE TABLE IF NOT EXISTS ckd_diagnosis_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    diagnosis_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ckd_stage_at_diagnosis VARCHAR(5) NOT NULL,
    egfr_at_diagnosis DECIMAL(5, 2),
    previous_ckd_status VARCHAR(50),
    previous_risk_level VARCHAR(20),
    detection_trigger VARCHAR(50) NOT NULL,
    triggering_observation_id UUID REFERENCES observations(id),
    egfr_below_60 BOOLEAN DEFAULT FALSE,
    persistent_proteinuria BOOLEAN DEFAULT FALSE,
    structural_abnormality BOOLEAN DEFAULT FALSE,
    duration_months INTEGER,
    doctor_notified BOOLEAN DEFAULT FALSE,
    doctor_notification_sent_at TIMESTAMP,
    diagnosis_confirmed BOOLEAN DEFAULT FALSE,
    diagnosis_confirmed_by VARCHAR(100),
    diagnosis_confirmed_at TIMESTAMP,
    clinical_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ckd_diagnosis_patient_id ON ckd_diagnosis_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_ckd_diagnosis_date ON ckd_diagnosis_events(diagnosis_date);
CREATE INDEX IF NOT EXISTS idx_ckd_diagnosis_confirmed ON ckd_diagnosis_events(diagnosis_confirmed);

CREATE TABLE IF NOT EXISTS ckd_treatment_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    diagnosis_event_id UUID REFERENCES ckd_diagnosis_events(id),
    protocol_name VARCHAR(100) NOT NULL,
    protocol_type VARCHAR(50) NOT NULL,
    ckd_stage VARCHAR(5) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending_approval',
    initiated_date TIMESTAMP,
    initiated_by VARCHAR(100),
    medication_orders JSONB,
    lab_monitoring_schedule JSONB,
    referrals JSONB,
    lifestyle_modifications JSONB,
    treatment_recommended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    treatment_approved BOOLEAN DEFAULT FALSE,
    treatment_approved_by VARCHAR(100),
    treatment_approved_at TIMESTAMP,
    approval_notes TEXT,
    baseline_egfr DECIMAL(5, 2),
    current_egfr DECIMAL(5, 2),
    egfr_change_since_treatment DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treatment_protocols_patient_id ON ckd_treatment_protocols(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_protocols_status ON ckd_treatment_protocols(status);
CREATE INDEX IF NOT EXISTS idx_treatment_protocols_stage ON ckd_treatment_protocols(ckd_stage);

CREATE TABLE IF NOT EXISTS doctor_action_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MODERATE',
    diagnosis_event_id UUID REFERENCES ckd_diagnosis_events(id),
    treatment_protocol_id UUID REFERENCES ckd_treatment_protocols(id),
    notification_id UUID REFERENCES doctor_notifications(id),
    action_title VARCHAR(200) NOT NULL,
    action_description TEXT NOT NULL,
    recommended_action TEXT,
    clinical_summary JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    completed_by VARCHAR(100),
    completion_notes TEXT,
    auto_expire_hours INTEGER DEFAULT 72,
    escalation_level INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_action_queue_patient_id ON doctor_action_queue(patient_id);
CREATE INDEX IF NOT EXISTS idx_action_queue_status ON doctor_action_queue(status);
CREATE INDEX IF NOT EXISTS idx_action_queue_priority ON doctor_action_queue(priority);
CREATE INDEX IF NOT EXISTS idx_action_queue_action_type ON doctor_action_queue(action_type);
CREATE INDEX IF NOT EXISTS idx_action_queue_due_date ON doctor_action_queue(due_date);

-- Add CKD status fields to patients
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS ckd_diagnosed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ckd_diagnosis_date DATE,
ADD COLUMN IF NOT EXISTS ckd_diagnosis_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pre_ckd_risk_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS on_early_treatment_protocol BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS treatment_protocol_start_date DATE;

CREATE INDEX IF NOT EXISTS idx_patients_ckd_diagnosed ON patients(ckd_diagnosed);
CREATE INDEX IF NOT EXISTS idx_patients_pre_ckd_risk ON patients(pre_ckd_risk_status);
CREATE INDEX IF NOT EXISTS idx_patients_on_treatment ON patients(on_early_treatment_protocol);

\echo '✓ CKD Diagnosis tables created'

-- ============================================
-- SECTION 6: PostgreSQL Functions
-- ============================================

-- Function: Detect Risk State Change (Trigger Function)
CREATE OR REPLACE FUNCTION detect_risk_state_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'patient_data_updated',
        json_build_object(
            'patient_id', NEW.id,
            'mrn', NEW.medical_record_number,
            'table', TG_TABLE_NAME,
            'timestamp', CURRENT_TIMESTAMP
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Record Risk Assessment
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
    state_improved BOOLEAN,
    requires_notification BOOLEAN,
    old_priority VARCHAR(20),
    new_priority VARCHAR(20)
) AS $$
DECLARE
    v_previous_priority VARCHAR(20);
    v_priority_changed BOOLEAN := FALSE;
    v_state_escalated BOOLEAN := FALSE;
    v_state_improved BOOLEAN := FALSE;
    v_requires_notification BOOLEAN := FALSE;
BEGIN
    SELECT current_risk_priority INTO v_previous_priority
    FROM patients WHERE id = p_patient_id;

    IF v_previous_priority IS NOT NULL AND v_previous_priority != p_risk_priority THEN
        v_priority_changed := TRUE;

        IF (v_previous_priority = 'LOW' AND p_risk_priority IN ('MODERATE', 'HIGH', 'CRITICAL')) OR
           (v_previous_priority = 'MODERATE' AND p_risk_priority IN ('HIGH', 'CRITICAL')) OR
           (v_previous_priority = 'HIGH' AND p_risk_priority = 'CRITICAL') THEN
            v_state_escalated := TRUE;
            v_requires_notification := TRUE;
        END IF;

        IF (v_previous_priority = 'CRITICAL' AND p_risk_priority IN ('HIGH', 'MODERATE', 'LOW')) OR
           (v_previous_priority = 'HIGH' AND p_risk_priority IN ('MODERATE', 'LOW')) OR
           (v_previous_priority = 'MODERATE' AND p_risk_priority = 'LOW') THEN
            v_state_improved := TRUE;
            v_requires_notification := TRUE;
        END IF;
    END IF;

    IF v_previous_priority IS NULL AND p_risk_priority IN ('CRITICAL', 'HIGH') THEN
        v_requires_notification := TRUE;
        v_state_escalated := TRUE;
    END IF;

    INSERT INTO patient_risk_history (
        patient_id, risk_priority, risk_score, alert_count, severity_score,
        ckd_stage, egfr, egfr_trend, egfr_change, previous_priority,
        priority_changed, state_escalated, state_improved, alerts_json, triggered_by
    ) VALUES (
        p_patient_id, p_risk_priority, p_risk_score, p_alert_count, p_severity_score,
        p_ckd_stage, p_egfr, p_egfr_trend, p_egfr_change, v_previous_priority,
        v_priority_changed, v_state_escalated, v_state_improved, p_alerts_json, p_triggered_by
    );

    UPDATE patients SET
        current_risk_priority = p_risk_priority,
        current_risk_score = p_risk_score,
        last_risk_assessment_date = CURRENT_TIMESTAMP,
        monitoring_status = CASE
            WHEN p_risk_priority IN ('CRITICAL', 'HIGH') AND monitoring_status = 'inactive'
            THEN 'active' ELSE monitoring_status END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_patient_id;

    RETURN QUERY SELECT v_priority_changed, v_state_escalated, v_state_improved,
                       v_requires_notification, v_previous_priority, p_risk_priority;
END;
$$ LANGUAGE plpgsql;

-- Function: Create Doctor Notification
CREATE OR REPLACE FUNCTION create_doctor_notification(
    p_patient_id UUID, p_risk_history_id UUID, p_notification_type VARCHAR(50),
    p_priority VARCHAR(20), p_subject VARCHAR(200), p_message TEXT,
    p_old_priority VARCHAR(20) DEFAULT NULL, p_new_priority VARCHAR(20) DEFAULT NULL,
    p_alert_summary JSONB DEFAULT NULL, p_doctor_email VARCHAR(100) DEFAULT 'doctor@hospital.com'
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO doctor_notifications (
        patient_id, risk_history_id, notification_type, priority, subject, message,
        doctor_email, old_priority, new_priority, alert_summary, status
    ) VALUES (
        p_patient_id, p_risk_history_id, p_notification_type, p_priority, p_subject, p_message,
        p_doctor_email, p_old_priority, p_new_priority, p_alert_summary, 'pending'
    ) RETURNING id INTO v_notification_id;

    PERFORM pg_notify('send_doctor_notification',
        json_build_object('notification_id', v_notification_id, 'priority', p_priority, 'patient_id', p_patient_id)::text
    );

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Detect CKD Diagnosis Onset
CREATE OR REPLACE FUNCTION detect_ckd_diagnosis_onset(
    p_patient_id UUID, p_current_egfr DECIMAL(5, 2), p_current_stage INTEGER,
    p_uacr DECIMAL(10, 2), p_previous_egfr DECIMAL(5, 2) DEFAULT NULL
) RETURNS TABLE (
    newly_diagnosed BOOLEAN, diagnosis_event_id UUID,
    requires_confirmation BOOLEAN, treatment_protocol_recommended BOOLEAN
) AS $$
DECLARE
    v_already_diagnosed BOOLEAN;
    v_meets_criteria BOOLEAN := FALSE;
    v_diagnosis_event_id UUID;
    v_previous_risk_level VARCHAR(20);
BEGIN
    SELECT ckd_diagnosed, current_risk_priority
    INTO v_already_diagnosed, v_previous_risk_level
    FROM patients WHERE id = p_patient_id;

    IF COALESCE(v_already_diagnosed, FALSE) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, FALSE, FALSE;
        RETURN;
    END IF;

    IF p_current_egfr < 60.0 OR
       (p_current_egfr >= 60.0 AND p_current_egfr < 90.0 AND p_uacr > 30.0) OR
       (p_previous_egfr IS NOT NULL AND p_previous_egfr >= 60.0 AND p_current_egfr < 60.0) THEN
        v_meets_criteria := TRUE;
    END IF;

    IF v_meets_criteria THEN
        INSERT INTO ckd_diagnosis_events (
            patient_id, ckd_stage_at_diagnosis, egfr_at_diagnosis, previous_risk_level,
            detection_trigger, egfr_below_60, persistent_proteinuria
        ) VALUES (
            p_patient_id, COALESCE(p_current_stage::VARCHAR, '2'), p_current_egfr,
            v_previous_risk_level, 'egfr_decline', p_current_egfr < 60.0, p_uacr > 30.0
        ) RETURNING id INTO v_diagnosis_event_id;

        UPDATE patients SET
            ckd_diagnosed = TRUE,
            ckd_diagnosis_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_patient_id;

        RETURN QUERY SELECT TRUE, v_diagnosis_event_id, TRUE, TRUE;
    ELSE
        RETURN QUERY SELECT FALSE, NULL::UUID, FALSE, FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- (Continuing in next part due to length...)

-- Function: Generate Early Treatment Protocol
CREATE OR REPLACE FUNCTION generate_early_treatment_protocol(
    p_patient_id UUID, p_diagnosis_event_id UUID,
    p_ckd_stage VARCHAR(5), p_baseline_egfr DECIMAL(5, 2)
) RETURNS UUID AS $$
DECLARE
    v_protocol_id UUID;
BEGIN
    INSERT INTO ckd_treatment_protocols (
        patient_id, diagnosis_event_id, protocol_name, protocol_type, ckd_stage,
        baseline_egfr, current_egfr, status,
        medication_orders, lab_monitoring_schedule, referrals, lifestyle_modifications
    ) VALUES (
        p_patient_id, p_diagnosis_event_id,
        'Early Stage ' || p_ckd_stage || ' CKD Management Protocol',
        'stage_' || p_ckd_stage, p_ckd_stage, p_baseline_egfr, p_baseline_egfr, 'pending_approval',
        '{"ras_inhibitor": {"recommended": true, "priority": "high"}}'::jsonb,
        '{"egfr_creatinine": "Every 3-6 months", "electrolytes": "Every 3-6 months"}'::jsonb,
        '{"nephrology": {"recommended": true, "urgency": "routine"}}'::jsonb,
        '{"diet": {"sodium": "<2000 mg/day"}, "exercise": {"recommendation": "150 min/week"}}'::jsonb
    ) RETURNING id INTO v_protocol_id;

    RETURN v_protocol_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Create CKD Diagnosis Action
CREATE OR REPLACE FUNCTION create_ckd_diagnosis_action(
    p_patient_id UUID, p_diagnosis_event_id UUID, p_action_type VARCHAR(50),
    p_priority VARCHAR(20), p_clinical_summary JSONB
) RETURNS UUID AS $$
DECLARE
    v_action_id UUID;
    v_patient_name VARCHAR(200);
BEGIN
    SELECT first_name || ' ' || last_name INTO v_patient_name
    FROM patients WHERE id = p_patient_id;

    INSERT INTO doctor_action_queue (
        patient_id, diagnosis_event_id, action_type, priority, clinical_summary,
        action_title, action_description, recommended_action, status, due_date
    ) VALUES (
        p_patient_id, p_diagnosis_event_id, p_action_type, p_priority, p_clinical_summary,
        '🔍 ' || p_action_type || ' - ' || v_patient_name,
        'Patient ' || v_patient_name || ' requires review for CKD diagnosis.',
        'Review patient data and approve action.', 'pending',
        CURRENT_TIMESTAMP + INTERVAL '48 hours'
    ) RETURNING id INTO v_action_id;

    RETURN v_action_id;
END;
$$ LANGUAGE plpgsql;

\echo '✓ Functions created'

-- ============================================
-- SECTION 7: Triggers
-- ============================================

DROP TRIGGER IF EXISTS trg_patient_update ON patients;
CREATE TRIGGER trg_patient_update
    AFTER UPDATE ON patients
    FOR EACH ROW
    WHEN (
        OLD.weight IS DISTINCT FROM NEW.weight OR
        OLD.on_ras_inhibitor IS DISTINCT FROM NEW.on_ras_inhibitor OR
        OLD.on_sglt2i IS DISTINCT FROM NEW.on_sglt2i
    )
    EXECUTE FUNCTION detect_risk_state_change();

DROP TRIGGER IF EXISTS trg_observation_change ON observations;
CREATE TRIGGER trg_observation_change
    AFTER INSERT OR UPDATE ON observations
    FOR EACH ROW
    EXECUTE FUNCTION detect_risk_state_change();

\echo '✓ Triggers created'

-- ============================================
-- SECTION 8: Mock Patient Data (205 patients total)
-- ============================================

\echo 'Loading patient data... (this may take 30-60 seconds)'

-- Insert 5 initial patients (detailed examples)
INSERT INTO patients (id, medical_record_number, first_name, last_name, date_of_birth, gender, email, phone,
    weight, height, smoking_status, cvd_history, family_history_esrd,
    on_ras_inhibitor, on_sglt2i, nephrotoxic_meds, nephrologist_referral,
    diagnosis_date, last_visit_date, next_visit_date)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'MRN001', 'John', 'Anderson', '1958-03-15', 'male',
     'john.anderson@email.com', '+1-555-0101', 92.5, 172, 'Former', true, false,
     true, false, true, false, '2022-05-20', '2025-10-15', '2025-11-28'),
    ('22222222-2222-2222-2222-222222222222', 'MRN002', 'Maria', 'Rodriguez', '1965-07-22', 'female',
     'maria.rodriguez@email.com', '+1-555-0102', 82.0, 162, 'Never', false, false,
     true, false, false, false, '2023-08-10', '2025-10-28', '2026-04-28'),
    ('33333333-3333-3333-3333-333333333333', 'MRN003', 'David', 'Chen', '1980-11-08', 'male',
     'david.chen@email.com', '+1-555-0103', 75.0, 178, 'Never', false, false,
     false, false, false, false, NULL, '2025-11-03', '2026-05-03'),
    ('44444444-4444-4444-4444-444444444444', 'MRN004', 'Sarah', 'Johnson', '1952-05-30', 'female',
     'sarah.johnson@email.com', '+1-555-0104', 78.5, 160, 'Current', true, true,
     true, true, false, true, '2021-03-15', '2025-10-30', '2025-12-15'),
    ('55555555-5555-5555-5555-555555555555', 'MRN005', 'Michael', 'Thompson', '1970-09-12', 'male',
     'michael.thompson@email.com', '+1-555-0105', 95.0, 180, 'Former', false, false,
     true, false, false, false, '2024-01-20', '2025-10-25', '2026-01-25');

-- Insert observations for the 5 patients
-- (Abbreviated for brevity - see original init.sql for full data)
INSERT INTO observations (patient_id, observation_type, value_numeric, value_text, unit, observation_date, notes) VALUES
    ('11111111-1111-1111-1111-111111111111', 'eGFR', 28.5, NULL, 'mL/min/1.73m²', '2025-11-01 09:30:00', 'Stage 4 CKD'),
    ('11111111-1111-1111-1111-111111111111', 'serum_creatinine', 2.4, NULL, 'mg/dL', '2025-11-01 09:30:00', 'Elevated'),
    ('11111111-1111-1111-1111-111111111111', 'uACR', 450, NULL, 'mg/g', '2025-11-01 09:30:00', 'Severely increased'),
    ('22222222-2222-2222-2222-222222222222', 'eGFR', 52.3, NULL, 'mL/min/1.73m²', '2025-10-28 08:15:00', 'Mild-moderate decline'),
    ('33333333-3333-3333-3333-333333333333', 'eGFR', 95.2, NULL, 'mL/min/1.73m²', '2025-11-03 10:45:00', 'Normal'),
    ('44444444-4444-4444-4444-444444444444', 'eGFR', 38.7, NULL, 'mL/min/1.73m²', '2025-10-30 07:30:00', 'Stage 3b CKD'),
    ('55555555-5555-5555-5555-555555555555', 'eGFR', 68.5, NULL, 'mL/min/1.73m²', '2025-11-02 09:00:00', 'Mild decline');

-- Insert conditions for the 5 patients
INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, severity, notes) VALUES
    ('11111111-1111-1111-1111-111111111111', 'E11.9', 'Type 2 Diabetes Mellitus', 'active', '2005-06-15', 'moderate', 'Long-standing'),
    ('11111111-1111-1111-1111-111111111111', 'N18.4', 'Chronic Kidney Disease, Stage 4', 'active', '2020-03-20', 'severe', 'eGFR 15-29'),
    ('22222222-2222-2222-2222-222222222222', 'I10', 'Essential Hypertension', 'active', '2015-04-12', 'moderate', 'On ACE inhibitor'),
    ('44444444-4444-4444-4444-444444444444', 'E11.9', 'Type 2 Diabetes Mellitus', 'active', '2000-03-10', 'moderate', 'Multiple complications');

\echo '✓ Initial 5 patients loaded'

-- Generate 200 additional patients with randomized data
DO $$
DECLARE
    v_patient_id uuid;
    v_age integer;
    v_gender text;
    v_egfr decimal;
    first_names_male text[] := ARRAY['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard'];
    first_names_female text[] := ARRAY['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan'];
    last_names text[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'];
BEGIN
    FOR i IN 1..200 LOOP
        v_patient_id := gen_random_uuid();
        v_gender := CASE WHEN random() < 0.5 THEN 'male' ELSE 'female' END;
        v_age := 40 + floor(random() * 46)::integer;
        v_egfr := 30 + (random() * 70);

        INSERT INTO patients (id, medical_record_number, first_name, last_name, date_of_birth, gender,
            email, weight, height, smoking_status, on_ras_inhibitor, diagnosis_date, last_visit_date)
        VALUES (
            v_patient_id, 'MRN' || lpad((i + 100)::text, 5, '0'),
            CASE WHEN v_gender = 'male' THEN first_names_male[1 + floor(random() * 7)::integer]
                 ELSE first_names_female[1 + floor(random() * 7)::integer] END,
            last_names[1 + floor(random() * 7)::integer],
            (CURRENT_DATE - (v_age * 365))::date, v_gender,
            'patient' || i || '@email.com', 70 + (random() * 40), 165 + floor(random() * 20)::integer,
            CASE WHEN random() < 0.5 THEN 'Never' ELSE 'Former' END,
            random() < 0.5, CURRENT_DATE - (floor(random() * 1000)::integer), CURRENT_DATE - 30
        );

        INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date)
        VALUES (v_patient_id, 'eGFR', v_egfr, 'mL/min/1.73m²', CURRENT_TIMESTAMP - interval '1 day');
    END LOOP;
END $$;

\echo '✓ Additional 200 patients generated'

-- ============================================
-- SECTION 9: Verification
-- ============================================

\echo ''
\echo '=========================================='
\echo 'DATABASE INITIALIZATION COMPLETE!'
\echo '=========================================='
\echo ''

-- Count verification
SELECT 'Total Patients: ' || COUNT(*)::text || ' (expected: 205)' AS verification FROM patients;
SELECT 'Total Observations: ' || COUNT(*)::text AS verification FROM observations;
SELECT 'Total Conditions: ' || COUNT(*)::text AS verification FROM conditions;

\echo ''
\echo 'Sample patient data:'
SELECT medical_record_number, first_name, last_name,
       EXTRACT(YEAR FROM AGE(date_of_birth))::integer AS age
FROM patients
ORDER BY medical_record_number
LIMIT 5;

\echo ''
\echo '=========================================='
\echo 'NEXT STEPS:'
\echo '1. Close this shell'
\echo '2. Set ANTHROPIC_API_KEY in backend env'
\echo '3. Deploy backend service'
\echo '4. Access your app!'
\echo '=========================================='
