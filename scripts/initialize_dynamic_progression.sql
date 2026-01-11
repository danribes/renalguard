-- ============================================================================
-- Dynamic Progression Tracking Initialization Script
-- ============================================================================
-- Purpose: Set up tables for dynamic on-demand progression generation
-- No pre-generated data - cycles are created when users navigate the timeline
-- ============================================================================

\echo '================================================'
\echo 'Dynamic CKD Progression Tracking Setup'
\echo '================================================'
\echo ''

-- Drop existing tables in correct order
\echo 'Dropping existing tables...'
DROP TABLE IF EXISTS action_recommendations CASCADE;
DROP TABLE IF EXISTS monitoring_alerts CASCADE;
DROP TABLE IF EXISTS state_transitions CASCADE;
DROP TABLE IF EXISTS health_state_history CASCADE;
DROP TABLE IF EXISTS patient_progression_state CASCADE;

\echo 'Creating progression tracking tables...'

-- ============================================================================
-- Table 1: patient_progression_state
-- Stores progression parameters for consistent dynamic generation
-- ============================================================================
CREATE TABLE patient_progression_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    progression_type VARCHAR(20) NOT NULL CHECK (progression_type IN ('progressive', 'stable', 'improving', 'rapid')),
    baseline_egfr DECIMAL(5, 2) NOT NULL,
    baseline_uacr DECIMAL(8, 2) NOT NULL,
    egfr_decline_rate DECIMAL(6, 4) NOT NULL,  -- mL/min per month
    uacr_change_rate DECIMAL(6, 4) NOT NULL,   -- Decimal percentage per month
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(patient_id)
);

CREATE INDEX idx_progression_state_patient ON patient_progression_state(patient_id);
CREATE INDEX idx_progression_state_type ON patient_progression_state(progression_type);

COMMENT ON TABLE patient_progression_state IS 'Stores consistent progression parameters for dynamic cycle generation';
COMMENT ON COLUMN patient_progression_state.progression_type IS 'progressive (30%), stable (50%), improving (15%), rapid (5%)';
COMMENT ON COLUMN patient_progression_state.egfr_decline_rate IS 'eGFR change per month (negative=decline, positive=improvement)';
COMMENT ON COLUMN patient_progression_state.uacr_change_rate IS 'uACR percentage change per month (e.g., 0.03=3% increase)';

-- ============================================================================
-- Table 2: health_state_history
-- Stores KDIGO health state classifications at each cycle
-- ============================================================================
CREATE TABLE health_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    measured_at TIMESTAMP NOT NULL,
    cycle_number INTEGER NOT NULL,

    -- Lab values
    egfr_value DECIMAL(5, 2) NOT NULL,
    uacr_value DECIMAL(8, 2),

    -- KDIGO Classification
    gfr_category VARCHAR(5) NOT NULL,  -- G1, G2, G3a, G3b, G4, G5
    albuminuria_category VARCHAR(5),  -- A1, A2, A3
    health_state VARCHAR(10) NOT NULL,  -- e.g., "G3a-A2"

    -- Risk Assessment
    risk_level VARCHAR(20) NOT NULL,  -- low, moderate, high, very_high
    risk_color VARCHAR(10) NOT NULL,  -- green, yellow, orange, red

    -- CKD Stage
    ckd_stage INTEGER,  -- 1-5

    -- Monitoring & Clinical Recommendations
    monitoring_frequency VARCHAR(50),
    nephrology_referral_needed BOOLEAN DEFAULT false,
    dialysis_planning_needed BOOLEAN DEFAULT false,
    treatment_recommendations JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(patient_id, cycle_number)
);

CREATE INDEX idx_health_state_patient ON health_state_history(patient_id);
CREATE INDEX idx_health_state_cycle ON health_state_history(patient_id, cycle_number);
CREATE INDEX idx_health_state_measured ON health_state_history(measured_at);
CREATE INDEX idx_health_state_risk ON health_state_history(risk_level);
CREATE INDEX idx_health_state_referral ON health_state_history(nephrology_referral_needed) WHERE nephrology_referral_needed = true;

COMMENT ON TABLE health_state_history IS 'KDIGO health state classifications generated dynamically per cycle';

-- ============================================================================
-- Table 3: state_transitions
-- Records when patients transition between health states
-- ============================================================================
CREATE TABLE state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    transition_date TIMESTAMP NOT NULL,

    -- Cycle information
    from_cycle INTEGER NOT NULL,
    to_cycle INTEGER NOT NULL,

    -- State changes
    from_health_state VARCHAR(10) NOT NULL,
    to_health_state VARCHAR(10) NOT NULL,
    from_gfr_category VARCHAR(5),
    to_gfr_category VARCHAR(5),
    from_albuminuria_category VARCHAR(5),
    to_albuminuria_category VARCHAR(5),
    from_risk_level VARCHAR(20),
    to_risk_level VARCHAR(20),

    -- Change analysis
    change_type VARCHAR(20),  -- improved, worsened, stable
    egfr_change DECIMAL(6, 2),
    uacr_change DECIMAL(8, 2),
    egfr_trend VARCHAR(20),  -- improving, declining, stable
    uacr_trend VARCHAR(20),  -- improving, worsening, stable

    -- Significance flags
    category_changed BOOLEAN DEFAULT false,
    risk_increased BOOLEAN DEFAULT false,
    crossed_critical_threshold BOOLEAN DEFAULT false,

    -- Alert information
    alert_generated BOOLEAN DEFAULT false,
    alert_severity VARCHAR(20),  -- critical, warning, info

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transition_patient ON state_transitions(patient_id);
CREATE INDEX idx_transition_date ON state_transitions(transition_date);
CREATE INDEX idx_transition_alert ON state_transitions(alert_generated) WHERE alert_generated = true;
CREATE INDEX idx_transition_severity ON state_transitions(alert_severity);

COMMENT ON TABLE state_transitions IS 'Records health state transitions detected during dynamic generation';

-- ============================================================================
-- Table 4: monitoring_alerts
-- AI-generated alerts for significant transitions
-- ============================================================================
CREATE TABLE monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    transition_id UUID REFERENCES state_transitions(id) ON DELETE SET NULL,

    -- Alert details
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,  -- critical, warning, info
    priority INTEGER NOT NULL,  -- 1-5, lower is higher priority
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    alert_reasons TEXT[],

    -- Action requirements
    requires_action BOOLEAN DEFAULT false,

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, acknowledged, resolved, dismissed
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    action_taken TEXT,
    action_taken_at TIMESTAMP,

    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_patient ON monitoring_alerts(patient_id);
CREATE INDEX idx_alert_status ON monitoring_alerts(status);
CREATE INDEX idx_alert_severity ON monitoring_alerts(severity);
CREATE INDEX idx_alert_generated ON monitoring_alerts(generated_at);

COMMENT ON TABLE monitoring_alerts IS 'AI-generated alerts for state transitions';

-- ============================================================================
-- Table 5: action_recommendations
-- Clinical recommendations based on KDIGO guidelines
-- ============================================================================
CREATE TABLE action_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    transition_id UUID REFERENCES state_transitions(id) ON DELETE SET NULL,

    -- Recommendation details
    recommendation_type VARCHAR(50) NOT NULL,
    category VARCHAR(50),  -- monitoring, treatment, referral, education
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    rationale TEXT,
    action_items JSONB,  -- Structured list of actions

    -- Prioritization
    priority INTEGER NOT NULL,  -- 1-5
    urgency VARCHAR(20) NOT NULL,  -- urgent, routine, optional
    timeframe VARCHAR(100),

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, dismissed
    implemented_by VARCHAR(100),
    implemented_at TIMESTAMP,
    completion_notes TEXT,
    outcome VARCHAR(50),  -- improved, stable, worsened, no_change

    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recommendation_patient ON action_recommendations(patient_id);
CREATE INDEX idx_recommendation_status ON action_recommendations(status);
CREATE INDEX idx_recommendation_urgency ON action_recommendations(urgency);
CREATE INDEX idx_recommendation_type ON action_recommendations(recommendation_type);

COMMENT ON TABLE action_recommendations IS 'KDIGO guideline-based clinical recommendations';

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_progression_state TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON health_state_history TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON state_transitions TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON monitoring_alerts TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON action_recommendations TO PUBLIC;

-- ============================================================================
-- Summary
-- ============================================================================
\echo ''
\echo '================================================'
\echo 'Setup Complete!'
\echo '================================================'
\echo ''
\echo 'Tables created:'
\echo '  ✓ patient_progression_state - Progression parameters'
\echo '  ✓ health_state_history - KDIGO classifications'
\echo '  ✓ state_transitions - Health state changes'
\echo '  ✓ monitoring_alerts - AI alerts'
\echo '  ✓ action_recommendations - Clinical recommendations'
\echo ''
\echo 'Ready for dynamic progression generation!'
\echo ''
\echo 'Usage:'
\echo '  1. Navigate to Progression Timeline in the UI'
\echo '  2. Select a patient'
\echo '  3. Baseline (cycle 0) initializes automatically'
\echo '  4. Press Play or Next to generate subsequent cycles'
\echo '  5. Each cycle generates on-demand with AI monitoring'
\echo ''
\echo '================================================'
