import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database';
import {
  performGCUAAssessment,
  GCUAPatientInput,
  GCUAAssessment,
  isGCUAEligible,
  getGCUASummary
} from '../../utils/gcua';

const router = Router();

/**
 * Helper function to transform database snake_case to camelCase for frontend
 */
function transformDatabaseAssessment(dbRow: any): any {
  if (!dbRow) return null;

  const renalRisk = parseFloat(dbRow.renal_risk) || 0;
  const cvdRisk = parseFloat(dbRow.cvd_risk) || 0;
  const mortalityRisk = parseFloat(dbRow.mortality_risk) || 0;

  // Generate phenotype description based on type
  const phenotypeDescriptions: Record<string, string> = {
    'I': 'High cardiorenal risk requiring aggressive intervention. Both kidney and cardiovascular systems show significant risk factors.',
    'II': 'Elevated renal risk with moderate cardiovascular concerns. Focus on kidney protection with CV monitoring.',
    'III': 'Cardiovascular-dominant risk profile. Prioritize heart health while maintaining renal surveillance.',
    'IV': 'Lower overall risk but age-related considerations. Focus on prevention and monitoring.'
  };

  const phenotypeStrategies: Record<string, string[]> = {
    'I': ['Initiate SGLT2 inhibitor therapy', 'Optimize blood pressure control', 'Consider GLP-1 RA if diabetic', 'Quarterly monitoring'],
    'II': ['Focus on nephroprotection', 'ACE/ARB optimization', 'Manage proteinuria', 'Monitor eGFR trends'],
    'III': ['Cardiovascular risk reduction priority', 'Statin therapy optimization', 'Blood pressure targets', 'Lifestyle modifications'],
    'IV': ['Preventive care focus', 'Annual comprehensive assessment', 'Maintain current therapies', 'Patient education']
  };

  const phenotypeType = dbRow.phenotype_type || 'IV';

  // Parse treatment recommendations from DB (stored as JSON)
  let treatmentRecs = dbRow.treatment_recommendations;
  if (typeof treatmentRecs === 'string') {
    try {
      treatmentRecs = JSON.parse(treatmentRecs);
    } catch {
      treatmentRecs = {};
    }
  }

  return {
    isEligible: dbRow.is_eligible,
    phenotype: {
      type: phenotypeType,
      name: dbRow.phenotype_name || 'Unknown',
      tag: dbRow.phenotype_tag || 'Assessment Complete',
      color: dbRow.phenotype_color || 'gray',
      description: phenotypeDescriptions[phenotypeType] || 'Risk assessment completed.',
      clinicalStrategy: phenotypeStrategies[phenotypeType] || ['Continue current management'],
      treatmentRecommendations: treatmentRecs || {}  // Include treatment recommendations in phenotype
    },
    module1: {
      name: 'Nelson/CKD-PC',
      fiveYearRisk: renalRisk,
      riskCategory: getRiskCategoryFromValue(renalRisk, 'renal'),
      cStatistic: 0.85,
      interpretation: `${renalRisk}% 5-year risk of CKD progression based on current kidney function and risk factors.`,
      components: ['Age', 'eGFR', 'Albuminuria', 'Diabetes status', 'Blood pressure']
    },
    module2: {
      name: 'AHA PREVENT',
      tenYearRisk: cvdRisk,
      riskCategory: getRiskCategoryFromValue(cvdRisk, 'cvd'),
      cStatistic: 0.79,
      interpretation: `${cvdRisk}% 10-year risk of cardiovascular events including heart attack and stroke.`,
      components: ['Age', 'Sex', 'Blood pressure', 'Cholesterol', 'Diabetes', 'Smoking'],
      heartAge: undefined
    },
    module3: {
      name: 'Bansal Mortality',
      fiveYearMortalityRisk: mortalityRisk,
      riskCategory: getRiskCategoryFromValue(mortalityRisk, 'mortality'),
      points: Math.round(mortalityRisk / 2),
      interpretation: `${mortalityRisk}% 5-year mortality risk accounting for competing risks in elderly patients.`,
      components: ['Age', 'Comorbidities', 'Functional status', 'Kidney function'],
      competingRiskAdjustment: true
    },
    benefitRatio: parseFloat(dbRow.benefit_ratio) || 0,
    benefitRatioInterpretation: parseFloat(dbRow.benefit_ratio) > 1
      ? 'Treatment benefits likely outweigh risks'
      : 'Careful consideration of treatment risks vs benefits needed',
    confidenceLevel: dbRow.confidence_level || 'moderate',
    treatmentRecommendations: treatmentRecs || {},  // Also keep at top level for backwards compatibility
    dataCompleteness: 75,
    missingData: [],
    kdigoScreeningRecommendation: 'Annual screening recommended',
    cystatinCRecommended: false,
    assessedAt: dbRow.assessed_at
  };
}

/**
 * Helper to determine risk category from numeric value
 */
function getRiskCategoryFromValue(value: number, type: 'renal' | 'cvd' | 'mortality'): string {
  if (type === 'renal') {
    if (value >= 30) return 'very_high';
    if (value >= 15) return 'high';
    if (value >= 5) return 'moderate';
    return 'low';
  } else if (type === 'cvd') {
    if (value >= 20) return 'high';
    if (value >= 7.5) return 'intermediate';
    if (value >= 5) return 'borderline';
    return 'low';
  } else {
    if (value >= 30) return 'very_high';
    if (value >= 15) return 'high';
    if (value >= 5) return 'moderate';
    return 'low';
  }
}

/**
 * Helper function to gather patient input for GCUA from database
 */
async function getPatientGCUAInput(patientId: string): Promise<GCUAPatientInput | null> {
  const pool = getPool();

  // Get patient demographics and comorbidities
  const patientResult = await pool.query(`
    SELECT
      p.id,
      p.date_of_birth,
      p.gender,
      EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as age,
      -- Risk factors
      rf.has_diabetes,
      rf.has_hypertension,
      rf.has_cvd,
      rf.has_heart_failure,
      rf.has_coronary_artery_disease,
      rf.has_stroke_history,
      rf.has_peripheral_vascular_disease,
      rf.current_bmi,
      rf.average_bp_systolic,
      rf.smoking_status,
      rf.hba1c,
      rf.current_egfr,
      rf.current_uacr
    FROM patients p
    LEFT JOIN patient_risk_factors rf ON p.id = rf.patient_id
    WHERE p.id = $1
  `, [patientId]);

  if (patientResult.rows.length === 0) {
    return null;
  }

  const patient = patientResult.rows[0];

  // ALWAYS get latest lab values from observations (more current than risk_factors)
  const egfrResult = await pool.query(`
    SELECT value_numeric FROM observations
    WHERE patient_id = $1 AND observation_type = 'eGFR'
    ORDER BY observation_date DESC LIMIT 1
  `, [patientId]);
  let eGFR = egfrResult.rows[0]?.value_numeric ?? patient.current_egfr;

  const uacrResult = await pool.query(`
    SELECT value_numeric FROM observations
    WHERE patient_id = $1 AND observation_type = 'uACR'
    ORDER BY observation_date DESC LIMIT 1
  `, [patientId]);
  let uACR = uacrResult.rows[0]?.value_numeric ?? patient.current_uacr;

  // Get additional comorbidities from conditions table
  const conditionsResult = await pool.query(`
    SELECT condition_code, condition_name FROM conditions
    WHERE patient_id = $1 AND clinical_status = 'active'
  `, [patientId]);

  const conditions = conditionsResult.rows;
  const hasAtrialFibrillation = conditions.some((c: any) =>
    c.condition_code?.includes('I48') ||
    c.condition_name?.toLowerCase().includes('atrial fibrillation') ||
    c.condition_name?.toLowerCase().includes('afib')
  );

  // Check for heart failure from conditions if not in risk factors
  const hasHeartFailure = patient.has_heart_failure || conditions.some((c: any) =>
    c.condition_code?.includes('I50') ||
    c.condition_name?.toLowerCase().includes('heart failure')
  );

  // Check for CVD from conditions
  const hasCVD = patient.has_cvd ||
    patient.has_coronary_artery_disease ||
    patient.has_stroke_history ||
    conditions.some((c: any) =>
      c.condition_code?.startsWith('I2') ||  // Ischemic heart disease
      c.condition_code?.startsWith('I63') || // Stroke
      c.condition_name?.toLowerCase().includes('myocardial infarction') ||
      c.condition_name?.toLowerCase().includes('stroke')
    );

  // Get BP from observations if not in risk factors
  let systolicBP = patient.average_bp_systolic;
  if (!systolicBP) {
    const bpResult = await pool.query(`
      SELECT value_numeric FROM observations
      WHERE patient_id = $1 AND observation_type IN ('Systolic BP', 'Blood Pressure Systolic')
      ORDER BY observation_date DESC LIMIT 1
    `, [patientId]);
    systolicBP = bpResult.rows[0]?.value_numeric;
  }

  // Get HbA1c from observations if diabetic and not in risk factors
  let hba1c = patient.hba1c;
  if (!hba1c && patient.has_diabetes) {
    const hba1cResult = await pool.query(`
      SELECT value_numeric FROM observations
      WHERE patient_id = $1 AND observation_type IN ('HbA1c', 'Hemoglobin A1c')
      ORDER BY observation_date DESC LIMIT 1
    `, [patientId]);
    hba1c = hba1cResult.rows[0]?.value_numeric;
  }

  // Get NT-proBNP if available
  const bnpResult = await pool.query(`
    SELECT value_numeric FROM observations
    WHERE patient_id = $1 AND observation_type IN ('NT-proBNP', 'BNP', 'NT-ProBNP')
    ORDER BY observation_date DESC LIMIT 1
  `, [patientId]);
  const ntProBNP = bnpResult.rows[0]?.value_numeric;

  // Map smoking status
  let smokingStatus: 'never' | 'former' | 'current' | undefined;
  if (patient.smoking_status) {
    const status = patient.smoking_status.toLowerCase();
    if (status === 'current' || status === 'smoker') {
      smokingStatus = 'current';
    } else if (status === 'former' || status === 'ex-smoker') {
      smokingStatus = 'former';
    } else if (status === 'never' || status === 'non-smoker') {
      smokingStatus = 'never';
    }
  }

  if (!eGFR || !patient.age) {
    return null;
  }

  return {
    age: patient.age,
    sex: patient.gender?.toLowerCase() === 'female' ? 'female' : 'male',
    eGFR: Number(eGFR),
    uACR: uACR ? Number(uACR) : undefined,
    bmi: patient.current_bmi ? Number(patient.current_bmi) : undefined,
    systolicBP: systolicBP ? Number(systolicBP) : undefined,
    hasDiabetes: Boolean(patient.has_diabetes),
    hasHypertension: Boolean(patient.has_hypertension),
    hasCVD: Boolean(hasCVD),
    hasHeartFailure: Boolean(hasHeartFailure),
    hasAtrialFibrillation: Boolean(hasAtrialFibrillation),
    smokingStatus,
    hba1c: hba1c ? Number(hba1c) : undefined,
    ntProBNP: ntProBNP ? Number(ntProBNP) : undefined
  };
}

/**
 * Helper to save GCUA assessment to database
 */
async function saveGCUAAssessment(
  patientId: string,
  input: GCUAPatientInput,
  assessment: GCUAAssessment,
  assessedBy: string = 'system'
): Promise<void> {
  const pool = getPool();

  await pool.query(`
    INSERT INTO patient_gcua_assessments (
      patient_id,
      is_eligible,
      eligibility_reason,
      module1_five_year_risk,
      module1_risk_category,
      module1_components,
      module1_interpretation,
      module1_c_statistic,
      module2_ten_year_risk,
      module2_risk_category,
      module2_heart_age,
      module2_components,
      module2_interpretation,
      module2_c_statistic,
      module3_five_year_mortality,
      module3_risk_category,
      module3_points,
      module3_components,
      module3_interpretation,
      phenotype_type,
      phenotype_name,
      phenotype_tag,
      phenotype_color,
      phenotype_description,
      phenotype_clinical_strategy,
      phenotype_treatment_recommendations,
      benefit_ratio,
      benefit_ratio_interpretation,
      data_completeness,
      missing_data,
      confidence_level,
      kdigo_screening_recommendation,
      cystatin_c_recommended,
      input_age,
      input_sex,
      input_egfr,
      input_uacr,
      input_systolic_bp,
      input_bmi,
      input_has_diabetes,
      input_has_hypertension,
      input_has_cvd,
      input_has_heart_failure,
      input_has_atrial_fibrillation,
      input_smoking_status,
      input_nt_probnp,
      input_hba1c,
      assessed_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
      $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
      $41, $42, $43, $44, $45, $46, $47, $48
    )
  `, [
    patientId,
    assessment.isEligible,
    assessment.eligibilityReason || null,
    assessment.isEligible ? assessment.module1.fiveYearRisk : null,
    assessment.isEligible ? assessment.module1.riskCategory : null,
    assessment.isEligible ? JSON.stringify(assessment.module1.components) : null,
    assessment.isEligible ? assessment.module1.interpretation : null,
    assessment.isEligible ? assessment.module1.cStatistic : null,
    assessment.isEligible ? assessment.module2.tenYearRisk : null,
    assessment.isEligible ? assessment.module2.riskCategory : null,
    assessment.isEligible ? assessment.module2.heartAge : null,
    assessment.isEligible ? JSON.stringify(assessment.module2.components) : null,
    assessment.isEligible ? assessment.module2.interpretation : null,
    assessment.isEligible ? assessment.module2.cStatistic : null,
    assessment.isEligible ? assessment.module3.fiveYearMortalityRisk : null,
    assessment.isEligible ? assessment.module3.riskCategory : null,
    assessment.isEligible ? assessment.module3.points : null,
    assessment.isEligible ? JSON.stringify(assessment.module3.components) : null,
    assessment.isEligible ? assessment.module3.interpretation : null,
    assessment.isEligible ? assessment.phenotype.type : null,
    assessment.isEligible ? assessment.phenotype.name : null,
    assessment.isEligible ? assessment.phenotype.tag : null,
    assessment.isEligible ? assessment.phenotype.color : null,
    assessment.isEligible ? assessment.phenotype.description : null,
    assessment.isEligible ? JSON.stringify(assessment.phenotype.clinicalStrategy) : null,
    assessment.isEligible ? JSON.stringify(assessment.phenotype.treatmentRecommendations) : null,
    assessment.isEligible ? assessment.benefitRatio : null,
    assessment.isEligible ? assessment.benefitRatioInterpretation : null,
    assessment.isEligible ? assessment.dataCompleteness : null,
    assessment.isEligible ? JSON.stringify(assessment.missingData) : null,
    assessment.isEligible ? assessment.confidenceLevel : null,
    assessment.isEligible ? assessment.kdigoScreeningRecommendation : null,
    assessment.isEligible ? assessment.cystatinCRecommended : null,
    input.age,
    input.sex,
    input.eGFR,
    input.uACR || null,
    input.systolicBP || null,
    input.bmi || null,
    input.hasDiabetes,
    input.hasHypertension,
    input.hasCVD,
    input.hasHeartFailure,
    input.hasAtrialFibrillation || null,
    input.smokingStatus || null,
    input.ntProBNP || null,
    input.hba1c || null,
    assessedBy
  ]);
}

// ============================================
// API ROUTES
// ============================================

/**
 * GET /api/gcua/assessment/:patientId
 * Get the latest GCUA assessment for a patient
 */
router.get('/assessment/:patientId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { patientId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM get_latest_gcua_assessment($1)
    `, [patientId]);

    if (result.rows.length === 0) {
      // Check if patient exists and is eligible
      const patientInput = await getPatientGCUAInput(patientId);
      if (!patientInput) {
        return res.status(404).json({
          status: 'error',
          message: 'Patient not found or missing required data'
        });
      }

      if (!isGCUAEligible(patientInput.age, patientInput.eGFR)) {
        return res.status(200).json({
          status: 'success',
          isEligible: false,
          reason: patientInput.age < 60
            ? `Patient age (${patientInput.age}) is under 60. GCUA is designed for adults 60+.`
            : `Patient eGFR (${patientInput.eGFR}) is ≤60. Use KDIGO staging for established CKD.`
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'No GCUA assessment found. Use POST /api/gcua/calculate/:patientId to generate one.',
        isEligible: true
      });
    }

    // Transform snake_case database result to camelCase for frontend
    const transformedAssessment = transformDatabaseAssessment(result.rows[0]);

    res.json({
      status: 'success',
      assessment: transformedAssessment
    });

  } catch (error) {
    console.error('[GCUA API] Error fetching assessment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch GCUA assessment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/gcua/calculate/:patientId
 * Calculate and save a new GCUA assessment for a patient
 */
router.post('/calculate/:patientId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { patientId } = req.params;
    const assessedBy = req.body?.assessedBy || 'system';

    // Gather patient input
    const patientInput = await getPatientGCUAInput(patientId);

    if (!patientInput) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient not found or missing required data (age, eGFR)'
      });
    }

    console.log(`[GCUA] Calculating assessment for patient ${patientId}`, {
      age: patientInput.age,
      eGFR: patientInput.eGFR,
      uACR: patientInput.uACR,
      hasDiabetes: patientInput.hasDiabetes
    });

    // Perform GCUA assessment
    const assessment = performGCUAAssessment(patientInput);

    // Save to database
    await saveGCUAAssessment(patientId, patientInput, assessment, assessedBy);

    // Sync risk_level in non_ckd_patient_data to match calculated phenotype
    // This ensures patient list displays the same risk as the detail card
    if (assessment.isEligible) {
      const pool = getPool();
      const phenotypeType = assessment.phenotype.type;
      // Phenotype I, II, III, IV are high risk; Moderate is moderate; Low is low
      const riskLevel = ['I', 'II', 'III', 'IV'].includes(phenotypeType) ? 'high' :
                        phenotypeType === 'Moderate' ? 'moderate' : 'low';

      await pool.query(`
        UPDATE non_ckd_patient_data
        SET risk_level = $1
        WHERE patient_id = $2
      `, [riskLevel, patientId]);

      console.log(`[GCUA] Synced risk_level to '${riskLevel}' for patient ${patientId}`);
    }

    console.log(`[GCUA] Assessment complete for patient ${patientId}:`, {
      isEligible: assessment.isEligible,
      phenotype: assessment.isEligible ? assessment.phenotype.name : 'N/A',
      renalRisk: assessment.isEligible ? assessment.module1.fiveYearRisk : 'N/A'
    });

    res.json({
      status: 'success',
      message: assessment.isEligible
        ? `GCUA assessment complete: ${assessment.phenotype.name}`
        : assessment.eligibilityReason,
      assessment,
      summary: assessment.isEligible ? getGCUASummary(assessment) : assessment.eligibilityReason
    });

  } catch (error) {
    console.error('[GCUA API] Error calculating assessment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate GCUA assessment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/gcua/eligible-patients
 * Get all patients eligible for GCUA (age >= 60, eGFR > 60)
 */
router.get('/eligible-patients', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        p.id,
        p.medical_record_number as mrn,
        p.first_name || ' ' || p.last_name as patient_name,
        EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as age,
        p.gender,
        rf.current_egfr,
        rf.current_uacr,
        rf.has_diabetes,
        rf.has_hypertension,
        rf.has_cvd,
        rf.gcua_phenotype,
        rf.gcua_phenotype_name,
        rf.gcua_last_assessment_date,
        CASE
          WHEN rf.gcua_phenotype IS NOT NULL THEN 'assessed'
          ELSE 'pending'
        END as gcua_status
      FROM patients p
      LEFT JOIN patient_risk_factors rf ON p.id = rf.patient_id
      WHERE EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= 60
        AND (rf.current_egfr IS NULL OR rf.current_egfr > 60)
      ORDER BY
        CASE WHEN rf.gcua_phenotype IS NULL THEN 0 ELSE 1 END,
        EXTRACT(YEAR FROM AGE(p.date_of_birth)) DESC
    `);

    res.json({
      status: 'success',
      count: result.rows.length,
      patients: result.rows
    });

  } catch (error) {
    console.error('[GCUA API] Error fetching eligible patients:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch eligible patients',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/gcua/high-risk
 * Get high-risk GCUA patients (Phenotype I and II)
 */
router.get('/high-risk', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM gcua_high_risk_patients
    `);

    res.json({
      status: 'success',
      count: result.rows.length,
      patients: result.rows
    });

  } catch (error) {
    console.error('[GCUA API] Error fetching high-risk patients:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch high-risk patients',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/gcua/missing-uacr
 * Get patients missing uACR data (Silent Hunter feature)
 */
router.get('/missing-uacr', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM gcua_missing_uacr_patients
    `);

    res.json({
      status: 'success',
      count: result.rows.length,
      message: 'Patients eligible for GCUA but missing uACR - order uACR to unlock full risk profile',
      patients: result.rows
    });

  } catch (error) {
    console.error('[GCUA API] Error fetching missing uACR patients:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch patients with missing uACR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/gcua/statistics
 * Get population-level GCUA statistics by phenotype
 */
router.get('/statistics', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const statsResult = await pool.query(`
      SELECT * FROM gcua_population_statistics
    `);

    // Also get overall counts
    const totalResult = await pool.query(`
      SELECT
        COUNT(*) as total_assessed,
        COUNT(CASE WHEN is_eligible THEN 1 END) as eligible_count,
        COUNT(CASE WHEN phenotype_type = 'I' THEN 1 END) as accelerated_ager_count,
        COUNT(CASE WHEN phenotype_type = 'II' THEN 1 END) as silent_renal_count,
        COUNT(CASE WHEN phenotype_type = 'III' THEN 1 END) as vascular_dominant_count,
        COUNT(CASE WHEN phenotype_type = 'IV' THEN 1 END) as senescent_count,
        ROUND(AVG(module1_five_year_risk), 2) as avg_renal_risk,
        ROUND(AVG(module2_ten_year_risk), 2) as avg_cvd_risk,
        ROUND(AVG(module3_five_year_mortality), 2) as avg_mortality_risk
      FROM patient_gcua_assessments
      WHERE assessed_at = (
        SELECT MAX(assessed_at)
        FROM patient_gcua_assessments pga2
        WHERE pga2.patient_id = patient_gcua_assessments.patient_id
      )
    `);

    res.json({
      status: 'success',
      overall: totalResult.rows[0],
      byPhenotype: statsResult.rows
    });

  } catch (error) {
    console.error('[GCUA API] Error fetching statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch GCUA statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/gcua/bulk-calculate
 * Calculate GCUA assessments for all eligible patients
 */
router.post('/bulk-calculate', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    // Get all eligible patients (age >= 60, eGFR > 60 or unknown)
    const patientsResult = await pool.query(`
      SELECT p.id
      FROM patients p
      LEFT JOIN patient_risk_factors rf ON p.id = rf.patient_id
      WHERE EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= 60
        AND (rf.current_egfr IS NULL OR rf.current_egfr > 60)
    `);

    let calculated = 0;
    let eligible = 0;
    let ineligible = 0;
    let errors = 0;

    for (const row of patientsResult.rows) {
      try {
        const patientInput = await getPatientGCUAInput(row.id);

        if (!patientInput) {
          ineligible++;
          continue;
        }

        const assessment = performGCUAAssessment(patientInput);

        if (assessment.isEligible) {
          await saveGCUAAssessment(row.id, patientInput, assessment, 'bulk-calculate');

          // Sync risk_level in non_ckd_patient_data to match calculated phenotype
          const phenotypeType = assessment.phenotype.type;
          const riskLevel = ['I', 'II', 'III', 'IV'].includes(phenotypeType) ? 'high' :
                            phenotypeType === 'Moderate' ? 'moderate' : 'low';
          await pool.query(`
            UPDATE non_ckd_patient_data
            SET risk_level = $1
            WHERE patient_id = $2
          `, [riskLevel, row.id]);

          calculated++;
          eligible++;
        } else {
          ineligible++;
        }
      } catch (err) {
        console.error(`[GCUA] Error calculating for patient ${row.id}:`, err);
        errors++;
      }
    }

    res.json({
      status: 'success',
      message: 'Bulk GCUA calculation complete',
      results: {
        total: patientsResult.rows.length,
        calculated,
        eligible,
        ineligible,
        errors
      }
    });

  } catch (error) {
    console.error('[GCUA API] Error in bulk calculation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform bulk GCUA calculation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/gcua/history/:patientId
 * Get GCUA assessment history for a patient
 */
router.get('/history/:patientId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { patientId } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        id,
        phenotype_type,
        phenotype_name,
        phenotype_tag,
        module1_five_year_risk as renal_risk,
        module2_ten_year_risk as cvd_risk,
        module3_five_year_mortality as mortality_risk,
        benefit_ratio,
        confidence_level,
        assessed_at,
        assessed_by
      FROM patient_gcua_assessments
      WHERE patient_id = $1
      ORDER BY assessed_at DESC
      LIMIT 10
    `, [patientId]);

    res.json({
      status: 'success',
      count: result.rows.length,
      history: result.rows
    });

  } catch (error) {
    console.error('[GCUA API] Error fetching assessment history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch GCUA history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
