-- Migration 023: Email Templates for Custom Notifications
-- Allows doctors to customize email templates with variable substitution

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_email VARCHAR(255) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  is_html BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_doctor_template UNIQUE(doctor_email, template_name)
);

-- Create indexes
CREATE INDEX idx_email_templates_doctor ON email_templates(doctor_email);
CREATE INDEX idx_email_templates_name ON email_templates(template_name);

-- Add comments
COMMENT ON TABLE email_templates IS 'Custom email templates per doctor for alert notifications';
COMMENT ON COLUMN email_templates.subject_template IS 'Subject line with {{variable}} placeholders';
COMMENT ON COLUMN email_templates.body_template IS 'Email body with {{variable}} placeholders';
COMMENT ON COLUMN email_templates.is_html IS 'Whether template contains HTML (vs plain text)';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_email_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_templates_timestamp
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_timestamp();

-- Insert default templates for common alert types
-- These serve as examples and fallbacks

-- Template 1: Kidney Function Decline
INSERT INTO email_templates (doctor_email, template_name, subject_template, body_template, is_html)
VALUES
  ('doctor@example.com', 'kidney_function_decline',
   '🔻 ALERT: {{patient_name}} - Kidney Function Worsening',
   E'Dear Dr. {{doctor_name}},\n\nPatient {{patient_name}} (MRN: {{mrn}}) has shown declining kidney function:\n\n{{alert_details}}\n\nPlease review at your earliest convenience.\n\nBest regards,\n{{facility_name}}',
   false
  );

-- Template 2: Abnormal Lab Values
INSERT INTO email_templates (doctor_email, template_name, subject_template, body_template, is_html)
VALUES
  ('doctor@example.com', 'abnormal_lab_value',
   '⚠️ ALERT: {{patient_name}} - Abnormal Lab Results',
   E'Dear Dr. {{doctor_name}},\n\nPatient {{patient_name}} (MRN: {{mrn}}) has abnormal lab results:\n\n{{alert_details}}\n\nAction may be required.\n\nBest regards,\n{{facility_name}}',
   false
  );

-- Template 3: Critical Health State Change
INSERT INTO email_templates (doctor_email, template_name, subject_template, body_template, is_html)
VALUES
  ('doctor@example.com', 'health_state_change',
   '🔴 CRITICAL: {{patient_name}} - Health State Deterioration',
   E'Dear Dr. {{doctor_name}},\n\nURGENT: Patient {{patient_name}} (MRN: {{mrn}}) has experienced health state deterioration:\n\n{{alert_details}}\n\nImmediate review recommended.\n\nBest regards,\n{{facility_name}}',
   false
  );

-- Template 4: Poor Adherence
INSERT INTO email_templates (doctor_email, template_name, subject_template, body_template, is_html)
VALUES
  ('doctor@example.com', 'poor_adherence',
   '💊 ALERT: {{patient_name}} - Poor Medication Adherence',
   E'Dear Dr. {{doctor_name}},\n\nPatient {{patient_name}} (MRN: {{mrn}}) is showing poor medication adherence:\n\n{{alert_details}}\n\nPatient intervention may be needed.\n\nBest regards,\n{{facility_name}}',
   false
  );

-- Template 5: Home Monitoring Alert
INSERT INTO email_templates (doctor_email, template_name, subject_template, body_template, is_html)
VALUES
  ('doctor@example.com', 'home_monitoring_alert',
   '🏠 URGENT: {{patient_name}} - Home Monitoring Shows Worsening',
   E'Dear Dr. {{doctor_name}},\n\nHome monitoring data for {{patient_name}} (MRN: {{mrn}}) shows concerning changes:\n\n{{alert_details}}\n\n{{ai_scheduling}}\n\nPlease schedule follow-up as recommended.\n\nBest regards,\n{{facility_name}}',
   false
  );

-- HTML template example (for doctors who prefer formatted emails)
INSERT INTO email_templates (doctor_email, template_name, subject_template, body_template, is_html)
VALUES
  ('doctor@example.com', 'kidney_function_decline_html',
   '🔻 ALERT: {{patient_name}} - Kidney Function Worsening',
   E'<html><body style="font-family: Arial, sans-serif; color: #333;">\n<h2 style="color: #d32f2f;">Kidney Function Alert</h2>\n<p>Dear Dr. {{doctor_name}},</p>\n<p>Patient <strong>{{patient_name}}</strong> (MRN: <code>{{mrn}}</code>) has shown declining kidney function:</p>\n<div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #ff9800; margin: 10px 0;">\n{{alert_details}}\n</div>\n<p>Please review at your earliest convenience.</p>\n<hr style="border: none; border-top: 1px solid #ddd;">\n<p style="color: #666; font-size: 12px;">{{facility_name}}<br>{{date}} at {{time}}</p>\n</body></html>',
   true
  );

-- Create view for template variables documentation
CREATE OR REPLACE VIEW template_variables_reference AS
SELECT
  'patient_name' as variable_name,
  'Patient full name (First Last)' as description,
  'John Doe' as example
UNION ALL
SELECT 'mrn', 'Medical Record Number', 'MRN-123456'
UNION ALL
SELECT 'doctor_name', 'Doctor full name', 'Dr. Smith'
UNION ALL
SELECT 'doctor_email', 'Doctor email address', 'doctor@example.com'
UNION ALL
SELECT 'alert_details', 'Detailed alert information', 'eGFR declined from 45 to 38...'
UNION ALL
SELECT 'facility_name', 'Medical facility name', 'General Hospital'
UNION ALL
SELECT 'date', 'Current date', '2024-03-15'
UNION ALL
SELECT 'time', 'Current time', '14:30'
UNION ALL
SELECT 'ai_scheduling', 'AI scheduling recommendation', 'Schedule blood work within 48 hours...'
UNION ALL
SELECT 'priority', 'Alert priority level', 'CRITICAL, HIGH, MODERATE';

COMMENT ON VIEW template_variables_reference IS 'Available variables for email template substitution';

-- Verification query
-- To see all templates: SELECT * FROM email_templates ORDER BY doctor_email, template_name;
