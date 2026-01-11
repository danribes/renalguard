-- ====================================================================
-- WEB-FRIENDLY PROGRESSION TRACKING INITIALIZATION
-- ====================================================================
-- This is a standalone version that works in any PostgreSQL client
-- including web-based interfaces like sqliteonline.com
--
-- It will:
-- 1. Create all progression tracking tables
-- 2. Generate 24 months of data for 230 patients (5,750 records)
-- 3. Detect state transitions
-- 4. Show summary statistics
--
-- Estimated execution time: 2-5 minutes
-- ====================================================================

-- ====================================================================
-- STEP 1: Create Progression Tracking Tables
-- ====================================================================

-- Drop existing tables if re-running
DROP TABLE IF EXISTS action_recommendations CASCADE;
DROP TABLE IF EXISTS monitoring_alerts CASCADE;
DROP TABLE IF EXISTS state_transitions CASCADE;
DROP TABLE IF EXISTS health_state_history CASCADE;
DROP MATERIALIZED VIEW IF EXISTS patient_progression_summary CASCADE;

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- health_state_history table
CREATE TABLE health_state_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    measured_at TIMESTAMP NOT NULL,
    cycle_number INTEGER,
    egfr_value DECIMAL(5, 2) NOT NULL,
    uacr_value DECIMAL(8, 2),
    gfr_category VARCHAR(5) NOT NULL,
    albuminuria_category VARCHAR(5) NOT NULL,
    health_state VARCHAR(10) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    risk_color VARCHAR(10) NOT NULL,
    ckd_stage INTEGER,
    ckd_stage_name VARCHAR(50),
    requires_nephrology_referral BOOLEAN DEFAULT false,
    requires_dialysis_planning BOOLEAN DEFAULT false,
    recommend_ras_inhibitor BOOLEAN DEFAULT false,
    recommend_sglt2i BOOLEAN DEFAULT false,
    target_bp VARCHAR(20),
    monitoring_frequency VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT health_state_unique UNIQUE (patient_id, measured_at)
);

CREATE INDEX idx_health_state_patient ON health_state_history(patient_id);
CREATE INDEX idx_health_state_date ON health_state_history(measured_at);
CREATE INDEX idx_health_state_cycle ON health_state_history(cycle_number);
CREATE INDEX idx_health_state_risk ON health_state_history(risk_level);
CREATE INDEX idx_health_state_category ON health_state_history(gfr_category, albuminuria_category);

-- state_transitions table
CREATE TABLE state_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    transition_date TIMESTAMP NOT NULL,
    from_cycle INTEGER,
    to_cycle INTEGER,
    from_health_state VARCHAR(10) NOT NULL,
    from_gfr_category VARCHAR(5) NOT NULL,
    from_albuminuria_category VARCHAR(5) NOT NULL,
    from_risk_level VARCHAR(20) NOT NULL,
    from_egfr DECIMAL(5, 2),
    from_uacr DECIMAL(8, 2),
    to_health_state VARCHAR(10) NOT NULL,
    to_gfr_category VARCHAR(5) NOT NULL,
    to_albuminuria_category VARCHAR(5) NOT NULL,
    to_risk_level VARCHAR(20) NOT NULL,
    to_egfr DECIMAL(5, 2),
    to_uacr DECIMAL(8, 2),
    change_type VARCHAR(20) NOT NULL,
    egfr_change DECIMAL(6, 2),
    uacr_change DECIMAL(8, 2),
    gfr_trend VARCHAR(20),
    albuminuria_trend VARCHAR(20),
    category_changed BOOLEAN DEFAULT false,
    risk_changed BOOLEAN DEFAULT false,
    risk_increased BOOLEAN DEFAULT false,
    crossed_critical_threshold BOOLEAN DEFAULT false,
    alert_generated BOOLEAN DEFAULT false,
    alert_severity VARCHAR(20),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transitions_patient ON state_transitions(patient_id);
CREATE INDEX idx_transitions_date ON state_transitions(transition_date);
CREATE INDEX idx_transitions_type ON state_transitions(change_type);
CREATE INDEX idx_transitions_alert ON state_transitions(alert_generated, alert_severity);

-- monitoring_alerts table
CREATE TABLE monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    transition_id UUID REFERENCES state_transitions(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    priority INTEGER DEFAULT 3,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    alert_reasons TEXT[],
    current_health_state VARCHAR(10),
    previous_health_state VARCHAR(10),
    egfr_value DECIMAL(5, 2),
    uacr_value DECIMAL(8, 2),
    status VARCHAR(20) DEFAULT 'active',
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    requires_action BOOLEAN DEFAULT false,
    action_taken TEXT,
    action_taken_at TIMESTAMP,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_patient ON monitoring_alerts(patient_id);
CREATE INDEX idx_alerts_status ON monitoring_alerts(status);
CREATE INDEX idx_alerts_severity ON monitoring_alerts(severity, priority);
CREATE INDEX idx_alerts_generated ON monitoring_alerts(generated_at);

-- action_recommendations table
CREATE TABLE action_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES monitoring_alerts(id) ON DELETE CASCADE,
    transition_id UUID REFERENCES state_transitions(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    rationale TEXT NOT NULL,
    priority INTEGER DEFAULT 3,
    urgency VARCHAR(20) DEFAULT 'routine',
    timeframe VARCHAR(100),
    based_on_health_state VARCHAR(10),
    based_on_risk_level VARCHAR(20),
    triggered_by TEXT[],
    action_items JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    implemented_by VARCHAR(100),
    implemented_at TIMESTAMP,
    completion_notes TEXT,
    outcome VARCHAR(50),
    outcome_notes TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recommendations_patient ON action_recommendations(patient_id);
CREATE INDEX idx_recommendations_status ON action_recommendations(status);
CREATE INDEX idx_recommendations_type ON action_recommendations(recommendation_type);
CREATE INDEX idx_recommendations_priority ON action_recommendations(priority, urgency);
CREATE INDEX idx_recommendations_generated ON action_recommendations(generated_at);

-- ====================================================================
-- STEP 2: Generate Baseline Measurements (Cycle 0)
-- ====================================================================

INSERT INTO health_state_history (
    patient_id,
    measured_at,
    cycle_number,
    egfr_value,
    uacr_value,
    gfr_category,
    albuminuria_category,
    health_state,
    risk_level,
    risk_color,
    ckd_stage,
    ckd_stage_name,
    requires_nephrology_referral,
    requires_dialysis_planning,
    recommend_ras_inhibitor,
    recommend_sglt2i,
    target_bp,
    monitoring_frequency
)
SELECT
    p.id AS patient_id,
    NOW() - INTERVAL '24 months' AS measured_at,
    0 AS cycle_number,
    COALESCE(
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'eGFR'
         ORDER BY observation_date DESC LIMIT 1),
        45.0 + (random() * 40)
    ) AS egfr_value,
    COALESCE(
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'uACR'
         ORDER BY observation_date DESC LIMIT 1),
        CASE
            WHEN random() < 0.4 THEN 10.0 + (random() * 20)
            WHEN random() < 0.8 THEN 40.0 + (random() * 200)
            ELSE 350.0 + (random() * 400)
        END
    ) AS uacr_value,
    CASE
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 90 THEN 'G1'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 60 THEN 'G2'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 45 THEN 'G3a'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 30 THEN 'G3b'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 15 THEN 'G4'
        ELSE 'G5'
    END AS gfr_category,
    CASE
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) < 30 THEN 'A1'
        WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) <= 300 THEN 'A2'
        ELSE 'A3'
    END AS albuminuria_category,
    CONCAT(
        CASE
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 90 THEN 'G1'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 60 THEN 'G2'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 45 THEN 'G3a'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 30 THEN 'G3b'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'eGFR' ORDER BY observation_date DESC LIMIT 1), 60) >= 15 THEN 'G4'
            ELSE 'G5'
        END,
        '-',
        CASE
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) < 30 THEN 'A1'
            WHEN COALESCE((SELECT value_numeric FROM observations WHERE patient_id = p.id AND observation_type = 'uACR' ORDER BY observation_date DESC LIMIT 1), 20) <= 300 THEN 'A2'
            ELSE 'A3'
        END
    ) AS health_state,
    'moderate' AS risk_level,
    'yellow' AS risk_color,
    3 AS ckd_stage,
    'CKD Stage 3' AS ckd_stage_name,
    false, false, false, false,
    '<140/90 mmHg' AS target_bp,
    'Every 6-12 months' AS monitoring_frequency
FROM patients p
WHERE p.id IN (SELECT id FROM patients LIMIT 230);

-- ====================================================================
-- STEP 3: Generate 24 Months of Progression Data
-- ====================================================================

DO $$
DECLARE
    v_patient RECORD;
    v_cycle INTEGER;
    v_baseline_egfr DECIMAL;
    v_baseline_uacr DECIMAL;
    v_current_egfr DECIMAL;
    v_current_uacr DECIMAL;
    v_progression_type VARCHAR(20);
    v_decline_rate DECIMAL;
    v_uacr_change_rate DECIMAL;
    v_monthly_variation DECIMAL;
    v_gfr_cat VARCHAR(5);
    v_alb_cat VARCHAR(5);
    v_health_state VARCHAR(10);
    v_risk_level VARCHAR(20);
    v_risk_color VARCHAR(10);
    v_patient_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting progression data generation...';

    FOR v_patient IN
        SELECT p.id FROM patients p LIMIT 230
    LOOP
        v_patient_count := v_patient_count + 1;

        SELECT egfr_value, uacr_value
        INTO v_baseline_egfr, v_baseline_uacr
        FROM health_state_history
        WHERE patient_id = v_patient.id AND cycle_number = 0;

        -- Assign progression pattern
        CASE
            WHEN random() < 0.30 THEN
                v_progression_type := 'progressive';
                v_decline_rate := -(3.0 + (random() * 3.0)) / 12.0;
                v_uacr_change_rate := (5.0 + (random() * 15.0)) / 12.0;
            WHEN random() < 0.80 THEN
                v_progression_type := 'stable';
                v_decline_rate := -(0.5 + (random() * 1.0)) / 12.0;
                v_uacr_change_rate := (random() * 3.0) / 12.0;
            WHEN random() < 0.95 THEN
                v_progression_type := 'improving';
                v_decline_rate := (0.5 + (random() * 1.5)) / 12.0;
                v_uacr_change_rate := -(5.0 + (random() * 10.0)) / 12.0;
            ELSE
                v_progression_type := 'rapid';
                v_decline_rate := -(8.0 + (random() * 4.0)) / 12.0;
                v_uacr_change_rate := (20.0 + (random() * 30.0)) / 12.0;
        END CASE;

        v_current_egfr := v_baseline_egfr;
        v_current_uacr := v_baseline_uacr;

        FOR v_cycle IN 1..24 LOOP
            v_monthly_variation := (random() * 2.0) - 1.0;
            v_current_egfr := GREATEST(5.0, v_current_egfr + v_decline_rate + v_monthly_variation);
            v_current_uacr := GREATEST(5.0, v_current_uacr + v_uacr_change_rate + (random() * 10.0 - 5.0));

            v_gfr_cat := CASE
                WHEN v_current_egfr >= 90 THEN 'G1'
                WHEN v_current_egfr >= 60 THEN 'G2'
                WHEN v_current_egfr >= 45 THEN 'G3a'
                WHEN v_current_egfr >= 30 THEN 'G3b'
                WHEN v_current_egfr >= 15 THEN 'G4'
                ELSE 'G5'
            END;

            v_alb_cat := CASE
                WHEN v_current_uacr < 30 THEN 'A1'
                WHEN v_current_uacr <= 300 THEN 'A2'
                ELSE 'A3'
            END;

            v_health_state := v_gfr_cat || '-' || v_alb_cat;

            v_risk_level := CASE
                WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A1' THEN 'low'
                WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A2' THEN 'moderate'
                WHEN v_gfr_cat = 'G3a' AND v_alb_cat = 'A1' THEN 'moderate'
                WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A3' THEN 'high'
                WHEN v_gfr_cat = 'G3a' AND v_alb_cat = 'A2' THEN 'high'
                WHEN v_gfr_cat = 'G3b' AND v_alb_cat = 'A1' THEN 'high'
                ELSE 'very_high'
            END;

            v_risk_color := CASE v_risk_level
                WHEN 'low' THEN 'green'
                WHEN 'moderate' THEN 'yellow'
                WHEN 'high' THEN 'orange'
                ELSE 'red'
            END;

            INSERT INTO health_state_history (
                patient_id, measured_at, cycle_number, egfr_value, uacr_value,
                gfr_category, albuminuria_category, health_state,
                risk_level, risk_color, ckd_stage, ckd_stage_name,
                requires_nephrology_referral, requires_dialysis_planning,
                recommend_ras_inhibitor, recommend_sglt2i,
                target_bp, monitoring_frequency
            ) VALUES (
                v_patient.id,
                NOW() - INTERVAL '24 months' + (v_cycle || ' months')::INTERVAL,
                v_cycle, v_current_egfr, v_current_uacr,
                v_gfr_cat, v_alb_cat, v_health_state,
                v_risk_level, v_risk_color,
                CASE
                    WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A1' THEN NULL
                    WHEN v_gfr_cat = 'G1' THEN 1
                    WHEN v_gfr_cat = 'G2' THEN 2
                    WHEN v_gfr_cat IN ('G3a', 'G3b') THEN 3
                    WHEN v_gfr_cat = 'G4' THEN 4
                    ELSE 5
                END,
                CASE
                    WHEN v_gfr_cat IN ('G1', 'G2') AND v_alb_cat = 'A1' THEN 'Not CKD'
                    WHEN v_gfr_cat = 'G1' THEN 'CKD Stage 1'
                    WHEN v_gfr_cat = 'G2' THEN 'CKD Stage 2'
                    WHEN v_gfr_cat = 'G3a' THEN 'CKD Stage 3a'
                    WHEN v_gfr_cat = 'G3b' THEN 'CKD Stage 3b'
                    WHEN v_gfr_cat = 'G4' THEN 'CKD Stage 4'
                    ELSE 'CKD Stage 5 (ESRD)'
                END,
                v_gfr_cat IN ('G3b', 'G4', 'G5') OR v_alb_cat = 'A3',
                v_gfr_cat IN ('G4', 'G5'),
                v_alb_cat IN ('A2', 'A3'),
                v_alb_cat IN ('A2', 'A3') AND v_current_egfr >= 20,
                CASE WHEN v_alb_cat = 'A1' THEN '<140/90 mmHg' ELSE '<130/80 mmHg' END,
                CASE v_risk_level
                    WHEN 'low' THEN 'Annually'
                    WHEN 'moderate' THEN 'Every 6-12 months'
                    WHEN 'high' THEN 'Every 3-6 months'
                    ELSE 'Every 1-3 months'
                END
            );
        END LOOP;

        IF v_patient_count % 50 = 0 THEN
            RAISE NOTICE 'Processed % of 230 patients...', v_patient_count;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '✓ Generated 24-month progression data for % patients!', v_patient_count;
END $$;

-- ====================================================================
-- STEP 4: Detect State Transitions
-- ====================================================================

INSERT INTO state_transitions (
    patient_id, transition_date, from_cycle, to_cycle,
    from_health_state, from_gfr_category, from_albuminuria_category,
    from_risk_level, from_egfr, from_uacr,
    to_health_state, to_gfr_category, to_albuminuria_category,
    to_risk_level, to_egfr, to_uacr,
    change_type, egfr_change, uacr_change,
    gfr_trend, albuminuria_trend,
    category_changed, risk_changed, risk_increased,
    crossed_critical_threshold, alert_generated, alert_severity
)
SELECT
    curr.patient_id,
    curr.measured_at AS transition_date,
    prev.cycle_number AS from_cycle,
    curr.cycle_number AS to_cycle,
    prev.health_state, prev.gfr_category, prev.albuminuria_category,
    prev.risk_level, prev.egfr_value, prev.uacr_value,
    curr.health_state, curr.gfr_category, curr.albuminuria_category,
    curr.risk_level, curr.egfr_value, curr.uacr_value,
    CASE
        WHEN (curr.gfr_category > prev.gfr_category) OR
             (curr.albuminuria_category > prev.albuminuria_category) OR
             (CASE curr.risk_level WHEN 'low' THEN 1 WHEN 'moderate' THEN 2 WHEN 'high' THEN 3 WHEN 'very_high' THEN 4 END >
              CASE prev.risk_level WHEN 'low' THEN 1 WHEN 'moderate' THEN 2 WHEN 'high' THEN 3 WHEN 'very_high' THEN 4 END)
        THEN 'worsened'
        WHEN (curr.gfr_category < prev.gfr_category) OR
             (curr.albuminuria_category < prev.albuminuria_category) OR
             (curr.egfr_value - prev.egfr_value > 5)
        THEN 'improved'
        ELSE 'stable'
    END AS change_type,
    (curr.egfr_value - prev.egfr_value) AS egfr_change,
    (curr.uacr_value - prev.uacr_value) AS uacr_change,
    CASE
        WHEN (curr.egfr_value - prev.egfr_value) > 5 THEN 'improving'
        WHEN (curr.egfr_value - prev.egfr_value) < -5 THEN 'declining'
        ELSE 'stable'
    END AS gfr_trend,
    CASE
        WHEN (curr.uacr_value - prev.uacr_value) < -10 THEN 'improving'
        WHEN (curr.uacr_value - prev.uacr_value) > 10 THEN 'worsening'
        ELSE 'stable'
    END AS albuminuria_trend,
    (curr.health_state != prev.health_state) AS category_changed,
    (curr.risk_level != prev.risk_level) AS risk_changed,
    (CASE curr.risk_level WHEN 'low' THEN 1 WHEN 'moderate' THEN 2 WHEN 'high' THEN 3 WHEN 'very_high' THEN 4 END >
     CASE prev.risk_level WHEN 'low' THEN 1 WHEN 'moderate' THEN 2 WHEN 'high' THEN 3 WHEN 'very_high' THEN 4 END) AS risk_increased,
    ((curr.egfr_value < 30 AND prev.egfr_value >= 30) OR
     (curr.egfr_value < 15 AND prev.egfr_value >= 15) OR
     (curr.uacr_value > 300 AND prev.uacr_value <= 300) OR
     (curr.egfr_value < 45 AND prev.egfr_value >= 45) OR
     (curr.uacr_value > 30 AND prev.uacr_value <= 30)) AS crossed_critical_threshold,
    ((curr.health_state != prev.health_state) OR
     (curr.risk_level != prev.risk_level AND
      CASE curr.risk_level WHEN 'low' THEN 1 WHEN 'moderate' THEN 2 WHEN 'high' THEN 3 WHEN 'very_high' THEN 4 END >
      CASE prev.risk_level WHEN 'low' THEN 1 WHEN 'moderate' THEN 2 WHEN 'high' THEN 3 WHEN 'very_high' THEN 4 END) OR
     (curr.egfr_value < 30 AND prev.egfr_value >= 30) OR
     (curr.uacr_value > 300 AND prev.uacr_value <= 300)) AS alert_generated,
    CASE
        WHEN (curr.egfr_value < 15 AND prev.egfr_value >= 15) THEN 'critical'
        WHEN (curr.egfr_value < 30 AND prev.egfr_value >= 30) THEN 'critical'
        WHEN (curr.uacr_value > 300 AND prev.uacr_value <= 300) THEN 'critical'
        WHEN (curr.gfr_category != prev.gfr_category) THEN 'warning'
        WHEN (curr.albuminuria_category != prev.albuminuria_category) THEN 'warning'
        WHEN (curr.risk_level != prev.risk_level) THEN 'warning'
        ELSE 'info'
    END AS alert_severity
FROM health_state_history curr
INNER JOIN health_state_history prev
    ON curr.patient_id = prev.patient_id
    AND curr.cycle_number = prev.cycle_number + 1
WHERE
    (curr.health_state != prev.health_state)
    OR (curr.risk_level != prev.risk_level)
    OR (ABS(curr.egfr_value - prev.egfr_value) > 5)
    OR (ABS(curr.uacr_value - prev.uacr_value) > 10)
ORDER BY curr.patient_id, curr.cycle_number;

-- ====================================================================
-- STEP 5: Display Summary Statistics
-- ====================================================================

SELECT
    '==================================================================' AS separator,
    'INITIALIZATION COMPLETE!' AS status,
    '==================================================================' AS separator2;

SELECT 'Total health state records' AS metric, COUNT(*)::TEXT AS value FROM health_state_history
UNION ALL
SELECT 'Total state transitions', COUNT(*)::TEXT FROM state_transitions
UNION ALL
SELECT 'Transitions with alerts', COUNT(*)::TEXT FROM state_transitions WHERE alert_generated = true
UNION ALL
SELECT 'Critical transitions', COUNT(*)::TEXT FROM state_transitions WHERE alert_severity = 'critical'
UNION ALL
SELECT 'Warning transitions', COUNT(*)::TEXT FROM state_transitions WHERE alert_severity = 'warning'
UNION ALL
SELECT 'Patients monitored', COUNT(DISTINCT patient_id)::TEXT FROM health_state_history;

SELECT
    'Baseline (Month 0)' AS timepoint,
    COUNT(*) AS measurements,
    ROUND(AVG(egfr_value), 1) AS avg_egfr,
    ROUND(AVG(uacr_value), 1) AS avg_uacr
FROM health_state_history WHERE cycle_number = 0
UNION ALL
SELECT 'Month 12', COUNT(*), ROUND(AVG(egfr_value), 1), ROUND(AVG(uacr_value), 1)
FROM health_state_history WHERE cycle_number = 12
UNION ALL
SELECT 'Month 24 (Current)', COUNT(*), ROUND(AVG(egfr_value), 1), ROUND(AVG(uacr_value), 1)
FROM health_state_history WHERE cycle_number = 24;

SELECT '==================================================================' AS next_steps;
SELECT 'Next: Access the Progression Timeline in your frontend!' AS instruction;
SELECT 'Or run: POST /api/progression/run-monitoring to generate alerts' AS api_endpoint;
SELECT '==================================================================' AS end_message;
