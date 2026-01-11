#!/usr/bin/env node

/**
 * Apply migration 023 - Email Templates
 * This script can be run directly in the Render shell
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://healthcare_user:2IDoqcoj1ERr9SAJgfEk6GQyDBUXhCpJ@dpg-d4c4tuadbo4c73d1s0p0-a.oregon-postgres.render.com/healthcare_ai_db_fo2v';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration 023 - Email Templates...\n');

    // 1. Create email_templates table
    console.log('1. Creating email_templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_email VARCHAR(255) NOT NULL,
        template_name VARCHAR(100) NOT NULL,
        subject_template TEXT NOT NULL,
        body_template TEXT NOT NULL,
        is_html BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(doctor_email, template_name)
      );
    `);
    console.log('✅ Table created\n');

    // 2. Create indexes
    console.log('2. Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_templates_doctor ON email_templates(doctor_email);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(template_name);
    `);
    console.log('✅ Indexes created\n');

    // 3. Create trigger function
    console.log('3. Creating trigger function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_email_template_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Trigger function created\n');

    // 4. Create trigger
    console.log('4. Creating trigger...');
    await client.query(`
      DROP TRIGGER IF EXISTS update_email_template_timestamp ON email_templates;
    `);
    await client.query(`
      CREATE TRIGGER update_email_template_timestamp
      BEFORE UPDATE ON email_templates
      FOR EACH ROW
      EXECUTE FUNCTION update_email_template_timestamp();
    `);
    console.log('✅ Trigger created\n');

    // 5. Insert default templates
    console.log('5. Inserting default templates...');

    const templates = [
      {
        name: 'kidney_function_decline',
        subject: '🔻 ALERT: {{patient_name}} - Kidney Function Worsening',
        body: `Dear Dr. {{doctor_name}},

Patient {{patient_name}} (MRN: {{mrn}}) has shown concerning kidney function decline.

Current eGFR: {{egfr}} ml/min/1.73m²
Previous eGFR: {{previous_egfr}} ml/min/1.73m²
Change: {{egfr_change}} ml/min/1.73m² ({{change_percentage}}%)

This represents a {{severity}} decline in kidney function.

Please review the patient chart and consider appropriate intervention.

Best regards,
Clinical AI Alert System`
      },
      {
        name: 'health_state_change',
        subject: '⚠️  NOTIFICATION: {{patient_name}} - Health Status Change',
        body: `Dear Dr. {{doctor_name}},

Patient {{patient_name}} (MRN: {{mrn}}) has experienced a health state change:

Previous State: {{previous_state}}
Current State: {{current_state}}
Date of Change: {{change_date}}

Please review the patient record for details.

Best regards,
Clinical AI Alert System`
      },
      {
        name: 'poor_adherence',
        subject: '⚠️  ADHERENCE ALERT: {{patient_name}} - Medication Non-Compliance',
        body: `Dear Dr. {{doctor_name}},

Patient {{patient_name}} (MRN: {{mrn}}) is showing signs of poor medication adherence.

Adherence Rate: {{adherence_percentage}}%
Missed Doses: {{missed_doses}}
Last Taken: {{last_taken_date}}

Consider reaching out to the patient to discuss barriers to adherence.

Best regards,
Clinical AI Alert System`
      },
      {
        name: 'home_monitoring_alert',
        subject: '📊 HOME MONITORING: {{patient_name}} - Abnormal Reading',
        body: `Dear Dr. {{doctor_name}},

Patient {{patient_name}} (MRN: {{mrn}}) has reported an abnormal home monitoring reading:

Measurement Type: {{measurement_type}}
Value: {{measurement_value}} {{measurement_unit}}
Normal Range: {{normal_range}}
Date/Time: {{measurement_date}}

Please review and determine if follow-up is needed.

Best regards,
Clinical AI Alert System`
      },
      {
        name: 'abnormal_lab_value',
        subject: '🧪 LAB ALERT: {{patient_name}} - Abnormal Result',
        body: `Dear Dr. {{doctor_name}},

Patient {{patient_name}} (MRN: {{mrn}}) has an abnormal lab result:

Test: {{lab_test_name}}
Result: {{lab_value}} {{lab_unit}}
Reference Range: {{reference_range}}
Severity: {{severity}}
Lab Date: {{lab_date}}

Please review and take appropriate action.

Best regards,
Clinical AI Alert System`
      }
    ];

    for (const template of templates) {
      await client.query(`
        INSERT INTO email_templates (doctor_email, template_name, subject_template, body_template, is_html)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (doctor_email, template_name) DO NOTHING;
      `, ['doctor@example.com', template.name, template.subject, template.body, false]);
      console.log(`  ✓ Inserted ${template.name}`);
    }
    console.log('✅ Default templates inserted\n');

    // 6. Create template_variables_reference view
    console.log('6. Creating template_variables_reference view...');
    await client.query(`
      CREATE OR REPLACE VIEW template_variables_reference AS
      SELECT 'patient_name' as variable_name, 'Full name of the patient' as description, 'John Smith' as example
      UNION ALL SELECT 'mrn', 'Medical Record Number', 'MRN-12345'
      UNION ALL SELECT 'doctor_name', 'Name of the assigned doctor', 'Dr. Sarah Johnson'
      UNION ALL SELECT 'egfr', 'Current eGFR value', '45'
      UNION ALL SELECT 'previous_egfr', 'Previous eGFR value', '52'
      UNION ALL SELECT 'egfr_change', 'Change in eGFR', '-7'
      UNION ALL SELECT 'change_percentage', 'Percentage change', '-13.5'
      UNION ALL SELECT 'severity', 'Alert severity level', 'moderate'
      UNION ALL SELECT 'previous_state', 'Previous health state', 'CKD Stage 3a'
      UNION ALL SELECT 'current_state', 'Current health state', 'CKD Stage 3b'
      UNION ALL SELECT 'change_date', 'Date of state change', '2024-01-15'
      UNION ALL SELECT 'adherence_percentage', 'Medication adherence rate', '65'
      UNION ALL SELECT 'missed_doses', 'Number of missed doses', '7'
      UNION ALL SELECT 'last_taken_date', 'Date of last dose', '2024-01-10'
      UNION ALL SELECT 'measurement_type', 'Type of home measurement', 'Blood Pressure'
      UNION ALL SELECT 'measurement_value', 'Measured value', '160/95'
      UNION ALL SELECT 'measurement_unit', 'Unit of measurement', 'mmHg'
      UNION ALL SELECT 'normal_range', 'Normal range for measurement', '120/80'
      UNION ALL SELECT 'measurement_date', 'Date/time of measurement', '2024-01-15 08:30'
      UNION ALL SELECT 'lab_test_name', 'Name of laboratory test', 'Serum Creatinine'
      UNION ALL SELECT 'lab_value', 'Lab result value', '2.1'
      UNION ALL SELECT 'lab_unit', 'Unit of lab result', 'mg/dL'
      UNION ALL SELECT 'reference_range', 'Normal reference range', '0.7-1.3 mg/dL'
      UNION ALL SELECT 'lab_date', 'Date of lab test', '2024-01-14';
    `);
    console.log('✅ View created\n');

    // 7. Record migration in schema_migrations table
    console.log('7. Recording migration...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      INSERT INTO schema_migrations (version)
      VALUES ('023_add_email_templates')
      ON CONFLICT (version) DO NOTHING;
    `);
    console.log('✅ Migration recorded\n');

    // Verify
    console.log('📊 Verification:');
    const count = await client.query('SELECT COUNT(*) as count FROM email_templates');
    console.log(`✓ email_templates table has ${count.rows[0].count} templates`);

    const varCount = await client.query('SELECT COUNT(*) as count FROM template_variables_reference');
    console.log(`✓ template_variables_reference view has ${varCount.rows[0].count} variables`);

    console.log('\n✅ Migration 023 completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
