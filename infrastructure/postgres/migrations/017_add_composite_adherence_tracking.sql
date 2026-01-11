-- ============================================
-- Enhanced Composite Adherence Tracking System
-- ============================================
-- Migration 017: Adds patient-reported adherence, composite scoring,
-- and predictive adherence risk assessment

-- ============================================
-- 1. Patient-Reported Adherence
-- ============================================
CREATE TABLE IF NOT EXISTS patient_reported_adherence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    treatment_id UUID REFERENCES patient_treatments(id) ON DELETE CASCADE,

    -- Reporting details
    reported_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reporting_cycle INTEGER,
    reporting_period_days INTEGER DEFAULT 7, -- Default: past week

    -- Simple adherence questions (Morisky-like)
    days_missed INTEGER NOT NULL, -- "How many days did you miss in the past week?"
    forgot_to_take BOOLEAN, -- "Did you sometimes forget to take medication?"
    stopped_feeling_worse BOOLEAN, -- "When you feel worse, do you stop taking it?"
    stopped_feeling_better BOOLEAN, -- "When you feel better, do you stop taking it?"

    -- Calculated score from responses
    self_reported_score DECIMAL(3, 2), -- 0.00-1.00 (derived from above)

    -- Barriers identified by patient
    reported_barriers TEXT[], -- Array: ['cost', 'side_effects', 'forgetfulness', 'access']
    barrier_details TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_days_missed_range CHECK (days_missed BETWEEN 0 AND reporting_period_days),
    CONSTRAINT check_self_reported_score CHECK (self_reported_score BETWEEN 0 AND 1)
);

CREATE INDEX idx_patient_reported_adh_patient ON patient_reported_adherence(patient_id);
CREATE INDEX idx_patient_reported_adh_treatment ON patient_reported_adherence(treatment_id);
CREATE INDEX idx_patient_reported_adh_date ON patient_reported_adherence(reported_at);

COMMENT ON TABLE patient_reported_adherence IS 'Stores patient self-reported adherence data and identified barriers';
COMMENT ON COLUMN patient_reported_adherence.self_reported_score IS 'Calculated adherence score from patient responses (1.0 = perfect adherence)';

-- ============================================
-- 2. Composite Adherence Scores
-- ============================================
CREATE TABLE IF NOT EXISTS composite_adherence_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    treatment_id UUID REFERENCES patient_treatments(id) ON DELETE CASCADE,

    -- Scoring period
    calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    cycle_number INTEGER,
    measurement_period_days INTEGER DEFAULT 90,

    -- Individual component scores
    mpr_score DECIMAL(3, 2), -- Medication Possession Ratio (0.00-1.00)
    mpr_available BOOLEAN DEFAULT false,

    lab_based_score DECIMAL(3, 2), -- From eGFR/uACR trends (0.00-1.00)
    lab_based_available BOOLEAN DEFAULT false,

    self_reported_score DECIMAL(3, 2), -- From patient reports (0.00-1.00)
    self_reported_available BOOLEAN DEFAULT false,

    -- Composite calculation
    composite_score DECIMAL(3, 2) NOT NULL, -- Weighted average (0.00-1.00)
    composite_percentage INTEGER GENERATED ALWAYS AS (ROUND(composite_score * 100)) STORED,
    scoring_method VARCHAR(50), -- 'mpr_primary', 'lab_primary', 'self_report_only'

    -- Weights used in calculation
    mpr_weight DECIMAL(3, 2) DEFAULT 0.50,
    lab_weight DECIMAL(3, 2) DEFAULT 0.30,
    self_report_weight DECIMAL(3, 2) DEFAULT 0.20,

    -- Adherence classification
    adherence_category VARCHAR(20) NOT NULL, -- 'GOOD', 'SUBOPTIMAL', 'POOR'

    -- Clinical correlation
    egfr_at_calculation DECIMAL(5, 2),
    uacr_at_calculation DECIMAL(8, 2),
    egfr_trend VARCHAR(20), -- 'IMPROVING', 'STABLE', 'WORSENING'
    uacr_trend VARCHAR(20),

    -- Barriers detected
    detected_barriers TEXT[],
    barrier_severity VARCHAR(20), -- 'LOW', 'MEDIUM', 'HIGH'

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_composite_score CHECK (composite_score BETWEEN 0 AND 1),
    CONSTRAINT check_adherence_category CHECK (adherence_category IN ('GOOD', 'SUBOPTIMAL', 'POOR')),
    CONSTRAINT check_weights_sum CHECK (
        CASE
            WHEN mpr_available AND lab_based_available AND self_reported_available
            THEN (mpr_weight + lab_weight + self_report_weight) = 1.00
            ELSE true
        END
    )
);

CREATE INDEX idx_composite_adh_patient ON composite_adherence_scores(patient_id);
CREATE INDEX idx_composite_adh_treatment ON composite_adherence_scores(treatment_id);
CREATE INDEX idx_composite_adh_cycle ON composite_adherence_scores(cycle_number);
CREATE INDEX idx_composite_adh_category ON composite_adherence_scores(adherence_category);
CREATE INDEX idx_composite_adh_score ON composite_adherence_scores(composite_score);

COMMENT ON TABLE composite_adherence_scores IS 'Unified adherence scores combining MPR, lab-based, and self-reported measures';
COMMENT ON COLUMN composite_adherence_scores.composite_score IS 'Final adherence score from weighted combination of available methods';

-- ============================================
-- 3. Adherence Risk Prediction
-- ============================================
CREATE TABLE IF NOT EXISTS adherence_risk_assessment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Assessment details
    assessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assessment_cycle INTEGER,

    -- Risk factors (predictive features)
    age INTEGER,
    total_medications_count INTEGER,
    comorbidity_count INTEGER,
    previous_adherence_avg DECIMAL(3, 2), -- Historical average
    recent_adherence_trend VARCHAR(20), -- 'IMPROVING', 'STABLE', 'DECLINING'

    -- Socioeconomic proxies (if available)
    has_insurance BOOLEAN,
    missed_appointments_count INTEGER,

    -- Calculated risk score
    risk_score DECIMAL(3, 2) NOT NULL, -- 0.00-1.00 (higher = higher risk of non-adherence)
    risk_category VARCHAR(20) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH'

    -- Risk factors identified
    primary_risk_factors TEXT[],

    -- Recommended interventions
    recommended_interventions TEXT[],
    intervention_priority VARCHAR(20), -- 'ROUTINE', 'ENHANCED', 'INTENSIVE'

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_risk_score CHECK (risk_score BETWEEN 0 AND 1),
    CONSTRAINT check_risk_category CHECK (risk_category IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE INDEX idx_adh_risk_patient ON adherence_risk_assessment(patient_id);
CREATE INDEX idx_adh_risk_category ON adherence_risk_assessment(risk_category);
CREATE INDEX idx_adh_risk_date ON adherence_risk_assessment(assessed_at);

COMMENT ON TABLE adherence_risk_assessment IS 'Predictive assessment of patient risk for medication non-adherence';

-- ============================================
-- 4. Adherence Interventions Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS adherence_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    risk_assessment_id UUID REFERENCES adherence_risk_assessment(id),

    -- Intervention details
    intervention_type VARCHAR(50) NOT NULL, -- 'PILL_ORGANIZER', 'MEDICATION_SYNC', 'FINANCIAL_ASSISTANCE', 'EDUCATION', 'DOSE_ADJUSTMENT'
    intervention_description TEXT NOT NULL,

    -- Timeline
    recommended_at TIMESTAMP NOT NULL DEFAULT NOW(),
    implemented_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'recommended', -- 'recommended', 'in_progress', 'completed', 'declined'

    -- Effectiveness tracking
    adherence_before DECIMAL(3, 2),
    adherence_after DECIMAL(3, 2),
    effectiveness_rating VARCHAR(20), -- 'VERY_EFFECTIVE', 'EFFECTIVE', 'MINIMAL', 'NOT_EFFECTIVE'

    -- Notes
    implementation_notes TEXT,
    outcome_notes TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_intervention_status CHECK (status IN ('recommended', 'in_progress', 'completed', 'declined'))
);

CREATE INDEX idx_adh_interventions_patient ON adherence_interventions(patient_id);
CREATE INDEX idx_adh_interventions_status ON adherence_interventions(status);
CREATE INDEX idx_adh_interventions_type ON adherence_interventions(intervention_type);

COMMENT ON TABLE adherence_interventions IS 'Tracks adherence improvement interventions and their effectiveness';

-- ============================================
-- 5. Helper Functions for Composite Scoring
-- ============================================

-- Function to calculate self-reported adherence score from questionnaire
CREATE OR REPLACE FUNCTION calculate_self_reported_score(
    p_days_missed INTEGER,
    p_reporting_period INTEGER,
    p_forgot_to_take BOOLEAN,
    p_stopped_feeling_worse BOOLEAN,
    p_stopped_feeling_better BOOLEAN
)
RETURNS DECIMAL AS $$
DECLARE
    score DECIMAL := 1.0;
    days_taken INTEGER;
BEGIN
    -- Calculate from days missed
    days_taken := p_reporting_period - p_days_missed;
    score := days_taken::DECIMAL / p_reporting_period::DECIMAL;

    -- Adjust for behavior flags (Morisky-like scoring)
    -- Each "yes" reduces score slightly
    IF p_forgot_to_take THEN
        score := score * 0.95; -- 5% penalty for forgetfulness
    END IF;

    IF p_stopped_feeling_worse THEN
        score := score * 0.90; -- 10% penalty for stopping when feeling worse
    END IF;

    IF p_stopped_feeling_better THEN
        score := score * 0.90; -- 10% penalty for stopping when feeling better
    END IF;

    -- Ensure valid range
    score := GREATEST(0, LEAST(1, score));

    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate composite adherence score
CREATE OR REPLACE FUNCTION calculate_composite_adherence(
    p_mpr_score DECIMAL,
    p_lab_score DECIMAL,
    p_self_report_score DECIMAL
)
RETURNS TABLE (
    composite_score DECIMAL,
    scoring_method VARCHAR,
    mpr_weight DECIMAL,
    lab_weight DECIMAL,
    self_report_weight DECIMAL,
    adherence_category VARCHAR
) AS $$
DECLARE
    final_score DECIMAL;
    method VARCHAR;
    w_mpr DECIMAL := 0.0;
    w_lab DECIMAL := 0.0;
    w_self DECIMAL := 0.0;
    category VARCHAR;
BEGIN
    -- Determine scoring method based on available data
    IF p_mpr_score IS NOT NULL AND p_lab_score IS NOT NULL AND p_self_report_score IS NOT NULL THEN
        -- All three available: MPR primary (50%), Lab (30%), Self-report (20%)
        w_mpr := 0.50;
        w_lab := 0.30;
        w_self := 0.20;
        final_score := (p_mpr_score * w_mpr) + (p_lab_score * w_lab) + (p_self_report_score * w_self);
        method := 'mpr_primary';

    ELSIF p_mpr_score IS NOT NULL AND p_lab_score IS NOT NULL THEN
        -- MPR and Lab available: MPR (60%), Lab (40%)
        w_mpr := 0.60;
        w_lab := 0.40;
        final_score := (p_mpr_score * w_mpr) + (p_lab_score * w_lab);
        method := 'mpr_lab_hybrid';

    ELSIF p_lab_score IS NOT NULL AND p_self_report_score IS NOT NULL THEN
        -- Lab and Self-report available: Lab (70%), Self-report (30%)
        w_lab := 0.70;
        w_self := 0.30;
        final_score := (p_lab_score * w_lab) + (p_self_report_score * w_self);
        method := 'lab_primary';

    ELSIF p_lab_score IS NOT NULL THEN
        -- Lab only
        w_lab := 1.0;
        final_score := p_lab_score;
        method := 'lab_only';

    ELSIF p_mpr_score IS NOT NULL THEN
        -- MPR only
        w_mpr := 1.0;
        final_score := p_mpr_score;
        method := 'mpr_only';

    ELSIF p_self_report_score IS NOT NULL THEN
        -- Self-report only
        w_self := 1.0;
        final_score := p_self_report_score;
        method := 'self_report_only';

    ELSE
        -- No data available
        final_score := NULL;
        method := 'no_data';
    END IF;

    -- Determine adherence category
    IF final_score IS NOT NULL THEN
        IF final_score >= 0.90 THEN
            category := 'GOOD';
        ELSIF final_score >= 0.75 THEN
            category := 'SUBOPTIMAL';
        ELSE
            category := 'POOR';
        END IF;
    ELSE
        category := 'UNKNOWN';
    END IF;

    RETURN QUERY SELECT final_score, method, w_mpr, w_lab, w_self, category;
END;
$$ LANGUAGE plpgsql;

-- Function to assess adherence risk
CREATE OR REPLACE FUNCTION assess_adherence_risk(
    p_patient_id UUID,
    p_age INTEGER,
    p_medication_count INTEGER,
    p_comorbidity_count INTEGER,
    p_previous_adherence DECIMAL
)
RETURNS TABLE (
    risk_score DECIMAL,
    risk_category VARCHAR,
    risk_factors TEXT[]
) AS $$
DECLARE
    score DECIMAL := 0.0;
    category VARCHAR;
    factors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Risk scoring algorithm (0.0 = low risk, 1.0 = high risk)

    -- Age factor (U-shaped: very young and very old = higher risk)
    IF p_age < 30 OR p_age > 75 THEN
        score := score + 0.15;
        factors := array_append(factors, 'Age-related risk');
    END IF;

    -- Medication burden (polypharmacy)
    IF p_medication_count >= 5 THEN
        score := score + 0.25;
        factors := array_append(factors, 'Polypharmacy (5+ medications)');
    ELSIF p_medication_count >= 3 THEN
        score := score + 0.10;
        factors := array_append(factors, 'Multiple medications');
    END IF;

    -- Comorbidity burden
    IF p_comorbidity_count >= 4 THEN
        score := score + 0.20;
        factors := array_append(factors, 'Multiple comorbidities');
    ELSIF p_comorbidity_count >= 2 THEN
        score := score + 0.10;
    END IF;

    -- Historical adherence (strongest predictor)
    IF p_previous_adherence IS NOT NULL THEN
        IF p_previous_adherence < 0.75 THEN
            score := score + 0.40;
            factors := array_append(factors, 'History of poor adherence');
        ELSIF p_previous_adherence < 0.90 THEN
            score := score + 0.20;
            factors := array_append(factors, 'History of suboptimal adherence');
        END IF;
    ELSE
        -- No history = moderate risk
        score := score + 0.15;
        factors := array_append(factors, 'No adherence history available');
    END IF;

    -- Cap at 1.0
    score := LEAST(1.0, score);

    -- Categorize risk
    IF score >= 0.60 THEN
        category := 'HIGH';
    ELSIF score >= 0.30 THEN
        category := 'MEDIUM';
    ELSE
        category := 'LOW';
    END IF;

    RETURN QUERY SELECT score, category, factors;
END;
$$ LANGUAGE plpgsql;

-- Function to get latest composite adherence for a patient
-- Drop first to allow changing return type
DROP FUNCTION IF EXISTS get_latest_adherence(UUID);
CREATE OR REPLACE FUNCTION get_latest_adherence(p_patient_id UUID)
RETURNS TABLE (
    composite_score DECIMAL,
    composite_percentage INTEGER,
    adherence_category VARCHAR,
    measurement_date TIMESTAMP,
    detected_barriers TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cas.composite_score,
        cas.composite_percentage,
        cas.adherence_category,
        cas.calculated_at,
        cas.detected_barriers
    FROM composite_adherence_scores cas
    WHERE cas.patient_id = p_patient_id
    ORDER BY cas.calculated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Update Existing Tables
-- ============================================

-- Add composite adherence reference to patient_treatments
ALTER TABLE patient_treatments
ADD COLUMN IF NOT EXISTS latest_composite_adherence DECIMAL(3, 2),
ADD COLUMN IF NOT EXISTS adherence_category VARCHAR(20),
ADD COLUMN IF NOT EXISTS last_adherence_update TIMESTAMP;

COMMENT ON COLUMN patient_treatments.latest_composite_adherence IS 'Most recent composite adherence score (0.00-1.00)';
COMMENT ON COLUMN patient_treatments.adherence_category IS 'Current adherence status: GOOD, SUBOPTIMAL, or POOR';

-- ============================================
-- 7. Triggers for Auto-calculation
-- ============================================

-- Trigger to auto-calculate self-reported score when patient reports adherence
CREATE OR REPLACE FUNCTION auto_calculate_self_reported_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.self_reported_score := calculate_self_reported_score(
        NEW.days_missed,
        NEW.reporting_period_days,
        NEW.forgot_to_take,
        NEW.stopped_feeling_worse,
        NEW.stopped_feeling_better
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_calc_self_reported
    BEFORE INSERT OR UPDATE ON patient_reported_adherence
    FOR EACH ROW
    EXECUTE FUNCTION auto_calculate_self_reported_score();

-- ============================================
-- Migration Complete
-- ============================================

SELECT 'Enhanced Composite Adherence Tracking System created successfully!' AS status;
