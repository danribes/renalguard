-- ============================================
-- FRESH DATABASE INITIALIZATION
-- Drops all existing tables and recreates from scratch
-- ============================================
-- This script will:
-- 1. Drop all existing tables (if any)
-- 2. Create fresh schema
-- 3. Load 205 mock patients
--
-- Safe to run multiple times
-- ============================================

\echo 'Starting FRESH database initialization...'
\echo 'Dropping existing tables if any...'

-- Drop all tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS risk_assessments CASCADE;
DROP TABLE IF EXISTS conditions CASCADE;
DROP TABLE IF EXISTS observations CASCADE;
DROP TABLE IF EXISTS patients CASCADE;

\echo 'Creating extensions...'

-- Create extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\echo 'Creating fresh tables...'

-- Patients table
CREATE TABLE patients (
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

-- Observations table
CREATE TABLE observations (
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

-- Conditions table
CREATE TABLE conditions (
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

-- Risk assessments table
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    risk_score DECIMAL(3, 2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    recommendations TEXT[],
    reasoning TEXT,
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

\echo 'Tables created successfully!'
\echo 'Loading sample patients...'

-- Insert 5 named sample patients
INSERT INTO patients (id, medical_record_number, first_name, last_name, date_of_birth, gender, email, weight, height, smoking_status)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'MRN001', 'John', 'Anderson', '1958-03-15', 'male', 'john.anderson@email.com', 92.5, 172, 'Former'),
    ('22222222-2222-2222-2222-222222222222', 'MRN002', 'Maria', 'Rodriguez', '1965-07-22', 'female', 'maria.rodriguez@email.com', 82.0, 162, 'Never'),
    ('33333333-3333-3333-3333-333333333333', 'MRN003', 'David', 'Chen', '1980-11-08', 'male', 'david.chen@email.com', 75.0, 178, 'Never'),
    ('44444444-4444-4444-4444-444444444444', 'MRN004', 'Sarah', 'Johnson', '1952-05-30', 'female', 'sarah.johnson@email.com', 78.5, 160, 'Current'),
    ('55555555-5555-5555-5555-555555555555', 'MRN005', 'Michael', 'Thompson', '1970-09-12', 'male', 'michael.thompson@email.com', 95.0, 180, 'Former');

-- Insert initial observations
INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, notes) VALUES
    ('11111111-1111-1111-1111-111111111111', 'eGFR', 28.5, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Stage 4 CKD'),
    ('22222222-2222-2222-2222-222222222222', 'eGFR', 52.3, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Mild decline'),
    ('33333333-3333-3333-3333-333333333333', 'eGFR', 95.2, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Normal'),
    ('44444444-4444-4444-4444-444444444444', 'eGFR', 38.7, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Stage 3b CKD'),
    ('55555555-5555-5555-5555-555555555555', 'eGFR', 68.5, 'mL/min/1.73m²', CURRENT_TIMESTAMP, 'Mild decline');

\echo 'Generating 200 additional patients...'

-- Generate 200 more patients with realistic data
DO $$
DECLARE
    v_patient_id uuid;
    v_egfr decimal;
    v_first_names text[] := ARRAY['James', 'Mary', 'Robert', 'Patricia', 'Michael', 'Jennifer', 'William', 'Linda', 'David', 'Barbara'];
    v_last_names text[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
BEGIN
    FOR i IN 1..200 LOOP
        v_patient_id := gen_random_uuid();
        v_egfr := 30 + (random() * 70);

        INSERT INTO patients (
            id,
            medical_record_number,
            first_name,
            last_name,
            date_of_birth,
            gender,
            email,
            weight,
            height,
            smoking_status,
            cvd_history,
            family_history_esrd
        ) VALUES (
            v_patient_id,
            'MRN' || lpad((i + 5)::text, 5, '0'),
            v_first_names[1 + floor(random() * 10)::int],
            v_last_names[1 + floor(random() * 10)::int],
            (CURRENT_DATE - ((40 + floor(random() * 40)) * 365))::date,
            CASE WHEN random() < 0.5 THEN 'male' ELSE 'female' END,
            'patient' || (i + 5) || '@example.com',
            70 + (random() * 40),
            165 + floor(random() * 20)::integer,
            CASE
                WHEN random() < 0.33 THEN 'Never'
                WHEN random() < 0.66 THEN 'Former'
                ELSE 'Current'
            END,
            random() < 0.3,
            random() < 0.2
        );

        -- Add eGFR observation for each patient
        INSERT INTO observations (
            patient_id,
            observation_type,
            value_numeric,
            unit,
            observation_date,
            notes
        ) VALUES (
            v_patient_id,
            'eGFR',
            v_egfr,
            'mL/min/1.73m²',
            CURRENT_TIMESTAMP - (random() * 30 || ' days')::interval,
            CASE
                WHEN v_egfr < 30 THEN 'Stage 4-5 CKD - Severe'
                WHEN v_egfr < 45 THEN 'Stage 3b CKD - Moderate to severe'
                WHEN v_egfr < 60 THEN 'Stage 3a CKD - Mild to moderate'
                WHEN v_egfr < 90 THEN 'Stage 2 CKD - Mild'
                ELSE 'Normal kidney function'
            END
        );

        -- Add some patients with diabetes or hypertension
        IF random() < 0.4 THEN
            INSERT INTO conditions (
                patient_id,
                condition_code,
                condition_name,
                clinical_status,
                onset_date
            ) VALUES (
                v_patient_id,
                CASE WHEN random() < 0.5 THEN 'E11' ELSE 'I10' END,
                CASE WHEN random() < 0.5 THEN 'Type 2 Diabetes Mellitus' ELSE 'Essential Hypertension' END,
                'active',
                (CURRENT_DATE - ((1 + floor(random() * 10)) * 365))::date
            );
        END IF;

    END LOOP;
END $$;

\echo ''
\echo '=========================================='
\echo 'DATABASE INITIALIZATION COMPLETE!'
\echo '=========================================='

-- Final verification
SELECT 'Database initialized successfully!' as status;
SELECT COUNT(*) as total_patients FROM patients;
SELECT COUNT(*) as total_observations FROM observations;
SELECT COUNT(*) as total_conditions FROM conditions;

\echo ''
\echo 'You can now access:'
\echo '- https://ckd-analyzer-backend-ejsm.onrender.com/api/patients'
\echo '- https://ckd-analyzer-frontend-ejsm.onrender.com'
\echo ''
