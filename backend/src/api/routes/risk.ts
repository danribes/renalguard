import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database';

const router = Router();

/**
 * GET /api/risk/assessment/:patientId
 * Get comprehensive risk assessment for a patient
 */
router.get('/assessment/:patientId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { patientId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM patient_risk_assessment
      WHERE patient_id = $1
    `, [patientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found or risk factors not assessed'
      });
    }

    res.json({
      status: 'success',
      assessment: result.rows[0]
    });

  } catch (error) {
    console.error('[Risk API] Error fetching risk assessment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch risk assessment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/risk/calculate/:patientId
 * Calculate and update risk score for a patient
 */
router.post('/calculate/:patientId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { patientId } = req.params;
    const pool = getPool();

    // Calculate eGFR trajectory
    const trajectoryResult = await pool.query(`
      SELECT * FROM calculate_egfr_trajectory($1, 12)
    `, [patientId]);

    const trajectory = trajectoryResult.rows[0] || { decline_rate: 0, trend: 'insufficient_data' };

    // Update risk factors with trajectory
    await pool.query(`
      UPDATE patient_risk_factors
      SET
        egfr_decline_rate = $1,
        egfr_trend = $2,
        last_egfr_assessment_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
      WHERE patient_id = $3
    `, [trajectory.decline_rate, trajectory.trend, patientId]);

    // Calculate risk score
    const scoreResult = await pool.query(`
      SELECT calculate_ckd_risk_score($1) as risk_score
    `, [patientId]);

    const riskScore = scoreResult.rows[0].risk_score;

    // Get risk tier
    const tierResult = await pool.query(`
      SELECT get_risk_tier($1) as risk_tier
    `, [riskScore]);

    const riskTier = tierResult.rows[0].risk_tier;

    // Update risk factors table
    await pool.query(`
      UPDATE patient_risk_factors
      SET
        risk_score = $1,
        risk_tier = $2,
        last_assessment_date = CURRENT_DATE,
        next_assessment_due = CASE
          WHEN $2 = 'very_high' THEN CURRENT_DATE + INTERVAL '1 month'
          WHEN $2 = 'high' THEN CURRENT_DATE + INTERVAL '3 months'
          WHEN $2 = 'moderate' THEN CURRENT_DATE + INTERVAL '6 months'
          ELSE CURRENT_DATE + INTERVAL '12 months'
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE patient_id = $3
      RETURNING *
    `, [riskScore, riskTier, patientId]);

    // Get updated assessment
    const assessmentResult = await pool.query(`
      SELECT * FROM patient_risk_assessment
      WHERE patient_id = $1
    `, [patientId]);

    res.json({
      status: 'success',
      message: 'Risk score calculated successfully',
      assessment: assessmentResult.rows[0],
      calculation: {
        risk_score: riskScore,
        risk_tier: riskTier,
        egfr_trajectory: trajectory
      }
    });

  } catch (error) {
    console.error('[Risk API] Error calculating risk:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate risk score',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/risk/patients/high-risk
 * Get all high-risk patients
 */
router.get('/patients/high-risk', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM patient_risk_assessment
      WHERE risk_tier IN ('high', 'very_high')
      ORDER BY risk_score DESC
    `);

    res.json({
      status: 'success',
      count: result.rows.length,
      patients: result.rows
    });

  } catch (error) {
    console.error('[Risk API] Error fetching high-risk patients:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch high-risk patients',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/risk/statistics
 * Get risk distribution statistics
 */
router.get('/statistics', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        risk_tier,
        COUNT(*) as patient_count,
        ROUND(AVG(risk_score), 2) as avg_risk_score,
        ROUND(AVG(current_egfr), 2) as avg_egfr,
        ROUND(AVG(current_uacr), 2) as avg_uacr,
        COUNT(CASE WHEN has_diabetes THEN 1 END) as diabetes_count,
        COUNT(CASE WHEN has_hypertension THEN 1 END) as hypertension_count,
        COUNT(CASE WHEN history_of_aki THEN 1 END) as aki_history_count
      FROM patient_risk_assessment
      WHERE risk_tier IS NOT NULL
      GROUP BY risk_tier
      ORDER BY
        CASE risk_tier
          WHEN 'very_high' THEN 1
          WHEN 'high' THEN 2
          WHEN 'moderate' THEN 3
          WHEN 'low' THEN 4
        END
    `);

    res.json({
      status: 'success',
      statistics: result.rows
    });

  } catch (error) {
    console.error('[Risk API] Error fetching statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch risk statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/risk/bulk-calculate
 * Calculate risk scores for all patients
 */
router.post('/bulk-calculate', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    // Get all patients with risk factors
    const patientsResult = await pool.query(`
      SELECT patient_id FROM patient_risk_factors
    `);

    let calculated = 0;
    let errors = 0;

    for (const row of patientsResult.rows) {
      try {
        // Calculate trajectory
        const trajectoryResult = await pool.query(`
          SELECT * FROM calculate_egfr_trajectory($1, 12)
        `, [row.patient_id]);

        const trajectory = trajectoryResult.rows[0] || { decline_rate: 0, trend: 'insufficient_data' };

        // Update trajectory
        await pool.query(`
          UPDATE patient_risk_factors
          SET egfr_decline_rate = $1, egfr_trend = $2
          WHERE patient_id = $3
        `, [trajectory.decline_rate, trajectory.trend, row.patient_id]);

        // Calculate risk score
        const scoreResult = await pool.query(`
          SELECT calculate_ckd_risk_score($1) as risk_score
        `, [row.patient_id]);

        const riskScore = scoreResult.rows[0].risk_score;

        // Get tier
        const tierResult = await pool.query(`
          SELECT get_risk_tier($1) as risk_tier
        `, [riskScore]);

        const riskTier = tierResult.rows[0].risk_tier;

        // Update risk factors
        await pool.query(`
          UPDATE patient_risk_factors
          SET
            risk_score = $1,
            risk_tier = $2,
            last_assessment_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
          WHERE patient_id = $3
        `, [riskScore, riskTier, row.patient_id]);

        calculated++;
      } catch (err) {
        console.error(`Error calculating risk for patient ${row.patient_id}:`, err);
        errors++;
      }
    }

    res.json({
      status: 'success',
      message: 'Bulk risk calculation complete',
      calculated,
      errors,
      total: patientsResult.rows.length
    });

  } catch (error) {
    console.error('[Risk API] Error in bulk calculation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform bulk calculation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
