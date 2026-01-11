import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database';

const router = Router();

// ============================================
// PRESCRIPTION ENDPOINTS
// ============================================

/**
 * GET /api/jardiance/prescriptions/:patientId
 * Get all Jardiance prescriptions for a patient
 */
router.get('/prescriptions/:patientId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { patientId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        jp.*,
        p.medical_record_number,
        p.first_name || ' ' || p.last_name as patient_name
      FROM jardiance_prescriptions jp
      JOIN patients p ON jp.patient_id = p.id
      WHERE jp.patient_id = $1
      ORDER BY jp.start_date DESC
    `, [patientId]);

    res.json({
      status: 'success',
      prescriptions: result.rows
    });

  } catch (error) {
    console.error('[Jardiance API] Error fetching prescriptions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch prescriptions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/jardiance/prescriptions
 * Create a new Jardiance prescription
 */
router.post('/prescriptions', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      patient_id,
      medication,
      dosage,
      start_date,
      prescriber_name,
      prescriber_npi,
      indication
    } = req.body;

    const pool = getPool();

    // Validate dosage
    if (!['10mg', '25mg'].includes(dosage)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid dosage. Must be 10mg or 25mg'
      });
    }

    const result = await pool.query(`
      INSERT INTO jardiance_prescriptions (
        patient_id, medication, dosage, start_date,
        prescriber_name, prescriber_npi, indication,
        prescribed, currently_taking
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
      RETURNING *
    `, [patient_id, medication, dosage, start_date, prescriber_name, prescriber_npi, indication]);

    res.json({
      status: 'success',
      message: 'Prescription created successfully',
      prescription: result.rows[0]
    });

  } catch (error) {
    console.error('[Jardiance API] Error creating prescription:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create prescription',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/jardiance/prescriptions/:prescriptionId/discontinue
 * Discontinue an active prescription
 */
router.put('/prescriptions/:prescriptionId/discontinue', async (req: Request, res: Response): Promise<any> => {
  try {
    const { prescriptionId } = req.params;
    const { end_date } = req.body;

    const pool = getPool();

    const result = await pool.query(`
      UPDATE jardiance_prescriptions
      SET
        currently_taking = false,
        end_date = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [end_date || new Date(), prescriptionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Prescription not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Prescription discontinued',
      prescription: result.rows[0]
    });

  } catch (error) {
    console.error('[Jardiance API] Error discontinuing prescription:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to discontinue prescription',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// REFILL ENDPOINTS
// ============================================

/**
 * GET /api/jardiance/refills/:prescriptionId
 * Get all refills for a prescription
 */
router.get('/refills/:prescriptionId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { prescriptionId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM jardiance_refills
      WHERE prescription_id = $1
      ORDER BY refill_date DESC
    `, [prescriptionId]);

    res.json({
      status: 'success',
      refills: result.rows
    });

  } catch (error) {
    console.error('[Jardiance API] Error fetching refills:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch refills',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/jardiance/refills
 * Record a new refill
 */
router.post('/refills', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      prescription_id,
      refill_date,
      days_supply,
      quantity,
      pharmacy_name,
      pharmacy_npi,
      copay_amount,
      cost_barrier_reported
    } = req.body;

    const pool = getPool();

    // Calculate expected refill date and gap from previous refill
    const previousRefill = await pool.query(`
      SELECT refill_date, days_supply
      FROM jardiance_refills
      WHERE prescription_id = $1
      ORDER BY refill_date DESC
      LIMIT 1
    `, [prescription_id]);

    let expected_refill_date = null;
    let gap_days = 0;

    if (previousRefill.rows.length > 0) {
      const prevDate = new Date(previousRefill.rows[0].refill_date);
      const prevDaysSupply = previousRefill.rows[0].days_supply;
      expected_refill_date = new Date(prevDate.getTime() + prevDaysSupply * 24 * 60 * 60 * 1000);

      const actualDate = new Date(refill_date);
      gap_days = Math.floor((actualDate.getTime() - expected_refill_date.getTime()) / (24 * 60 * 60 * 1000));
    }

    const result = await pool.query(`
      INSERT INTO jardiance_refills (
        prescription_id, refill_date, days_supply, quantity,
        expected_refill_date, gap_days,
        pharmacy_name, pharmacy_npi, copay_amount, cost_barrier_reported
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      prescription_id, refill_date, days_supply, quantity,
      expected_refill_date, gap_days,
      pharmacy_name, pharmacy_npi, copay_amount, cost_barrier_reported
    ]);

    res.json({
      status: 'success',
      message: 'Refill recorded successfully',
      refill: result.rows[0],
      gap_analysis: {
        gap_days,
        expected_refill_date,
        status: gap_days > 7 ? 'late' : gap_days < -7 ? 'early' : 'on-time'
      }
    });

  } catch (error) {
    console.error('[Jardiance API] Error recording refill:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to record refill',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// ADHERENCE ENDPOINTS
// ============================================

/**
 * GET /api/jardiance/adherence/:prescriptionId
 * Get adherence history for a prescription
 */
router.get('/adherence/:prescriptionId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { prescriptionId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM jardiance_adherence
      WHERE prescription_id = $1
      ORDER BY assessment_date DESC
    `, [prescriptionId]);

    res.json({
      status: 'success',
      adherence_history: result.rows
    });

  } catch (error) {
    console.error('[Jardiance API] Error fetching adherence:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch adherence',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/jardiance/adherence/calculate
 * Calculate adherence metrics for a prescription over a period
 */
router.post('/adherence/calculate', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      prescription_id,
      start_date,
      end_date
    } = req.body;

    const pool = getPool();

    // Get all refills in the period
    const refillsResult = await pool.query(`
      SELECT
        refill_date,
        days_supply,
        quantity,
        gap_days
      FROM jardiance_refills
      WHERE prescription_id = $1
        AND refill_date BETWEEN $2 AND $3
      ORDER BY refill_date
    `, [prescription_id, start_date, end_date]);

    const refills = refillsResult.rows;

    if (refills.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No refills found in the specified period'
      });
    }

    // Calculate metrics
    const periodStart = new Date(start_date);
    const periodEnd = new Date(end_date);
    const periodDays = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    const totalDaysSupply = refills.reduce((sum, r) => sum + r.days_supply, 0);
    const totalQuantity = refills.reduce((sum, r) => sum + r.quantity, 0);
    const totalGapDays = refills.reduce((sum, r) => sum + Math.max(0, r.gap_days), 0);
    const maxGapDays = Math.max(...refills.map(r => r.gap_days), 0);
    const gapCount = refills.filter(r => r.gap_days > 7).length;

    // MPR = (Total days supply / Period days) * 100
    const mpr = Math.min((totalDaysSupply / periodDays) * 100, 100);

    // PDC calculation (simplified - days covered)
    const pdc = Math.min(((periodDays - totalGapDays) / periodDays) * 100, 100);

    // Determine category
    let category: string;
    if (mpr >= 80) {
      category = 'High';
    } else if (mpr >= 60) {
      category = 'Medium';
    } else {
      category = 'Low';
    }

    // Save to database
    const adherenceResult = await pool.query(`
      INSERT INTO jardiance_adherence (
        prescription_id, assessment_date,
        period_start_date, period_end_date, period_days,
        mpr, pdc, category,
        total_refills, total_days_supply, total_quantity,
        total_gap_days, max_gap_days, gap_count
      ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      prescription_id, start_date, end_date, periodDays,
      mpr.toFixed(2), pdc.toFixed(2), category,
      refills.length, totalDaysSupply, totalQuantity,
      totalGapDays, maxGapDays, gapCount
    ]);

    res.json({
      status: 'success',
      message: 'Adherence calculated successfully',
      adherence: adherenceResult.rows[0],
      details: {
        period_days: periodDays,
        total_refills: refills.length,
        total_days_supply: totalDaysSupply,
        mpr: mpr.toFixed(2),
        pdc: pdc.toFixed(2),
        category,
        gap_analysis: {
          total_gap_days: totalGapDays,
          max_gap_days: maxGapDays,
          gap_count: gapCount
        }
      }
    });

  } catch (error) {
    console.error('[Jardiance API] Error calculating adherence:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate adherence',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// BARRIERS ENDPOINTS
// ============================================

/**
 * GET /api/jardiance/barriers/:prescriptionId
 * Get all barriers for a prescription
 */
router.get('/barriers/:prescriptionId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { prescriptionId } = req.params;
    const { resolved } = req.query;

    const pool = getPool();

    let query = `
      SELECT * FROM adherence_barriers
      WHERE prescription_id = $1
    `;

    if (resolved === 'false') {
      query += ' AND resolved = false';
    } else if (resolved === 'true') {
      query += ' AND resolved = true';
    }

    query += ' ORDER BY identified_date DESC';

    const result = await pool.query(query, [prescriptionId]);

    res.json({
      status: 'success',
      barriers: result.rows
    });

  } catch (error) {
    console.error('[Jardiance API] Error fetching barriers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch barriers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/jardiance/barriers
 * Add a new adherence barrier
 */
router.post('/barriers', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      prescription_id,
      barrier_type,
      barrier_description,
      identified_date,
      severity,
      intervention_required,
      intervention_type
    } = req.body;

    const pool = getPool();

    const result = await pool.query(`
      INSERT INTO adherence_barriers (
        prescription_id, barrier_type, barrier_description,
        identified_date, severity,
        intervention_required, intervention_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      prescription_id, barrier_type, barrier_description,
      identified_date || new Date(), severity,
      intervention_required, intervention_type
    ]);

    res.json({
      status: 'success',
      message: 'Barrier recorded successfully',
      barrier: result.rows[0]
    });

  } catch (error) {
    console.error('[Jardiance API] Error recording barrier:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to record barrier',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/jardiance/barriers/:barrierId/resolve
 * Mark a barrier as resolved
 */
router.put('/barriers/:barrierId/resolve', async (req: Request, res: Response): Promise<any> => {
  try {
    const { barrierId } = req.params;
    const { resolution_date, resolution_notes } = req.body;

    const pool = getPool();

    const result = await pool.query(`
      UPDATE adherence_barriers
      SET
        resolved = true,
        resolution_date = $1,
        resolution_notes = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [resolution_date || new Date(), resolution_notes, barrierId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Barrier not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Barrier marked as resolved',
      barrier: result.rows[0]
    });

  } catch (error) {
    console.error('[Jardiance API] Error resolving barrier:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to resolve barrier',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// SUMMARY ENDPOINT
// ============================================

/**
 * GET /api/jardiance/summary/:patientId
 * Get complete Jardiance summary for a patient
 */
router.get('/summary/:patientId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { patientId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM patient_jardiance_summary
      WHERE patient_id = $1
    `, [patientId]);

    if (result.rows.length === 0) {
      return res.json({
        status: 'success',
        message: 'No Jardiance prescription found for this patient',
        summary: null
      });
    }

    res.json({
      status: 'success',
      summary: result.rows[0]
    });

  } catch (error) {
    console.error('[Jardiance API] Error fetching summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
