-- ============================================
-- CKD Diagnosis Detection and Early Treatment System
-- Migration: Detect transition from at-risk to CKD diagnosis
-- ============================================

-- ============================================
-- 1. CKD Diagnosis Tracking Table
-- ============================================

CREATE TABLE IF NOT EXISTS ckd_diagnosis_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Diagnosis details
    diagnosis_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ckd_stage_at_diagnosis VARCHAR(5) NOT NULL, -- Stage when first diagnosed (2, 3a, 3b, 4, 5)
    egfr_at_diagnosis DECIMAL(5, 2),

    -- Previous state
    previous_ckd_status VARCHAR(50), -- 'no_ckd', 'at_risk', 'pre_ckd'
    previous_risk_level VARCHAR(20), -- HIGH, MODERATE, LOW

    -- Detection method
    detection_trigger VARCHAR(50) NOT NULL, -- 'egfr_decline', 'persistent_proteinuria', 'manual'
    triggering_observation_id UUID REFERENCES observations(id),

    -- Diagnostic criteria met
    egfr_below_60 BOOLEAN DEFAULT FALSE,
    persistent_proteinuria BOOLEAN DEFAULT FALSE,
    structural_abnormality BOOLEAN DEFAULT FALSE,
    duration_months INTEGER, -- How long criteria have been met

    -- Doctor interaction status
    doctor_notified BOOLEAN DEFAULT FALSE,
    doctor_notification_sent_at TIMESTAMP,
    diagnosis_confirmed BOOLEAN DEFAULT FALSE,
    diagnosis_confirmed_by VARCHAR(100),
    diagnosis_confirmed_at TIMESTAMP,

    -- Notes
    clinical_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ckd_diagnosis_patient_id ON ckd_diagnosis_events(patient_id);
CREATE INDEX idx_ckd_diagnosis_date ON ckd_diagnosis_events(diagnosis_date);
CREATE INDEX idx_ckd_diagnosis_confirmed ON ckd_diagnosis_events(diagnosis_confirmed);

-- ============================================
-- 2. Early Treatment Protocol Table
-- ============================================

CREATE TABLE IF NOT EXISTS ckd_treatment_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    diagnosis_event_id UUID REFERENCES ckd_diagnosis_events(id),

    -- Protocol details
    protocol_name VARCHAR(100) NOT NULL,
    protocol_type VARCHAR(50) NOT NULL, -- 'early_stage_2', 'stage_3', 'stage_4', 'stage_5'
    ckd_stage VARCHAR(5) NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'pending_approval', -- pending_approval, approved, active, completed, discontinued
    initiated_date TIMESTAMP,
    initiated_by VARCHAR(100),

    -- Treatment components (as JSONB for flexibility)
    medication_orders JSONB, -- RAS inhibitors, SGLT2i, etc.
    lab_monitoring_schedule JSONB, -- Frequency of eGFR, potassium, etc.
    referrals JSONB, -- Nephrology, dietitian, etc.
    lifestyle_modifications JSONB, -- Diet, exercise, smoking cessation

    -- Doctor interaction
    treatment_recommended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    treatment_approved BOOLEAN DEFAULT FALSE,
    treatment_approved_by VARCHAR(100),
    treatment_approved_at TIMESTAMP,
    approval_notes TEXT,

    -- Effectiveness tracking
    baseline_egfr DECIMAL(5, 2),
    current_egfr DECIMAL(5, 2),
    egfr_change_since_treatment DECIMAL(5, 2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_treatment_protocols_patient_id ON ckd_treatment_protocols(patient_id);
CREATE INDEX idx_treatment_protocols_status ON ckd_treatment_protocols(status);
CREATE INDEX idx_treatment_protocols_stage ON ckd_treatment_protocols(ckd_stage);

-- ============================================
-- 3. Doctor Action Queue Table
-- ============================================

CREATE TABLE IF NOT EXISTS doctor_action_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Action details
    action_type VARCHAR(50) NOT NULL, -- 'confirm_ckd_diagnosis', 'approve_treatment', 'review_progression'
    priority VARCHAR(20) NOT NULL DEFAULT 'MODERATE', -- CRITICAL, HIGH, MODERATE

    -- Related entities
    diagnosis_event_id UUID REFERENCES ckd_diagnosis_events(id),
    treatment_protocol_id UUID REFERENCES ckd_treatment_protocols(id),
    notification_id UUID REFERENCES doctor_notifications(id),

    -- Action prompt
    action_title VARCHAR(200) NOT NULL,
    action_description TEXT NOT NULL,
    recommended_action TEXT,

    -- Clinical context
    clinical_summary JSONB,

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, declined, expired
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    completed_by VARCHAR(100),
    completion_notes TEXT,

    -- Urgency
    auto_expire_hours INTEGER DEFAULT 72, -- Auto-expire if not acted upon
    escalation_level INTEGER DEFAULT 0
);

CREATE INDEX idx_action_queue_patient_id ON doctor_action_queue(patient_id);
CREATE INDEX idx_action_queue_status ON doctor_action_queue(status);
CREATE INDEX idx_action_queue_priority ON doctor_action_queue(priority);
CREATE INDEX idx_action_queue_action_type ON doctor_action_queue(action_type);
CREATE INDEX idx_action_queue_due_date ON doctor_action_queue(due_date);

-- ============================================
-- 4. Add CKD status fields to patients table
-- ============================================

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS ckd_diagnosed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ckd_diagnosis_date DATE,
ADD COLUMN IF NOT EXISTS ckd_diagnosis_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pre_ckd_risk_status VARCHAR(50), -- 'high_risk', 'moderate_risk', 'low_risk', 'no_risk'
ADD COLUMN IF NOT EXISTS on_early_treatment_protocol BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS treatment_protocol_start_date DATE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_patients_ckd_diagnosed ON patients(ckd_diagnosed);
CREATE INDEX IF NOT EXISTS idx_patients_pre_ckd_risk ON patients(pre_ckd_risk_status);
CREATE INDEX IF NOT EXISTS idx_patients_on_treatment ON patients(on_early_treatment_protocol);

-- ============================================
-- 5. Function: Detect CKD Diagnosis Onset
-- ============================================

CREATE OR REPLACE FUNCTION detect_ckd_diagnosis_onset(
    p_patient_id UUID,
    p_current_egfr DECIMAL(5, 2),
    p_current_stage INTEGER,
    p_uacr DECIMAL(10, 2),
    p_previous_egfr DECIMAL(5, 2) DEFAULT NULL
) RETURNS TABLE (
    newly_diagnosed BOOLEAN,
    diagnosis_event_id UUID,
    requires_confirmation BOOLEAN,
    treatment_protocol_recommended BOOLEAN
) AS $$
DECLARE
    v_patient_record RECORD;
    v_already_diagnosed BOOLEAN;
    v_meets_criteria BOOLEAN := FALSE;
    v_detection_trigger VARCHAR(50);
    v_diagnosis_event_id UUID;
    v_persistent_proteinuria BOOLEAN := FALSE;
    v_egfr_below_60 BOOLEAN := FALSE;
    v_previous_risk_level VARCHAR(20);
BEGIN
    -- Get patient current status
    SELECT
        ckd_diagnosed,
        ckd_diagnosis_confirmed,
        current_risk_priority,
        pre_ckd_risk_status
    INTO v_patient_record
    FROM patients
    WHERE id = p_patient_id;

    v_already_diagnosed := COALESCE(v_patient_record.ckd_diagnosed, FALSE);
    v_previous_risk_level := v_patient_record.current_risk_priority;

    -- If already diagnosed and confirmed, return early
    IF v_already_diagnosed AND v_patient_record.ckd_diagnosis_confirmed THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, FALSE, FALSE;
        RETURN;
    END IF;

    -- Check diagnostic criteria

    -- Criterion 1: eGFR < 60 (Stage 3+)
    IF p_current_egfr < 60.0 THEN
        v_meets_criteria := TRUE;
        v_egfr_below_60 := TRUE;
        v_detection_trigger := 'egfr_decline';
    END IF;

    -- Criterion 2: eGFR 60-89 with significant proteinuria (Stage 2)
    IF p_current_egfr >= 60.0 AND p_current_egfr < 90.0 AND p_uacr > 30.0 THEN
        v_meets_criteria := TRUE;
        v_persistent_proteinuria := TRUE;
        IF v_detection_trigger IS NULL THEN
            v_detection_trigger := 'persistent_proteinuria';
        END IF;
    END IF;

    -- Criterion 3: Significant eGFR decline in at-risk patient
    IF p_previous_egfr IS NOT NULL AND p_previous_egfr >= 60.0 AND p_current_egfr < 60.0 THEN
        v_meets_criteria := TRUE;
        v_egfr_below_60 := TRUE;
        v_detection_trigger := 'egfr_decline';
    END IF;

    -- If criteria met and not already diagnosed, create diagnosis event
    IF v_meets_criteria AND NOT v_already_diagnosed THEN

        -- Create diagnosis event
        INSERT INTO ckd_diagnosis_events (
            patient_id,
            diagnosis_date,
            ckd_stage_at_diagnosis,
            egfr_at_diagnosis,
            previous_ckd_status,
            previous_risk_level,
            detection_trigger,
            egfr_below_60,
            persistent_proteinuria,
            doctor_notified,
            diagnosis_confirmed
        ) VALUES (
            p_patient_id,
            CURRENT_TIMESTAMP,
            CASE
                WHEN p_current_stage >= 2 THEN p_current_stage::VARCHAR
                ELSE '2'
            END,
            p_current_egfr,
            CASE
                WHEN v_patient_record.pre_ckd_risk_status IS NOT NULL
                THEN v_patient_record.pre_ckd_risk_status
                ELSE 'at_risk'
            END,
            v_previous_risk_level,
            v_detection_trigger,
            v_egfr_below_60,
            v_persistent_proteinuria,
            FALSE,
            FALSE
        ) RETURNING id INTO v_diagnosis_event_id;

        -- Update patient record
        UPDATE patients
        SET
            ckd_diagnosed = TRUE,
            ckd_diagnosis_date = CURRENT_DATE,
            ckd_diagnosis_confirmed = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_patient_id;

        -- Return results
        RETURN QUERY SELECT
            TRUE,  -- newly_diagnosed
            v_diagnosis_event_id,
            TRUE,  -- requires_confirmation
            TRUE;  -- treatment_protocol_recommended

    ELSE
        -- No new diagnosis
        RETURN QUERY SELECT FALSE, NULL::UUID, FALSE, FALSE;
    END IF;

END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Function: Create Doctor Action for CKD Diagnosis
-- ============================================

CREATE OR REPLACE FUNCTION create_ckd_diagnosis_action(
    p_patient_id UUID,
    p_diagnosis_event_id UUID,
    p_action_type VARCHAR(50),
    p_priority VARCHAR(20),
    p_clinical_summary JSONB
) RETURNS UUID AS $$
DECLARE
    v_action_id UUID;
    v_patient_name VARCHAR(200);
    v_patient_mrn VARCHAR(20);
    v_egfr DECIMAL(5, 2);
    v_stage VARCHAR(5);
    v_action_title VARCHAR(200);
    v_action_description TEXT;
    v_recommended_action TEXT;
BEGIN
    -- Get patient details
    SELECT
        first_name || ' ' || last_name,
        medical_record_number
    INTO v_patient_name, v_patient_mrn
    FROM patients
    WHERE id = p_patient_id;

    -- Get diagnosis details
    SELECT egfr_at_diagnosis, ckd_stage_at_diagnosis
    INTO v_egfr, v_stage
    FROM ckd_diagnosis_events
    WHERE id = p_diagnosis_event_id;

    -- Build action based on type
    IF p_action_type = 'confirm_ckd_diagnosis' THEN
        v_action_title := '🔍 Confirm CKD Diagnosis - ' || v_patient_name;
        v_action_description := format(
            'Patient %s (MRN: %s) shows criteria for CKD Stage %s diagnosis.

Current Clinical Status:
• eGFR: %s mL/min/1.73m²
• CKD Stage: %s
• Detection: Automatic algorithm

DIAGNOSTIC CRITERIA MET:
%s

REQUIRED ACTION:
Please review the patient''s clinical data and confirm or reject this CKD diagnosis.',
            v_patient_name,
            v_patient_mrn,
            v_stage,
            v_egfr,
            v_stage,
            CASE
                WHEN v_egfr < 60 THEN '✓ eGFR < 60 mL/min/1.73m² (persistent kidney function decline)'
                ELSE '✓ eGFR 60-89 with significant proteinuria'
            END
        );
        v_recommended_action := 'Review patient history, confirm diagnosis, and initiate appropriate treatment protocol.';

    ELSIF p_action_type = 'approve_treatment' THEN
        v_action_title := '💊 Approve Early CKD Treatment Protocol - ' || v_patient_name;
        v_action_description := format(
            'Patient %s (MRN: %s) has been diagnosed with CKD Stage %s.

RECOMMENDED EARLY TREATMENT PROTOCOL:
• RAS Inhibitor (ACE-I or ARB) - if not contraindicated
• SGLT2 Inhibitor - for renoprotection
• Blood pressure control - target <130/80 mmHg
• Dietary counseling - sodium, protein, phosphorus restriction
• Nephrology referral - for Stage 3+ CKD
• Lab monitoring - eGFR, electrolytes q3-6 months

REQUIRED ACTION:
Please review and approve the recommended treatment protocol.',
            v_patient_name,
            v_patient_mrn,
            v_stage
        );
        v_recommended_action := 'Approve treatment protocol to initiate early CKD management and slow disease progression.';
    END IF;

    -- Create action in queue
    INSERT INTO doctor_action_queue (
        patient_id,
        diagnosis_event_id,
        action_type,
        priority,
        action_title,
        action_description,
        recommended_action,
        clinical_summary,
        status,
        due_date,
        auto_expire_hours
    ) VALUES (
        p_patient_id,
        p_diagnosis_event_id,
        p_action_type,
        p_priority,
        v_action_title,
        v_action_description,
        v_recommended_action,
        p_clinical_summary,
        'pending',
        CURRENT_TIMESTAMP + INTERVAL '48 hours',
        48
    ) RETURNING id INTO v_action_id;

    RETURN v_action_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Function: Generate Early Treatment Protocol
-- ============================================

CREATE OR REPLACE FUNCTION generate_early_treatment_protocol(
    p_patient_id UUID,
    p_diagnosis_event_id UUID,
    p_ckd_stage VARCHAR(5),
    p_baseline_egfr DECIMAL(5, 2)
) RETURNS UUID AS $$
DECLARE
    v_protocol_id UUID;
    v_protocol_name VARCHAR(100);
    v_protocol_type VARCHAR(50);
    v_medications JSONB;
    v_lab_schedule JSONB;
    v_referrals JSONB;
    v_lifestyle JSONB;
BEGIN
    -- Determine protocol based on stage
    v_protocol_type := 'stage_' || p_ckd_stage;
    v_protocol_name := 'Early Stage ' || p_ckd_stage || ' CKD Management Protocol';

    -- Build medication recommendations
    v_medications := jsonb_build_object(
        'ras_inhibitor', jsonb_build_object(
            'recommended', true,
            'priority', 'high',
            'options', jsonb_build_array('Lisinopril', 'Losartan', 'Ramipril'),
            'rationale', 'Slows CKD progression, especially with proteinuria'
        ),
        'sglt2_inhibitor', jsonb_build_object(
            'recommended', CASE WHEN p_ckd_stage::INTEGER >= 2 THEN true ELSE false END,
            'priority', 'high',
            'options', jsonb_build_array('Empagliflozin', 'Dapagliflozin'),
            'rationale', 'Proven renoprotection in CKD stages 2-4'
        ),
        'blood_pressure', jsonb_build_object(
            'target', '<130/80 mmHg',
            'additional_agents', jsonb_build_array('Amlodipine', 'Chlorthalidone'),
            'monitoring', 'Home BP monitoring recommended'
        ),
        'avoid', jsonb_build_array('NSAIDs', 'High-dose PPIs', 'Aminoglycosides')
    );

    -- Build lab monitoring schedule
    v_lab_schedule := jsonb_build_object(
        'egfr_creatinine', CASE
            WHEN p_ckd_stage::INTEGER >= 4 THEN 'Every 3 months'
            WHEN p_ckd_stage::INTEGER = 3 THEN 'Every 3-6 months'
            ELSE 'Every 6-12 months'
        END,
        'electrolytes', 'Every 3-6 months (K+, Na+, Cl-, CO2)',
        'urine_acr', 'Every 3-12 months',
        'lipid_panel', 'Annually',
        'hba1c', 'Every 3 months if diabetic',
        'pth_vitamin_d', CASE
            WHEN p_ckd_stage::INTEGER >= 3 THEN 'Every 6-12 months'
            ELSE 'As indicated'
        END
    );

    -- Build referrals
    v_referrals := jsonb_build_object(
        'nephrology', jsonb_build_object(
            'recommended', CASE WHEN p_ckd_stage::INTEGER >= 3 THEN true ELSE false END,
            'urgency', CASE WHEN p_ckd_stage::INTEGER >= 4 THEN 'urgent' ELSE 'routine' END,
            'rationale', 'Specialist management for Stage 3+ CKD'
        ),
        'dietitian', jsonb_build_object(
            'recommended', true,
            'urgency', 'routine',
            'focus', jsonb_build_array('Sodium restriction', 'Protein modification', 'Phosphorus management')
        ),
        'diabetes_educator', jsonb_build_object(
            'recommended', 'if_diabetic',
            'rationale', 'Glycemic control critical for CKD progression'
        )
    );

    -- Build lifestyle modifications
    v_lifestyle := jsonb_build_object(
        'diet', jsonb_build_object(
            'sodium', '<2000 mg/day',
            'protein', CASE
                WHEN p_ckd_stage::INTEGER >= 3 THEN '0.8 g/kg/day'
                ELSE 'Normal intake'
            END,
            'phosphorus', CASE
                WHEN p_ckd_stage::INTEGER >= 4 THEN '<800-1000 mg/day'
                ELSE 'No restriction'
            END,
            'potassium', 'Monitor based on labs'
        ),
        'exercise', jsonb_build_object(
            'recommendation', '150 minutes moderate activity per week',
            'type', 'Walking, cycling, swimming'
        ),
        'smoking', jsonb_build_object(
            'recommendation', 'Complete cessation',
            'resources', 'Smoking cessation program referral'
        ),
        'weight_management', jsonb_build_object(
            'target', 'BMI 20-25',
            'strategy', 'Gradual weight loss if BMI >30'
        )
    );

    -- Create treatment protocol
    INSERT INTO ckd_treatment_protocols (
        patient_id,
        diagnosis_event_id,
        protocol_name,
        protocol_type,
        ckd_stage,
        status,
        medication_orders,
        lab_monitoring_schedule,
        referrals,
        lifestyle_modifications,
        baseline_egfr,
        current_egfr
    ) VALUES (
        p_patient_id,
        p_diagnosis_event_id,
        v_protocol_name,
        v_protocol_type,
        p_ckd_stage,
        'pending_approval',
        v_medications,
        v_lab_schedule,
        v_referrals,
        v_lifestyle,
        p_baseline_egfr,
        p_baseline_egfr
    ) RETURNING id INTO v_protocol_id;

    RETURN v_protocol_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Comments
-- ============================================

COMMENT ON TABLE ckd_diagnosis_events IS 'Tracks when patients transition from at-risk to CKD diagnosis';
COMMENT ON TABLE ckd_treatment_protocols IS 'Early treatment protocols for newly diagnosed CKD patients';
COMMENT ON TABLE doctor_action_queue IS 'Actions requiring doctor review and approval';
COMMENT ON FUNCTION detect_ckd_diagnosis_onset IS 'Detects when a patient meets criteria for CKD diagnosis';
COMMENT ON FUNCTION create_ckd_diagnosis_action IS 'Creates doctor action for diagnosis confirmation';
COMMENT ON FUNCTION generate_early_treatment_protocol IS 'Generates evidence-based early treatment protocol';

-- ============================================
-- 9. Grant permissions (commented out for Render compatibility)
-- ============================================
-- Note: On Render, the connection user has full access to tables it creates.
-- GRANT SELECT, INSERT, UPDATE ON ckd_diagnosis_events TO healthcare_user;
-- GRANT SELECT, INSERT, UPDATE ON ckd_treatment_protocols TO healthcare_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_action_queue TO healthcare_user;

-- ============================================
-- End of Migration
-- ============================================

SELECT 'Migration 004: CKD Diagnosis Detection System installed successfully' AS status;
