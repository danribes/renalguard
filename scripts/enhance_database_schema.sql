-- ===============================================================
-- ENHANCED CKD DATABASE SCHEMA - COMPLETE SPECIFICATION
-- Based on: Unified_CKD_Complete_Specification_Enhanced_v3
-- ===============================================================
-- This script adds all variables from the specification document
-- and populates data for 500 patients
-- ===============================================================

-- ===============================================================
-- PART 1: SCHEMA ENHANCEMENTS
-- ===============================================================

-- Add new columns to patients table for comprehensive data
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS systolic_bp INTEGER,
ADD COLUMN IF NOT EXISTS diastolic_bp INTEGER,
ADD COLUMN IF NOT EXISTS bp_control_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS heart_rate INTEGER,
ADD COLUMN IF NOT EXISTS oxygen_saturation DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS has_diabetes BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_hypertension BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_heart_failure BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_cad BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_aki_history BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_lupus BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_ra BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_obesity BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_metabolic_syndrome BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS resistant_hypertension BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS antihypertensive_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bmi DECIMAL(5,2);

-- Create comprehensive medications reference table
CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    generic_name VARCHAR(100) NOT NULL,
    brand_name VARCHAR(100),
    medication_class VARCHAR(50) NOT NULL,
    ndc_code VARCHAR(20),
    indication VARCHAR(200),
    is_ckd_specific BOOLEAN DEFAULT FALSE,
    is_nephrotoxic BOOLEAN DEFAULT FALSE,
    requires_renal_adjustment BOOLEAN DEFAULT FALSE,
    min_egfr_threshold INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create prescriptions table for adherence tracking
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_id UUID REFERENCES medications(id),
    medication_name VARCHAR(100) NOT NULL,
    generic_name VARCHAR(100),
    medication_class VARCHAR(50) NOT NULL,
    prescribed_date DATE NOT NULL,
    prescribed_by VARCHAR(100),
    prescriber_npi VARCHAR(20),
    dosage VARCHAR(50),
    frequency VARCHAR(50),
    quantity_per_fill INTEGER,
    days_supply INTEGER NOT NULL,
    refills_authorized INTEGER DEFAULT 0,
    refills_remaining INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    discontinued_date DATE,
    discontinuation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create refills table for MPR calculation
CREATE TABLE IF NOT EXISTS refills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    rx_number VARCHAR(50),
    fill_date DATE NOT NULL,
    quantity_dispensed INTEGER NOT NULL,
    days_supply INTEGER NOT NULL,
    pharmacy_name VARCHAR(100),
    pharmacy_npi VARCHAR(20),
    fill_status VARCHAR(20) DEFAULT 'completed',
    cost_patient DECIMAL(10,2),
    cost_insurance DECIMAL(10,2),
    next_refill_due DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create patient_risk_assessments table (updated structure)
CREATE TABLE IF NOT EXISTS patient_risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assessment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assessment_type VARCHAR(50) NOT NULL,  -- 'pre_diagnosis', 'kdigo', 'treatment', 'adherence'
    risk_tier VARCHAR(50),  -- For pre-diagnosis: TIER_1_HIGH, TIER_2_MODERATE, TIER_3_LOW
    risk_score INTEGER,
    risk_level VARCHAR(20),  -- For KDIGO: GREEN, YELLOW, ORANGE, RED
    kdigo_category VARCHAR(10),  -- G1-A1, G2-A2, etc.
    gfr_category VARCHAR(5),  -- G1, G2, G3a, G3b, G4, G5
    albuminuria_category VARCHAR(5),  -- A1, A2, A3
    ckd_stage VARCHAR(20),
    egfr_value DECIMAL(6,2),
    uacr_value DECIMAL(8,2),
    progression_risk VARCHAR(20),  -- RAPID, MODERATE, SLOW, STABLE
    egfr_decline_rate DECIMAL(6,2),  -- mL/min/year
    monitoring_frequency VARCHAR(50),
    recommendations TEXT[],
    risk_factors JSONB,
    missing_data TEXT[],
    priority VARCHAR(20),  -- URGENT, ROUTINE, STANDARD
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create treatment_recommendations table
CREATE TABLE IF NOT EXISTS treatment_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES patient_risk_assessments(id),
    recommendation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    medication_type VARCHAR(50) NOT NULL,  -- 'jardiance', 'ras_inhibitor', 'renalguard'
    medication_name VARCHAR(100),
    indication VARCHAR(50),  -- STRONG, MODERATE, NOT_INDICATED, CONTRAINDICATED
    evidence_grade VARCHAR(10),  -- Grade 1A, 2B, etc.
    evidence_description TEXT,
    reasoning TEXT[],
    contraindications TEXT[],
    safety_monitoring TEXT[],
    recommended_dosage VARCHAR(50),
    renalguard_frequency VARCHAR(50),
    renalguard_rationale TEXT,
    cost_effectiveness VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, declined, implemented
    implemented_date DATE,
    outcome_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create adherence_monitoring table
CREATE TABLE IF NOT EXISTS adherence_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_name VARCHAR(100) NOT NULL,
    medication_class VARCHAR(50) NOT NULL,
    measurement_period_start DATE NOT NULL,
    measurement_period_end DATE NOT NULL,
    measurement_period_days INTEGER NOT NULL,
    days_covered INTEGER NOT NULL,
    mpr_percentage DECIMAL(5,2) NOT NULL,  -- Medication Possession Ratio
    adherence_status VARCHAR(20),  -- GOOD, SUBOPTIMAL, POOR
    refill_count INTEGER,
    gap_days INTEGER,
    longest_gap_days INTEGER,
    barriers_detected TEXT[],
    egfr_trend VARCHAR(20),  -- STABLE, IMPROVING, WORSENING
    uacr_trend VARCHAR(20),
    clinical_correlation TEXT,
    alert_priority VARCHAR(20),  -- CRITICAL, HIGH, MEDIUM, LOW
    alert_message TEXT,
    recommendations TEXT[],
    assessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medication ON prescriptions(medication_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON prescriptions(prescribed_date);

CREATE INDEX IF NOT EXISTS idx_refills_prescription ON refills(prescription_id);
CREATE INDEX IF NOT EXISTS idx_refills_patient ON refills(patient_id);
CREATE INDEX IF NOT EXISTS idx_refills_date ON refills(fill_date);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_patient ON patient_risk_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_type ON patient_risk_assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_date ON patient_risk_assessments(assessment_date);

CREATE INDEX IF NOT EXISTS idx_treatment_recs_patient ON treatment_recommendations(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_recs_medication ON treatment_recommendations(medication_type);
CREATE INDEX IF NOT EXISTS idx_treatment_recs_status ON treatment_recommendations(status);

CREATE INDEX IF NOT EXISTS idx_adherence_patient ON adherence_monitoring(patient_id);
CREATE INDEX IF NOT EXISTS idx_adherence_medication ON adherence_monitoring(medication_name);
CREATE INDEX IF NOT EXISTS idx_adherence_period ON adherence_monitoring(measurement_period_end);

-- ===============================================================
-- PART 2: POPULATE MEDICATIONS REFERENCE DATA
-- ===============================================================

INSERT INTO medications (generic_name, brand_name, medication_class, indication, is_ckd_specific, is_nephrotoxic, requires_renal_adjustment, min_egfr_threshold) VALUES
-- SGLT2 Inhibitors (CKD-specific)
('Empagliflozin', 'Jardiance', 'SGLT2i', 'CKD with proteinuria - 28% risk reduction', TRUE, FALSE, TRUE, 20),
('Dapagliflozin', 'Farxiga', 'SGLT2i', 'CKD with proteinuria', TRUE, FALSE, TRUE, 25),
('Canagliflozin', 'Invokana', 'SGLT2i', 'Type 2 diabetes with CKD', TRUE, FALSE, TRUE, 30),

-- ACE Inhibitors
('Lisinopril', 'Prinivil', 'ACEi', 'Hypertension, proteinuria reduction', TRUE, FALSE, FALSE, NULL),
('Enalapril', 'Vasotec', 'ACEi', 'Hypertension, heart failure', TRUE, FALSE, FALSE, NULL),
('Ramipril', 'Altace', 'ACEi', 'Hypertension, post-MI', TRUE, FALSE, FALSE, NULL),

-- ARBs
('Losartan', 'Cozaar', 'ARB', 'Hypertension, diabetic nephropathy', TRUE, FALSE, FALSE, NULL),
('Valsartan', 'Diovan', 'ARB', 'Hypertension, heart failure', TRUE, FALSE, FALSE, NULL),
('Irbesartan', 'Avapro', 'ARB', 'Hypertension, diabetic nephropathy', TRUE, FALSE, FALSE, NULL),

-- Calcium Channel Blockers
('Amlodipine', 'Norvasc', 'CCB', 'Hypertension', FALSE, FALSE, FALSE, NULL),
('Nifedipine', 'Procardia', 'CCB', 'Hypertension, angina', FALSE, FALSE, FALSE, NULL),

-- Beta Blockers
('Metoprolol', 'Lopressor', 'Beta-Blocker', 'Hypertension, heart failure', FALSE, FALSE, FALSE, NULL),
('Carvedilol', 'Coreg', 'Beta-Blocker', 'Heart failure', FALSE, FALSE, FALSE, NULL),

-- Diuretics
('Furosemide', 'Lasix', 'Loop Diuretic', 'Edema, heart failure', FALSE, FALSE, FALSE, NULL),
('Hydrochlorothiazide', 'Microzide', 'Thiazide', 'Hypertension', FALSE, FALSE, FALSE, 30),

-- Statins
('Atorvastatin', 'Lipitor', 'Statin', 'Hyperlipidemia, CV protection', FALSE, FALSE, FALSE, NULL),
('Rosuvastatin', 'Crestor', 'Statin', 'Hyperlipidemia', FALSE, FALSE, FALSE, NULL),

-- Diabetes Medications
('Metformin', 'Glucophage', 'Biguanide', 'Type 2 diabetes', FALSE, FALSE, TRUE, 30),
('Glipizide', 'Glucotrol', 'Sulfonylurea', 'Type 2 diabetes', FALSE, FALSE, TRUE, 15),
('Sitagliptin', 'Januvia', 'DPP-4i', 'Type 2 diabetes', FALSE, FALSE, TRUE, NULL),
('Semaglutide', 'Ozempic', 'GLP-1', 'Type 2 diabetes, weight loss', FALSE, FALSE, FALSE, NULL),

-- Nephrotoxic Medications
('Ibuprofen', 'Advil', 'NSAID', 'Pain, inflammation', FALSE, TRUE, FALSE, NULL),
('Naproxen', 'Aleve', 'NSAID', 'Pain, inflammation', FALSE, TRUE, FALSE, NULL),
('Omeprazole', 'Prilosec', 'PPI', 'GERD, gastritis', FALSE, TRUE, FALSE, NULL),

-- Other
('Aspirin', 'Aspirin', 'Antiplatelet', 'Cardiovascular protection', FALSE, FALSE, FALSE, NULL),
('Allopurinol', 'Zyloprim', 'Xanthine oxidase inhibitor', 'Gout', FALSE, FALSE, TRUE, NULL);

-- ===============================================================
-- Success message
-- ===============================================================
SELECT 'Schema enhanced successfully! Ready for Part 3 (data population)' as status;
