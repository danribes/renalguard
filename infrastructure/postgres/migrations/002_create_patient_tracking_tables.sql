-- Migration: Create separate tracking tables for CKD and non-CKD patients
-- Created: 2025-11-12

-- ============================================
-- CKD Patient Data Table
-- ============================================
CREATE TABLE IF NOT EXISTS ckd_patient_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,

    -- CKD Severity Classification
    ckd_severity VARCHAR(20) NOT NULL, -- 'mild', 'moderate', 'severe', 'kidney_failure'
    ckd_stage INTEGER NOT NULL, -- 1, 2, 3, 4, 5

    -- KDIGO Classification
    kdigo_gfr_category VARCHAR(5) NOT NULL, -- 'G1', 'G2', 'G3a', 'G3b', 'G4', 'G5'
    kdigo_albuminuria_category VARCHAR(5) NOT NULL, -- 'A1', 'A2', 'A3'
    kdigo_health_state VARCHAR(10) NOT NULL, -- 'G1-A1', 'G3a-A2', etc.

    -- Monitoring
    is_monitored BOOLEAN DEFAULT false,
    monitoring_device VARCHAR(100), -- 'Minuteful Kidney Kit', etc.
    monitoring_frequency VARCHAR(50), -- 'weekly', 'biweekly', 'monthly', 'quarterly'
    last_monitoring_date DATE,

    -- Treatment
    is_treated BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CKD Treatments Table (Many-to-Many relationship)
-- ============================================
CREATE TABLE IF NOT EXISTS ckd_treatments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ckd_patient_data_id UUID NOT NULL REFERENCES ckd_patient_data(id) ON DELETE CASCADE,

    treatment_name VARCHAR(100) NOT NULL,
    treatment_class VARCHAR(50), -- 'SGLT2i', 'MRA', 'Investigational', etc.
    dosage VARCHAR(50),
    start_date DATE,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Non-CKD Patient Data Table
-- ============================================
CREATE TABLE IF NOT EXISTS non_ckd_patient_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,

    -- Risk Classification
    risk_level VARCHAR(20) NOT NULL, -- 'low', 'moderate', 'high'

    -- KDIGO Health State
    kdigo_health_state VARCHAR(10) NOT NULL, -- 'G1-A1', 'G2-A1', etc.

    -- Monitoring
    is_monitored BOOLEAN DEFAULT false,
    monitoring_device VARCHAR(100),
    monitoring_frequency VARCHAR(50), -- 'monthly', 'quarterly', 'biannually', 'annually'
    last_monitoring_date DATE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Non-CKD Risk Factors Table
-- ============================================
CREATE TABLE IF NOT EXISTS non_ckd_risk_factors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    non_ckd_patient_data_id UUID NOT NULL REFERENCES non_ckd_patient_data(id) ON DELETE CASCADE,

    risk_factor_type VARCHAR(50) NOT NULL, -- 'diabetes', 'hypertension', 'obesity', 'smoking', 'family_history', etc.
    risk_factor_value VARCHAR(100), -- Specific value or severity
    severity VARCHAR(20), -- 'mild', 'moderate', 'severe'
    is_controlled BOOLEAN DEFAULT false,
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- CKD Patient Data Indexes
CREATE INDEX IF NOT EXISTS idx_ckd_patient_data_patient_id ON ckd_patient_data(patient_id);
CREATE INDEX IF NOT EXISTS idx_ckd_patient_data_severity ON ckd_patient_data(ckd_severity);
CREATE INDEX IF NOT EXISTS idx_ckd_patient_data_stage ON ckd_patient_data(ckd_stage);
CREATE INDEX IF NOT EXISTS idx_ckd_patient_data_monitored ON ckd_patient_data(is_monitored);
CREATE INDEX IF NOT EXISTS idx_ckd_patient_data_treated ON ckd_patient_data(is_treated);
CREATE INDEX IF NOT EXISTS idx_ckd_patient_data_monitoring_freq ON ckd_patient_data(monitoring_frequency);
CREATE INDEX IF NOT EXISTS idx_ckd_patient_data_health_state ON ckd_patient_data(kdigo_health_state);

-- CKD Treatments Indexes
CREATE INDEX IF NOT EXISTS idx_ckd_treatments_patient_data_id ON ckd_treatments(ckd_patient_data_id);
CREATE INDEX IF NOT EXISTS idx_ckd_treatments_name ON ckd_treatments(treatment_name);
CREATE INDEX IF NOT EXISTS idx_ckd_treatments_active ON ckd_treatments(is_active);

-- Non-CKD Patient Data Indexes
CREATE INDEX IF NOT EXISTS idx_non_ckd_patient_data_patient_id ON non_ckd_patient_data(patient_id);
CREATE INDEX IF NOT EXISTS idx_non_ckd_patient_data_risk_level ON non_ckd_patient_data(risk_level);
CREATE INDEX IF NOT EXISTS idx_non_ckd_patient_data_monitored ON non_ckd_patient_data(is_monitored);
CREATE INDEX IF NOT EXISTS idx_non_ckd_patient_data_monitoring_freq ON non_ckd_patient_data(monitoring_frequency);
CREATE INDEX IF NOT EXISTS idx_non_ckd_patient_data_health_state ON non_ckd_patient_data(kdigo_health_state);

-- Non-CKD Risk Factors Indexes
CREATE INDEX IF NOT EXISTS idx_non_ckd_risk_factors_patient_data_id ON non_ckd_risk_factors(non_ckd_patient_data_id);
CREATE INDEX IF NOT EXISTS idx_non_ckd_risk_factors_type ON non_ckd_risk_factors(risk_factor_type);
CREATE INDEX IF NOT EXISTS idx_non_ckd_risk_factors_severity ON non_ckd_risk_factors(severity);

-- Composite Indexes for Common Queries
CREATE INDEX IF NOT EXISTS idx_ckd_severity_monitored ON ckd_patient_data(ckd_severity, is_monitored);
CREATE INDEX IF NOT EXISTS idx_ckd_stage_treated ON ckd_patient_data(ckd_stage, is_treated);
CREATE INDEX IF NOT EXISTS idx_non_ckd_risk_monitored ON non_ckd_patient_data(risk_level, is_monitored);

-- Verification
SELECT 'Migration complete: Created patient tracking tables with indexes' AS status;
