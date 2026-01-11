/**
 * Doctor Management API Routes
 * Handles doctor profiles and patient-doctor assignments
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database';
import { getPrimaryDoctor } from '../../utils/doctorLookup';

const router = Router();

/**
 * GET /api/doctors
 * Get all doctors
 */
router.get('/', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        id,
        email,
        name,
        specialty,
        phone,
        notification_preferences,
        is_active,
        created_at,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_password,
        from_email,
        from_name,
        smtp_enabled
      FROM doctors
      WHERE is_active = true
      ORDER BY name ASC
    `);

    return res.json({
      status: 'success',
      doctors: result.rows
    });
  } catch (error) {
    console.error('[Doctors API] Error fetching doctors:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch doctors',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/doctors
 * Create a new doctor
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      email,
      name,
      specialty,
      phone,
      notification_preferences,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      from_email,
      from_name,
      smtp_enabled
    } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and name are required'
      });
    }

    const pool = getPool();
    const result = await pool.query(`
      INSERT INTO doctors (
        email, name, specialty, phone, notification_preferences,
        smtp_host, smtp_port, smtp_user, smtp_password,
        from_email, from_name, smtp_enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, email, name, specialty, phone, notification_preferences, is_active, created_at,
                smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name, smtp_enabled
    `, [
      email, name, specialty, phone, notification_preferences || null,
      smtp_host || null, smtp_port || null, smtp_user || null, smtp_password || null,
      from_email || null, from_name || null, smtp_enabled || false
    ]);

    return res.json({
      status: 'success',
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('[Doctors API] Error creating doctor:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create doctor',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/doctors/category-stats
 * Get patient counts by category
 * MUST be before /:email route to avoid matching 'category-stats' as email
 */
router.get('/category-stats', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const stats = await pool.query(`
      SELECT
        'non_ckd_low' as category,
        COUNT(*) as patient_count,
        'Non-CKD Low Risk' as display_name
      FROM patients p
      INNER JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
      WHERE npd.risk_level = 'low'

      UNION ALL

      SELECT
        'non_ckd_moderate' as category,
        COUNT(*) as patient_count,
        'Non-CKD Moderate Risk' as display_name
      FROM patients p
      INNER JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
      WHERE npd.risk_level = 'moderate'

      UNION ALL

      SELECT
        'non_ckd_high' as category,
        COUNT(*) as patient_count,
        'Non-CKD High Risk' as display_name
      FROM patients p
      INNER JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
      WHERE npd.risk_level = 'high'

      UNION ALL

      SELECT
        'ckd_mild' as category,
        COUNT(*) as patient_count,
        'CKD Mild' as display_name
      FROM patients p
      INNER JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
      WHERE cpd.ckd_severity = 'mild'

      UNION ALL

      SELECT
        'ckd_moderate' as category,
        COUNT(*) as patient_count,
        'CKD Moderate' as display_name
      FROM patients p
      INNER JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
      WHERE cpd.ckd_severity = 'moderate'

      UNION ALL

      SELECT
        'ckd_severe' as category,
        COUNT(*) as patient_count,
        'CKD Severe' as display_name
      FROM patients p
      INNER JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
      WHERE cpd.ckd_severity = 'severe'

      UNION ALL

      SELECT
        'ckd_kidney_failure' as category,
        COUNT(*) as patient_count,
        'CKD Kidney Failure' as display_name
      FROM patients p
      INNER JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
      WHERE cpd.ckd_severity = 'kidney_failure'

      ORDER BY category
    `);

    return res.json({
      status: 'success',
      categories: stats.rows
    });
  } catch (error) {
    console.error('[Doctors API] Error fetching category stats:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch category statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/doctors/assign-by-category
 * Bulk assign doctors to patients by category
 * MUST be before /:email route
 */
router.post('/assign-by-category', async (req: Request, res: Response): Promise<any> => {
  try {
    const { assignments } = req.body;
    // assignments = [
    //   { category: 'non_ckd_low', doctor_email: 'dr.smith@hospital.com', doctor_name: 'Dr. Smith' },
    //   { category: 'ckd_mild', doctor_email: '', doctor_name: '' } // Empty = remove assignment
    // ]

    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({
        status: 'error',
        message: 'assignments array is required'
      });
    }

    const pool = getPool();
    const results = [];

    for (const assignment of assignments) {
      const { category, doctor_email, doctor_name } = assignment;

      if (!category) {
        continue; // Skip invalid assignments
      }

      // Get patients for this category
      let query = '';
      let params: any[] = [];

      switch (category) {
        case 'non_ckd_low':
          query = `
            SELECT p.id FROM patients p
            INNER JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
            WHERE npd.risk_level = 'low'
          `;
          break;

        case 'non_ckd_moderate':
          query = `
            SELECT p.id FROM patients p
            INNER JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
            WHERE npd.risk_level = 'moderate'
          `;
          break;

        case 'non_ckd_high':
          query = `
            SELECT p.id FROM patients p
            INNER JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
            WHERE npd.risk_level = 'high'
          `;
          break;

        case 'ckd_mild':
          query = `
            SELECT p.id FROM patients p
            INNER JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
            WHERE cpd.ckd_severity = 'mild'
          `;
          break;

        case 'ckd_moderate':
          query = `
            SELECT p.id FROM patients p
            INNER JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
            WHERE cpd.ckd_severity = 'moderate'
          `;
          break;

        case 'ckd_severe':
          query = `
            SELECT p.id FROM patients p
            INNER JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
            WHERE cpd.ckd_severity = 'severe'
          `;
          break;

        case 'ckd_kidney_failure':
          query = `
            SELECT p.id FROM patients p
            INNER JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
            WHERE cpd.ckd_severity = 'kidney_failure'
          `;
          break;

        default:
          continue; // Skip unknown categories
      }

      // Get patient IDs for this category
      const patientResult = await pool.query(query, params);
      const patientIds = patientResult.rows.map(row => row.id);

      // If doctor_email is empty, REMOVE assignments for this category
      if (!doctor_email) {
        let removedCount = 0;
        for (const patientId of patientIds) {
          // Remove all primary assignments for this patient
          await pool.query(`
            UPDATE doctor_patient_assignments
            SET is_primary = false
            WHERE patient_id = $1 AND is_primary = true
          `, [patientId]);
          removedCount++;
        }

        results.push({
          category,
          doctor_email: null,
          patients_unassigned: removedCount
        });
      } else {
        // Assign doctor to all patients in this category
        let assignedCount = 0;
        for (const patientId of patientIds) {
          // Remove existing primary assignments for this patient
          await pool.query(`
            UPDATE doctor_patient_assignments
            SET is_primary = false
            WHERE patient_id = $1 AND is_primary = true
          `, [patientId]);

          // Insert or update the assignment
          await pool.query(`
            INSERT INTO doctor_patient_assignments (patient_id, doctor_email, doctor_name, is_primary)
            VALUES ($1, $2, $3, true)
            ON CONFLICT (patient_id, doctor_email)
            DO UPDATE SET
              doctor_name = EXCLUDED.doctor_name,
              is_primary = EXCLUDED.is_primary,
              updated_at = NOW()
          `, [patientId, doctor_email, doctor_name]);

          assignedCount++;
        }

        results.push({
          category,
          doctor_email,
          patients_assigned: assignedCount
        });
      }
    }

    return res.json({
      status: 'success',
      message: 'Bulk assignments completed',
      results
    });
  } catch (error) {
    console.error('[Doctors API] Error in bulk assignment by category:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to assign doctors by category',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/doctors/category-assignments
 * Get current doctor assignments by category
 * Returns which doctor is assigned to each category based on existing assignments
 */
router.get('/category-assignments', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    // Query to find the most commonly assigned doctor for each granular category
    const result = await pool.query(`
      WITH category_assignments AS (
        -- Non-CKD Low Risk
        SELECT
          'non_ckd_low' as category,
          dpa.doctor_email,
          dpa.doctor_name,
          COUNT(*) as patient_count
        FROM doctor_patient_assignments dpa
        JOIN non_ckd_patient_data nckd ON dpa.patient_id = nckd.patient_id
        WHERE dpa.is_primary = true AND nckd.risk_level = 'low'
        GROUP BY dpa.doctor_email, dpa.doctor_name

        UNION ALL

        -- Non-CKD Moderate Risk
        SELECT
          'non_ckd_moderate' as category,
          dpa.doctor_email,
          dpa.doctor_name,
          COUNT(*) as patient_count
        FROM doctor_patient_assignments dpa
        JOIN non_ckd_patient_data nckd ON dpa.patient_id = nckd.patient_id
        WHERE dpa.is_primary = true AND nckd.risk_level = 'moderate'
        GROUP BY dpa.doctor_email, dpa.doctor_name

        UNION ALL

        -- Non-CKD High Risk
        SELECT
          'non_ckd_high' as category,
          dpa.doctor_email,
          dpa.doctor_name,
          COUNT(*) as patient_count
        FROM doctor_patient_assignments dpa
        JOIN non_ckd_patient_data nckd ON dpa.patient_id = nckd.patient_id
        WHERE dpa.is_primary = true AND nckd.risk_level = 'high'
        GROUP BY dpa.doctor_email, dpa.doctor_name

        UNION ALL

        -- CKD Mild
        SELECT
          'ckd_mild' as category,
          dpa.doctor_email,
          dpa.doctor_name,
          COUNT(*) as patient_count
        FROM doctor_patient_assignments dpa
        JOIN ckd_patient_data ckd ON dpa.patient_id = ckd.patient_id
        WHERE dpa.is_primary = true AND ckd.ckd_severity = 'mild'
        GROUP BY dpa.doctor_email, dpa.doctor_name

        UNION ALL

        -- CKD Moderate
        SELECT
          'ckd_moderate' as category,
          dpa.doctor_email,
          dpa.doctor_name,
          COUNT(*) as patient_count
        FROM doctor_patient_assignments dpa
        JOIN ckd_patient_data ckd ON dpa.patient_id = ckd.patient_id
        WHERE dpa.is_primary = true AND ckd.ckd_severity = 'moderate'
        GROUP BY dpa.doctor_email, dpa.doctor_name

        UNION ALL

        -- CKD Severe
        SELECT
          'ckd_severe' as category,
          dpa.doctor_email,
          dpa.doctor_name,
          COUNT(*) as patient_count
        FROM doctor_patient_assignments dpa
        JOIN ckd_patient_data ckd ON dpa.patient_id = ckd.patient_id
        WHERE dpa.is_primary = true AND ckd.ckd_severity = 'severe'
        GROUP BY dpa.doctor_email, dpa.doctor_name

        UNION ALL

        -- CKD Kidney Failure
        SELECT
          'ckd_kidney_failure' as category,
          dpa.doctor_email,
          dpa.doctor_name,
          COUNT(*) as patient_count
        FROM doctor_patient_assignments dpa
        JOIN ckd_patient_data ckd ON dpa.patient_id = ckd.patient_id
        WHERE dpa.is_primary = true AND ckd.ckd_severity = 'kidney_failure'
        GROUP BY dpa.doctor_email, dpa.doctor_name
      ),
      ranked_assignments AS (
        SELECT
          category,
          doctor_email,
          doctor_name,
          patient_count,
          ROW_NUMBER() OVER (PARTITION BY category ORDER BY patient_count DESC) as rank
        FROM category_assignments
      )
      SELECT
        category,
        doctor_email,
        doctor_name,
        patient_count
      FROM ranked_assignments
      WHERE rank = 1
    `);

    // Format response with all 7 categories
    const assignments: Record<string, { email: string; name: string; patientCount: number } | null> = {
      non_ckd_low: null,
      non_ckd_moderate: null,
      non_ckd_high: null,
      ckd_mild: null,
      ckd_moderate: null,
      ckd_severe: null,
      ckd_kidney_failure: null
    };

    for (const row of result.rows) {
      assignments[row.category] = {
        email: row.doctor_email,
        name: row.doctor_name,
        patientCount: parseInt(row.patient_count)
      };
    }

    console.log('[Doctors API] Fetched category assignments:', assignments);

    return res.json({
      status: 'success',
      data: assignments
    });
  } catch (error) {
    console.error('[Doctors API] Error fetching category assignments:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch category assignments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/doctors/:email
 * Get doctor by email
 */
router.get('/:email', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        id,
        email,
        name,
        specialty,
        phone,
        notification_preferences,
        email_signature,
        facility_name,
        is_active,
        created_at
      FROM doctors
      WHERE email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Doctor not found'
      });
    }

    return res.json({
      status: 'success',
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('[Doctors API] Error fetching doctor:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch doctor',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/doctors/:email
 * Update doctor profile
 */
router.put('/:email', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.params;
    const {
      name,
      specialty,
      phone,
      notification_preferences,
      email_signature,
      facility_name,
      is_active,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_password,
      from_email,
      from_name,
      smtp_enabled
    } = req.body;

    const pool = getPool();
    const result = await pool.query(`
      UPDATE doctors
      SET
        name = COALESCE($1, name),
        specialty = COALESCE($2, specialty),
        phone = COALESCE($3, phone),
        notification_preferences = COALESCE($4, notification_preferences),
        email_signature = COALESCE($5, email_signature),
        facility_name = COALESCE($6, facility_name),
        is_active = COALESCE($7, is_active),
        smtp_host = COALESCE($8, smtp_host),
        smtp_port = COALESCE($9, smtp_port),
        smtp_user = COALESCE($10, smtp_user),
        smtp_password = COALESCE($11, smtp_password),
        from_email = COALESCE($12, from_email),
        from_name = COALESCE($13, from_name),
        smtp_enabled = COALESCE($14, smtp_enabled),
        updated_at = NOW()
      WHERE email = $15
      RETURNING id, email, name, specialty, phone, notification_preferences, email_signature, facility_name, is_active, updated_at,
                smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name, smtp_enabled
    `, [
      name, specialty, phone, notification_preferences, email_signature, facility_name, is_active,
      smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name, smtp_enabled,
      email
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Doctor not found'
      });
    }

    return res.json({
      status: 'success',
      doctor: result.rows[0]
    });
  } catch (error) {
    console.error('[Doctors API] Error updating doctor:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update doctor',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/doctors/:email
 * Delete doctor profile and all assignments
 */
router.delete('/:email', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.params;
    const pool = getPool();

    // First, delete all patient assignments for this doctor
    await pool.query(`
      DELETE FROM doctor_patient_assignments
      WHERE doctor_email = $1
    `, [email]);

    // Then delete the doctor profile
    const result = await pool.query(`
      DELETE FROM doctors
      WHERE email = $1
      RETURNING email, name
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Doctor not found'
      });
    }

    return res.json({
      status: 'success',
      message: `Doctor ${result.rows[0].name} deleted successfully`,
      deleted: result.rows[0]
    });
  } catch (error) {
    console.error('[Doctors API] Error deleting doctor:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete doctor',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/patients/:id/assign-doctor
 * Assign a doctor to a patient
 */
router.post('/:id/assign-doctor', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id: patientId } = req.params;
    const { doctor_email, doctor_name, is_primary } = req.body;

    if (!doctor_email) {
      return res.status(400).json({
        status: 'error',
        message: 'doctor_email is required'
      });
    }

    const pool = getPool();

    // If this is a primary doctor, unset other primary doctors first
    if (is_primary) {
      await pool.query(`
        UPDATE doctor_patient_assignments
        SET is_primary = false
        WHERE patient_id = $1 AND is_primary = true
      `, [patientId]);
    }

    // Insert or update the assignment
    const result = await pool.query(`
      INSERT INTO doctor_patient_assignments (patient_id, doctor_email, doctor_name, is_primary)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (patient_id, doctor_email)
      DO UPDATE SET
        doctor_name = EXCLUDED.doctor_name,
        is_primary = EXCLUDED.is_primary,
        updated_at = NOW()
      RETURNING id, patient_id, doctor_email, doctor_name, is_primary, assigned_at
    `, [patientId, doctor_email, doctor_name || null, is_primary || false]);

    return res.json({
      status: 'success',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('[Doctors API] Error assigning doctor:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to assign doctor',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/patients/:id/doctors
 * Get all doctors assigned to a patient
 */
router.get('/:id/doctors', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id: patientId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        dpa.id,
        dpa.doctor_email,
        dpa.doctor_name,
        dpa.is_primary,
        dpa.assigned_at,
        d.name as doctor_full_name,
        d.specialty,
        d.phone,
        d.notification_preferences,
        d.is_active
      FROM doctor_patient_assignments dpa
      LEFT JOIN doctors d ON dpa.doctor_email = d.email
      WHERE dpa.patient_id = $1
      ORDER BY dpa.is_primary DESC, dpa.assigned_at ASC
    `, [patientId]);

    return res.json({
      status: 'success',
      doctors: result.rows
    });
  } catch (error) {
    console.error('[Doctors API] Error fetching patient doctors:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch patient doctors',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/patients/:id/doctors/:email
 * Remove doctor assignment from patient
 */
router.delete('/:id/doctors/:email', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id: patientId, email: doctorEmail } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      DELETE FROM doctor_patient_assignments
      WHERE patient_id = $1 AND doctor_email = $2
      RETURNING id
    `, [patientId, doctorEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Assignment not found'
      });
    }

    return res.json({
      status: 'success',
      message: 'Doctor assignment removed'
    });
  } catch (error) {
    console.error('[Doctors API] Error removing doctor assignment:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to remove doctor assignment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/patients/:id/primary-doctor
 * Get primary doctor for a patient (using utility function)
 */
router.get('/:id/primary-doctor', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id: patientId } = req.params;
    const pool = getPool();

    const doctor = await getPrimaryDoctor(pool, patientId);

    return res.json({
      status: 'success',
      doctor
    });
  } catch (error) {
    console.error('[Doctors API] Error fetching primary doctor:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch primary doctor',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/doctors/external-notifications
 * Get all external notification email addresses
 */
router.get('/external-notifications', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT id, email, name, description, enabled, created_at, updated_at
      FROM external_notification_emails
      ORDER BY created_at DESC
    `);

    return res.json({
      status: 'success',
      emails: result.rows
    });
  } catch (error) {
    console.error('[Doctors API] Error fetching external notification emails:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch external notification emails',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/doctors/external-notifications
 * Add a new external notification email
 */
router.post('/external-notifications', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, name, description } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and name are required'
      });
    }

    const pool = getPool();
    const result = await pool.query(`
      INSERT INTO external_notification_emails (email, name, description, enabled)
      VALUES ($1, $2, $3, true)
      RETURNING id, email, name, description, enabled, created_at, updated_at
    `, [email, name, description || null]);

    return res.json({
      status: 'success',
      email: result.rows[0]
    });
  } catch (error) {
    console.error('[Doctors API] Error adding external notification email:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add external notification email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/doctors/external-notifications/:id
 * Update an external notification email
 */
router.put('/external-notifications/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { email, name, description, enabled } = req.body;

    const pool = getPool();
    const result = await pool.query(`
      UPDATE external_notification_emails
      SET
        email = COALESCE($1, email),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        enabled = COALESCE($4, enabled),
        updated_at = NOW()
      WHERE id = $5
      RETURNING id, email, name, description, enabled, created_at, updated_at
    `, [email, name, description, enabled, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'External notification email not found'
      });
    }

    return res.json({
      status: 'success',
      email: result.rows[0]
    });
  } catch (error) {
    console.error('[Doctors API] Error updating external notification email:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update external notification email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/doctors/external-notifications/:id
 * Delete an external notification email
 */
router.delete('/external-notifications/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      DELETE FROM external_notification_emails
      WHERE id = $1
      RETURNING id, email, name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'External notification email not found'
      });
    }

    return res.json({
      status: 'success',
      message: `External notification email ${result.rows[0].email} deleted successfully`
    });
  } catch (error) {
    console.error('[Doctors API] Error deleting external notification email:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete external notification email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
