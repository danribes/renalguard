-- ============================================
-- CONSOLIDATED DATABASE INITIALIZATION SCRIPT
-- FOR RENDER.COM SHELL ACCESS
-- ============================================
--
-- QUICK SETUP INSTRUCTIONS:
-- 1. Go to: https://dashboard.render.com
-- 2. Click: ckd-analyzer-db-ejsm
-- 3. Click: "Info" or "Connect" section
-- 4. Look for: "Connection String" or "External Connection"
-- 5. Copy the connection string
-- 6. Use any PostgreSQL client (DBeaver, TablePlus, or online tool)
-- 7. Paste this ENTIRE script and execute
--
-- ALTERNATIVE: If you find the Shell tab
-- 1. Click: Shell tab (might be under Connect dropdown)
-- 2. Paste this entire script
-- 3. Press Enter
--
-- Run time: 30-60 seconds
-- ============================================

\echo 'Starting database initialization...'

-- Create extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core tables (simplified version for quick setup)
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_record_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
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
    monitoring_status VARCHAR(20) DEFAULT 'inactive',
    current_risk_priority VARCHAR(20),
    current_risk_score INTEGER DEFAULT 0,
    ckd_diagnosed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

\echo 'Core tables created...'

-- Insert 5 sample patients
INSERT INTO patients (id, medical_record_number, first_name, last_name, date_of_birth, gender, email, weight, height, smoking_status)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'MRN001', 'John', 'Anderson', '1958-03-15', 'male', 'john.anderson@email.com', 92.5, 172, 'Former'),
    ('22222222-2222-2222-2222-222222222222', 'MRN002', 'Maria', 'Rodriguez', '1965-07-22', 'female', 'maria.rodriguez@email.com', 82.0, 162, 'Never'),
    ('33333333-3333-3333-3333-333333333333', 'MRN003', 'David', 'Chen', '1980-11-08', 'male', 'david.chen@email.com', 75.0, 178, 'Never'),
    ('44444444-4444-4444-4444-444444444444', 'MRN004', 'Sarah', 'Johnson', '1952-05-30', 'female', 'sarah.johnson@email.com', 78.5, 160, 'Current'),
    ('55555555-5555-5555-5555-555555555555', 'MRN005', 'Michael', 'Thompson', '1970-09-12', 'male', 'michael.thompson@email.com', 95.0, 180, 'Former');

-- Insert observations
INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, notes) VALUES
    ('11111111-1111-1111-1111-111111111111', 'eGFR', 28.5, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Stage 4 CKD'),
    ('22222222-2222-2222-2222-222222222222', 'eGFR', 52.3, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Mild decline'),
    ('33333333-3333-3333-3333-333333333333', 'eGFR', 95.2, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Normal'),
    ('44444444-4444-4444-4444-444444444444', 'eGFR', 38.7, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Stage 3b CKD'),
    ('55555555-5555-5555-5555-555555555555', 'eGFR', 68.5, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Mild decline');

-- Generate 200 more patients
DO $$
DECLARE
    v_patient_id uuid;
    v_egfr decimal;
BEGIN
    FOR i IN 1..200 LOOP
        v_patient_id := gen_random_uuid();
        v_egfr := 30 + (random() * 70);

        INSERT INTO patients (id, medical_record_number, first_name, last_name, date_of_birth, gender, email, weight, height)
        VALUES (
            v_patient_id,
            'MRN' || lpad((i + 5)::text, 5, '0'),
            CASE WHEN random() < 0.5 THEN 'Patient' ELSE 'Test' END,
            'User' || i,
            (CURRENT_DATE - ((40 + floor(random() * 40)) * 365))::date,
            CASE WHEN random() < 0.5 THEN 'male' ELSE 'female' END,
            'patient' || i || '@email.com',
            70 + (random() * 40),
            165 + floor(random() * 20)::integer
        );

        INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date)
        VALUES (v_patient_id, 'eGFR', v_egfr, 'mL/min/1.73m²', CURRENT_TIMESTAMP);
    END LOOP;
END $$;

\echo 'Patient data loaded...'

-- Verification
SELECT 'Database initialized successfully!' as status;
SELECT COUNT(*) as total_patients FROM patients;
SELECT COUNT(*) as total_observations FROM observations;

\echo ''
\echo '=========================================='
\echo 'INITIALIZATION COMPLETE!'
\echo 'Total patients loaded: 205'
\echo '=========================================='
