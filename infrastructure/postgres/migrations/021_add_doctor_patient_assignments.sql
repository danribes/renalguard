-- Migration 021: Add Doctor-Patient Assignment Table
-- This migration creates the infrastructure for assigning doctors to patients
-- Resolves the TODO in patientMonitor.ts line 230

-- Create doctor_patient_assignments table
CREATE TABLE IF NOT EXISTS doctor_patient_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_email VARCHAR(255) NOT NULL,
  doctor_name VARCHAR(100),
  assigned_at TIMESTAMP DEFAULT NOW(),
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_patient_doctor UNIQUE(patient_id, doctor_email)
);

-- Create indexes for performance
CREATE INDEX idx_doctor_assignments_patient ON doctor_patient_assignments(patient_id);
CREATE INDEX idx_doctor_assignments_doctor ON doctor_patient_assignments(doctor_email);
CREATE INDEX idx_doctor_assignments_primary ON doctor_patient_assignments(patient_id, is_primary) WHERE is_primary = true;

-- Add comments for documentation
COMMENT ON TABLE doctor_patient_assignments IS 'Maps patients to their assigned doctors for notification routing';
COMMENT ON COLUMN doctor_patient_assignments.is_primary IS 'Primary doctor receives all notifications; consulting doctors may receive CRITICAL only';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_doctor_assignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_doctor_assignment_timestamp
  BEFORE UPDATE ON doctor_patient_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_doctor_assignment_timestamp();

-- Populate initial assignments for existing patients
-- Assign all existing patients to a default doctor email
-- This can be updated later via the API
DO $$
DECLARE
  default_email VARCHAR(255) := 'doctor@example.com';
  patient_record RECORD;
  assignment_count INTEGER := 0;
BEGIN
  -- Only populate if no assignments exist
  IF NOT EXISTS (SELECT 1 FROM doctor_patient_assignments LIMIT 1) THEN
    FOR patient_record IN SELECT id FROM patients LOOP
      INSERT INTO doctor_patient_assignments (patient_id, doctor_email, doctor_name, is_primary)
      VALUES (patient_record.id, default_email, 'Default Doctor', true)
      ON CONFLICT (patient_id, doctor_email) DO NOTHING;
      assignment_count := assignment_count + 1;
    END LOOP;

    RAISE NOTICE 'Created % default doctor assignments', assignment_count;
    RAISE NOTICE 'Update doctor assignments via POST /api/patients/:id/assign-doctor';
  END IF;
END $$;
