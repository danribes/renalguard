import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database';
import { classifyKDIGO, classifyKDIGOWithSCORED, getCKDSeverity, getMonitoringFrequencyCategory, getNonCKDRiskLevel, calculateSCORED, PatientDemographics } from '../../utils/kdigo';

const router = Router();

/**
 * POST /api/init/populate
 * Populate database with initial patient data
 */
router.post('/populate', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    // Check if patients already exist
    const checkResult = await pool.query('SELECT COUNT(*) FROM patients');
    const patientCount = parseInt(checkResult.rows[0].count);

    if (patientCount > 0) {
      return res.json({
        status: 'success',
        message: 'Database already contains patients',
        patient_count: patientCount
      });
    }

    console.log('Populating database with initial patients...');

    // Insert 5 initial patients
    await pool.query(`
      INSERT INTO patients (
        id, medical_record_number, first_name, last_name, date_of_birth, gender, email, phone,
        weight, height, smoking_status, cvd_history, family_history_esrd,
        on_ras_inhibitor, on_sglt2i, nephrotoxic_meds, nephrologist_referral,
        diagnosis_date, last_visit_date, next_visit_date
      ) VALUES
      (
        '11111111-1111-1111-1111-111111111111', 'MRN001', 'John', 'Anderson', '1958-03-15', 'male',
        'john.anderson@email.com', '+1-555-0101',
        92.5, 172, 'Former', true, false,
        true, false, true, false,
        '2022-05-20', '2025-10-15', '2025-11-28'
      ),
      (
        '22222222-2222-2222-2222-222222222222', 'MRN002', 'Maria', 'Rodriguez', '1965-07-22', 'female',
        'maria.rodriguez@email.com', '+1-555-0102',
        82.0, 162, 'Never', false, false,
        true, false, false, false,
        '2023-08-10', '2025-10-28', '2026-04-28'
      ),
      (
        '33333333-3333-3333-3333-333333333333', 'MRN003', 'David', 'Chen', '1980-11-08', 'male',
        'david.chen@email.com', '+1-555-0103',
        75.0, 178, 'Never', false, false,
        false, false, false, false,
        NULL, '2025-11-03', '2026-05-03'
      ),
      (
        '44444444-4444-4444-4444-444444444444', 'MRN004', 'Sarah', 'Johnson', '1952-05-30', 'female',
        'sarah.johnson@email.com', '+1-555-0104',
        78.5, 160, 'Current', true, true,
        true, true, false, true,
        '2021-03-15', '2025-11-02', '2025-11-20'
      ),
      (
        '55555555-5555-5555-5555-555555555555', 'MRN005', 'Michael', 'Brown', '1975-09-12', 'male',
        'michael.brown@email.com', '+1-555-0105',
        88.0, 180, 'Never', false, false,
        false, false, false, false,
        '2024-01-20', '2025-10-20', '2026-04-20'
      )
    `);

    // Get final count
    const finalResult = await pool.query('SELECT COUNT(*) FROM patients');
    const finalCount = parseInt(finalResult.rows[0].count);

    console.log(`✓ Database populated with ${finalCount} patients`);

    res.json({
      status: 'success',
      message: 'Database populated successfully',
      patient_count: finalCount
    });

  } catch (error) {
    console.error('[Init API] Error populating database:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to populate database',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/init/status
 * Check database status
 */
/**
 * POST /api/init/migrate
 * Run database migrations to add missing columns
 */
router.post('/migrate', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('Running database migrations...');

    // Add monitoring and treatment columns if they don't exist
    await pool.query(`
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS home_monitoring_device VARCHAR(100);
    `);
    await pool.query(`
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS home_monitoring_active BOOLEAN DEFAULT false;
    `);
    await pool.query(`
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS ckd_treatment_active BOOLEAN DEFAULT false;
    `);
    await pool.query(`
      ALTER TABLE patients ADD COLUMN IF NOT EXISTS ckd_treatment_type VARCHAR(100);
    `);

    // Update existing NULL values to defaults
    await pool.query(`
      UPDATE patients SET home_monitoring_active = false WHERE home_monitoring_active IS NULL;
    `);
    await pool.query(`
      UPDATE patients SET ckd_treatment_active = false WHERE ckd_treatment_active IS NULL;
    `);

    // Create patient_health_state_comments table
    console.log('Creating patient_health_state_comments table...');
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS patient_health_state_comments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        state_transition_id UUID,
        comment_text TEXT NOT NULL,
        comment_type VARCHAR(50) NOT NULL DEFAULT 'automatic',
        health_state_from VARCHAR(10),
        health_state_to VARCHAR(10) NOT NULL,
        risk_level_from VARCHAR(20),
        risk_level_to VARCHAR(20) NOT NULL,
        change_type VARCHAR(20),
        is_ckd_patient BOOLEAN NOT NULL DEFAULT false,
        severity_from VARCHAR(20),
        severity_to VARCHAR(20),
        cycle_number INTEGER,
        egfr_from DECIMAL(5, 2),
        egfr_to DECIMAL(5, 2),
        egfr_change DECIMAL(6, 2),
        uacr_from DECIMAL(8, 2),
        uacr_to DECIMAL(8, 2),
        uacr_change DECIMAL(8, 2),
        clinical_summary TEXT,
        recommended_actions TEXT[],
        mitigation_measures TEXT[],
        acknowledgment_text TEXT,
        severity VARCHAR(20) NOT NULL DEFAULT 'info',
        created_by VARCHAR(100) DEFAULT 'system',
        created_by_type VARCHAR(20) DEFAULT 'system',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        visibility VARCHAR(20) DEFAULT 'visible',
        is_pinned BOOLEAN DEFAULT false,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        CONSTRAINT valid_comment_type CHECK (comment_type IN ('automatic', 'manual', 'ai_generated')),
        CONSTRAINT valid_change_type CHECK (change_type IN ('improved', 'worsened', 'stable', 'initial')),
        CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical')),
        CONSTRAINT valid_visibility CHECK (visibility IN ('visible', 'archived')),
        CONSTRAINT valid_created_by_type CHECK (created_by_type IN ('system', 'doctor', 'ai'))
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_comments_patient_id ON patient_health_state_comments(patient_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_comments_state_transition ON patient_health_state_comments(state_transition_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_comments_created_at ON patient_health_state_comments(created_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_comments_visibility ON patient_health_state_comments(visibility);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_comments_is_read ON patient_health_state_comments(is_read);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_comments_change_type ON patient_health_state_comments(change_type);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_comments_severity ON patient_health_state_comments(severity);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_comments_recent_changes ON patient_health_state_comments(patient_id, created_at DESC, change_type)
      WHERE visibility = 'visible' AND change_type IN ('improved', 'worsened');
    `);

    console.log('✓ Database migrations completed successfully');

    res.json({
      status: 'success',
      message: 'Database migrations completed successfully'
    });

  } catch (error) {
    console.error('[Init API] Error running migrations:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to run database migrations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/fix-trigger
 * Fix the detect_risk_state_change trigger to handle both patients and observations tables
 */
router.post('/fix-trigger', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('Fixing detect_risk_state_change trigger...');

    // Update the trigger function to handle both tables
    await pool.query(`
      CREATE OR REPLACE FUNCTION detect_risk_state_change()
      RETURNS TRIGGER AS $$
      DECLARE
          v_patient_id UUID;
          v_mrn VARCHAR(20);
      BEGIN
          -- Determine patient_id and MRN based on which table triggered this
          IF TG_TABLE_NAME = 'patients' THEN
              v_patient_id := NEW.id;
              v_mrn := NEW.medical_record_number;
          ELSIF TG_TABLE_NAME = 'observations' THEN
              v_patient_id := NEW.patient_id;
              -- Get MRN from patients table
              SELECT medical_record_number INTO v_mrn
              FROM patients
              WHERE id = NEW.patient_id;
          ELSE
              -- Unknown table, just use patient_id if available
              v_patient_id := NEW.patient_id;
              v_mrn := 'UNKNOWN';
          END IF;

          -- Log that trigger was fired
          RAISE NOTICE 'Risk state change detector triggered for patient: % (MRN: %)', v_patient_id, v_mrn;

          -- Send a notification to the backend via NOTIFY
          -- The backend will listen for this and run the risk assessment
          PERFORM pg_notify(
              'patient_data_updated',
              json_build_object(
                  'patient_id', v_patient_id,
                  'mrn', v_mrn,
                  'table', TG_TABLE_NAME,
                  'timestamp', CURRENT_TIMESTAMP
              )::text
          );

          RAISE NOTICE 'Notification sent via pg_notify for patient %', v_mrn;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✓ Trigger function fixed successfully');

    res.json({
      status: 'success',
      message: 'Trigger function fixed successfully'
    });

  } catch (error) {
    console.error('[Init API] Error fixing trigger:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fix trigger function',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/clear-patients
 * Clear all patients and related data from the database
 * WARNING: This deletes ALL patient data!
 */
router.post('/clear-patients', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('Clearing all patient data...');

    // Count existing patients
    const countResult = await pool.query('SELECT COUNT(*) FROM patients');
    const existingCount = parseInt(countResult.rows[0].count);

    if (existingCount === 0) {
      return res.json({
        status: 'success',
        message: 'Database is already empty',
        deleted_patients: 0
      });
    }

    // Delete all patients (cascade will handle related tables)
    await pool.query('DELETE FROM patients');

    console.log(`✓ Deleted ${existingCount} patients and all related data`);

    res.json({
      status: 'success',
      message: 'All patient data cleared successfully',
      deleted_patients: existingCount
    });

  } catch (error) {
    console.error('[Init API] Error clearing patients:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear patient data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/populate-tracking-tables
 * Populate CKD and non-CKD patient tracking tables with risk factors and treatments
 * Uses SCORED model for non-CKD patient risk calculation
 */
router.post('/populate-tracking-tables', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('Populating patient tracking tables...');

    // Get all patients with their latest observations and demographics for SCORED
    const patientsResult = await pool.query(`
      SELECT
        p.id,
        p.date_of_birth,
        p.gender,
        p.weight,
        p.height,
        p.cvd_history,
        p.smoking_status,
        p.family_history_esrd,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'eGFR'
         ORDER BY observation_date DESC LIMIT 1) as latest_egfr,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'uACR'
         ORDER BY observation_date DESC LIMIT 1) as latest_uacr,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'BMI'
         ORDER BY observation_date DESC LIMIT 1) as latest_bmi,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'HbA1c'
         ORDER BY observation_date DESC LIMIT 1) as latest_hba1c,
        -- Risk factors from patient_risk_factors table (if exists)
        prf.has_diabetes,
        prf.has_hypertension,
        prf.has_cvd,
        prf.has_peripheral_vascular_disease as has_pvd,
        prf.current_bmi as risk_factor_bmi
      FROM patients p
      LEFT JOIN patient_risk_factors prf ON p.id = prf.patient_id
    `);

    const treatments = [
      { name: 'Jardiance (Empagliflozin)', class: 'SGLT2i' },
      { name: 'Farxiga (Dapagliflozin)', class: 'SGLT2i' },
      { name: 'Invokana (Canagliflozin)', class: 'SGLT2i' },
      { name: 'Kerendia (Finerenone)', class: 'MRA' },
      { name: 'Vicadrostat (Investigational)', class: 'Investigational' }
    ];

    let ckdPatientsProcessed = 0;
    let nonCkdPatientsProcessed = 0;

    for (const patient of patientsResult.rows) {
      const egfr = patient.latest_egfr || 90;
      const uacr = patient.latest_uacr || 15;

      // Calculate age from date_of_birth
      const birthDate = new Date(patient.date_of_birth);
      const age = Math.floor((new Date().getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      // Calculate BMI if not available from risk factors
      let bmi = patient.risk_factor_bmi || patient.latest_bmi;
      if (!bmi && patient.weight && patient.height) {
        const heightInMeters = patient.height / 100;
        bmi = patient.weight / (heightInMeters * heightInMeters);
      }

      // Normalize smoking status
      let smoking_status: 'never' | 'former' | 'current' | undefined;
      if (patient.smoking_status) {
        const status = patient.smoking_status.toLowerCase();
        if (status === 'never') smoking_status = 'never';
        else if (status === 'former' || status === 'ex-smoker') smoking_status = 'former';
        else if (status === 'current' || status === 'smoker') smoking_status = 'current';
      }

      // Determine diabetes status from HbA1c or risk factors
      const hasDiabetes = patient.has_diabetes || (patient.latest_hba1c && patient.latest_hba1c >= 6.5);

      // Build demographics for SCORED/Framingham assessment
      const demographics: PatientDemographics = {
        age,
        gender: (patient.gender?.toLowerCase() || 'male') as 'male' | 'female',
        has_hypertension: patient.has_hypertension || false,
        has_diabetes: hasDiabetes || false,
        has_cvd: patient.has_cvd || patient.cvd_history || false,
        has_pvd: patient.has_pvd || false,
        smoking_status,
        bmi
      };

      // Use SCORED-based classification for proper risk assessment
      const kdigo = classifyKDIGOWithSCORED(egfr, uacr, demographics);
      const monitoringFreq = getMonitoringFrequencyCategory(kdigo);

      if (kdigo.has_ckd) {
        // CKD Patient - Insert into ckd_patient_data
        const severity = getCKDSeverity(kdigo.ckd_stage);
        const isMonitored = kdigo.risk_level === 'high' || kdigo.risk_level === 'very_high';

        const ckdDataResult = await pool.query(`
          INSERT INTO ckd_patient_data (
            patient_id, ckd_severity, ckd_stage,
            kdigo_gfr_category, kdigo_albuminuria_category, kdigo_health_state,
            is_monitored, monitoring_device, monitoring_frequency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (patient_id) DO UPDATE SET
            ckd_severity = EXCLUDED.ckd_severity,
            ckd_stage = EXCLUDED.ckd_stage,
            is_monitored = EXCLUDED.is_monitored,
            monitoring_frequency = EXCLUDED.monitoring_frequency,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [
          patient.id,
          severity,
          kdigo.ckd_stage,
          kdigo.gfr_category,
          kdigo.albuminuria_category,
          kdigo.health_state,
          isMonitored,
          isMonitored ? 'Minuteful Kidney Kit' : null,
          monitoringFreq
        ]);

        const ckdDataId = ckdDataResult.rows[0].id;

        // Assign treatment to all CKD patients
        const randomTreatment = treatments[Math.floor(Math.random() * treatments.length)];
        await pool.query(`
          INSERT INTO ckd_treatments (
            ckd_patient_data_id, treatment_name, treatment_class, is_active, start_date
          ) VALUES ($1, $2, $3, $4, CURRENT_DATE)
          ON CONFLICT DO NOTHING
        `, [ckdDataId, randomTreatment.name, randomTreatment.class, true]);

        // Update is_treated flag
        await pool.query(`
          UPDATE ckd_patient_data SET is_treated = true WHERE id = $1
        `, [ckdDataId]);

        ckdPatientsProcessed++;

      } else {
        // Non-CKD Patient - Insert into non_ckd_patient_data
        // Use the correctly calculated risk level from SCORED model
        const riskLevel = kdigo.risk_level === 'very_high' ? 'high' : kdigo.risk_level;
        const isMonitored = kdigo.risk_level === 'high' || kdigo.risk_level === 'very_high';

        const nonCkdDataResult = await pool.query(`
          INSERT INTO non_ckd_patient_data (
            patient_id, risk_level, kdigo_health_state,
            is_monitored, monitoring_device, monitoring_frequency
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (patient_id) DO UPDATE SET
            risk_level = EXCLUDED.risk_level,
            is_monitored = EXCLUDED.is_monitored,
            monitoring_frequency = EXCLUDED.monitoring_frequency,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [
          patient.id,
          riskLevel,
          kdigo.health_state,
          isMonitored,
          isMonitored ? 'Minuteful Kidney Kit' : null,
          monitoringFreq
        ]);

        const nonCkdDataId = nonCkdDataResult.rows[0].id;

        // Add risk factors
        const riskFactors: Array<{ type: string; value: string; severity: string }> = [];

        if (patient.cvd_history || patient.has_cvd) {
          riskFactors.push({ type: 'cardiovascular_disease', value: 'History of CVD', severity: 'moderate' });
        }

        if (patient.smoking_status === 'Current') {
          riskFactors.push({ type: 'smoking', value: 'Current smoker', severity: 'severe' });
        } else if (patient.smoking_status === 'Former') {
          riskFactors.push({ type: 'smoking', value: 'Former smoker', severity: 'mild' });
        }

        if (patient.family_history_esrd) {
          riskFactors.push({ type: 'family_history', value: 'Family history of ESRD', severity: 'moderate' });
        }

        if (patient.latest_bmi && patient.latest_bmi >= 30) {
          riskFactors.push({ type: 'obesity', value: `BMI ${patient.latest_bmi}`, severity: patient.latest_bmi >= 35 ? 'severe' : 'moderate' });
        }

        if (patient.latest_hba1c && patient.latest_hba1c >= 6.5) {
          riskFactors.push({ type: 'diabetes', value: `HbA1c ${patient.latest_hba1c}%`, severity: patient.latest_hba1c >= 8.0 ? 'severe' : 'moderate' });
        }

        // Insert risk factors
        for (const rf of riskFactors) {
          await pool.query(`
            INSERT INTO non_ckd_risk_factors (
              non_ckd_patient_data_id, risk_factor_type, risk_factor_value, severity
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
          `, [nonCkdDataId, rf.type, rf.value, rf.severity]);
        }

        nonCkdPatientsProcessed++;
      }
    }

    console.log(`✓ Processed ${ckdPatientsProcessed} CKD patients`);
    console.log(`✓ Processed ${nonCkdPatientsProcessed} non-CKD patients`);

    res.json({
      status: 'success',
      message: 'Patient tracking tables populated successfully',
      ckd_patients: ckdPatientsProcessed,
      non_ckd_patients: nonCkdPatientsProcessed
    });

  } catch (error) {
    console.error('[Init API] Error populating tracking tables:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to populate tracking tables',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/assign-monitoring-treatment
 * Assign monitoring and treatment based on risk classification (DEPRECATED - use populate-tracking-tables)
 */
router.post('/assign-monitoring-treatment', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    // Get all patients with their latest observations
    const patientsResult = await pool.query(`
      SELECT
        p.id,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'eGFR'
         ORDER BY observation_date DESC LIMIT 1) as latest_egfr,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'uACR'
         ORDER BY observation_date DESC LIMIT 1) as latest_uacr
      FROM patients p
    `);

    const treatments = [
      'Jardiance (Empagliflozin)',
      'Farxiga (Dapagliflozin)',
      'Invokana (Canagliflozin)',
      'Kerendia (Finerenone)',
      'Vicadrostat (Investigational)'
    ];

    let monitoringAssigned = 0;
    let treatmentAssigned = 0;

    for (const patient of patientsResult.rows) {
      const egfr = patient.latest_egfr || 90;
      const uacr = patient.latest_uacr || 15;

      const kdigo = classifyKDIGO(egfr, uacr);

      // Assign Minuteful Kidney Kit to all high-risk patients (CKD or non-CKD)
      if (kdigo.risk_level === 'high' || kdigo.risk_level === 'very_high') {
        await pool.query(`
          UPDATE patients
          SET home_monitoring_device = $1,
              home_monitoring_active = $2
          WHERE id = $3
        `, ['Minuteful Kidney Kit', true, patient.id]);
        monitoringAssigned++;
      }

      // Assign treatment to all CKD patients
      if (kdigo.has_ckd) {
        // Randomly assign one of the treatments
        const randomTreatment = treatments[Math.floor(Math.random() * treatments.length)];

        await pool.query(`
          UPDATE patients
          SET ckd_treatment_active = $1,
              ckd_treatment_type = $2
          WHERE id = $3
        `, [true, randomTreatment, patient.id]);
        treatmentAssigned++;
      }
    }

    console.log(`✓ Assigned monitoring to ${monitoringAssigned} high-risk patients`);
    console.log(`✓ Assigned treatment to ${treatmentAssigned} CKD patients`);

    res.json({
      status: 'success',
      message: 'Monitoring and treatment assigned successfully',
      monitoring_assigned: monitoringAssigned,
      treatment_assigned: treatmentAssigned
    });

  } catch (error) {
    console.error('[Init API] Error assigning monitoring/treatment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to assign monitoring and treatment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/status', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const patientResult = await pool.query('SELECT COUNT(*) FROM patients');
    const patientCount = parseInt(patientResult.rows[0].count);

    const observationResult = await pool.query('SELECT COUNT(*) FROM observations');
    const observationCount = parseInt(observationResult.rows[0].count);

    const conditionResult = await pool.query('SELECT COUNT(*) FROM conditions');
    const conditionCount = parseInt(conditionResult.rows[0].count);

    res.json({
      status: 'success',
      database: {
        patients: patientCount,
        observations: observationCount,
        conditions: conditionCount,
        is_empty: patientCount === 0
      }
    });

  } catch (error) {
    console.error('[Init API] Error checking status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check database status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/populate-realistic-cohort
 * Populate database with realistic patient distribution matching real-world prevalence
 * Body: { patient_count: number } (default: 1000)
 */
router.post('/populate-realistic-cohort', async (req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    const targetCount = req.body.patient_count || 1000;

    console.log(`Generating ${targetCount} patients with real-world prevalence...`);

    // Check if database already has patients
    const countResult = await pool.query('SELECT COUNT(*) FROM patients');
    const existingCount = parseInt(countResult.rows[0].count);

    if (existingCount > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Database already contains ${existingCount} patients. Please clear the database first using /api/init/clear-patients`,
        existing_patients: existingCount
      });
    }

    // Start MRN numbering from 1 (will be formatted as MRN000001, MRN000002, etc.)
    const startingMrnNumber = 1;
    console.log(`Starting from MRN number: ${startingMrnNumber}`);

    // Distribution based on real-world prevalence
    const distribution = {
      nonCkdLowModerate: Math.floor(targetCount * 0.245), // 24.5%
      nonCkdHigh: Math.floor(targetCount * 0.40), // 40%
      ckdMild: Math.floor(targetCount * 0.08), // 8%
      ckdModerate: Math.floor(targetCount * 0.25), // 25%
      ckdSevere: Math.floor(targetCount * 0.02), // 2%
      ckdKidneyFailure: Math.floor(targetCount * 0.005) // 0.5%
    };

    // Monitoring/treatment percentages
    const nonCkdHighMonitoredPercent = 0.60; // 60% of high-risk non-CKD
    const ckdMonitoredPercent = 0.90; // 90% of all CKD
    const ckdTreatedPercent = 0.80; // 80% of all CKD

    const treatments = [
      { name: 'Jardiance (Empagliflozin)', class: 'SGLT2i' },
      { name: 'Farxiga (Dapagliflozin)', class: 'SGLT2i' },
      { name: 'Invokana (Canagliflozin)', class: 'SGLT2i' },
      { name: 'Kerendia (Finerenone)', class: 'MRA' },
      { name: 'Vicadrostat (Investigational)', class: 'Investigational' }
    ];

    // Separate name arrays by gender
    const maleFirstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Donald', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua'];
    const femaleFirstNames = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];

    let patientsCreated = 0;
    const today = new Date();

    // Helper function to generate patient
    const generatePatient = async (category: string, _index: number) => {
      // Determine gender first
      const gender = Math.random() > 0.5 ? 'male' : 'female';

      // Then pick appropriate name based on gender
      const firstNamePool = gender === 'male' ? maleFirstNames : femaleFirstNames;
      const firstName = firstNamePool[Math.floor(Math.random() * firstNamePool.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

      // Age 66-90 with random variation
      const age = 66 + Math.floor(Math.random() * 25);
      const birthYear = today.getFullYear() - age;
      const birthMonth = Math.floor(Math.random() * 12);
      const birthDay = Math.floor(Math.random() * 28) + 1;
      const dateOfBirth = new Date(birthYear, birthMonth, birthDay);

      // Generate labs based on category
      let egfr: number, uacr: number, severity: string | null, ckdStage: number | null;
      let riskLevel: string | null, isMonitored: boolean, isTreated: boolean;

      switch (category) {
        case 'nonCkdLowModerate':
          egfr = 75 + Math.random() * 30; // 75-105
          uacr = Math.random() * 25; // 0-25
          severity = null;
          ckdStage = null;
          riskLevel = Math.random() > 0.5 ? 'low' : 'moderate';
          isMonitored = false;
          isTreated = false;
          break;

        case 'nonCkdHigh':
          egfr = 60 + Math.random() * 20; // 60-80
          uacr = 30 + Math.random() * 270; // 30-300
          severity = null;
          ckdStage = null;
          riskLevel = 'high';
          isMonitored = Math.random() < nonCkdHighMonitoredPercent;
          isTreated = false;
          break;

        case 'ckdMild':
          egfr = 65 + Math.random() * 25; // 65-90
          uacr = 30 + Math.random() * 70; // 30-100
          severity = 'mild';
          ckdStage = Math.random() > 0.5 ? 1 : 2;
          riskLevel = null;
          isMonitored = Math.random() < ckdMonitoredPercent;
          isTreated = Math.random() < ckdTreatedPercent;
          break;

        case 'ckdModerate':
          egfr = 30 + Math.random() * 30; // 30-60
          uacr = 30 + Math.random() * 270; // 30-300
          severity = 'moderate';
          ckdStage = 3;
          riskLevel = null;
          isMonitored = Math.random() < ckdMonitoredPercent;
          isTreated = Math.random() < ckdTreatedPercent;
          break;

        case 'ckdSevere':
          egfr = 15 + Math.random() * 15; // 15-30
          uacr = 100 + Math.random() * 400; // 100-500
          severity = 'severe';
          ckdStage = 4;
          riskLevel = null;
          isMonitored = Math.random() < ckdMonitoredPercent;
          isTreated = Math.random() < ckdTreatedPercent;
          break;

        case 'ckdKidneyFailure':
          egfr = 5 + Math.random() * 10; // 5-15
          uacr = 300 + Math.random() * 200; // 300-500
          severity = 'kidney_failure';
          ckdStage = 5;
          riskLevel = null;
          isMonitored = true; // All kidney failure patients monitored
          isTreated = true; // All kidney failure patients treated
          break;

        default:
          throw new Error('Invalid category');
      }

      // Insert patient with all required fields to avoid trigger issues
      const weight = 60 + Math.random() * 50; // 60-110 kg
      const height = gender === 'male' ? 170 + Math.floor(Math.random() * 20) : 160 + Math.floor(Math.random() * 20);
      const smokingStatus = Math.random() < 0.7 ? 'Never' : (Math.random() < 0.7 ? 'Former' : 'Current');

      const patientResult = await pool.query(`
        INSERT INTO patients (
          medical_record_number, first_name, last_name, date_of_birth, gender,
          email, phone, last_visit_date,
          weight, height, smoking_status, cvd_history, family_history_esrd,
          on_ras_inhibitor, on_sglt2i, nephrotoxic_meds, nephrologist_referral
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id
      `, [
        `MRN${String(startingMrnNumber + patientsCreated).padStart(6, '0')}`,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
        `+1-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000),
        weight,
        height,
        smokingStatus,
        Math.random() < 0.2, // 20% CVD history
        Math.random() < 0.1, // 10% family history
        severity !== null, // On RAS inhibitor if CKD
        false, // on_sglt2i
        false, // nephrotoxic_meds
        severity === 'severe' || severity === 'kidney_failure' // Nephrology referral for severe cases
      ]);

      const newPatientId = patientResult.rows[0].id;

      // Calculate BMI
      const bmi = weight / ((height / 100) * (height / 100));

      // ============================================
      // Generate comprehensive lab panel
      // ============================================

      // Blood Pressure (CRITICAL - all patients)
      let systolic: number, diastolic: number;
      if (category === 'nonCkdLowModerate') {
        // Normal BP
        systolic = 110 + Math.floor(Math.random() * 20); // 110-129
        diastolic = 70 + Math.floor(Math.random() * 15); // 70-84
      } else if (category === 'nonCkdHigh') {
        // Prehypertensive/mild HTN
        systolic = 130 + Math.floor(Math.random() * 20); // 130-149
        diastolic = 80 + Math.floor(Math.random() * 15); // 80-94
      } else {
        // CKD patients - higher prevalence of HTN
        systolic = 135 + Math.floor(Math.random() * 25); // 135-159
        diastolic = 85 + Math.floor(Math.random() * 15); // 85-99
        // Worse control in advanced CKD
        if (severity === 'severe' || severity === 'kidney_failure') {
          systolic += 10;
          diastolic += 5;
        }
      }

      // HbA1c (IMPORTANT - determine diabetes status)
      const hasDiabetes = Math.random() < (
        category === 'nonCkdLowModerate' ? 0.10 : // 10%
        category === 'nonCkdHigh' ? 0.45 : // 45%
        severity === 'mild' ? 0.50 : // 50%
        severity === 'moderate' ? 0.60 : // 60%
        severity === 'severe' ? 0.70 : // 70%
        0.75 // 75% for kidney failure
      );

      const hba1c = hasDiabetes
        ? 6.5 + Math.random() * 2.5 // Diabetics: 6.5-9.0%
        : 4.5 + Math.random() * 1.0; // Non-diabetics: 4.5-5.5%

      // Potassium (CRITICAL - especially for CKD patients)
      let potassium: number;
      if (!severity) {
        // Non-CKD: normal range
        potassium = 3.8 + Math.random() * 0.9; // 3.8-4.7 mEq/L
      } else if (severity === 'mild' || severity === 'moderate') {
        // CKD 1-3: slightly elevated risk
        potassium = 4.0 + Math.random() * 1.2; // 4.0-5.2 mEq/L
      } else {
        // CKD 4-5: high risk of hyperkalemia
        potassium = 4.5 + Math.random() * 1.5; // 4.5-6.0 mEq/L
      }

      // Hemoglobin (CRITICAL - anemia common in CKD)
      let hemoglobin: number;
      if (!severity) {
        // Non-CKD: normal
        hemoglobin = 12.5 + Math.random() * 3.5; // 12.5-16 g/dL
      } else if (severity === 'mild') {
        // Mild CKD: minimal anemia
        hemoglobin = 12 + Math.random() * 3; // 12-15 g/dL
      } else if (severity === 'moderate') {
        // Moderate CKD: mild anemia
        hemoglobin = 11 + Math.random() * 3; // 11-14 g/dL
      } else if (severity === 'severe') {
        // Severe CKD: moderate anemia
        hemoglobin = 9.5 + Math.random() * 2.5; // 9.5-12 g/dL
      } else {
        // Kidney failure: severe anemia
        hemoglobin = 8 + Math.random() * 2; // 8-10 g/dL
      }

      // LDL & HDL Cholesterol (IMPORTANT - CVD risk)
      const ldl = 80 + Math.random() * 100; // 80-180 mg/dL
      const hdl = 30 + Math.random() * 40; // 30-70 mg/dL

      // Calcium & Phosphorus (IMPORTANT for Stage 3b+)
      let calcium: number, phosphorus: number;
      if (!severity || severity === 'mild') {
        // Normal range
        calcium = 8.8 + Math.random() * 1.2; // 8.8-10.0 mg/dL
        phosphorus = 2.7 + Math.random() * 1.8; // 2.7-4.5 mg/dL
      } else if (severity === 'moderate') {
        // Mild CKD-MBD
        calcium = 8.5 + Math.random() * 1.5; // 8.5-10.0 mg/dL (can be low)
        phosphorus = 3.0 + Math.random() * 2.0; // 3.0-5.0 mg/dL (rising)
      } else {
        // Advanced CKD-MBD
        calcium = 8.0 + Math.random() * 1.5; // 8.0-9.5 mg/dL (low)
        phosphorus = 4.5 + Math.random() * 2.5; // 4.5-7.0 mg/dL (high)
      }

      // Serum Albumin (OPTIONAL - nutritional status)
      let albumin: number;
      if (!severity || severity === 'mild') {
        albumin = 3.8 + Math.random() * 0.7; // 3.8-4.5 g/dL (normal)
      } else if (severity === 'moderate') {
        albumin = 3.4 + Math.random() * 0.8; // 3.4-4.2 g/dL
      } else {
        albumin = 2.8 + Math.random() * 0.9; // 2.8-3.7 g/dL (low in advanced CKD)
      }

      // Creatinine & BUN (already implicit in eGFR, but useful for context)
      let creatinine: number, bun: number;
      if (egfr >= 90) {
        creatinine = 0.7 + Math.random() * 0.3; // 0.7-1.0 mg/dL
        bun = 8 + Math.random() * 12; // 8-20 mg/dL
      } else if (egfr >= 60) {
        creatinine = 1.0 + Math.random() * 0.5; // 1.0-1.5 mg/dL
        bun = 15 + Math.random() * 15; // 15-30 mg/dL
      } else if (egfr >= 30) {
        creatinine = 1.5 + Math.random() * 1.0; // 1.5-2.5 mg/dL
        bun = 25 + Math.random() * 25; // 25-50 mg/dL
      } else if (egfr >= 15) {
        creatinine = 2.5 + Math.random() * 2.5; // 2.5-5.0 mg/dL
        bun = 40 + Math.random() * 60; // 40-100 mg/dL
      } else {
        creatinine = 5.0 + Math.random() * 5.0; // 5.0-10.0 mg/dL
        bun = 80 + Math.random() * 100; // 80-180 mg/dL
      }

      // Insert all observations with month_number = 1 (initial baseline)
      await pool.query(`
        INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, month_number, status)
        VALUES
          -- Kidney Function Panel
          ($1, 'eGFR', $2, 'mL/min/1.73m²', $3, 1, 'final'),
          ($1, 'uACR', $4, 'mg/g', $3, 1, 'final'),
          ($1, 'serum_creatinine', $5, 'mg/dL', $3, 1, 'final'),
          ($1, 'BUN', $6, 'mg/dL', $3, 1, 'final'),
          ($1, 'BMI', $7, 'kg/m²', $3, 1, 'final'),

          -- Blood Pressure & Cardiovascular (CRITICAL)
          ($1, 'blood_pressure_systolic', $8, 'mmHg', $3, 1, 'final'),
          ($1, 'blood_pressure_diastolic', $9, 'mmHg', $3, 1, 'final'),
          ($1, 'LDL_cholesterol', $10, 'mg/dL', $3, 1, 'final'),
          ($1, 'HDL_cholesterol', $11, 'mg/dL', $3, 1, 'final'),

          -- Metabolic (IMPORTANT)
          ($1, 'HbA1c', $12, '%', $3, 1, 'final'),

          -- Hematology & Minerals (CRITICAL for CKD)
          ($1, 'hemoglobin', $13, 'g/dL', $3, 1, 'final'),
          ($1, 'potassium', $14, 'mEq/L', $3, 1, 'final'),
          ($1, 'calcium', $15, 'mg/dL', $3, 1, 'final'),
          ($1, 'phosphorus', $16, 'mg/dL', $3, 1, 'final'),
          ($1, 'albumin', $17, 'g/dL', $3, 1, 'final')
      `, [
        newPatientId, egfr, today, uacr, creatinine, bun, bmi,
        systolic, diastolic, ldl, hdl,
        hba1c,
        hemoglobin, potassium, calcium, phosphorus, albumin
      ]);

      // Calculate KDIGO for health state
      const kdigo = classifyKDIGO(egfr, uacr);
      const monitoringFreq = getMonitoringFrequencyCategory(kdigo);

      // Insert into appropriate tracking table
      if (severity) {
        // CKD patient
        const ckdDataResult = await pool.query(`
          INSERT INTO ckd_patient_data (
            patient_id, ckd_severity, ckd_stage,
            kdigo_gfr_category, kdigo_albuminuria_category, kdigo_health_state,
            is_monitored, monitoring_device, monitoring_frequency, is_treated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          newPatientId, severity, ckdStage,
          kdigo.gfr_category, kdigo.albuminuria_category, kdigo.health_state,
          isMonitored, isMonitored ? 'Minuteful Kidney Kit' : null, monitoringFreq, isTreated
        ]);

        // Add treatment if treated
        if (isTreated) {
          const randomTreatment = treatments[Math.floor(Math.random() * treatments.length)];
          await pool.query(`
            INSERT INTO ckd_treatments (
              ckd_patient_data_id, treatment_name, treatment_class, is_active, start_date
            ) VALUES ($1, $2, $3, true, $4)
          `, [ckdDataResult.rows[0].id, randomTreatment.name, randomTreatment.class, today]);

          // ============================================
          // Add Jardiance prescription and adherence tracking
          // ============================================

          // Determine if this is Jardiance (SGLT2i) - 60% of treated patients
          const isJardiance = randomTreatment.class === 'SGLT2i' || Math.random() < 0.6;

          if (isJardiance) {
            const dosage = Math.random() < 0.7 ? '10mg' : '25mg';
            const medication = `Jardiance (empagliflozin) ${dosage}`;

            // Prescription started 6-12 months ago
            const monthsAgo = 6 + Math.floor(Math.random() * 7);
            const prescriptionStartDate = new Date(today.getTime() - monthsAgo * 30 * 24 * 60 * 60 * 1000);

            // Determine adherence category (realistic distribution)
            // High: 50%, Medium: 30%, Low: 20%
            let adherenceCategory: string;
            const adherenceRand = Math.random();

            if (adherenceRand < 0.5) {
              // High adherence: MPR 80-95%
              adherenceCategory = 'High';
            } else if (adherenceRand < 0.8) {
              // Medium adherence: MPR 60-79%
              adherenceCategory = 'Medium';
            } else {
              // Low adherence: MPR 30-59%
              adherenceCategory = 'Low';
            }

            // Create prescription
            const prescriptionResult = await pool.query(`
              INSERT INTO jardiance_prescriptions (
                patient_id, medication, dosage, start_date,
                prescribed, currently_taking,
                prescriber_name, indication
              ) VALUES ($1, $2, $3, $4, true, true, $5, $6)
              RETURNING id
            `, [
              newPatientId,
              medication,
              dosage,
              prescriptionStartDate,
              'Dr. John Smith',
              'CKD with diabetes'
            ]);

            const prescriptionId = prescriptionResult.rows[0].id;

            // Generate realistic refill history
            // Standard refill: 30 days supply
            const daysSupply = 30;
            const refillsNeeded = monthsAgo; // Roughly one per month

            let currentRefillDate = new Date(prescriptionStartDate);
            let totalDaysSupply = 0;

            for (let refillNum = 0; refillNum < refillsNeeded; refillNum++) {
              // Calculate expected next refill
              const expectedRefillDate = new Date(currentRefillDate.getTime() + daysSupply * 24 * 60 * 60 * 1000);

              // Add realistic gaps based on adherence category
              let gapDays = 0;

              if (adherenceCategory === 'High') {
                // High adherence: mostly on-time, occasional 1-5 day delays
                gapDays = Math.random() < 0.8 ? 0 : Math.floor(Math.random() * 5);
              } else if (adherenceCategory === 'Medium') {
                // Medium adherence: 7-14 day gaps common
                gapDays = Math.random() < 0.5 ? Math.floor(Math.random() * 7) : 7 + Math.floor(Math.random() * 8);
              } else {
                // Low adherence: long gaps, sometimes 30+ days
                gapDays = Math.random() < 0.3 ? 15 + Math.floor(Math.random() * 15) : 30 + Math.floor(Math.random() * 30);
              }

              // Actual refill date = expected + gap
              const actualRefillDate = new Date(expectedRefillDate.getTime() + gapDays * 24 * 60 * 60 * 1000);

              // Don't create refills in the future
              if (actualRefillDate > today) break;

              // Insert refill
              await pool.query(`
                INSERT INTO jardiance_refills (
                  prescription_id, refill_date, days_supply, quantity,
                  expected_refill_date, gap_days,
                  pharmacy_name, copay_amount, cost_barrier_reported
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              `, [
                prescriptionId,
                actualRefillDate,
                daysSupply,
                daysSupply, // 30 tablets for 30 days
                expectedRefillDate,
                gapDays,
                'CVS Pharmacy',
                Math.random() < 0.3 ? 10 + Math.random() * 40 : null, // 30% report copay
                gapDays > 14 && Math.random() < 0.3 // Cost barrier if long gap
              ]);

              totalDaysSupply += daysSupply;
              currentRefillDate = actualRefillDate;
            }

            // Calculate actual MPR/PDC
            // Period days must match the constraint: (end_date - start_date + 1)
            const totalDays = Math.floor((today.getTime() - prescriptionStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
            const actualMPR = Math.min((totalDaysSupply / totalDays) * 100, 100);
            const actualPDC = actualMPR; // Simplified PDC = MPR for this scenario

            // Insert adherence metric
            await pool.query(`
              INSERT INTO jardiance_adherence (
                prescription_id, assessment_date,
                period_start_date, period_end_date, period_days,
                mpr, pdc, category,
                total_refills, total_days_supply, total_quantity,
                total_gap_days, max_gap_days, gap_count
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [
              prescriptionId,
              today,
              prescriptionStartDate,
              today,
              totalDays,
              actualMPR.toFixed(2),
              actualPDC.toFixed(2),
              adherenceCategory,
              refillsNeeded,
              totalDaysSupply,
              totalDaysSupply,
              0, // Will be calculated from refills
              0, // Will be calculated from refills
              0  // Will be calculated from refills
            ]);

            // Add barriers for non-adherent patients
            if (adherenceCategory === 'Low' || adherenceCategory === 'Medium') {
              const possibleBarriers = [
                { type: 'Cost concerns', severity: 'High' },
                { type: 'Forgetfulness', severity: 'Medium' },
                { type: 'Side effects', severity: 'High' },
                { type: 'Lack of symptoms', severity: 'Low' },
                { type: 'Complex regimen', severity: 'Medium' }
              ];

              // Add 1-3 barriers
              const barrierCount = adherenceCategory === 'Low' ? 2 + Math.floor(Math.random() * 2) : 1;

              for (let b = 0; b < barrierCount; b++) {
                const barrier = possibleBarriers[Math.floor(Math.random() * possibleBarriers.length)];
                const identifiedDate = new Date(today.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000); // Within last 60 days

                await pool.query(`
                  INSERT INTO adherence_barriers (
                    prescription_id, barrier_type, severity,
                    identified_date, resolved,
                    intervention_required
                  ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                  prescriptionId,
                  barrier.type,
                  barrier.severity,
                  identifiedDate,
                  Math.random() < 0.2, // 20% chance barrier is already resolved
                  true
                ]);
              }
            }
          }
        }
      } else {
        // Non-CKD patient
        await pool.query(`
          INSERT INTO non_ckd_patient_data (
            patient_id, risk_level, kdigo_health_state,
            is_monitored, monitoring_device, monitoring_frequency
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          newPatientId, riskLevel, kdigo.health_state,
          isMonitored, isMonitored ? 'Minuteful Kidney Kit' : null, monitoringFreq
        ]);
      }

      patientsCreated++;
      if (patientsCreated % 100 === 0) {
        console.log(`✓ Created ${patientsCreated} patients...`);
      }
    };

    // Generate patients for each category
    console.log('Generating Non-CKD Low/Moderate Risk patients...');
    for (let i = 0; i < distribution.nonCkdLowModerate; i++) {
      await generatePatient('nonCkdLowModerate', i);
    }

    console.log('Generating Non-CKD High Risk patients...');
    for (let i = 0; i < distribution.nonCkdHigh; i++) {
      await generatePatient('nonCkdHigh', i);
    }

    console.log('Generating Mild CKD patients...');
    for (let i = 0; i < distribution.ckdMild; i++) {
      await generatePatient('ckdMild', i);
    }

    console.log('Generating Moderate CKD patients...');
    for (let i = 0; i < distribution.ckdModerate; i++) {
      await generatePatient('ckdModerate', i);
    }

    console.log('Generating Severe CKD patients...');
    for (let i = 0; i < distribution.ckdSevere; i++) {
      await generatePatient('ckdSevere', i);
    }

    console.log('Generating Kidney Failure patients...');
    for (let i = 0; i < distribution.ckdKidneyFailure; i++) {
      await generatePatient('ckdKidneyFailure', i);
    }

    console.log(`✓ Successfully created ${patientsCreated} patients with realistic distribution`);

    // ============================================
    // Generate Risk Factors for All Patients
    // ============================================

    console.log('Generating comprehensive risk factors...');

    const allPatientsResult = await pool.query('SELECT id, date_of_birth FROM patients');

    for (const patient of allPatientsResult.rows) {
      const age = Math.floor((today.getTime() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      // Determine ethnicity (realistic US distribution)
      const ethnicityRand = Math.random();
      let ethnicity: string;
      if (ethnicityRand < 0.13) {
        ethnicity = 'African American';
      } else if (ethnicityRand < 0.31) {
        ethnicity = 'Hispanic/Latino';
      } else if (ethnicityRand < 0.37) {
        ethnicity = 'Asian';
      } else if (ethnicityRand < 0.39) {
        ethnicity = 'Native American';
      } else {
        ethnicity = 'Caucasian';
      }

      // Update patient ethnicity
      await pool.query(`
        UPDATE patients SET ethnicity = $1 WHERE id = $2
      `, [ethnicity, patient.id]);

      // Get patient's latest labs
      const labsResult = await pool.query(`
        SELECT
          MAX(CASE WHEN observation_type = 'eGFR' THEN value_numeric END) as egfr,
          MAX(CASE WHEN observation_type = 'uACR' THEN value_numeric END) as uacr,
          MAX(CASE WHEN observation_type = 'BMI' THEN value_numeric END) as bmi,
          MAX(CASE WHEN observation_type = 'HbA1c' THEN value_numeric END) as hba1c
        FROM observations
        WHERE patient_id = $1
      `, [patient.id]);

      const labs = labsResult.rows[0];

      // Determine comorbidities based on age and labs
      const hasDiabetes = labs.hba1c && labs.hba1c > 6.5 || Math.random() < (age > 65 ? 0.3 : 0.15);
      const hasHypertension = age > 60 ? Math.random() < 0.5 : Math.random() < 0.25;
      const hasCVD = age > 65 ? Math.random() < 0.25 : Math.random() < 0.1;
      const hasObesity = labs.bmi && labs.bmi > 30;
      const hasAKIHistory = Math.random() < 0.08; // 8% have AKI history
      const hasAutoimmune = Math.random() < 0.03; // 3% have autoimmune disease
      const hasKidneyStones = Math.random() < 0.12; // 12% have kidney stones
      const hasGout = Math.random() < 0.08; // 8% have gout

      // Smoking status
      const smokingRand = Math.random();
      let smoking: string;
      let packYears = 0;
      if (smokingRand < 0.55) {
        smoking = 'Never';
      } else if (smokingRand < 0.70) {
        smoking = 'Former';
        packYears = 5 + Math.random() * 30; // 5-35 pack-years
      } else {
        smoking = 'Current';
        packYears = 10 + Math.random() * 40; // 10-50 pack-years
      }

      // Physical activity
      const activityRand = Math.random();
      let activityLevel: string;
      if (activityRand < 0.30) {
        activityLevel = 'Sedentary';
      } else if (activityRand < 0.55) {
        activityLevel = 'Light';
      } else if (activityRand < 0.80) {
        activityLevel = 'Moderate';
      } else {
        activityLevel = 'Active';
      }

      // Medications
      const chronicNSAID = Math.random() < 0.15; // 15% use chronic NSAIDs
      const ppiUse = Math.random() < 0.20; // 20% use PPIs

      // Insert comprehensive risk factors
      await pool.query(`
        INSERT INTO patient_risk_factors (
          patient_id, current_egfr, current_uacr, hba1c,
          has_diabetes, diabetes_type, diabetes_controlled,
          has_hypertension, hypertension_controlled,
          has_cvd, has_obesity, current_bmi,
          history_of_aki, aki_episodes_count,
          has_autoimmune_disease, has_kidney_stones, has_gout,
          family_history_ckd, family_history_esrd,
          smoking_status, pack_years,
          physical_activity_level,
          chronic_nsaid_use, ppi_use,
          on_ras_inhibitor,
          last_assessment_date
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9,
          $10, $11, $12,
          $13, $14,
          $15, $16, $17,
          $18, $19,
          $20, $21,
          $22,
          $23, $24,
          $25,
          $26
        )
      `, [
        patient.id, labs.egfr, labs.uacr, labs.hba1c,
        hasDiabetes, hasDiabetes ? (Math.random() < 0.9 ? 'Type 2' : 'Type 1') : null, hasDiabetes ? Math.random() < 0.7 : null,
        hasHypertension, hasHypertension ? Math.random() < 0.6 : null,
        hasCVD, hasObesity, labs.bmi,
        hasAKIHistory, hasAKIHistory ? (Math.floor(Math.random() * 3) + 1) : 0,
        hasAutoimmune, hasKidneyStones, hasGout,
        Math.random() < 0.15, Math.random() < 0.10,
        smoking, packYears,
        activityLevel,
        chronicNSAID, ppiUse,
        labs.egfr < 60 || labs.uacr > 30, // On RAS inhibitor if indicated
        today
      ]);
    }

    console.log('✓ Risk factors generated for all patients');

    // Calculate risk scores for all patients
    console.log('Calculating risk scores...');

    await pool.query(`
      SELECT calculate_ckd_risk_score(patient_id)
      FROM patient_risk_factors
    `);

    // Update risk tiers
    await pool.query(`
      UPDATE patient_risk_factors
      SET
        risk_tier = get_risk_tier(risk_score),
        next_assessment_due = CASE
          WHEN risk_score >= 75 THEN CURRENT_DATE + INTERVAL '1 month'
          WHEN risk_score >= 50 THEN CURRENT_DATE + INTERVAL '3 months'
          WHEN risk_score >= 25 THEN CURRENT_DATE + INTERVAL '6 months'
          ELSE CURRENT_DATE + INTERVAL '12 months'
        END
      WHERE risk_score IS NOT NULL
    `);

    console.log('✓ Risk scores calculated for all patients');

    res.json({
      status: 'success',
      message: 'Realistic patient cohort generated successfully',
      patients_created: patientsCreated,
      distribution: {
        'Non-CKD Low/Moderate Risk': distribution.nonCkdLowModerate,
        'Non-CKD High Risk': distribution.nonCkdHigh,
        'Mild CKD': distribution.ckdMild,
        'Moderate CKD': distribution.ckdModerate,
        'Severe CKD': distribution.ckdSevere,
        'Kidney Failure': distribution.ckdKidneyFailure
      },
      monitoring_treatment: {
        'Non-CKD High Risk Monitored': `${nonCkdHighMonitoredPercent * 100}%`,
        'CKD Monitored': `${ckdMonitoredPercent * 100}%`,
        'CKD Treated': `${ckdTreatedPercent * 100}%`
      }
    });

  } catch (error) {
    console.error('[Init API] Error populating realistic cohort:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to populate realistic cohort',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/update-patient-ages
 * Update all patient ages to be over 65 with random variation
 */
router.post('/update-patient-ages', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('Updating patient ages to 65+ with random variation...');

    // Get all patients
    const patientsResult = await pool.query('SELECT id, first_name, last_name, date_of_birth FROM patients');

    let updatedCount = 0;
    const today = new Date();

    for (const patient of patientsResult.rows) {
      // Calculate random age between 66 and 90 years old
      const randomAge = 66 + Math.floor(Math.random() * 25); // 66-90 years

      // Calculate new date of birth
      const birthYear = today.getFullYear() - randomAge;
      const birthMonth = Math.floor(Math.random() * 12); // 0-11
      const birthDay = Math.floor(Math.random() * 28) + 1; // 1-28 (safe for all months)

      const newDateOfBirth = new Date(birthYear, birthMonth, birthDay);

      // Update patient's date of birth
      await pool.query(
        'UPDATE patients SET date_of_birth = $1 WHERE id = $2',
        [newDateOfBirth, patient.id]
      );

      updatedCount++;

      console.log(`✓ Updated ${patient.first_name} ${patient.last_name}: Age ${randomAge}`);
    }

    console.log(`✓ Updated ${updatedCount} patients to ages 65+`);

    res.json({
      status: 'success',
      message: 'All patient ages updated to 65+ with random variation',
      patients_updated: updatedCount,
      age_range: '66-90 years'
    });

  } catch (error) {
    console.error('[Init API] Error updating patient ages:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update patient ages',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/migrate-month-tracking
 * Add month_number column to observations table for 12-month history tracking
 * This migration enables the lab value simulation feature
 */
router.post('/migrate-month-tracking', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('Running month tracking migration...');

    // Step 1: Add month_number column with default value
    await pool.query(`
      ALTER TABLE observations
      ADD COLUMN IF NOT EXISTS month_number INTEGER DEFAULT 1 CHECK (month_number >= 1 AND month_number <= 12);
    `);
    console.log('✓ Added month_number column');

    // Step 2: Create index for efficient month-based queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_observations_month ON observations(patient_id, month_number, observation_type);
    `);
    console.log('✓ Created index on month_number');

    // Step 3: Add comment explaining the column
    await pool.query(`
      COMMENT ON COLUMN observations.month_number IS 'Month number (1-12) for tracking historical lab values. Month 12 represents the most recent values.';
    `);
    console.log('✓ Added column comment');

    // Step 4: Update existing observations to be in month 1 (baseline)
    const updateResult = await pool.query(`
      UPDATE observations
      SET month_number = 1
      WHERE month_number IS NULL;
    `);
    const rowsUpdated = updateResult.rowCount || 0;
    console.log(`✓ Updated ${rowsUpdated} existing observations to month 1`);

    // Step 5: Make the column NOT NULL now that all existing rows have a value
    await pool.query(`
      ALTER TABLE observations
      ALTER COLUMN month_number SET NOT NULL;
    `);
    console.log('✓ Set month_number as NOT NULL');

    // Verify the migration
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'observations' AND column_name = 'month_number';
    `);

    console.log('✓ Month tracking migration completed successfully');

    res.json({
      status: 'success',
      message: 'Month tracking migration completed successfully',
      details: {
        column_added: true,
        index_created: true,
        rows_updated: rowsUpdated,
        column_info: verifyResult.rows[0] || null
      }
    });

  } catch (error) {
    console.error('[Init API] Error running month tracking migration:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to run month tracking migration',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Migration endpoint for Email notification tables
 * POST /api/init/migrate-email-tables
 */
router.post('/migrate-email-tables', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    console.log('Running email tables migration...');

    // Step 1: Create email_config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        doctor_email VARCHAR(255) NOT NULL,
        enabled BOOLEAN DEFAULT false,
        smtp_host VARCHAR(255),
        smtp_port INTEGER,
        smtp_user VARCHAR(255),
        smtp_password VARCHAR(255),
        from_email VARCHAR(255),
        from_name VARCHAR(255) DEFAULT 'CKD Analyzer System',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT single_config CHECK (id = 1)
      );
    `);
    console.log('✓ Created email_config table');

    // Step 2: Create email_messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_messages (
        id SERIAL PRIMARY KEY,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
        email_message_id VARCHAR(255),
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Created email_messages table');

    // Step 3: Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_email_messages_to ON email_messages(to_email, sent_at DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status, sent_at DESC);
    `);
    console.log('✓ Created indexes on email_messages');

    // Step 4: Add comments
    await pool.query(`
      COMMENT ON TABLE email_config IS 'Email notification configuration';
    `);
    await pool.query(`
      COMMENT ON TABLE email_messages IS 'Log of email messages sent to doctors';
    `);
    await pool.query(`
      COMMENT ON COLUMN email_config.doctor_email IS 'Email address to receive notifications';
    `);
    await pool.query(`
      COMMENT ON COLUMN email_config.enabled IS 'Whether email notifications are enabled';
    `);
    await pool.query(`
      COMMENT ON COLUMN email_config.smtp_host IS 'SMTP server hostname (optional, uses test account if not set)';
    `);
    await pool.query(`
      COMMENT ON COLUMN email_messages.email_message_id IS 'Email message ID from SMTP server for tracking';
    `);
    console.log('✓ Added table comments');

    // Step 5: Verify tables exist
    const configTableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'email_config';
    `);
    const messagesTableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'email_messages';
    `);

    console.log('✓ Email tables migration completed successfully');

    res.json({
      status: 'success',
      message: 'Email tables migration completed successfully',
      details: {
        config_table_created: configTableCheck.rows.length > 0,
        messages_table_created: messagesTableCheck.rows.length > 0,
        indexes_created: true
      }
    });
  } catch (error) {
    console.error('Failed to run email tables migration:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to run email tables migration',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/fix-duplicate-names
 * Replace duplicate patient names with unique names
 */
router.post('/fix-duplicate-names', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('Analyzing duplicate names...');

    // Expanded name lists to ensure uniqueness
    const firstNamesMale = [
      'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
      'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Donald', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth',
      'Joshua', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan',
      'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon',
      'Frank', 'Benjamin', 'Gregory', 'Samuel', 'Raymond', 'Patrick', 'Alexander', 'Jack', 'Dennis', 'Jerry',
      'Tyler', 'Aaron', 'Henry', 'Douglas', 'Peter', 'Adam', 'Nathan', 'Zachary', 'Walter', 'Harold',
      'Kyle', 'Carl', 'Arthur', 'Gerald', 'Roger', 'Keith', 'Jeremy', 'Terry', 'Lawrence', 'Sean',
      'Christian', 'Albert', 'Joe', 'Ethan', 'Austin', 'Jesse', 'Willie', 'Billy', 'Bryan', 'Bruce',
      'Noah', 'Jordan', 'Dylan', 'Ralph', 'Roy', 'Eugene', 'Randy', 'Vincent', 'Russell', 'Louis',
      'Philip', 'Bobby', 'Johnny', 'Bradley', 'Howard', 'Fred', 'Ernest', 'Carlos', 'Martin', 'Craig'
    ];

    const firstNamesFemale = [
      'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
      'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
      'Dorothy', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia',
      'Kathleen', 'Amy', 'Shirley', 'Angela', 'Helen', 'Anna', 'Brenda', 'Pamela', 'Nicole', 'Samantha',
      'Katherine', 'Emma', 'Ruth', 'Christine', 'Catherine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Virginia',
      'Maria', 'Heather', 'Diane', 'Julie', 'Joyce', 'Victoria', 'Olivia', 'Kelly', 'Christina', 'Lauren',
      'Joan', 'Evelyn', 'Judith', 'Megan', 'Cheryl', 'Andrea', 'Hannah', 'Jacqueline', 'Martha', 'Gloria',
      'Teresa', 'Ann', 'Sara', 'Madison', 'Frances', 'Kathryn', 'Janice', 'Jean', 'Abigail', 'Alice',
      'Judy', 'Sophia', 'Grace', 'Denise', 'Amber', 'Doris', 'Marilyn', 'Danielle', 'Beverly', 'Isabella',
      'Theresa', 'Diana', 'Natalie', 'Brittany', 'Charlotte', 'Marie', 'Kayla', 'Alexis', 'Lori', 'Julia'
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
      'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
      'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
      'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
      'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
      'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
      'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
      'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
      'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
      'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'
    ];

    // Step 1: Find all duplicate name combinations
    const duplicatesResult = await pool.query(`
      SELECT first_name, last_name, ARRAY_AGG(id ORDER BY medical_record_number) as patient_ids
      FROM patients
      GROUP BY first_name, last_name
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);

    if (duplicatesResult.rows.length === 0) {
      return res.json({
        status: 'success',
        message: 'No duplicate names found',
        duplicates_fixed: 0
      });
    }

    console.log(`Found ${duplicatesResult.rows.length} duplicate name combinations`);

    // Track used name combinations to ensure uniqueness
    const usedNames = new Set<string>();

    // Add all current unique names to the set
    const currentNamesResult = await pool.query(`
      SELECT DISTINCT first_name, last_name FROM patients
    `);

    currentNamesResult.rows.forEach(row => {
      usedNames.add(`${row.first_name}|${row.last_name}`);
    });

    let totalFixed = 0;

    // Step 2: For each duplicate set, keep the first patient, rename the rest
    for (const duplicate of duplicatesResult.rows) {
      const patientIds = duplicate.patient_ids;

      // Keep the first patient (oldest), rename the rest
      for (let i = 1; i < patientIds.length; i++) {
        const patientId = patientIds[i];

        // Get patient's gender to choose appropriate first names
        const patientResult = await pool.query(
          'SELECT gender FROM patients WHERE id = $1',
          [patientId]
        );

        const gender = patientResult.rows[0]?.gender;
        const firstNamePool = gender === 'male' ? firstNamesMale :
                             gender === 'female' ? firstNamesFemale :
                             [...firstNamesMale, ...firstNamesFemale];

        // Find a unique name combination
        let newFirstName = '';
        let newLastName = '';
        let attempts = 0;
        const maxAttempts = 1000;

        while (attempts < maxAttempts) {
          newFirstName = firstNamePool[Math.floor(Math.random() * firstNamePool.length)];
          newLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
          const nameKey = `${newFirstName}|${newLastName}`;

          if (!usedNames.has(nameKey)) {
            usedNames.add(nameKey);
            break;
          }
          attempts++;
        }

        if (attempts >= maxAttempts) {
          console.error(`Could not find unique name for patient ${patientId} after ${maxAttempts} attempts`);
          continue;
        }

        // Update the patient with the new unique name
        await pool.query(
          `UPDATE patients
           SET first_name = $1, last_name = $2,
               email = $3
           WHERE id = $4`,
          [
            newFirstName,
            newLastName,
            `${newFirstName.toLowerCase()}.${newLastName.toLowerCase()}@email.com`,
            patientId
          ]
        );

        totalFixed++;
        console.log(`✓ Renamed patient ${patientId}: ${duplicate.first_name} ${duplicate.last_name} → ${newFirstName} ${newLastName}`);
      }
    }

    // Step 3: Verify no duplicates remain
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as remaining_duplicates
      FROM (
        SELECT first_name, last_name, COUNT(*) as dup_count
        FROM patients
        GROUP BY first_name, last_name
        HAVING COUNT(*) > 1
      ) dup
    `);

    const remainingDuplicates = parseInt(verifyResult.rows[0].remaining_duplicates);

    console.log(`✓ Fixed ${totalFixed} duplicate patient names`);
    console.log(`✓ Remaining duplicates: ${remainingDuplicates}`);

    res.json({
      status: 'success',
      message: 'Duplicate names fixed successfully',
      duplicates_fixed: totalFixed,
      remaining_duplicates: remainingDuplicates,
      duplicate_sets_processed: duplicatesResult.rows.length
    });

  } catch (error) {
    console.error('[Init API] Error fixing duplicate names:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fix duplicate names',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/deduplicate-observations
 * Remove duplicate observations (same patient, type, and month_number)
 * Keeps the most recent observation and removes older duplicates
 */
router.post('/deduplicate-observations', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('[Init] Starting observation deduplication...');

    // Step 1: Ensure NULL month_number values are set to 1
    const updateNullResult = await pool.query(`
      UPDATE observations
      SET month_number = 1
      WHERE month_number IS NULL
    `);
    console.log(`✓ Updated ${updateNullResult.rowCount} observations with NULL month_number to 1`);

    // Step 2: Find and remove duplicate observations
    // Keep the most recent observation (by id) when duplicates exist
    const deduplicateResult = await pool.query(`
      DELETE FROM observations
      WHERE id IN (
        SELECT id
        FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY patient_id, observation_type, month_number
                   ORDER BY observation_date DESC, id DESC
                 ) as rn
          FROM observations
        ) t
        WHERE t.rn > 1
      )
    `);

    const deletedCount = deduplicateResult.rowCount || 0;
    console.log(`✓ Removed ${deletedCount} duplicate observations`);

    // Step 3: Verify deduplication
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as duplicate_count
      FROM (
        SELECT patient_id, observation_type, month_number, COUNT(*) as cnt
        FROM observations
        GROUP BY patient_id, observation_type, month_number
        HAVING COUNT(*) > 1
      ) t
    `);

    const remainingDuplicates = parseInt(verifyResult.rows[0].duplicate_count);

    res.json({
      status: 'success',
      message: 'Observation deduplication completed',
      null_month_numbers_updated: updateNullResult.rowCount,
      duplicates_removed: deletedCount,
      remaining_duplicates: remainingDuplicates
    });

  } catch (error) {
    console.error('[Init API] Error deduplicating observations:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to deduplicate observations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/init/recalculate-non-ckd-risk
 * Recalculate risk levels for all non-CKD patients using SCORED model
 * This fixes the inconsistency between patient list and patient profile risk displays
 */
router.post('/recalculate-non-ckd-risk', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('[Init] Recalculating non-CKD patient risk levels using SCORED model...');

    // Get all non-CKD patients with their demographics and lab values
    const patientsResult = await pool.query(`
      SELECT
        npd.id as non_ckd_data_id,
        npd.patient_id,
        npd.risk_level as old_risk_level,
        p.date_of_birth,
        p.gender,
        p.weight,
        p.height,
        p.smoking_status,
        -- Lab values
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'eGFR'
         ORDER BY observation_date DESC LIMIT 1) as latest_egfr,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'uACR'
         ORDER BY observation_date DESC LIMIT 1) as latest_uacr,
        -- Risk factors from patient_risk_factors table
        prf.has_diabetes,
        prf.has_hypertension,
        prf.has_cvd,
        prf.has_peripheral_vascular_disease as has_pvd,
        prf.current_bmi
      FROM non_ckd_patient_data npd
      INNER JOIN patients p ON npd.patient_id = p.id
      LEFT JOIN patient_risk_factors prf ON p.id = prf.patient_id
    `);

    let updatedCount = 0;
    let lowToModerate = 0;
    let lowToHigh = 0;
    let moderateToHigh = 0;
    let unchanged = 0;

    for (const patient of patientsResult.rows) {
      const egfr = patient.latest_egfr || 90;
      const uacr = patient.latest_uacr || 15;

      // Calculate age from date_of_birth
      const birthDate = new Date(patient.date_of_birth);
      const age = Math.floor((new Date().getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      // Calculate BMI if not available from risk factors
      let bmi = patient.current_bmi;
      if (!bmi && patient.weight && patient.height) {
        const heightInMeters = patient.height / 100;
        bmi = patient.weight / (heightInMeters * heightInMeters);
      }

      // Normalize smoking status
      let smoking_status: 'never' | 'former' | 'current' | undefined;
      if (patient.smoking_status) {
        const status = patient.smoking_status.toLowerCase();
        if (status === 'never') smoking_status = 'never';
        else if (status === 'former' || status === 'ex-smoker') smoking_status = 'former';
        else if (status === 'current' || status === 'smoker') smoking_status = 'current';
      }

      // Build demographics for SCORED assessment
      const demographics: PatientDemographics = {
        age,
        gender: (patient.gender?.toLowerCase() || 'male') as 'male' | 'female',
        has_hypertension: patient.has_hypertension || false,
        has_diabetes: patient.has_diabetes || false,
        has_cvd: patient.has_cvd || false,
        has_pvd: patient.has_pvd || false,
        smoking_status,
        bmi
      };

      // Calculate SCORED score and get correct risk level
      const scoredResult = calculateSCORED(demographics, uacr);
      const nonCKDRisk = getNonCKDRiskLevel(egfr, uacr, scoredResult.points);
      const newRiskLevel = nonCKDRisk.risk_level;

      // Track changes
      const oldRiskLevel = patient.old_risk_level;
      if (oldRiskLevel !== newRiskLevel) {
        if (oldRiskLevel === 'low' && newRiskLevel === 'moderate') lowToModerate++;
        else if (oldRiskLevel === 'low' && newRiskLevel === 'high') lowToHigh++;
        else if (oldRiskLevel === 'moderate' && newRiskLevel === 'high') moderateToHigh++;

        // Update the risk level in the database
        await pool.query(`
          UPDATE non_ckd_patient_data
          SET risk_level = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newRiskLevel, patient.non_ckd_data_id]);

        updatedCount++;
      } else {
        unchanged++;
      }
    }

    console.log(`✓ Recalculated risk levels for ${patientsResult.rows.length} non-CKD patients`);
    console.log(`  - Updated: ${updatedCount} patients`);
    console.log(`  - Low → Moderate: ${lowToModerate}`);
    console.log(`  - Low → High: ${lowToHigh}`);
    console.log(`  - Moderate → High: ${moderateToHigh}`);
    console.log(`  - Unchanged: ${unchanged}`);

    res.json({
      status: 'success',
      message: 'Non-CKD patient risk levels recalculated using SCORED model',
      total_patients: patientsResult.rows.length,
      updated: updatedCount,
      unchanged: unchanged,
      changes: {
        low_to_moderate: lowToModerate,
        low_to_high: lowToHigh,
        moderate_to_high: moderateToHigh
      }
    });

  } catch (error) {
    console.error('[Init API] Error recalculating non-CKD risk levels:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to recalculate non-CKD risk levels',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
