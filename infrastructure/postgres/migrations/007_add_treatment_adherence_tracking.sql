-- ============================================
-- Treatment and Adherence Tracking System
-- ============================================
-- Migration 007: Adds comprehensive treatment and adherence tracking
-- for realistic disease progression simulation

-- ============================================
-- 1. Cycle Metadata - System-wide Cycle Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS cycle_metadata (
    id SERIAL PRIMARY KEY,
    current_cycle INTEGER NOT NULL DEFAULT 0,
    total_cycles INTEGER NOT NULL DEFAULT 24,
    cycle_duration_months INTEGER NOT NULL DEFAULT 1,
    simulation_start_date TIMESTAMP NOT NULL DEFAULT NOW(),
    last_advance_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure only one row exists
    CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize with cycle 0
INSERT INTO cycle_metadata (id, current_cycle, total_cycles, cycle_duration_months, simulation_start_date)
VALUES (1, 0, 24, 1, NOW())
ON CONFLICT (id) DO NOTHING;

CREATE INDEX idx_cycle_metadata_current ON cycle_metadata(current_cycle);

COMMENT ON TABLE cycle_metadata IS 'System-wide cycle tracking for cohort-based progression simulation';
COMMENT ON COLUMN cycle_metadata.current_cycle IS 'Current cycle number (0-24). Incremented by "Next Cycle" button';
COMMENT ON COLUMN cycle_metadata.last_advance_date IS 'Timestamp of last cycle advancement';

-- ============================================
-- 2. Patient Treatments
-- ============================================
CREATE TABLE IF NOT EXISTS patient_treatments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Treatment details
    medication_name VARCHAR(100) NOT NULL,
    medication_class VARCHAR(50) NOT NULL, -- 'RAS_INHIBITOR', 'SGLT2I', 'GLP1_RA', etc.

    -- Timing
    started_cycle INTEGER NOT NULL, -- Cycle when treatment started
    started_date TIMESTAMP NOT NULL,
    stopped_cycle INTEGER, -- null if ongoing
    stopped_date TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'stopped', 'paused'

    -- Adherence tracking
    baseline_adherence DECIMAL(3, 2) NOT NULL DEFAULT 0.80, -- Initial adherence (0.00-1.00)
    current_adherence DECIMAL(3, 2) NOT NULL DEFAULT 0.80, -- Current adherence score

    -- Expected vs actual effect tracking
    expected_egfr_benefit DECIMAL(5, 2), -- Expected eGFR improvement (mL/min)
    expected_uacr_reduction DECIMAL(4, 2), -- Expected uACR reduction (percentage, 0.30 = 30% reduction)

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_adherence_range CHECK (baseline_adherence BETWEEN 0 AND 1 AND current_adherence BETWEEN 0 AND 1),
    CONSTRAINT check_status CHECK (status IN ('active', 'stopped', 'paused'))
);

CREATE INDEX idx_treatments_patient ON patient_treatments(patient_id);
CREATE INDEX idx_treatments_status ON patient_treatments(status);
CREATE INDEX idx_treatments_class ON patient_treatments(medication_class);
CREATE INDEX idx_treatments_cycle ON patient_treatments(started_cycle);

COMMENT ON TABLE patient_treatments IS 'Tracks medication treatments and adherence for CKD patients';
COMMENT ON COLUMN patient_treatments.baseline_adherence IS 'Initial adherence score when treatment started (0.00-1.00)';
COMMENT ON COLUMN patient_treatments.current_adherence IS 'Current adherence score calculated from lab trends (0.00-1.00)';

-- ============================================
-- 3. Adherence History
-- ============================================
CREATE TABLE IF NOT EXISTS adherence_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    treatment_id UUID NOT NULL REFERENCES patient_treatments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Cycle tracking
    cycle_number INTEGER NOT NULL,
    measured_at TIMESTAMP NOT NULL,

    -- Adherence calculation
    adherence_score DECIMAL(3, 2) NOT NULL, -- 0.00-1.00
    calculation_method VARCHAR(50) NOT NULL, -- 'lab_trend', 'manual', 'pill_count', 'self_report'

    -- Supporting data for lab-based calculation
    egfr_value DECIMAL(5, 2),
    uacr_value DECIMAL(8, 2),
    egfr_change_from_baseline DECIMAL(6, 2),
    uacr_change_from_baseline DECIMAL(8, 2),

    -- Expected vs actual
    expected_egfr DECIMAL(5, 2), -- What we expected with 100% adherence
    actual_egfr DECIMAL(5, 2), -- What we observed
    adherence_indicator VARCHAR(20), -- 'excellent', 'good', 'fair', 'poor', 'very_poor'

    -- Notes
    notes TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_adherence_score CHECK (adherence_score BETWEEN 0 AND 1),
    CONSTRAINT unique_adherence_record UNIQUE (treatment_id, cycle_number)
);

CREATE INDEX idx_adherence_treatment ON adherence_history(treatment_id);
CREATE INDEX idx_adherence_patient ON adherence_history(patient_id);
CREATE INDEX idx_adherence_cycle ON adherence_history(cycle_number);
CREATE INDEX idx_adherence_score ON adherence_history(adherence_score);

COMMENT ON TABLE adherence_history IS 'Tracks adherence scores over time for treated patients';
COMMENT ON COLUMN adherence_history.adherence_score IS 'Calculated adherence (1.0 = perfect, 0.0 = none)';

-- ============================================
-- 4. Treatment Recommendations Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS treatment_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Recommendation details
    recommended_medication_class VARCHAR(50) NOT NULL,
    recommended_medication VARCHAR(100),
    recommendation_reason TEXT NOT NULL,

    -- Clinical context
    recommended_at_cycle INTEGER NOT NULL,
    recommended_at TIMESTAMP NOT NULL DEFAULT NOW(),
    health_state_at_recommendation VARCHAR(10),
    egfr_at_recommendation DECIMAL(5, 2),
    uacr_at_recommendation DECIMAL(8, 2),

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'implemented'
    implemented_at TIMESTAMP,
    implemented_cycle INTEGER,
    treatment_id UUID REFERENCES patient_treatments(id), -- Links to actual treatment if implemented

    -- Decision tracking
    decision_made_by VARCHAR(100),
    decision_notes TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_rec_status CHECK (status IN ('pending', 'accepted', 'declined', 'implemented'))
);

CREATE INDEX idx_treatment_recs_patient ON treatment_recommendations(patient_id);
CREATE INDEX idx_treatment_recs_status ON treatment_recommendations(status);
CREATE INDEX idx_treatment_recs_cycle ON treatment_recommendations(recommended_at_cycle);
CREATE INDEX idx_treatment_recs_class ON treatment_recommendations(recommended_medication_class);

COMMENT ON TABLE treatment_recommendations IS 'Tracks AI-generated treatment recommendations and their implementation status';

-- ============================================
-- 5. Lab Values History (Enhanced)
-- ============================================
-- Add treatment-related columns to health_state_history
ALTER TABLE health_state_history
ADD COLUMN IF NOT EXISTS is_treated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS active_treatments TEXT[], -- Array of active medication classes
ADD COLUMN IF NOT EXISTS average_adherence DECIMAL(3, 2), -- Average adherence across all active treatments
ADD COLUMN IF NOT EXISTS treatment_effect_egfr DECIMAL(5, 2), -- Estimated treatment benefit on eGFR
ADD COLUMN IF NOT EXISTS treatment_effect_uacr DECIMAL(6, 2); -- Estimated treatment benefit on uACR

COMMENT ON COLUMN health_state_history.is_treated IS 'Whether patient has active treatments during this cycle';
COMMENT ON COLUMN health_state_history.average_adherence IS 'Average adherence score (0-1) for this cycle';

-- Add progression metadata to patient_progression_state
ALTER TABLE patient_progression_state
ADD COLUMN IF NOT EXISTS natural_trajectory VARCHAR(20), -- 'worsening' (always, unless treated)
ADD COLUMN IF NOT EXISTS last_updated_cycle INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_decline_locked BOOLEAN DEFAULT true; -- Ensures consistent decline rate

COMMENT ON COLUMN patient_progression_state.natural_trajectory IS 'Natural disease trajectory (always worsening without treatment)';
COMMENT ON COLUMN patient_progression_state.base_decline_locked IS 'If true, decline rate stays constant (realistic CKD progression)';

-- ============================================
-- 6. Helper Functions
-- ============================================

-- Function to get current system cycle
CREATE OR REPLACE FUNCTION get_current_cycle()
RETURNS INTEGER AS $$
DECLARE
    current_cycle_num INTEGER;
BEGIN
    SELECT current_cycle INTO current_cycle_num FROM cycle_metadata WHERE id = 1;
    RETURN current_cycle_num;
END;
$$ LANGUAGE plpgsql;

-- Function to advance system cycle
CREATE OR REPLACE FUNCTION advance_system_cycle()
RETURNS INTEGER AS $$
DECLARE
    new_cycle INTEGER;
BEGIN
    UPDATE cycle_metadata
    SET
        current_cycle = current_cycle + 1,
        last_advance_date = NOW(),
        updated_at = NOW()
    WHERE id = 1
    RETURNING current_cycle INTO new_cycle;

    RETURN new_cycle;
END;
$$ LANGUAGE plpgsql;

-- Function to get patient's active treatments
CREATE OR REPLACE FUNCTION get_active_treatments(p_patient_id UUID)
RETURNS TABLE (
    medication_name VARCHAR,
    medication_class VARCHAR,
    adherence DECIMAL,
    started_cycle INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pt.medication_name,
        pt.medication_class,
        pt.current_adherence,
        pt.started_cycle
    FROM patient_treatments pt
    WHERE pt.patient_id = p_patient_id
    AND pt.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate adherence from lab trends
CREATE OR REPLACE FUNCTION calculate_adherence_from_labs(
    p_treatment_id UUID,
    p_current_egfr DECIMAL,
    p_current_uacr DECIMAL,
    p_baseline_egfr DECIMAL,
    p_baseline_uacr DECIMAL,
    p_expected_egfr_benefit DECIMAL,
    p_expected_uacr_reduction DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    actual_egfr_change DECIMAL;
    actual_uacr_change DECIMAL;
    adherence_from_egfr DECIMAL;
    adherence_from_uacr DECIMAL;
    final_adherence DECIMAL;
BEGIN
    -- Calculate actual changes
    actual_egfr_change := p_current_egfr - p_baseline_egfr;
    actual_uacr_change := (p_current_uacr - p_baseline_uacr) / NULLIF(p_baseline_uacr, 0);

    -- Estimate adherence from eGFR (higher is better adherence)
    IF p_expected_egfr_benefit IS NOT NULL THEN
        adherence_from_egfr := GREATEST(0, LEAST(1, actual_egfr_change / NULLIF(p_expected_egfr_benefit, 0)));
    ELSE
        adherence_from_egfr := NULL;
    END IF;

    -- Estimate adherence from uACR (more reduction = better adherence)
    IF p_expected_uacr_reduction IS NOT NULL THEN
        adherence_from_uacr := GREATEST(0, LEAST(1, -actual_uacr_change / NULLIF(p_expected_uacr_reduction, 0)));
    ELSE
        adherence_from_uacr := NULL;
    END IF;

    -- Average both if available, otherwise use whichever is available
    IF adherence_from_egfr IS NOT NULL AND adherence_from_uacr IS NOT NULL THEN
        final_adherence := (adherence_from_egfr + adherence_from_uacr) / 2.0;
    ELSIF adherence_from_egfr IS NOT NULL THEN
        final_adherence := adherence_from_egfr;
    ELSIF adherence_from_uacr IS NOT NULL THEN
        final_adherence := adherence_from_uacr;
    ELSE
        final_adherence := 0.5; -- Default to moderate adherence if can't calculate
    END IF;

    -- Ensure in valid range
    final_adherence := GREATEST(0, LEAST(1, final_adherence));

    RETURN final_adherence;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Indexes for Performance
-- ============================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_health_state_patient_cycle
ON health_state_history(patient_id, cycle_number);

CREATE INDEX IF NOT EXISTS idx_treatments_patient_status
ON patient_treatments(patient_id, status);

-- ============================================
-- Migration Complete
-- ============================================

SELECT 'Treatment and Adherence Tracking System created successfully!' AS status;
