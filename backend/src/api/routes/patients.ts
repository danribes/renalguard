import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database';
import { classifyKDIGO, classifyKDIGOWithSCORED, getRiskCategoryLabel, getCKDSeverity } from '../../utils/kdigo';
import { HealthStateCommentService } from '../../services/healthStateCommentService';
import { AIUpdateAnalysisService } from '../../services/aiUpdateAnalysisService';
import { EmailService } from '../../services/emailService';
import { ClinicalAlertsService } from '../../services/clinicalAlertsService';
import { getMCPClient } from '../../services/mcpClient';

const router = Router();

/**
 * Generate patient evolution summary by comparing current and previous cycle values
 */
/**
 * GET /api/patients/filter
 * Flexible filtering endpoint - all parameters optional
 * Query parameters:
 *   - has_ckd: boolean ('true' or 'false')
 *   - severity: 'mild' | 'moderate' | 'severe' | 'kidney_failure'
 *   - ckd_stage: 1 | 2 | 3 | 4 | 5
 *   - risk_level: 'low' | 'moderate' | 'high'
 *   - is_monitored: boolean ('true' or 'false')
 *   - is_treated: boolean ('true' or 'false') - CKD patients only
 *   - monitoring_frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'biannually' | 'annually'
 *   - treatment_name: string (e.g., 'Jardiance')
 *   - has_recent_updates: boolean ('true' or 'false') - patients with recent comments/updates
 *   - update_days: number (default: 30) - number of days to look back for recent updates
 */
router.get('/filter', async (req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    const {
      has_ckd,
      severity,
      ckd_stage,
      risk_level,
      is_monitored,
      is_treated,
      monitoring_frequency,
      treatment_name,
      has_recent_updates,
      update_days
    } = req.query;

    // Build dynamic query based on provided filters with full patient data
    let baseQuery = `
      SELECT DISTINCT
        p.id,
        p.medical_record_number,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.gender,
        p.email,
        p.phone,
        p.weight,
        p.height,
        p.smoking_status,
        p.last_visit_date,
        p.created_at,
        -- Legacy fields (for backward compatibility)
        p.home_monitoring_device,
        p.home_monitoring_active,
        p.ckd_treatment_active,
        p.ckd_treatment_type,
        -- Latest observations
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'eGFR'
         ORDER BY observation_date DESC LIMIT 1) as latest_egfr,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'uACR'
         ORDER BY observation_date DESC LIMIT 1) as latest_uacr,
        -- CKD patient data
        cpd.ckd_severity,
        cpd.ckd_stage,
        cpd.kdigo_health_state as ckd_health_state,
        cpd.is_monitored as ckd_is_monitored,
        cpd.monitoring_device as ckd_monitoring_device,
        cpd.monitoring_frequency as ckd_monitoring_frequency,
        cpd.is_treated as ckd_is_treated,
        -- Non-CKD patient data
        npd.risk_level as non_ckd_risk_level,
        npd.kdigo_health_state as non_ckd_health_state,
        npd.is_monitored as non_ckd_is_monitored,
        npd.monitoring_device as non_ckd_monitoring_device,
        npd.monitoring_frequency as non_ckd_monitoring_frequency,
        -- Risk factors for SCORED/Framingham calculation
        prf.has_diabetes,
        prf.has_hypertension,
        prf.has_cvd,
        prf.has_peripheral_vascular_disease as has_pvd,
        prf.current_bmi,
        -- Latest health state comment (for patient list summary)
        (SELECT comment_text FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_text,
        (SELECT change_type FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_change_type,
        (SELECT severity FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_severity,
        (SELECT created_at FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_date,
        (SELECT cycle_number FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_cycle,
        (SELECT clinical_summary FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_clinical_summary,
        (SELECT recommended_actions FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_recommended_actions
    `;

    let fromClause = ' FROM patients p LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id LEFT JOIN patient_risk_factors prf ON p.id = prf.patient_id';
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramCounter = 1;

    // Determine if we need CKD or non-CKD tables
    if (has_ckd === 'true') {
      whereConditions.push('cpd.patient_id IS NOT NULL');

      // CKD-specific filters
      if (severity) {
        whereConditions.push(`cpd.ckd_severity = $${paramCounter++}`);
        queryParams.push(severity);
      }

      if (ckd_stage) {
        whereConditions.push(`cpd.ckd_stage = $${paramCounter++}`);
        queryParams.push(parseInt(ckd_stage as string));
      }

      if (is_monitored !== undefined) {
        whereConditions.push(`cpd.is_monitored = $${paramCounter++}`);
        queryParams.push(is_monitored === 'true');
      }

      if (is_treated !== undefined) {
        whereConditions.push(`cpd.is_treated = $${paramCounter++}`);
        queryParams.push(is_treated === 'true');
      }

      if (monitoring_frequency) {
        whereConditions.push(`cpd.monitoring_frequency = $${paramCounter++}`);
        queryParams.push(monitoring_frequency);
      }

      // Filter by treatment name
      if (treatment_name) {
        whereConditions.push(`
          EXISTS (
            SELECT 1 FROM ckd_treatments ct
            WHERE ct.ckd_patient_data_id = cpd.id
            AND ct.treatment_name ILIKE $${paramCounter}
            AND ct.is_active = true
          )
        `);
        queryParams.push(`%${treatment_name}%`);
        paramCounter++;
      }

    } else if (has_ckd === 'false') {
      // Non-CKD patients: must have non_ckd_patient_data AND must NOT have ckd_patient_data
      whereConditions.push('npd.patient_id IS NOT NULL');
      whereConditions.push('cpd.patient_id IS NULL');  // Exclude patients who have developed CKD

      // Non-CKD specific filters
      if (risk_level) {
        whereConditions.push(`npd.risk_level = $${paramCounter++}`);
        queryParams.push(risk_level);
      }

      if (is_monitored !== undefined) {
        whereConditions.push(`npd.is_monitored = $${paramCounter++}`);
        queryParams.push(is_monitored === 'true');
      }

      if (monitoring_frequency) {
        whereConditions.push(`npd.monitoring_frequency = $${paramCounter++}`);
        queryParams.push(monitoring_frequency);
      }
    }

    // Filter for patients with recent updates (comments)
    if (has_recent_updates === 'true') {
      const daysBack = update_days ? parseInt(update_days as string) : 30;
      whereConditions.push(`
        EXISTS (
          SELECT 1 FROM patient_health_state_comments phsc
          WHERE phsc.patient_id = p.id
          AND phsc.visibility = 'visible'
          AND phsc.created_at >= NOW() - INTERVAL '${daysBack} days'
        )
      `);
    }

    // Build final query
    let finalQuery = baseQuery + fromClause;
    if (whereConditions.length > 0) {
      finalQuery += ' WHERE ' + whereConditions.join(' AND ');
    }
    finalQuery += ' ORDER BY p.last_name ASC, p.first_name ASC';

    // Execute query
    const result = await pool.query(finalQuery, queryParams);

    // Calculate KDIGO classification for each patient with SCORED/Framingham for non-CKD
    const patientsWithRisk = result.rows.map(patient => {
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

      // Build demographics for SCORED/Framingham assessment
      const demographics = {
        age,
        gender: (patient.gender?.toLowerCase() || 'male') as 'male' | 'female',
        has_hypertension: patient.has_hypertension || false,
        has_diabetes: patient.has_diabetes || false,
        has_cvd: patient.has_cvd || false,
        has_pvd: patient.has_pvd || false,
        smoking_status,
        bmi
      };

      // Use SCORED-based classification for proper non-CKD risk assessment
      const kdigo = classifyKDIGOWithSCORED(egfr, uacr, demographics);
      const risk_category = getRiskCategoryLabel(kdigo);

      // Use data from tracking tables if available, otherwise fall back to legacy fields
      const is_monitored = kdigo.has_ckd
        ? (patient.ckd_is_monitored !== null ? patient.ckd_is_monitored : patient.home_monitoring_active)
        : (patient.non_ckd_is_monitored !== null ? patient.non_ckd_is_monitored : patient.home_monitoring_active);

      const monitoring_device = kdigo.has_ckd
        ? (patient.ckd_monitoring_device || patient.home_monitoring_device)
        : (patient.non_ckd_monitoring_device || patient.home_monitoring_device);

      // Generate summarized comment for list view (max 100 chars)
      let comment_summary = null;
      if (patient.latest_comment_text) {
        // Remove emojis and special characters, extract key info
        const cleanText = patient.latest_comment_text.replace(/[⚠️✓]/g, '').trim();
        // Take first sentence or up to 100 characters
        const firstSentence = cleanText.split('.')[0];
        comment_summary = firstSentence.length > 100
          ? firstSentence.substring(0, 97) + '...'
          : firstSentence;
      }

      // Generate evolution_summary for patient list badge display
      let evolution_summary = null;
      if (patient.latest_comment_change_type) {
        const changeType = patient.latest_comment_change_type;
        const severity = patient.latest_comment_severity;

        // Create concise evolution summary based on change type and severity
        if (changeType === 'worsened' || changeType === 'worsening') {
          evolution_summary = severity === 'critical' ? 'Critical - Worsening' : 'Worsening';
        } else if (changeType === 'improved' || changeType === 'improving') {
          evolution_summary = 'Improving';
        } else if (changeType === 'stable') {
          evolution_summary = 'Stable';
        } else if (changeType === 'initial') {
          evolution_summary = 'Initial Assessment';
        }
      }

      return {
        ...patient,
        kdigo_classification: kdigo,
        risk_category,
        // Simplified tracking data
        is_monitored,
        monitoring_device,
        is_treated: kdigo.has_ckd ? (patient.ckd_is_treated || patient.ckd_treatment_active) : false,
        // Evolution summary for patient list
        evolution_summary,
        // Latest comment summary for list view
        latest_comment: patient.latest_comment_text ? {
          summary: comment_summary,
          change_type: patient.latest_comment_change_type,
          severity: patient.latest_comment_severity,
          date: patient.latest_comment_date,
          cycle: patient.latest_comment_cycle,
          clinical_summary: patient.latest_comment_clinical_summary,
          recommended_actions: patient.latest_comment_recommended_actions
        } : null
      };
    });

    // Post-processing filter: When filtering for non-CKD patients, exclude those whose
    // computed KDIGO classification shows has_ckd = true (based on current lab values)
    // This handles cases where patients' lab values have changed since initial classification
    let filteredPatients = patientsWithRisk;
    if (has_ckd === 'false') {
      filteredPatients = patientsWithRisk.filter(p => !p.kdigo_classification?.has_ckd);
    } else if (has_ckd === 'true') {
      filteredPatients = patientsWithRisk.filter(p => p.kdigo_classification?.has_ckd);
    }

    res.json({
      status: 'success',
      filters_applied: {
        has_ckd: has_ckd || 'not_specified',
        severity: severity || 'not_specified',
        ckd_stage: ckd_stage || 'not_specified',
        risk_level: risk_level || 'not_specified',
        is_monitored: is_monitored || 'not_specified',
        is_treated: is_treated || 'not_specified',
        monitoring_frequency: monitoring_frequency || 'not_specified',
        treatment_name: treatment_name || 'not_specified',
        has_recent_updates: has_recent_updates || 'not_specified',
        update_days: update_days || 'not_specified'
      },
      count: filteredPatients.length,
      patients: filteredPatients
    });

  } catch (error) {
    console.error('[Patients API] Error filtering patients:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to filter patients',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/patients/with-health-state-changes
 * Get patients with recent health state changes
 * Query parameters:
 *   - days: number of days to look back (default: 30)
 *   - change_type: 'improved' | 'worsened' | 'any' (default: 'any')
 */
router.get('/with-health-state-changes', async (req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    const days = parseInt(req.query.days as string) || 30;
    const changeType = req.query.change_type as string || 'any';

    const commentService = new HealthStateCommentService(pool);
    const patientIds = await commentService.getPatientsWithRecentHealthStateChanges(days);

    if (patientIds.length === 0) {
      return res.json({
        status: 'success',
        filters_applied: {
          days_back: days,
          change_type: changeType
        },
        count: 0,
        patients: []
      });
    }

    // Build query to get full patient details
    let whereClause = `p.id = ANY($1::uuid[])`;
    const queryParams: any[] = [patientIds];
    let paramCounter = 2;

    // Add change type filter if specified
    if (changeType !== 'any') {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM patient_health_state_comments phsc
        WHERE phsc.patient_id = p.id
        AND phsc.change_type = $${paramCounter}
        AND phsc.created_at >= NOW() - INTERVAL '${days} days'
        AND phsc.visibility = 'visible'
      )`;
      queryParams.push(changeType);
      paramCounter++;
    }

    const result = await pool.query(`
      SELECT
        p.id,
        p.medical_record_number,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.gender,
        p.email,
        p.phone,
        p.last_visit_date,
        p.created_at,
        -- Latest observations
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'eGFR'
         ORDER BY observation_date DESC LIMIT 1) as latest_egfr,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'uACR'
         ORDER BY observation_date DESC LIMIT 1) as latest_uacr,
        -- CKD patient data
        cpd.ckd_severity,
        cpd.ckd_stage,
        cpd.kdigo_health_state as ckd_health_state,
        cpd.is_monitored as ckd_is_monitored,
        cpd.is_treated as ckd_is_treated,
        -- Non-CKD patient data
        npd.risk_level as non_ckd_risk_level,
        npd.kdigo_health_state as non_ckd_health_state,
        npd.is_monitored as non_ckd_is_monitored,
        -- Recent health state change info
        (SELECT change_type FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_change_type,
        (SELECT severity FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_change_severity,
        (SELECT created_at FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_change_date,
        (SELECT health_state_to FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as current_health_state,
        (SELECT comment_text FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_text,
        (SELECT clinical_summary FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_clinical_summary,
        (SELECT recommended_actions FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_recommended_actions,
        (SELECT cycle_number FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_cycle,
        -- Legacy fields
        p.home_monitoring_device,
        p.home_monitoring_active,
        p.ckd_treatment_active,
        p.ckd_treatment_type,
        -- Monitoring and treatment device fields
        cpd.monitoring_device as ckd_monitoring_device,
        npd.monitoring_device as non_ckd_monitoring_device
      FROM patients p
      LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
      LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
      WHERE ${whereClause}
      ORDER BY (SELECT created_at FROM patient_health_state_comments
                WHERE patient_id = p.id AND visibility = 'visible'
                ORDER BY created_at DESC LIMIT 1) DESC
    `, queryParams);

    // Process patients to add kdigo_classification, risk_category, evolution_summary, and latest_comment
    const patientsWithRisk = result.rows.map(patient => {
      const egfr = patient.latest_egfr || 90;
      const uacr = patient.latest_uacr || 15;

      const kdigo = classifyKDIGO(egfr, uacr);
      const risk_category = getRiskCategoryLabel(kdigo);

      // Use data from tracking tables if available, otherwise fall back to legacy fields
      const is_monitored = kdigo.has_ckd
        ? (patient.ckd_is_monitored !== null ? patient.ckd_is_monitored : patient.home_monitoring_active)
        : (patient.non_ckd_is_monitored !== null ? patient.non_ckd_is_monitored : patient.home_monitoring_active);

      const monitoring_device = kdigo.has_ckd
        ? (patient.ckd_monitoring_device || patient.home_monitoring_device)
        : (patient.non_ckd_monitoring_device || patient.home_monitoring_device);

      // Generate summarized comment for list view (max 100 chars)
      let comment_summary = null;
      if (patient.latest_comment_text) {
        // Remove emojis and special characters, extract key info
        const cleanText = patient.latest_comment_text.replace(/[⚠️✓]/g, '').trim();
        // Take first sentence or up to 100 characters
        const firstSentence = cleanText.split('.')[0];
        comment_summary = firstSentence.length > 100
          ? firstSentence.substring(0, 97) + '...'
          : firstSentence;
      }

      // Generate evolution_summary for patient list badge display
      let evolution_summary = null;
      if (patient.latest_change_type) {
        const changeType = patient.latest_change_type;
        const severity = patient.latest_change_severity;

        // Create concise evolution summary based on change type and severity
        if (changeType === 'worsened' || changeType === 'worsening') {
          evolution_summary = severity === 'critical' ? 'Critical - Worsening' : 'Worsening';
        } else if (changeType === 'improved' || changeType === 'improving') {
          evolution_summary = 'Improving';
        } else if (changeType === 'stable') {
          evolution_summary = 'Stable';
        } else if (changeType === 'initial') {
          evolution_summary = 'Initial Assessment';
        }
      }

      return {
        ...patient,
        kdigo_classification: kdigo,
        risk_category,
        // Simplified tracking data
        is_monitored,
        monitoring_device,
        is_treated: kdigo.has_ckd ? (patient.ckd_is_treated || patient.ckd_treatment_active) : false,
        // Evolution summary for patient list
        evolution_summary,
        // Latest comment summary for list view
        latest_comment: patient.latest_comment_text ? {
          summary: comment_summary,
          change_type: patient.latest_change_type,
          severity: patient.latest_change_severity,
          date: patient.latest_change_date,
          cycle: patient.latest_comment_cycle,
          clinical_summary: patient.latest_comment_clinical_summary,
          recommended_actions: patient.latest_comment_recommended_actions
        } : null
      };
    });

    res.json({
      status: 'success',
      filters_applied: {
        days_back: days,
        change_type: changeType
      },
      count: patientsWithRisk.length,
      patients: patientsWithRisk
    });

  } catch (error) {
    console.error('[Patients API] Error fetching patients with health state changes:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch patients with health state changes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/patients
 * Get all patients with tracking data from new tables
 */
router.get('/', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    // Get patients with data from tracking tables
    const result = await pool.query(`
      SELECT
        p.id,
        p.medical_record_number,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.gender,
        p.email,
        p.phone,
        p.weight,
        p.height,
        p.smoking_status,
        p.last_visit_date,
        p.created_at,
        -- Legacy fields (for backward compatibility)
        p.home_monitoring_device,
        p.home_monitoring_active,
        p.ckd_treatment_active,
        p.ckd_treatment_type,
        -- Latest observations
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'eGFR'
         ORDER BY observation_date DESC LIMIT 1) as latest_egfr,
        (SELECT value_numeric FROM observations
         WHERE patient_id = p.id AND observation_type = 'uACR'
         ORDER BY observation_date DESC LIMIT 1) as latest_uacr,
        -- CKD patient data
        cpd.ckd_severity,
        cpd.ckd_stage,
        cpd.kdigo_health_state as ckd_health_state,
        cpd.is_monitored as ckd_is_monitored,
        cpd.monitoring_device as ckd_monitoring_device,
        cpd.monitoring_frequency as ckd_monitoring_frequency,
        cpd.is_treated as ckd_is_treated,
        -- Non-CKD patient data
        npd.risk_level as non_ckd_risk_level,
        npd.kdigo_health_state as non_ckd_health_state,
        npd.is_monitored as non_ckd_is_monitored,
        npd.monitoring_device as non_ckd_monitoring_device,
        npd.monitoring_frequency as non_ckd_monitoring_frequency,
        -- Risk factors for SCORED/Framingham calculation
        prf.has_diabetes,
        prf.has_hypertension,
        prf.has_cvd,
        prf.has_peripheral_vascular_disease as has_pvd,
        prf.current_bmi,
        -- Latest health state comment (for patient list summary)
        (SELECT comment_text FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_text,
        (SELECT change_type FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_change_type,
        (SELECT severity FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_severity,
        (SELECT created_at FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_date,
        (SELECT cycle_number FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_cycle,
        (SELECT clinical_summary FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_clinical_summary,
        (SELECT recommended_actions FROM patient_health_state_comments
         WHERE patient_id = p.id AND visibility = 'visible'
         ORDER BY created_at DESC LIMIT 1) as latest_comment_recommended_actions
      FROM patients p
      LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
      LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
      LEFT JOIN patient_risk_factors prf ON p.id = prf.patient_id
      ORDER BY p.last_name ASC, p.first_name ASC
    `);

    // Calculate KDIGO classification for each patient with SCORED/Framingham for non-CKD
    const patientsWithRisk = result.rows.map(patient => {
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

      // Build demographics for SCORED/Framingham assessment
      const demographics = {
        age,
        gender: (patient.gender?.toLowerCase() || 'male') as 'male' | 'female',
        has_hypertension: patient.has_hypertension || false,
        has_diabetes: patient.has_diabetes || false,
        has_cvd: patient.has_cvd || false,
        has_pvd: patient.has_pvd || false,
        smoking_status,
        bmi
      };

      // Use SCORED-based classification for proper non-CKD risk assessment
      const kdigo = classifyKDIGOWithSCORED(egfr, uacr, demographics);
      const risk_category = getRiskCategoryLabel(kdigo);

      // Use data from tracking tables if available, otherwise fall back to legacy fields
      const is_monitored = kdigo.has_ckd
        ? (patient.ckd_is_monitored !== null ? patient.ckd_is_monitored : patient.home_monitoring_active)
        : (patient.non_ckd_is_monitored !== null ? patient.non_ckd_is_monitored : patient.home_monitoring_active);

      const monitoring_device = kdigo.has_ckd
        ? (patient.ckd_monitoring_device || patient.home_monitoring_device)
        : (patient.non_ckd_monitoring_device || patient.home_monitoring_device);

      // Generate summarized comment for list view (max 100 chars)
      let comment_summary = null;
      if (patient.latest_comment_text) {
        // Remove emojis and special characters, extract key info
        const cleanText = patient.latest_comment_text.replace(/[⚠️✓]/g, '').trim();
        // Take first sentence or up to 100 characters
        const firstSentence = cleanText.split('.')[0];
        comment_summary = firstSentence.length > 100
          ? firstSentence.substring(0, 97) + '...'
          : firstSentence;
      }

      // Generate evolution_summary for patient list badge display
      let evolution_summary = null;
      if (patient.latest_comment_change_type) {
        const changeType = patient.latest_comment_change_type;
        const severity = patient.latest_comment_severity;

        // Create concise evolution summary based on change type and severity
        if (changeType === 'worsened' || changeType === 'worsening') {
          evolution_summary = severity === 'critical' ? 'Critical - Worsening' : 'Worsening';
        } else if (changeType === 'improved' || changeType === 'improving') {
          evolution_summary = 'Improving';
        } else if (changeType === 'stable') {
          evolution_summary = 'Stable';
        } else if (changeType === 'initial') {
          evolution_summary = 'Initial Assessment';
        }
      }

      return {
        ...patient,
        kdigo_classification: kdigo,
        risk_category,
        // Simplified tracking data
        is_monitored,
        monitoring_device,
        is_treated: kdigo.has_ckd ? (patient.ckd_is_treated || patient.ckd_treatment_active) : false,
        // Evolution summary for patient list
        evolution_summary,
        // Latest comment summary for list view
        latest_comment: patient.latest_comment_text ? {
          summary: comment_summary,
          change_type: patient.latest_comment_change_type,
          severity: patient.latest_comment_severity,
          date: patient.latest_comment_date,
          cycle: patient.latest_comment_cycle,
          clinical_summary: patient.latest_comment_clinical_summary,
          recommended_actions: patient.latest_comment_recommended_actions
        } : null
      };
    });

    res.json({
      status: 'success',
      count: patientsWithRisk.length,
      patients: patientsWithRisk
    });

  } catch (error) {
    console.error('[Patients API] Error fetching patients:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch patients',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/patients/statistics
 * Get comprehensive patient statistics for filtering UI
 * Returns hierarchical counts for CKD and non-CKD patients
 * NOTE: This route MUST be defined before /:id to avoid routing conflicts
 */
router.get('/statistics', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    // Get CKD patient statistics (severity breakdown with treatment status)
    const ckdStatsResult = await pool.query(`
      SELECT
        cpd.ckd_severity,
        cpd.is_treated,
        COUNT(*) as count
      FROM ckd_patient_data cpd
      INNER JOIN patients p ON cpd.patient_id = p.id
      GROUP BY cpd.ckd_severity, cpd.is_treated
      ORDER BY
        CASE cpd.ckd_severity
          WHEN 'mild' THEN 1
          WHEN 'moderate' THEN 2
          WHEN 'severe' THEN 3
          WHEN 'kidney_failure' THEN 4
        END,
        cpd.is_treated DESC
    `);

    // Get non-CKD patient statistics (risk level breakdown with monitoring status)
    const nonCkdStatsResult = await pool.query(`
      SELECT
        npd.risk_level,
        npd.is_monitored,
        COUNT(*) as count
      FROM non_ckd_patient_data npd
      INNER JOIN patients p ON npd.patient_id = p.id
      GROUP BY npd.risk_level, npd.is_monitored
      ORDER BY
        CASE npd.risk_level
          WHEN 'low' THEN 1
          WHEN 'moderate' THEN 2
          WHEN 'high' THEN 3
        END,
        npd.is_monitored DESC
    `);

    // Process CKD statistics into hierarchical structure
    const ckdStats: any = {
      total: 0,
      mild: { total: 0, treated: 0, not_treated: 0 },
      moderate: { total: 0, treated: 0, not_treated: 0 },
      severe: { total: 0, treated: 0, not_treated: 0 },
      kidney_failure: { total: 0, treated: 0, not_treated: 0 }
    };

    ckdStatsResult.rows.forEach((row: any) => {
      const count = parseInt(row.count);
      const severity = row.ckd_severity;
      const isTreated = row.is_treated;

      ckdStats.total += count;

      if (ckdStats[severity]) {
        ckdStats[severity].total += count;
        if (isTreated) {
          ckdStats[severity].treated += count;
        } else {
          ckdStats[severity].not_treated += count;
        }
      }
    });

    // Process non-CKD statistics into hierarchical structure
    const nonCkdStats: any = {
      total: 0,
      low: { total: 0, monitored: 0, not_monitored: 0 },
      moderate: { total: 0, monitored: 0, not_monitored: 0 },
      high: { total: 0, monitored: 0, not_monitored: 0 }
    };

    nonCkdStatsResult.rows.forEach((row: any) => {
      const count = parseInt(row.count);
      const riskLevel = row.risk_level;
      const isMonitored = row.is_monitored;

      nonCkdStats.total += count;

      if (nonCkdStats[riskLevel]) {
        nonCkdStats[riskLevel].total += count;
        if (isMonitored) {
          nonCkdStats[riskLevel].monitored += count;
        } else {
          nonCkdStats[riskLevel].not_monitored += count;
        }
      }
    });

    // Get health state change statistics
    const healthStateChangeStats: any = {
      days_7: { total: 0, improved: 0, worsened: 0 },
      days_30: { total: 0, improved: 0, worsened: 0 },
      days_90: { total: 0, improved: 0, worsened: 0 }
    };

    // Query for 7 days
    const stats7DaysResult = await pool.query(`
      SELECT
        change_type,
        COUNT(DISTINCT patient_id) as count
      FROM patient_health_state_comments
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND visibility = 'visible'
        AND change_type IN ('improved', 'worsened', 'stable')
      GROUP BY change_type
    `);

    stats7DaysResult.rows.forEach((row: any) => {
      const count = parseInt(row.count);
      healthStateChangeStats.days_7.total += count;
      if (row.change_type === 'improved') {
        healthStateChangeStats.days_7.improved = count;
      } else if (row.change_type === 'worsened') {
        healthStateChangeStats.days_7.worsened = count;
      }
    });

    // Query for 30 days
    const stats30DaysResult = await pool.query(`
      SELECT
        change_type,
        COUNT(DISTINCT patient_id) as count
      FROM patient_health_state_comments
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND visibility = 'visible'
        AND change_type IN ('improved', 'worsened', 'stable')
      GROUP BY change_type
    `);

    stats30DaysResult.rows.forEach((row: any) => {
      const count = parseInt(row.count);
      healthStateChangeStats.days_30.total += count;
      if (row.change_type === 'improved') {
        healthStateChangeStats.days_30.improved = count;
      } else if (row.change_type === 'worsened') {
        healthStateChangeStats.days_30.worsened = count;
      }
    });

    // Query for 90 days
    const stats90DaysResult = await pool.query(`
      SELECT
        change_type,
        COUNT(DISTINCT patient_id) as count
      FROM patient_health_state_comments
      WHERE created_at >= NOW() - INTERVAL '90 days'
        AND visibility = 'visible'
        AND change_type IN ('improved', 'worsened', 'stable')
      GROUP BY change_type
    `);

    stats90DaysResult.rows.forEach((row: any) => {
      const count = parseInt(row.count);
      healthStateChangeStats.days_90.total += count;
      if (row.change_type === 'improved') {
        healthStateChangeStats.days_90.improved = count;
      } else if (row.change_type === 'worsened') {
        healthStateChangeStats.days_90.worsened = count;
      }
    });

    // Calculate total patient count as sum of CKD and non-CKD patients
    // This ensures the total matches the breakdown (CKD + non-CKD)
    const totalPatients = ckdStats.total + nonCkdStats.total;

    res.json({
      status: 'success',
      statistics: {
        total_patients: totalPatients,
        ckd: ckdStats,
        non_ckd: nonCkdStats,
        health_state_changes: healthStateChangeStats
      }
    });

  } catch (error) {
    console.error('[Patients API] Error fetching statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch patient statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/patients/:id
 * Get complete patient details including observations, conditions, and risk assessments
 * NOTE: This route MUST be defined after specific routes like /statistics
 */
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Get patient basic info with tracking data from new tables
    const patientResult = await pool.query(`
      SELECT
        p.*,
        -- CKD patient tracking data
        cpd.is_treated as ckd_is_treated,
        cpd.is_monitored as ckd_is_monitored,
        cpd.monitoring_device as ckd_monitoring_device,
        cpd.monitoring_frequency as ckd_monitoring_frequency,
        cpd.last_monitoring_date as ckd_last_monitoring_date,
        -- Non-CKD patient tracking data
        npd.is_monitored as non_ckd_is_monitored,
        npd.monitoring_device as non_ckd_monitoring_device,
        npd.monitoring_frequency as non_ckd_monitoring_frequency,
        npd.last_monitoring_date as non_ckd_last_monitoring_date
      FROM patients p
      LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
      LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
      WHERE p.id = $1
    `, [id]);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    const patient = patientResult.rows[0];

    const observationsResult = await pool.query(`
      SELECT
        observation_type,
        value_numeric,
        value_text,
        unit,
        observation_date,
        notes,
        month_number
      FROM observations
      WHERE patient_id = $1
      ORDER BY observation_type, month_number DESC
    `, [id]);

    // Get latest observations for KDIGO calculation (most recent cycle only)
    const latestObservationsResult = await pool.query(`
      SELECT DISTINCT ON (observation_type)
        observation_type,
        value_numeric,
        value_text,
        unit,
        observation_date,
        notes,
        month_number
      FROM observations
      WHERE patient_id = $1
      ORDER BY observation_type, observation_date DESC
    `, [id]);

    // Get active conditions
    const conditionsResult = await pool.query(`
      SELECT
        condition_code,
        condition_name,
        clinical_status,
        onset_date,
        severity,
        notes
      FROM conditions
      WHERE patient_id = $1
      ORDER BY
        CASE clinical_status
          WHEN 'active' THEN 1
          WHEN 'inactive' THEN 2
          WHEN 'resolved' THEN 3
        END,
        recorded_date DESC
    `, [id]);

    // Get latest risk assessment
    const riskResult = await pool.query(`
      SELECT
        risk_score,
        risk_level,
        recommendations,
        reasoning,
        assessed_at
      FROM risk_assessments
      WHERE patient_id = $1
      ORDER BY assessed_at DESC
      LIMIT 1
    `, [id]);

    // Calculate KDIGO classification using latest observations
    const egfrObs = latestObservationsResult.rows.find(obs => obs.observation_type === 'eGFR');
    const uacrObs = latestObservationsResult.rows.find(obs => obs.observation_type === 'uACR');

    const egfr = egfrObs?.value_numeric || 90;
    const uacr = uacrObs?.value_numeric || 15;

    // Derive comorbidity flags from conditions BEFORE classification
    // (needed for SCORED assessment)
    const conditions = conditionsResult.rows;
    const comorbidities = {
      has_diabetes: conditions.some(c => c.condition_code?.startsWith('E1') && c.clinical_status === 'active'),
      has_type1_diabetes: conditions.some(c => c.condition_code?.startsWith('E10') && c.clinical_status === 'active'),
      has_type2_diabetes: conditions.some(c => c.condition_code?.startsWith('E11') && c.clinical_status === 'active'),
      has_hypertension: conditions.some(c => (c.condition_code?.startsWith('I10') || c.condition_code?.startsWith('I11') || c.condition_code?.startsWith('I12') || c.condition_code?.startsWith('I13')) && c.clinical_status === 'active'),
      has_essential_hypertension: conditions.some(c => c.condition_code === 'I10' && c.clinical_status === 'active'),
      has_heart_failure: conditions.some(c => c.condition_code?.startsWith('I50') && c.clinical_status === 'active'),
      has_cad: conditions.some(c => c.condition_code?.startsWith('I25') && c.clinical_status === 'active'),
      has_mi: conditions.some(c => (c.condition_code?.startsWith('I21') || c.condition_code?.startsWith('I22')) && c.clinical_status === 'active'),
      has_atrial_fibrillation: conditions.some(c => c.condition_code?.startsWith('I48') && c.clinical_status === 'active'),
      has_stroke: conditions.some(c => (c.condition_code?.startsWith('I63') || c.condition_code?.startsWith('I64')) && c.clinical_status === 'active'),
      has_peripheral_vascular_disease: conditions.some(c => c.condition_code?.startsWith('I73') && c.clinical_status === 'active'),
      has_obesity: conditions.some(c => c.condition_code?.startsWith('E66') && c.clinical_status === 'active'),
      has_hyperlipidemia: conditions.some(c => c.condition_code?.startsWith('E78') && c.clinical_status === 'active'),
      has_gout: conditions.some(c => c.condition_code?.startsWith('M10') && c.clinical_status === 'active'),
      has_lupus: conditions.some(c => c.condition_code?.startsWith('M32') && c.clinical_status === 'active'),
      has_ra: conditions.some(c => (c.condition_code?.startsWith('M05') || c.condition_code?.startsWith('M06')) && c.clinical_status === 'active'),
      has_polycystic_kidney_disease: conditions.some(c => c.condition_code?.startsWith('Q61') && c.clinical_status === 'active'),
    };

    // Calculate patient age from date_of_birth
    const birthDate = new Date(patient.date_of_birth);
    const age = Math.floor((new Date().getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    // Calculate BMI from weight and height
    let bmi: number | undefined;
    if (patient.weight && patient.height) {
      // BMI = weight (kg) / (height (m))^2
      const heightInMeters = patient.height / 100; // Convert cm to meters
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

    // Build demographics for SCORED and Framingham assessment
    const demographics = {
      age,
      gender: patient.gender.toLowerCase() as 'male' | 'female',
      has_hypertension: comorbidities.has_hypertension,
      has_diabetes: comorbidities.has_diabetes,
      has_cvd: comorbidities.has_heart_failure || comorbidities.has_cad || comorbidities.has_mi || comorbidities.has_stroke,
      has_pvd: comorbidities.has_peripheral_vascular_disease,
      smoking_status,
      bmi
    };

    // Use SCORED-based classification for proper non-CKD risk assessment
    const kdigoClassification = classifyKDIGOWithSCORED(egfr, uacr, demographics);
    const riskCategory = getRiskCategoryLabel(kdigoClassification);

    // Extract vital signs from latest observations for backward compatibility
    const latestObservations = latestObservationsResult.rows;
    const systolicBP = latestObservations.find(o => o.observation_type === 'blood_pressure_systolic');
    const diastolicBP = latestObservations.find(o => o.observation_type === 'blood_pressure_diastolic');
    const heartRate = latestObservations.find(o => o.observation_type === 'heart_rate');
    const oxygenSat = latestObservations.find(o => o.observation_type === 'oxygen_saturation');
    const bmiObs = latestObservations.find(o => o.observation_type === 'BMI');

    const vitalSigns = {
      systolic_bp: systolicBP?.value_numeric || null,
      diastolic_bp: diastolicBP?.value_numeric || null,
      heart_rate: heartRate?.value_numeric || null,
      oxygen_saturation: oxygenSat?.value_numeric || null,
      bmi: bmiObs?.value_numeric || null,
    };

    // Combine tracking data from new tables with legacy fields (same logic as list endpoint)
    // Use data from tracking tables if available, otherwise fall back to legacy fields
    const is_monitored = kdigoClassification.has_ckd
      ? (patient.ckd_is_monitored !== null ? patient.ckd_is_monitored : patient.home_monitoring_active)
      : (patient.non_ckd_is_monitored !== null ? patient.non_ckd_is_monitored : patient.home_monitoring_active);

    const monitoring_device = kdigoClassification.has_ckd
      ? (patient.ckd_monitoring_device || patient.home_monitoring_device)
      : (patient.non_ckd_monitoring_device || patient.home_monitoring_device);

    const monitoring_frequency = kdigoClassification.has_ckd
      ? (patient.ckd_monitoring_frequency || null)
      : (patient.non_ckd_monitoring_frequency || null);

    // Treatment tracking: Combine tracking table with legacy field (OR logic)
    const is_treated = kdigoClassification.has_ckd
      ? (patient.ckd_is_treated || patient.ckd_treatment_active || false)
      : false;

    res.json({
      status: 'success',
      patient: {
        ...patient,
        observations: observationsResult.rows,
        conditions: conditionsResult.rows,
        risk_assessment: riskResult.rows[0] || null,
        kdigo_classification: kdigoClassification,
        risk_category: riskCategory,
        // Comorbidity flags derived from conditions
        ...comorbidities,
        // Vital signs from observations
        ...vitalSigns,
        // Home monitoring - combined from tracking tables and legacy fields
        home_monitoring_device: monitoring_device || null,
        home_monitoring_active: is_monitored || false,
        monitoring_frequency: monitoring_frequency,
        // Treatment tracking - combined from tracking tables and legacy fields
        ckd_treatment_active: is_treated,
        ckd_treatment_type: patient.ckd_treatment_type || null,
        // Additional tracking data for frontend
        is_treated: is_treated,
        is_monitored: is_monitored
      }
    });

  } catch (error) {
    console.error('[Patients API] Error fetching patient:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch patient',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/patients/:id/update-records
 * Generate AI-powered patient progression with new cycle of lab values
 * Creates realistic progressions based on treatment status
 */
router.post('/:id/update-records', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Get current patient data with latest observations
    const patientResult = await pool.query(`
      SELECT *
      FROM patients
      WHERE id = $1
    `, [id]);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    const patient = patientResult.rows[0];

    // Get patient conditions for comorbidity assessment
    const conditionsResult = await pool.query(`
      SELECT *
      FROM conditions
      WHERE patient_id = $1
    `, [id]);

    // Extract comorbidities from conditions
    const comorbidities = {
      has_diabetes: conditionsResult.rows.some(c => c.condition_code?.startsWith('E11')), // Type 2 Diabetes
      has_hypertension: conditionsResult.rows.some(c => c.condition_code?.startsWith('I10')), // Essential hypertension
      has_heart_failure: conditionsResult.rows.some(c => c.condition_code?.startsWith('I50')), // Heart failure
      has_cad: conditionsResult.rows.some(c => c.condition_code?.startsWith('I25')), // Coronary artery disease
      has_mi: conditionsResult.rows.some(c => c.condition_code?.startsWith('I21')), // Myocardial infarction
      has_stroke: conditionsResult.rows.some(c => c.condition_code?.startsWith('I63')), // Cerebral infarction
      has_peripheral_vascular_disease: conditionsResult.rows.some(c => c.condition_code?.startsWith('I73')), // Peripheral vascular disease
      has_obesity: conditionsResult.rows.some(c => c.condition_code?.startsWith('E66')), // Obesity
      family_history_esrd: conditionsResult.rows.some(c => c.condition_code === 'Z82.49'), // Family history of ESRD
    };

    // Calculate patient age from date_of_birth
    const birthDate = new Date(patient.date_of_birth);
    const age = Math.floor((new Date().getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    // Get latest observations
    const latestObservationsResult = await pool.query(`
      SELECT DISTINCT ON (observation_type)
        observation_type,
        value_numeric,
        value_text,
        unit,
        observation_date,
        month_number
      FROM observations
      WHERE patient_id = $1
      ORDER BY observation_type, observation_date DESC
    `, [id]);

    const latestObs = latestObservationsResult.rows;

    // Get the highest month_number to determine the next cycle
    const maxMonthResult = await pool.query(`
      SELECT COALESCE(MAX(month_number), 0) as max_month
      FROM observations
      WHERE patient_id = $1
    `, [id]);

    let nextMonthNumber = (maxMonthResult.rows[0]?.max_month || 0) + 1;

    // Track if we performed a reset (needed to handle previous values correctly)
    let wasReset = false;

    // Handle observation limit: Reset all data after 12 cycles
    // If we've reached month 13, delete everything and start fresh from month 1
    if (nextMonthNumber > 12) {
      console.log(`[Patient Update] Month ${nextMonthNumber} exceeds limit of 12, resetting patient data...`);
      console.log(`[Patient Update] This will delete ALL observations (months 1-12) and ALL comments`);

      // Delete ALL observations for this patient (complete reset)
      const deleteObsResult = await pool.query(`
        DELETE FROM observations
        WHERE patient_id = $1
      `, [id]);
      console.log(`✓ Deleted ${deleteObsResult.rowCount} observations`);

      // Delete ALL health state comments for this patient (complete reset)
      const deleteCommentsResult = await pool.query(`
        DELETE FROM patient_health_state_comments
        WHERE patient_id = $1
      `, [id]);
      console.log(`✓ Deleted ${deleteCommentsResult.rowCount} comments`);

      // Reset to month 1 (starting a brand new 12-month cycle)
      nextMonthNumber = 1;
      wasReset = true;

      console.log(`✓ Patient data reset complete, starting new cycle from month 1`);
    }

    // Calculate KDIGO classification with SCORED assessment for non-CKD patients
    const egfrObs = latestObs.find(obs => obs.observation_type === 'eGFR');
    const uacrObs = latestObs.find(obs => obs.observation_type === 'uACR');
    const egfr = egfrObs?.value_numeric || 90;
    const uacr = uacrObs?.value_numeric || 15;

    // Calculate BMI from weight and height
    let bmi: number | undefined;
    if (patient.weight && patient.height) {
      // BMI = weight (kg) / (height (m))^2
      const heightInMeters = patient.height / 100; // Convert cm to meters
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

    // Build demographics for SCORED and Framingham assessment
    const demographics = {
      age,
      gender: patient.gender.toLowerCase() as 'male' | 'female',
      has_hypertension: comorbidities.has_hypertension,
      has_diabetes: comorbidities.has_diabetes,
      has_cvd: comorbidities.has_heart_failure || comorbidities.has_cad || comorbidities.has_mi || comorbidities.has_stroke,
      has_pvd: comorbidities.has_peripheral_vascular_disease,
      smoking_status,
      bmi
    };

    const kdigoClassification = classifyKDIGOWithSCORED(egfr, uacr, demographics);

    // Determine treatment and monitoring status
    const isTreated = patient.ckd_treatment_active || false;
    const isMonitored = patient.home_monitoring_active || false;
    const hasCKD = kdigoClassification.has_ckd;

    // =================================================================================
    // PHASE 1: PRE-UPDATE MCP BASELINE ANALYSIS
    // =================================================================================
    // Capture comprehensive baseline assessment BEFORE any changes
    // This includes risk assessment, treatment recommendations, and current health state
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Patient Update] 📊 PHASE 1: PRE-UPDATE BASELINE ANALYSIS`);
    console.log(`[Patient Update] Patient: ${patient.first_name} ${patient.last_name} (${patient.medical_record_number})`);
    console.log(`[Patient Update] Current Cycle: ${nextMonthNumber - 1} → Next Cycle: ${nextMonthNumber}`);
    console.log(`${'='.repeat(80)}\n`);

    let baselineAnalysis = null;
    let mcpBaselineError: string | null = null;
    try {
      const mcpClient = await getMCPClient();
      console.log('[MCP Baseline] Fetching comprehensive baseline analysis...');
      baselineAnalysis = await mcpClient.comprehensiveCKDAnalysis(id);
      console.log('[MCP Baseline] ✅ Baseline analysis complete');
      console.log('[MCP Baseline] Current Health State:', baselineAnalysis?.patient_summary?.current_health_state || 'Unknown');
      console.log('[MCP Baseline] CKD Status:', baselineAnalysis?.patient_summary?.has_ckd ? 'Yes' : 'No');
      console.log('[MCP Baseline] Risk Level:', baselineAnalysis?.patient_summary?.risk_level || 'Unknown');
    } catch (mcpError) {
      const errorMessage = mcpError instanceof Error ? mcpError.message : String(mcpError);
      const errorStack = mcpError instanceof Error ? mcpError.stack : '';
      mcpBaselineError = errorMessage;
      console.error('[MCP Baseline] ⚠️  Error fetching baseline analysis:', errorMessage);
      console.error('[MCP Baseline] Error details:', errorStack);
      console.log('[MCP Baseline] Continuing without baseline analysis...');
      // Don't fail the update if MCP baseline fails
    }

    // =================================================================================
    // PHASE 2: GENERATE NEW LAB VALUES
    // =================================================================================
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Patient Update] 🧪 PHASE 2: GENERATING NEW LAB VALUES`);
    console.log(`${'='.repeat(80)}\n`);

    // Import Anthropic client
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Build context for AI
    const currentLabValues = latestObs.map(obs =>
      `${obs.observation_type}: ${obs.value_numeric} ${obs.unit || ''}`
    ).join('\n');

    const prompt = `You are a clinical data simulator for a CKD (Chronic Kidney Disease) patient tracking system.

PATIENT CONTEXT:
- Patient ID: ${patient.medical_record_number}
- CKD Status: ${hasCKD ? 'Has CKD' : 'No CKD'}
- Treatment Active: ${isTreated ? 'YES' : 'NO'}
- Treatment Type: ${patient.ckd_treatment_type || 'None'}
- Current Month/Cycle: ${nextMonthNumber - 1}

CURRENT LAB VALUES (Latest):
${currentLabValues}

TASK:
Generate realistic lab values for the NEXT cycle (Month ${nextMonthNumber}) based on the following rules:

**IF TREATED (Treatment Active = YES):**
- eGFR: Should stabilize or improve slightly (increase by 1-3 units or stay stable)
- Serum Creatinine: Should stabilize or decrease slightly
- uACR: Should decrease (treatment reducing proteinuria)
- Blood Pressure: Should improve towards target (130/80)
- HbA1c: If diabetic, should improve slightly
- Other values: Show improvement or stabilization

**IF NOT TREATED (Treatment Active = NO):**
- eGFR: Should decline (decrease by 2-5 units) - kidney function worsening
- Serum Creatinine: Should increase
- uACR: Should increase (more protein leakage)
- Blood Pressure: May increase or stay elevated
- HbA1c: If diabetic, may worsen or stay high
- Other values: Show gradual worsening

IMPORTANT CONSTRAINTS:
1. Changes should be gradual and realistic (no sudden jumps)
2. Values must stay within physiologically plausible ranges
3. Maintain consistency with the clinical trajectory
4. Consider the patient's baseline values

OUTPUT FORMAT (JSON only, no explanations):
{
  "eGFR": number,
  "serum_creatinine": number,
  "BUN": number,
  "uACR": number,
  "blood_pressure_systolic": number,
  "blood_pressure_diastolic": number,
  "HbA1c": number,
  "glucose": number,
  "potassium": number,
  "sodium": number,
  "hemoglobin": number,
  "heart_rate": number,
  "oxygen_saturation": number,
  "reasoning": "brief explanation of the trajectory"
}

Provide ONLY the JSON object, nothing else.`;

    // Call Claude AI to generate new values
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const textContent = response.content.find(block => block.type === 'text');
    const aiResponseText = textContent ? (textContent as any).text : '{}';

    // Parse AI response - extract JSON from potential markdown code blocks
    let generatedValues;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = aiResponseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       aiResponseText.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, aiResponseText];
      const jsonText = jsonMatch[1] || aiResponseText;
      generatedValues = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponseText);
      throw new Error('AI generated invalid response format');
    }

    // Validate and coerce AI-generated values to ensure they are proper numbers
    // This prevents "toFixed is not a function" errors when values are strings/null/undefined
    const validateAndCoerceNumber = (value: any, fallback: number): number => {
      if (value === null || value === undefined) return fallback;
      const num = Number(value);
      return isNaN(num) ? fallback : num;
    };

    // Coerce all generated values to numbers with sensible fallbacks based on current values
    generatedValues = {
      eGFR: validateAndCoerceNumber(generatedValues.eGFR, egfr),
      serum_creatinine: validateAndCoerceNumber(generatedValues.serum_creatinine, 1.0),
      BUN: validateAndCoerceNumber(generatedValues.BUN, 15),
      uACR: validateAndCoerceNumber(generatedValues.uACR, uacr),
      blood_pressure_systolic: validateAndCoerceNumber(generatedValues.blood_pressure_systolic, 130),
      blood_pressure_diastolic: validateAndCoerceNumber(generatedValues.blood_pressure_diastolic, 80),
      HbA1c: validateAndCoerceNumber(generatedValues.HbA1c, 6.0),
      glucose: validateAndCoerceNumber(generatedValues.glucose, 100),
      potassium: validateAndCoerceNumber(generatedValues.potassium, 4.5),
      sodium: validateAndCoerceNumber(generatedValues.sodium, 140),
      hemoglobin: validateAndCoerceNumber(generatedValues.hemoglobin, 14),
      heart_rate: validateAndCoerceNumber(generatedValues.heart_rate, 72),
      oxygen_saturation: validateAndCoerceNumber(generatedValues.oxygen_saturation, 98),
      reasoning: generatedValues.reasoning || 'Values generated based on patient trajectory'
    };

    console.log('[Patient Update] Validated generated values:', {
      eGFR: generatedValues.eGFR,
      uACR: generatedValues.uACR,
      serum_creatinine: generatedValues.serum_creatinine
    });

    // Calculate new observation date (1 month from latest)
    const latestDate = new Date(egfrObs?.observation_date || new Date());
    const newDate = new Date(latestDate);
    newDate.setMonth(newDate.getMonth() + 1);

    // Calculate previous health state for comparison
    // After a reset, there is no previous state
    const previousHealthState = wasReset ? null : kdigoClassification.health_state;
    const previousRiskLevel = wasReset ? null : kdigoClassification.risk_level;

    // Insert new observations into database
    const observationsToInsert = [
      { type: 'eGFR', value: generatedValues.eGFR, unit: 'mL/min/1.73m²' },
      { type: 'serum_creatinine', value: generatedValues.serum_creatinine, unit: 'mg/dL' },
      { type: 'BUN', value: generatedValues.BUN, unit: 'mg/dL' },
      { type: 'uACR', value: generatedValues.uACR, unit: 'mg/g' },
      { type: 'blood_pressure_systolic', value: generatedValues.blood_pressure_systolic, unit: 'mmHg' },
      { type: 'blood_pressure_diastolic', value: generatedValues.blood_pressure_diastolic, unit: 'mmHg' },
      { type: 'HbA1c', value: generatedValues.HbA1c, unit: '%' },
      { type: 'glucose', value: generatedValues.glucose, unit: 'mg/dL' },
      { type: 'potassium', value: generatedValues.potassium, unit: 'mEq/L' },
      { type: 'sodium', value: generatedValues.sodium, unit: 'mEq/L' },
      { type: 'hemoglobin', value: generatedValues.hemoglobin, unit: 'g/dL' },
      { type: 'heart_rate', value: generatedValues.heart_rate, unit: 'bpm' },
      { type: 'oxygen_saturation', value: generatedValues.oxygen_saturation, unit: '%' },
    ];

    for (const obs of observationsToInsert) {
      if (obs.value !== undefined && obs.value !== null) {
        await pool.query(`
          INSERT INTO observations (patient_id, observation_type, value_numeric, unit, observation_date, month_number, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'final')
        `, [id, obs.type, obs.value, obs.unit, newDate, nextMonthNumber]);
      }
    }

    // Calculate new health state after inserting observations (with SCORED for non-CKD)
    const newKdigoClassification = classifyKDIGOWithSCORED(generatedValues.eGFR, generatedValues.uACR, demographics);

    // Detect CKD status transition (non-CKD → CKD or CKD → non-CKD)
    const previousHasCKD = kdigoClassification.has_ckd;
    const currentHasCKD = newKdigoClassification.has_ckd;
    const hasTransitioned = previousHasCKD !== currentHasCKD;

    if (hasTransitioned) {
      console.log(`[Patient Update] 🔄 CKD STATUS TRANSITION DETECTED for patient ${id}`);
      console.log(`  Previous: ${previousHasCKD ? 'CKD' : 'Non-CKD'} → Current: ${currentHasCKD ? 'CKD' : 'Non-CKD'}`);
      console.log(`  Previous state: ${kdigoClassification.health_state} → Current state: ${newKdigoClassification.health_state}`);

      // Create alert for CKD transition
      try {
        const transitionType = currentHasCKD ? 'non-ckd-to-ckd' : 'ckd-to-non-ckd';
        const subject = currentHasCKD
          ? `🚨 New CKD Diagnosis: ${patient.first_name} ${patient.last_name} (MRN: ${patient.medical_record_number})`
          : `Positive Change: CKD Resolution for ${patient.first_name} ${patient.last_name} (MRN: ${patient.medical_record_number})`;

        const message = currentHasCKD
          ? `Patient has transitioned from high-risk non-CKD to CKD.\n\n` +
            `New Classification: ${newKdigoClassification.health_state} (${newKdigoClassification.ckd_stage_name})\n` +
            `Risk Level: ${newKdigoClassification.risk_level}\n` +
            `eGFR: ${egfr.toFixed(1)} → ${generatedValues.eGFR.toFixed(1)} mL/min/1.73m²\n` +
            `uACR: ${uacr.toFixed(1)} → ${generatedValues.uACR.toFixed(1)} mg/g\n\n` +
            `Action Required: Review patient for CKD management protocol initiation.`
          : `Patient has improved from CKD to non-CKD status.\n\n` +
            `New Classification: ${newKdigoClassification.health_state}\n` +
            `Risk Level: ${newKdigoClassification.risk_level}\n` +
            `eGFR: ${egfr.toFixed(1)} → ${generatedValues.eGFR.toFixed(1)} mL/min/1.73m²\n` +
            `uACR: ${uacr.toFixed(1)} → ${generatedValues.uACR.toFixed(1)} mg/g\n\n` +
            `Continue monitoring and maintain current treatment plan.`;

        const priority = currentHasCKD ? 'CRITICAL' : 'HIGH';
        const notificationType = currentHasCKD ? 'critical_alert' : 'state_change';

        const alertSummary = {
          transition_type: transitionType,
          previous_has_ckd: previousHasCKD,
          current_has_ckd: currentHasCKD,
          previous_health_state: kdigoClassification.health_state,
          current_health_state: newKdigoClassification.health_state,
          previous_egfr: egfr,
          current_egfr: generatedValues.eGFR,
          previous_uacr: uacr,
          current_uacr: generatedValues.uACR,
          timestamp: new Date().toISOString(),
          cycle_number: nextMonthNumber
        };

        // Insert notification into database
        await pool.query(`
          INSERT INTO doctor_notifications (
            patient_id,
            notification_type,
            priority,
            subject,
            message,
            doctor_email,
            doctor_name,
            status,
            alert_summary
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [
          id,
          notificationType,
          priority,
          subject,
          message,
          'doctor@example.com',
          'Primary Care Provider',
          'pending',
          JSON.stringify(alertSummary)
        ]);

        console.log(`✓ CKD transition alert created: ${subject} [${priority}]`);

        // Send email notification
        try {
          const emailService = new EmailService(pool);
          await emailService.sendNotification({
            to: '', // Will be determined by email config
            subject,
            message,
            priority,
            patientName: `${patient.first_name} ${patient.last_name}`,
            mrn: patient.medical_record_number,
          });
          console.log(`✓ Email notification sent for CKD transition`);
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
          // Don't fail the update if email fails
        }
      } catch (alertError) {
        console.error('[Patient Update] Error creating CKD transition alert:', alertError);
        // Don't fail the update if alert creation fails
      }
    }

    // Update patient data tables with new health state
    // Handle transitions between CKD and non-CKD status
    if (currentHasCKD) {
      if (hasTransitioned) {
        // Transition: non-CKD → CKD
        console.log(`[Patient Update] Moving patient from non_ckd_patient_data to ckd_patient_data`);

        // Delete from non_ckd_patient_data
        await pool.query(`DELETE FROM non_ckd_patient_data WHERE patient_id = $1`, [id]);

        // Insert into ckd_patient_data
        await pool.query(`
          INSERT INTO ckd_patient_data (
            patient_id, kdigo_health_state, kdigo_gfr_category,
            kdigo_albuminuria_category, ckd_severity, ckd_stage,
            is_treated, is_monitored
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          id,
          newKdigoClassification.health_state,
          newKdigoClassification.gfr_category,
          newKdigoClassification.albuminuria_category,
          getCKDSeverity(newKdigoClassification.ckd_stage),
          newKdigoClassification.ckd_stage,
          patient.ckd_treatment_active || false,
          patient.home_monitoring_active || false
        ]);
        console.log(`✓ Created new ckd_patient_data entry for patient (transitioned to CKD)`);
      } else {
        // No transition - just update existing CKD record
        await pool.query(`
          UPDATE ckd_patient_data
          SET kdigo_health_state = $1,
              kdigo_gfr_category = $2,
              kdigo_albuminuria_category = $3,
              ckd_severity = $4,
              ckd_stage = $5,
              updated_at = CURRENT_TIMESTAMP
          WHERE patient_id = $6
        `, [
          newKdigoClassification.health_state,
          newKdigoClassification.gfr_category,
          newKdigoClassification.albuminuria_category,
          getCKDSeverity(newKdigoClassification.ckd_stage),
          newKdigoClassification.ckd_stage,
          id
        ]);
        console.log(`✓ Updated ckd_patient_data with new health state: ${newKdigoClassification.health_state}`);
      }
    } else {
      if (hasTransitioned) {
        // Transition: CKD → non-CKD (rare but possible with treatment)
        console.log(`[Patient Update] Moving patient from ckd_patient_data to non_ckd_patient_data`);

        // Delete from ckd_patient_data
        await pool.query(`DELETE FROM ckd_patient_data WHERE patient_id = $1`, [id]);

        // Insert into non_ckd_patient_data
        await pool.query(`
          INSERT INTO non_ckd_patient_data (
            patient_id, kdigo_health_state, risk_level, is_monitored
          ) VALUES ($1, $2, $3, $4)
        `, [
          id,
          newKdigoClassification.health_state,
          newKdigoClassification.risk_level === 'very_high' ? 'high' : newKdigoClassification.risk_level,
          patient.home_monitoring_active || false
        ]);
        console.log(`✓ Created new non_ckd_patient_data entry for patient (transitioned to non-CKD)`);
      } else {
        // No transition - just update existing non-CKD record
        await pool.query(`
          UPDATE non_ckd_patient_data
          SET kdigo_health_state = $1,
              risk_level = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE patient_id = $3
        `, [
          newKdigoClassification.health_state,
          newKdigoClassification.risk_level === 'very_high' ? 'high' : newKdigoClassification.risk_level,
          id
        ]);
        console.log(`✓ Updated non_ckd_patient_data with new health state: ${newKdigoClassification.health_state}`);
      }
    }
    const newHealthState = newKdigoClassification.health_state;
    const newRiskLevel = newKdigoClassification.risk_level;

    // Check if health state changed and generate comment
    // After reset, always create an initial comment (no previous state)
    let commentId = null;
    if (wasReset || previousHealthState !== newHealthState) {
      if (wasReset) {
        console.log(`[Patient Update] Creating initial comment after reset for patient ${id}`);
      } else {
        console.log(`[Patient Update] Health state changed for patient ${id}: ${previousHealthState} -> ${newHealthState}`);
      }

      try {
        const commentService = new HealthStateCommentService(pool);
        commentId = await commentService.createCommentForHealthStateChange({
          patient_id: id,
          from_health_state: previousHealthState,
          to_health_state: newHealthState,
          from_risk_level: previousRiskLevel,
          to_risk_level: newRiskLevel,
          egfr_from: wasReset ? null : egfr,
          egfr_to: generatedValues.eGFR,
          uacr_from: wasReset ? null : uacr,
          uacr_to: generatedValues.uACR,
          cycle_number: nextMonthNumber,
          is_ckd_patient: newKdigoClassification.has_ckd
        });

        console.log(`✓ Health state comment created: ${commentId}`);
      } catch (commentError) {
        console.error('[Patient Update] Error creating health state comment:', commentError);
        // Don't fail the update if comment creation fails
      }
    }

    // =================================================================================
    // PHASE 3: POST-UPDATE MCP COMPARATIVE ANALYSIS
    // =================================================================================
    // Capture comprehensive post-update assessment AFTER all changes
    // This will be compared with baseline to generate comprehensive report
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Patient Update] 📊 PHASE 3: POST-UPDATE COMPARATIVE ANALYSIS`);
    console.log(`${'='.repeat(80)}\n`);

    let postUpdateAnalysis = null;
    let mcpPostUpdateError: string | null = null;
    try {
      const mcpClient = await getMCPClient();
      console.log('[MCP Post-Update] Fetching comprehensive post-update analysis...');
      postUpdateAnalysis = await mcpClient.comprehensiveCKDAnalysis(id);
      console.log('[MCP Post-Update] ✅ Post-update analysis complete');
      console.log('[MCP Post-Update] New Health State:', postUpdateAnalysis?.patient_summary?.current_health_state || 'Unknown');
      console.log('[MCP Post-Update] New CKD Status:', postUpdateAnalysis?.patient_summary?.has_ckd ? 'Yes' : 'No');
      console.log('[MCP Post-Update] New Risk Level:', postUpdateAnalysis?.patient_summary?.risk_level || 'Unknown');

      // Log comparison if both baseline and post-update analyses are available
      if (baselineAnalysis && postUpdateAnalysis) {
        console.log('\n[MCP Comparison] 🔄 Changes Detected:');
        const baselineState = baselineAnalysis.patient_summary?.current_health_state;
        const postUpdateState = postUpdateAnalysis.patient_summary?.current_health_state;
        if (baselineState !== postUpdateState) {
          console.log(`  ⚠️  Health State: ${baselineState} → ${postUpdateState}`);
        } else {
          console.log(`  ℹ️  Health State: ${postUpdateState} (unchanged)`);
        }

        const baselineEGFR = baselineAnalysis.patient_summary?.latest_egfr;
        const postUpdateEGFR = postUpdateAnalysis.patient_summary?.latest_egfr;
        if (baselineEGFR && postUpdateEGFR) {
          const egfrChange = postUpdateEGFR - baselineEGFR;
          console.log(`  📉 eGFR: ${baselineEGFR.toFixed(1)} → ${postUpdateEGFR.toFixed(1)} (${egfrChange > 0 ? '+' : ''}${egfrChange.toFixed(1)} mL/min/1.73m²)`);
        }

        const baselineUACR = baselineAnalysis.patient_summary?.latest_uacr;
        const postUpdateUACR = postUpdateAnalysis.patient_summary?.latest_uacr;
        if (baselineUACR && postUpdateUACR) {
          const uacrChange = postUpdateUACR - baselineUACR;
          console.log(`  📊 uACR: ${baselineUACR.toFixed(1)} → ${postUpdateUACR.toFixed(1)} (${uacrChange > 0 ? '+' : ''}${uacrChange.toFixed(1)} mg/g)`);
        }
        console.log('');
      }
    } catch (mcpError) {
      const errorMessage = mcpError instanceof Error ? mcpError.message : String(mcpError);
      const errorStack = mcpError instanceof Error ? mcpError.stack : '';
      mcpPostUpdateError = errorMessage;
      console.error('[MCP Post-Update] ⚠️  Error fetching post-update analysis:', errorMessage);
      console.error('[MCP Post-Update] Error details:', errorStack);
      console.log('[MCP Post-Update] Continuing without post-update analysis...');
      // Don't fail the update if MCP post-update fails
    }

    // =================================================================================
    // PHASE 4: COMPREHENSIVE AI-POWERED COMPARATIVE REPORT
    // =================================================================================
    // Generate extensive report comparing baseline vs post-update with MCP insights
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Patient Update] 🤖 PHASE 4: GENERATING COMPREHENSIVE AI REPORT`);
    console.log(`${'='.repeat(80)}\n`);

    // Generate AI-powered update analysis comment
    // Skip AI analysis after reset since there's no previous data to compare
    let aiCommentId = null;
    if (!wasReset) {
      console.log(`[Patient Update] Generating comprehensive AI analysis for patient ${id}...`);

      // Declare these outside try block so they're accessible in catch block
      const aiAnalysisService = new AIUpdateAnalysisService(pool);

      // Prepare previous lab values from the latest observations before this update
      const previousLabValues = {
        egfr,
        uacr,
        creatinine: latestObs.find(obs => obs.observation_type === 'serum_creatinine')?.value_numeric,
        bun: latestObs.find(obs => obs.observation_type === 'BUN')?.value_numeric,
        systolic_bp: latestObs.find(obs => obs.observation_type === 'blood_pressure_systolic')?.value_numeric,
        diastolic_bp: latestObs.find(obs => obs.observation_type === 'blood_pressure_diastolic')?.value_numeric,
        hba1c: latestObs.find(obs => obs.observation_type === 'HbA1c')?.value_numeric,
        glucose: latestObs.find(obs => obs.observation_type === 'glucose')?.value_numeric,
        hemoglobin: latestObs.find(obs => obs.observation_type === 'hemoglobin')?.value_numeric,
        heart_rate: latestObs.find(obs => obs.observation_type === 'heart_rate')?.value_numeric,
        oxygen_saturation: latestObs.find(obs => obs.observation_type === 'oxygen_saturation')?.value_numeric,
      };

      // Prepare new lab values
      const newLabValues = {
        egfr: generatedValues.eGFR,
        uacr: generatedValues.uACR,
        creatinine: generatedValues.serum_creatinine,
        bun: generatedValues.BUN,
        systolic_bp: generatedValues.blood_pressure_systolic,
        diastolic_bp: generatedValues.blood_pressure_diastolic,
        hba1c: generatedValues.HbA1c,
        glucose: generatedValues.glucose,
        hemoglobin: generatedValues.hemoglobin,
        heart_rate: generatedValues.heart_rate,
        oxygen_saturation: generatedValues.oxygen_saturation,
      };

      try {

      // Calculate patient age
      const birthDate = new Date(patient.date_of_birth);
      const age = Math.floor((new Date().getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      // Fetch GCUA assessment data for patients 60+ (REPLACES SCORED/Framingham)
      let gcuaData: any = null;
      if (age >= 60) {
        try {
          const gcuaResult = await pool.query(`
            SELECT
              phenotype_type, phenotype_name, phenotype_tag, phenotype_color,
              module1_five_year_risk, module1_risk_category,
              module2_ten_year_risk, module2_risk_category,
              module3_five_year_mortality, module3_risk_category,
              benefit_ratio, benefit_ratio_interpretation,
              confidence_level, data_completeness,
              home_monitoring_recommended
            FROM patient_gcua_assessments
            WHERE patient_id = $1
            ORDER BY assessed_at DESC
            LIMIT 1
          `, [id]);
          if (gcuaResult.rows.length > 0) {
            gcuaData = gcuaResult.rows[0];
            console.log(`[Patient Update] GCUA assessment found for patient ${id}: ${gcuaData.phenotype_type} - ${gcuaData.phenotype_name}`);
          }
        } catch (gcuaError) {
          console.error('[Patient Update] Error fetching GCUA data:', gcuaError);
          // Continue without GCUA data
        }
      }

      // Prepare patient context with KDIGO clinical recommendations and GCUA data
      const patientContext = {
        patientId: id,
        firstName: patient.first_name,
        lastName: patient.last_name,
        age,
        isCkd: currentHasCKD,  // FIXED: Use current CKD status, not previous
        currentHealthState: newHealthState,
        previousHealthState: previousHealthState || undefined,
        treatmentActive: isTreated,
        treatmentType: patient.ckd_treatment_type,
        monitoringActive: isMonitored,
        monitoringDevice: patient.home_monitoring_device,
        cycleNumber: nextMonthNumber,
        previousCycleNumber: nextMonthNumber - 1,
        // CKD status transition information
        hasTransitioned,
        transitionType: hasTransitioned ? (currentHasCKD ? 'non-ckd-to-ckd' as const : 'ckd-to-non-ckd' as const) : undefined,
        // Include KDIGO clinical recommendations to guide AI analysis
        recommendRasInhibitor: newKdigoClassification.recommend_ras_inhibitor,
        recommendSglt2i: newKdigoClassification.recommend_sglt2i,
        requiresNephrologyReferral: newKdigoClassification.requires_nephrology_referral,
        riskLevel: newKdigoClassification.risk_level,
        gfrCategory: newKdigoClassification.gfr_category,
        albuminuriaCategory: newKdigoClassification.albuminuria_category,
        // Include GCUA assessment data for patients 60+ (REPLACES SCORED/Framingham)
        gcua_phenotype_type: gcuaData?.phenotype_type || undefined,
        gcua_phenotype_name: gcuaData?.phenotype_name || undefined,
        gcua_renal_risk: gcuaData?.module1_five_year_risk || undefined,
        gcua_renal_risk_category: gcuaData?.module1_risk_category || undefined,
        gcua_cvd_risk: gcuaData?.module2_ten_year_risk || undefined,
        gcua_cvd_risk_category: gcuaData?.module2_risk_category || undefined,
        gcua_mortality_risk: gcuaData?.module3_five_year_mortality || undefined,
        gcua_mortality_risk_category: gcuaData?.module3_risk_category || undefined,
        gcua_benefit_ratio: gcuaData?.benefit_ratio || undefined,
        gcua_benefit_ratio_interpretation: gcuaData?.benefit_ratio_interpretation || undefined,
        gcua_confidence_level: gcuaData?.confidence_level || undefined,
        gcua_home_monitoring_recommended: gcuaData?.home_monitoring_recommended || undefined,
        // Include demographics and comorbidities for context
        gender: patient.gender.toLowerCase() as 'male' | 'female',
        has_hypertension: comorbidities.has_hypertension,
        has_diabetes: comorbidities.has_diabetes,
        has_cvd: comorbidities.has_heart_failure || comorbidities.has_cad || comorbidities.has_mi || comorbidities.has_stroke,
        has_pvd: comorbidities.has_peripheral_vascular_disease,
        smoking_status,
        bmi,
        // ⭐ CRITICAL: MCP Baseline and Post-Update Comprehensive Analyses ⭐
        // These contain complete clinical decision support data including:
        // - Treatment recommendations (Jardiance, RAS inhibitors, home monitoring)
        // - Risk stratification and progression analysis
        // - Lifestyle and dietary modifications
        // - Medication safety assessments
        // - Protocol adherence tracking
        mcpBaselineAnalysis: baselineAnalysis || undefined,
        mcpPostUpdateAnalysis: postUpdateAnalysis || undefined,
        mcpBaselineError: mcpBaselineError || undefined,
        mcpPostUpdateError: mcpPostUpdateError || undefined,
      };

      console.log(`\n${'='.repeat(80)}`);
      console.log(`[Patient Update] 🤖 INITIATING AI ANALYSIS SERVICE`);
      console.log(`${'='.repeat(80)}\n`);

      // Call AI analysis service
      const aiAnalysis = await aiAnalysisService.analyzePatientUpdate(
        patientContext,
        previousLabValues,
        newLabValues
      );

      console.log(`\n${'='.repeat(80)}`);
      console.log(`[Patient Update] 📝 DECIDING WHETHER TO CREATE AI COMMENT`);
      console.log(`${'='.repeat(80)}`);
      console.log(`AI Analysis Significance Flag: ${aiAnalysis.hasSignificantChanges}`);
      console.log(`Decision: ${aiAnalysis.hasSignificantChanges ? 'CREATE COMMENT' : 'SKIP COMMENT (stable patient)'}`);
      console.log(`${'='.repeat(80)}\n`);

      // Only create AI-generated comment if there are significant changes OR a CKD transition
      // This prevents unnecessary alerts for stable patients with no meaningful changes
      if (aiAnalysis.hasSignificantChanges) {
        console.log(`[Patient Update] ✅ Creating AI comment (significant changes detected)...`);

        aiCommentId = await aiAnalysisService.createAIUpdateComment(
          id,
          aiAnalysis,
          nextMonthNumber,
          previousLabValues,
          newLabValues
        );

        console.log(`[Patient Update] ✓ AI update analysis comment created with ID: ${aiCommentId}`);
      } else {
        console.log(`[Patient Update] ⊘ Skipping AI comment creation - patient stable with no significant changes`);
        console.log(`[Patient Update]    This prevents unnecessary alert fatigue for clinicians`);

        // However, if no health state comment was created either, we should create a basic stable comment
        // This ensures the patient list always has an evolution summary to display
        if (!commentId && !aiCommentId) {
          console.log(`[Patient Update] 📝 Creating stable patient comment for list display...`);
          try {
            // Create a basic stable comment using the AI analysis data
            aiCommentId = await aiAnalysisService.createAIUpdateComment(
              id,
              {
                ...aiAnalysis,
                hasSignificantChanges: true, // Override to force comment creation
                commentText: aiAnalysis.commentText || 'Patient status stable. Continue current management plan.',
                clinicalSummary: aiAnalysis.clinicalSummary || 'No significant changes in kidney function markers.',
                recommendedActions: aiAnalysis.recommendedActions && aiAnalysis.recommendedActions.length > 0
                  ? aiAnalysis.recommendedActions
                  : ['Continue current treatment and monitoring schedule'],
                severity: 'info'
              },
              nextMonthNumber,
              previousLabValues,
              newLabValues
            );
            console.log(`[Patient Update] ✓ Stable patient comment created with ID: ${aiCommentId}`);
          } catch (stableCommentError) {
            console.error('[Patient Update] Error creating stable patient comment:', stableCommentError);
            // Don't fail the update if stable comment creation fails
          }
        }
      }

      // Send email notification if CKD status transition occurred
      if (hasTransitioned) {
        try {
          console.log(`[Patient Update] 📧 Sending email notification for CKD status transition...`);
          const emailService = new EmailService(pool);

          const transitionMessage = currentHasCKD
            ? `Patient ${patient.first_name} ${patient.last_name} has transitioned from Non-CKD to CKD status.\n\n` +
              `New Classification: ${newKdigoClassification.ckd_stage_name} (${newHealthState})\n` +
              `Risk Level: ${newKdigoClassification.risk_level}\n\n` +
              `Latest Lab Values:\n` +
              `- eGFR: ${generatedValues.eGFR.toFixed(1)} mL/min/1.73m²\n` +
              `- uACR: ${generatedValues.uACR.toFixed(1)} mg/g\n\n` +
              `Clinical Recommendations:\n` +
              `${newKdigoClassification.recommend_ras_inhibitor ? '- RAS Inhibitor (ACE-I/ARB) recommended\n' : ''}` +
              `${newKdigoClassification.recommend_sglt2i ? '- SGLT2 Inhibitor recommended\n' : ''}` +
              `${newKdigoClassification.requires_nephrology_referral ? '- Nephrology referral required\n' : ''}` +
              `- Target BP: ${newKdigoClassification.target_bp}\n` +
              `- Monitoring Frequency: ${newKdigoClassification.monitoring_frequency}\n\n` +
              `Please review the patient's record for detailed AI analysis and recommendations.`
            : `Patient ${patient.first_name} ${patient.last_name} has transitioned from CKD to Non-CKD status.\n\n` +
              `Previous Classification: ${kdigoClassification.ckd_stage_name}\n` +
              `New Status: Non-CKD (${newHealthState})\n\n` +
              `Latest Lab Values:\n` +
              `- eGFR: ${generatedValues.eGFR.toFixed(1)} mL/min/1.73m²\n` +
              `- uACR: ${generatedValues.uACR.toFixed(1)} mg/g\n\n` +
              `This indicates improvement in kidney function. Continue monitoring per guidelines.`;

          // Get assigned doctor(s) for this patient
          const transitionAssignedDoctors = await pool.query(
            `SELECT doctor_email, doctor_name, is_primary
             FROM doctor_patient_assignments
             WHERE patient_id = $1 AND is_primary = true`,
            [id]
          );

          const transitionEmailConfig = await emailService.getConfig();
          const transitionRecipients = new Set<string>();

          // Add assigned doctor's email if exists
          if (transitionAssignedDoctors.rows.length > 0) {
            for (const assignment of transitionAssignedDoctors.rows) {
              transitionRecipients.add(assignment.doctor_email);
              console.log(`[CKD Transition] Adding assigned doctor: ${assignment.doctor_email}`);
            }
          }

          // Also add configured doctor email as fallback
          if (transitionEmailConfig) {
            transitionRecipients.add(transitionEmailConfig.doctor_email);
          }

          // Send to all recipients
          for (const recipientEmail of transitionRecipients) {
            await emailService.sendNotification({
              to: recipientEmail,
              subject: currentHasCKD
                ? `🚨 CRITICAL: Patient Transitioned to CKD Status - ${patient.first_name} ${patient.last_name}`
                : `✅ Patient Improved: Transitioned from CKD to Non-CKD - ${patient.first_name} ${patient.last_name}`,
              message: transitionMessage,
              priority: currentHasCKD ? 'CRITICAL' : 'MODERATE',
              patientName: `${patient.first_name} ${patient.last_name}`,
              mrn: patient.medical_record_number
            });
            console.log(`✓ CKD transition email sent to ${recipientEmail}`);
          }

          console.log(`✓ Email notification sent for CKD status transition to ${transitionRecipients.size} recipient(s)`);
        } catch (emailError) {
          console.error('[Patient Update] Error sending email notification:', emailError);
          // Don't fail the update if email fails
        }
      }
    } catch (aiError) {
      console.error('[Patient Update] Error generating AI update analysis:', aiError);

      // Create a fallback basic comment if AI analysis fails
      try {
        console.log(`[Patient Update] Creating fallback comment due to AI error...`);

        const recommendedAction = isTreated
          ? 'Continue current management plan'
          : (hasCKD && newKdigoClassification.ckd_stage && newKdigoClassification.ckd_stage >= 3)
            ? 'Consider initiating CKD treatment per clinical guidelines'
            : 'Continue monitoring';

        const fallbackComment = {
          hasSignificantChanges: true,
          commentText: `Lab values updated for cycle ${nextMonthNumber}.`,
          clinicalSummary: `Routine lab update completed. ${!isTreated && hasCKD ? 'Patient not currently on CKD treatment - consider initiating therapy.' : 'Continue current management.'}`,
          keyChanges: [`Cycle ${nextMonthNumber} completed`, `eGFR: ${generatedValues.eGFR.toFixed(1)} mL/min/1.73m²`, `uACR: ${generatedValues.uACR.toFixed(1)} mg/g`],
          recommendedActions: [recommendedAction, 'Follow up as scheduled'],
          severity: 'info' as const,
          concernLevel: 'none' as const
        };

        aiCommentId = await aiAnalysisService.createAIUpdateComment(
          id,
          fallbackComment,
          nextMonthNumber,
          previousLabValues,
          {
            egfr: generatedValues.eGFR,
            uacr: generatedValues.uACR,
            creatinine: generatedValues.serum_creatinine,
            bun: generatedValues.BUN,
            systolic_bp: generatedValues.blood_pressure_systolic,
            diastolic_bp: generatedValues.blood_pressure_diastolic,
            hba1c: generatedValues.HbA1c,
            glucose: generatedValues.glucose,
            hemoglobin: generatedValues.hemoglobin,
            heart_rate: generatedValues.heart_rate,
            oxygen_saturation: generatedValues.oxygen_saturation,
          }
        );

        console.log(`✓ Fallback update comment created: ${aiCommentId}`);
      } catch (fallbackError) {
        console.error('[Patient Update] Error creating fallback comment:', fallbackError);
        // Don't fail the update even if fallback comment creation fails
      }
    }
  } else {
    console.log(`[Patient Update] Skipping AI analysis after reset (no previous data to compare)`);
  }

    // =================================================================================
    // PHASE 4: LAB UPDATE EMAIL NOTIFICATIONS (CONFIGURABLE)
    // =================================================================================
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Patient Update] 📧 PHASE 4: LAB UPDATE EMAIL NOTIFICATIONS`);
    console.log(`${'='.repeat(80)}\n`);

    // Check email notification preferences and send if configured
    if (!wasReset && baselineAnalysis && postUpdateAnalysis) {
      try {
        const emailService = new EmailService(pool);
        const emailConfig = await emailService.getConfig();

        if (emailConfig && emailConfig.enabled) {
          // Calculate lab changes
          const egfrChange = baselineAnalysis.patient_summary?.latest_egfr && postUpdateAnalysis.patient_summary?.latest_egfr
            ? baselineAnalysis.patient_summary.latest_egfr - postUpdateAnalysis.patient_summary.latest_egfr
            : 0;
          const egfrChangePercent = baselineAnalysis.patient_summary?.latest_egfr && egfrChange
            ? (egfrChange / baselineAnalysis.patient_summary.latest_egfr) * 100
            : 0;
          const uacrChange = baselineAnalysis.patient_summary?.latest_uacr && postUpdateAnalysis.patient_summary?.latest_uacr
            ? postUpdateAnalysis.patient_summary.latest_uacr - baselineAnalysis.patient_summary.latest_uacr
            : 0;
          const uacrChangePercent = baselineAnalysis.patient_summary?.latest_uacr && uacrChange
            ? (uacrChange / baselineAnalysis.patient_summary.latest_uacr) * 100
            : 0;

          const hasSignificantChange = Math.abs(egfrChangePercent) > 10 || Math.abs(uacrChangePercent) > 30;

          // Determine if we should send email based on preferences
          const shouldSendEmail =
            (emailConfig.notify_lab_updates) || // Send for all updates
            (emailConfig.notify_significant_changes && hasSignificantChange && !hasTransitioned); // Send for significant changes (not transitions, those are handled separately)

          if (shouldSendEmail) {
            console.log(`[Patient Update] Sending ${hasSignificantChange ? 'significant change' : 'routine update'} email notification...`);

            const changeDescription = hasSignificantChange
              ? `Significant laboratory value changes detected:\n` +
                `${Math.abs(egfrChangePercent) > 10 ? `- eGFR ${egfrChange > 0 ? 'declined' : 'improved'} by ${Math.abs(egfrChangePercent).toFixed(1)}%\n` : ''}` +
                `${Math.abs(uacrChangePercent) > 30 ? `- uACR ${uacrChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(uacrChangePercent).toFixed(1)}%\n` : ''}`
              : `Routine lab values updated for cycle ${nextMonthNumber}.`;

            const emailMessage =
              `Lab Results Updated - ${patient.first_name} ${patient.last_name}\n\n` +
              `${changeDescription}\n\n` +
              `Current Lab Values (Cycle ${nextMonthNumber}):\n` +
              `- eGFR: ${postUpdateAnalysis.patient_summary?.latest_egfr?.toFixed(1) || 'N/A'} mL/min/1.73m²` +
              `${egfrChange !== 0 ? ` (${egfrChange > 0 ? '+' : ''}${egfrChange.toFixed(1)})` : ''}\n` +
              `- uACR: ${postUpdateAnalysis.patient_summary?.latest_uacr?.toFixed(1) || 'N/A'} mg/g` +
              `${uacrChange !== 0 ? ` (${uacrChange > 0 ? '+' : ''}${uacrChange.toFixed(1)})` : ''}\n\n` +
              `Current Classification: ${newHealthState}\n` +
              `${currentHasCKD ? `CKD Stage: ${newKdigoClassification.ckd_stage_name}\n` : ''}` +
              `Risk Level: ${newKdigoClassification.risk_level}\n\n` +
              `Please review the patient's record for detailed AI analysis and recommendations.`;

            // Get assigned doctor(s) for this patient
            const assignedDoctorsResult = await pool.query(
              `SELECT doctor_email, doctor_name, is_primary
               FROM doctor_patient_assignments
               WHERE patient_id = $1 AND is_primary = true`,
              [id]
            );

            const emailRecipients = new Set<string>();

            // Add assigned doctor's email if exists
            if (assignedDoctorsResult.rows.length > 0) {
              for (const assignment of assignedDoctorsResult.rows) {
                emailRecipients.add(assignment.doctor_email);
                console.log(`[Patient Update] Adding assigned doctor: ${assignment.doctor_email}`);
              }
            }

            // Also add configured doctor email as fallback/backup
            emailRecipients.add(emailConfig.doctor_email);

            // Send email to all recipients
            for (const recipientEmail of emailRecipients) {
              await emailService.sendNotification({
                to: recipientEmail,
                subject: hasSignificantChange
                  ? `⚠️ Significant Lab Changes - ${patient.first_name} ${patient.last_name}`
                  : `📊 Lab Update - ${patient.first_name} ${patient.last_name}`,
                message: emailMessage,
                priority: hasSignificantChange ? 'HIGH' : 'MODERATE',
                patientName: `${patient.first_name} ${patient.last_name}`,
                mrn: patient.medical_record_number
              });
              console.log(`✓ Lab update email sent to ${recipientEmail}`);
            }

            console.log(`✓ Lab update email notification sent to ${emailRecipients.size} recipient(s)`);
          } else {
            console.log(`[Patient Update] No email sent (preferences: notify_lab_updates=${emailConfig.notify_lab_updates}, notify_significant_changes=${emailConfig.notify_significant_changes}, has_significant_change=${hasSignificantChange})`);
          }
        }
      } catch (emailError) {
        console.error('[Patient Update] Error sending lab update email:', emailError);
        // Don't fail the update if email fails
      }
    }

    // =================================================================================
    // PHASE 5: CLINICAL ALERTS & EMAIL NOTIFICATIONS
    // =================================================================================
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Patient Update] 📧 PHASE 5: CHECKING CLINICAL ALERTS`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      const clinicalAlertsService = new ClinicalAlertsService(pool);

      // Gather clinical change data
      const clinicalChange = {
        previous_egfr: baselineAnalysis?.patient_summary?.latest_egfr,
        current_egfr: postUpdateAnalysis?.patient_summary?.latest_egfr || generatedValues.eGFR,
        previous_uacr: baselineAnalysis?.patient_summary?.latest_uacr,
        current_uacr: postUpdateAnalysis?.patient_summary?.latest_uacr || generatedValues.uACR,
        previous_health_state: previousHealthState || undefined,
        current_health_state: newHealthState,
        egfr_change_percent: baselineAnalysis?.patient_summary?.latest_egfr && postUpdateAnalysis?.patient_summary?.latest_egfr
          ? ((baselineAnalysis.patient_summary.latest_egfr - postUpdateAnalysis.patient_summary.latest_egfr) / baselineAnalysis.patient_summary.latest_egfr) * 100
          : undefined,
        uacr_change_percent: baselineAnalysis?.patient_summary?.latest_uacr && postUpdateAnalysis?.patient_summary?.latest_uacr
          ? ((postUpdateAnalysis.patient_summary.latest_uacr - baselineAnalysis.patient_summary.latest_uacr) / baselineAnalysis.patient_summary.latest_uacr) * 100
          : undefined,
        cycle_number: nextMonthNumber,
      };

      // Get adherence data if patient is treated
      let adherenceData;
      if (isTreated) {
        try {
          const mcpClient = await getMCPClient();
          const adherenceResult = await mcpClient.monitorCompositeAdherence(id, 90, false);
          if (adherenceResult && !adherenceResult.error) {
            adherenceData = {
              compositeScore: adherenceResult.compositeScore,
              adherenceCategory: adherenceResult.adherenceCategory,
              compositePercentage: adherenceResult.compositePercentage,
            };
          }
        } catch (adhError) {
          console.log('[Clinical Alerts] Could not fetch adherence data:', adhError);
        }
      }

      // Check and send clinical alerts
      await clinicalAlertsService.checkAndSendAlerts(
        {
          id: patient.id,
          medical_record_number: patient.medical_record_number,
          first_name: patient.first_name,
          last_name: patient.last_name,
          email: patient.email,
          home_monitoring_active: patient.home_monitoring_active,
        },
        clinicalChange,
        adherenceData
      );

      console.log('[Clinical Alerts] ✓ Alert checking completed');
    } catch (alertError) {
      console.error('[Clinical Alerts] Error checking clinical alerts:', alertError);
      // Don't fail the update if alert checking fails
    }

    res.json({
      status: 'success',
      message: `Generated cycle ${nextMonthNumber} for patient`,
      cycle_number: nextMonthNumber,
      observation_date: newDate,
      generated_values: generatedValues,
      treatment_status: isTreated ? 'treated' : 'not_treated',
      health_state_changed: previousHealthState !== newHealthState,
      previous_health_state: previousHealthState,
      new_health_state: newHealthState,
      comment_id: commentId,
      ai_comment_id: aiCommentId
    });

  } catch (error) {
    console.error('[Patients API] Error updating patient records:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update patient records',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/patients/:id/comments
 * Get health state comments for a specific patient
 */
router.get('/:id/comments', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const pool = getPool();

    const commentService = new HealthStateCommentService(pool);
    const comments = await commentService.getCommentsForPatient(id, limit);

    res.json({
      status: 'success',
      count: comments.length,
      comments
    });
  } catch (error) {
    console.error('[Patients API] Error fetching comments:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch comments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/patients/:id/comments/:commentId/read
 * Mark a comment as read
 */
router.post('/:id/comments/:commentId/read', async (req: Request, res: Response): Promise<any> => {
  try {
    const { commentId } = req.params;
    const pool = getPool();

    const commentService = new HealthStateCommentService(pool);
    await commentService.markCommentAsRead(commentId);

    res.json({
      status: 'success',
      message: 'Comment marked as read'
    });
  } catch (error) {
    console.error('[Patients API] Error marking comment as read:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark comment as read',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/patients/:id/comments/:commentId/archive
 * Archive a comment
 */
router.post('/:id/comments/:commentId/archive', async (req: Request, res: Response): Promise<any> => {
  try {
    const { commentId } = req.params;
    const pool = getPool();

    const commentService = new HealthStateCommentService(pool);
    await commentService.archiveComment(commentId);

    res.json({
      status: 'success',
      message: 'Comment archived'
    });
  } catch (error) {
    console.error('[Patients API] Error archiving comment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to archive comment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/patients/:id/adherence
 * Get composite adherence data for a treated patient
 */
router.get('/:id/adherence', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    // Get MCP client to call composite adherence monitoring tool
    const mcpClient = await getMCPClient();

    // Call the composite adherence monitoring MCP tool
    const adherenceResult = await mcpClient.monitorCompositeAdherence(id, 90, true);

    // Check if the tool returned an error or no treatment data
    if (!adherenceResult || adherenceResult.error) {
      return res.status(404).json({
        status: 'error',
        message: 'No adherence data available for this patient',
        error: adherenceResult?.error || 'Patient may not be on active treatment'
      });
    }

    // Return the adherence data
    res.json({
      status: 'success',
      adherence: adherenceResult
    });
  } catch (error) {
    console.error('[Patients API] Error fetching adherence data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch adherence data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/patients/:id/reset-records
 * Reset patient records by removing all generated data, keeping only original data (month 1)
 */
router.post('/:id/reset-records', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Check if patient exists
    const patientResult = await pool.query(`
      SELECT id FROM patients WHERE id = $1
    `, [id]);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found'
      });
    }

    // Delete all observations with month_number > 1 (keeping only original data)
    const deleteObsResult = await pool.query(`
      DELETE FROM observations
      WHERE patient_id = $1 AND month_number > 1
    `, [id]);

    // Delete all health state comments for this patient
    const deleteCommentsResult = await pool.query(`
      DELETE FROM patient_health_state_comments
      WHERE patient_id = $1
    `, [id]);

    console.log(`[Patient Reset] Reset patient ${id}:`);
    console.log(`  - Deleted ${deleteObsResult.rowCount} generated observations (month > 1)`);
    console.log(`  - Deleted ${deleteCommentsResult.rowCount} health state comments`);

    res.json({
      status: 'success',
      message: 'Patient records reset successfully',
      deleted_observations: deleteObsResult.rowCount,
      deleted_comments: deleteCommentsResult.rowCount
    });

  } catch (error) {
    console.error('[Patients API] Error resetting patient records:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset patient records',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Reset all patients to original state
 * POST /api/patients/reset-all
 * Removes all generated observations (month_number > 1) and comments for ALL patients
 */
router.post('/reset-all', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('[Reset All] Starting database-wide patient reset...');

    // Delete all observations with month_number > 1 (keeping only original baseline data)
    const deleteObsResult = await pool.query(`
      DELETE FROM observations
      WHERE month_number > 1
    `);

    // Delete all health state comments (all of them, since they're all generated)
    const deleteCommentsResult = await pool.query(`
      DELETE FROM patient_health_state_comments
    `);

    // Reset patient health states to their baseline (based on month 1 observations)
    // This ensures the UI shows correct initial state
    await pool.query(`
      UPDATE patients p
      SET
        updated_at = NOW()
      WHERE EXISTS (
        SELECT 1 FROM observations o
        WHERE o.patient_id = p.id AND o.month_number = 1
      )
    `);

    console.log('[Reset All] Database-wide reset completed:');
    console.log(`  - Deleted ${deleteObsResult.rowCount} generated observations (month > 1)`);
    console.log(`  - Deleted ${deleteCommentsResult.rowCount} health state comments`);
    console.log('  - All patients reset to original baseline state');

    res.json({
      status: 'success',
      message: 'All patient records reset to original state successfully',
      deleted_observations: deleteObsResult.rowCount,
      deleted_comments: deleteCommentsResult.rowCount,
      description: 'All patients have been reset to their original baseline. You can now simulate patient evolution from scratch.'
    });

  } catch (error) {
    console.error('[Reset All] Error resetting all patient records:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset all patient records',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Fix misclassified patients
 * POST /api/patients/fix-classifications
 * Corrects patients who are in the wrong tracking table (ckd_patient_data vs non_ckd_patient_data)
 * based on their current KDIGO classification
 */
router.post('/fix-classifications', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    console.log('[Fix Classifications] Starting patient classification correction...');

    // Get all patients with their latest observations
    const patientsResult = await pool.query(`
      SELECT DISTINCT p.id, p.medical_record_number,
             p.first_name, p.last_name,
             p.ckd_treatment_active, p.home_monitoring_active
      FROM patients p
    `);

    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    const fixes: any[] = [];

    for (const patient of patientsResult.rows) {
      // Get latest eGFR and uACR for this patient
      const latestObsResult = await pool.query(`
        SELECT DISTINCT ON (observation_type)
          observation_type,
          value_numeric
        FROM observations
        WHERE patient_id = $1
        ORDER BY observation_type, observation_date DESC
      `, [patient.id]);

      const latestObs = latestObsResult.rows;
      const egfr = latestObs.find(obs => obs.observation_type === 'eGFR')?.value_numeric || 90;
      const uacr = latestObs.find(obs => obs.observation_type === 'uACR')?.value_numeric || 15;

      // Calculate current KDIGO classification
      const kdigo = classifyKDIGO(egfr, uacr);

      // Check which table the patient is currently in
      const inCKDTable = await pool.query(
        `SELECT 1 FROM ckd_patient_data WHERE patient_id = $1`,
        [patient.id]
      );
      const inNonCKDTable = await pool.query(
        `SELECT 1 FROM non_ckd_patient_data WHERE patient_id = $1`,
        [patient.id]
      );

      const isInCKDTable = inCKDTable.rows.length > 0;
      const isInNonCKDTable = inNonCKDTable.rows.length > 0;
      const shouldBeInCKDTable = kdigo.has_ckd;

      // Check if patient is in the wrong table
      if (shouldBeInCKDTable && !isInCKDTable && isInNonCKDTable) {
        // Patient has CKD but is in non_ckd_patient_data → Move to ckd_patient_data
        console.log(`[Fix] Moving ${patient.medical_record_number} (${patient.first_name} ${patient.last_name}) from non-CKD to CKD table`);
        console.log(`  Classification: ${kdigo.health_state} (eGFR: ${egfr}, uACR: ${uacr})`);

        // Delete from non_ckd_patient_data
        await pool.query(`DELETE FROM non_ckd_patient_data WHERE patient_id = $1`, [patient.id]);

        // Insert into ckd_patient_data
        await pool.query(`
          INSERT INTO ckd_patient_data (
            patient_id, kdigo_health_state, kdigo_gfr_category,
            kdigo_albuminuria_category, ckd_severity, ckd_stage,
            is_treated, is_monitored
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          patient.id,
          kdigo.health_state,
          kdigo.gfr_category,
          kdigo.albuminuria_category,
          getCKDSeverity(kdigo.ckd_stage),
          kdigo.ckd_stage,
          patient.ckd_treatment_active || false,
          patient.home_monitoring_active || false
        ]);

        fixedCount++;
        fixes.push({
          mrn: patient.medical_record_number,
          name: `${patient.first_name} ${patient.last_name}`,
          direction: 'non-CKD → CKD',
          health_state: kdigo.health_state,
          egfr,
          uacr
        });

      } else if (!shouldBeInCKDTable && isInCKDTable && !isInNonCKDTable) {
        // Patient doesn't have CKD but is in ckd_patient_data → Move to non_ckd_patient_data
        console.log(`[Fix] Moving ${patient.medical_record_number} (${patient.first_name} ${patient.last_name}) from CKD to non-CKD table`);
        console.log(`  Classification: ${kdigo.health_state} (eGFR: ${egfr}, uACR: ${uacr})`);

        // Delete from ckd_patient_data
        await pool.query(`DELETE FROM ckd_patient_data WHERE patient_id = $1`, [patient.id]);

        // Insert into non_ckd_patient_data
        await pool.query(`
          INSERT INTO non_ckd_patient_data (
            patient_id, kdigo_health_state, risk_level, is_monitored
          ) VALUES ($1, $2, $3, $4)
        `, [
          patient.id,
          kdigo.health_state,
          kdigo.risk_level === 'very_high' ? 'high' : kdigo.risk_level,
          patient.home_monitoring_active || false
        ]);

        fixedCount++;
        fixes.push({
          mrn: patient.medical_record_number,
          name: `${patient.first_name} ${patient.last_name}`,
          direction: 'CKD → non-CKD',
          health_state: kdigo.health_state,
          egfr,
          uacr
        });

      } else if (!isInCKDTable && !isInNonCKDTable) {
        // Patient is in neither table - create entry in correct table
        console.log(`[Fix] Creating entry for ${patient.medical_record_number} (not in any tracking table)`);

        if (shouldBeInCKDTable) {
          await pool.query(`
            INSERT INTO ckd_patient_data (
              patient_id, kdigo_health_state, kdigo_gfr_category,
              kdigo_albuminuria_category, ckd_severity, ckd_stage,
              is_treated, is_monitored
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            patient.id,
            kdigo.health_state,
            kdigo.gfr_category,
            kdigo.albuminuria_category,
            getCKDSeverity(kdigo.ckd_stage),
            kdigo.ckd_stage,
            patient.ckd_treatment_active || false,
            patient.home_monitoring_active || false
          ]);
        } else {
          await pool.query(`
            INSERT INTO non_ckd_patient_data (
              patient_id, kdigo_health_state, risk_level, is_monitored
            ) VALUES ($1, $2, $3, $4)
          `, [
            patient.id,
            kdigo.health_state,
            kdigo.risk_level === 'very_high' ? 'high' : kdigo.risk_level,
            patient.home_monitoring_active || false
          ]);
        }

        fixedCount++;
        fixes.push({
          mrn: patient.medical_record_number,
          name: `${patient.first_name} ${patient.last_name}`,
          direction: 'missing → ' + (shouldBeInCKDTable ? 'CKD' : 'non-CKD'),
          health_state: kdigo.health_state,
          egfr,
          uacr
        });

      } else {
        // Patient is correctly classified
        alreadyCorrectCount++;
      }
    }

    console.log(`[Fix Classifications] Completed:`);
    console.log(`  - Fixed: ${fixedCount} patients`);
    console.log(`  - Already correct: ${alreadyCorrectCount} patients`);
    console.log(`  - Total processed: ${patientsResult.rows.length} patients`);

    res.json({
      status: 'success',
      message: 'Patient classifications corrected successfully',
      total_patients: patientsResult.rows.length,
      fixed_count: fixedCount,
      already_correct: alreadyCorrectCount,
      fixes: fixes
    });

  } catch (error) {
    console.error('[Fix Classifications] Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fix patient classifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
