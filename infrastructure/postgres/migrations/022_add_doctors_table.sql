-- Migration 022: Add Doctors Table for Multi-Doctor Support
-- This migration creates a doctors table to support multiple doctors and their preferences

-- Create doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  specialty VARCHAR(100),
  phone VARCHAR(20),

  -- Notification preferences stored as JSONB
  -- Example: {"critical_via": "email", "high_via": "email", "moderate_via": "none", "quiet_hours": {"start": "22:00", "end": "07:00"}}
  notification_preferences JSONB DEFAULT '{
    "critical_via": "email",
    "high_via": "email",
    "moderate_via": "email",
    "quiet_hours_enabled": false,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "07:00"
  }'::jsonb,

  -- Email template customization
  email_signature TEXT,
  facility_name VARCHAR(200),
  facility_logo_url VARCHAR(500),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_doctors_email ON doctors(email);
CREATE INDEX idx_doctors_active ON doctors(is_active);

-- Add comments
COMMENT ON TABLE doctors IS 'Stores doctor profiles and notification preferences';
COMMENT ON COLUMN doctors.notification_preferences IS 'JSONB containing alert delivery preferences and quiet hours';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_doctors_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_doctors_timestamp
  BEFORE UPDATE ON doctors
  FOR EACH ROW
  EXECUTE FUNCTION update_doctors_timestamp();

-- Add foreign key to doctor_patient_assignments (optional, for referential integrity)
-- Only add if you want to enforce that doctor_email must exist in doctors table
-- For now, we'll keep it optional to allow flexibility

-- Create a default doctor entry
INSERT INTO doctors (email, name, specialty, is_active)
VALUES ('doctor@example.com', 'Default Doctor', 'Nephrology', true)
ON CONFLICT (email) DO NOTHING;

-- Create view for easy patient-doctor lookup with preferences
CREATE OR REPLACE VIEW patient_doctor_assignments_with_prefs AS
SELECT
  dpa.id,
  dpa.patient_id,
  dpa.doctor_email,
  dpa.doctor_name,
  dpa.is_primary,
  dpa.assigned_at,
  d.name as doctor_full_name,
  d.specialty,
  d.phone as doctor_phone,
  d.notification_preferences,
  d.email_signature,
  d.facility_name,
  d.is_active as doctor_is_active
FROM doctor_patient_assignments dpa
LEFT JOIN doctors d ON dpa.doctor_email = d.email;

COMMENT ON VIEW patient_doctor_assignments_with_prefs IS 'Combines patient assignments with doctor preferences for easy notification routing';
