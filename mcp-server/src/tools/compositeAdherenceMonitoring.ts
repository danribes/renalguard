import { pool } from '../database.js';

export interface CompositeAdherenceInput {
  patient_id: string;
  measurement_period_days?: number; // Default 90 days
  include_predictions?: boolean; // Include risk prediction
}

export interface AdherenceComponent {
  score: number; // 0.00-1.00
  percentage: number; // 0-100
  available: boolean;
  weight: number; // Weight used in composite
  source: string;
  details?: any;
}

export interface MedicationAdherenceDetail {
  medicationName: string;
  medicationType: string;
  adherence: number;
  category: 'GOOD' | 'SUBOPTIMAL' | 'POOR';
}

export interface CompositeAdherenceOutput {
  patientId: string;
  compositeScore: number; // 0.00-1.00
  compositePercentage: number; // 0-100
  adherenceCategory: 'GOOD' | 'SUBOPTIMAL' | 'POOR';
  scoringMethod: string;

  // Component scores
  components: {
    mpr?: AdherenceComponent;
    labBased?: AdherenceComponent;
    selfReported?: AdherenceComponent;
  };

  // Per-medication breakdown
  medications: MedicationAdherenceDetail[];

  // Clinical correlation
  clinicalContext: {
    latestEgfr: number | null;
    latestUacr: number | null;
    egfrTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN';
    uacrTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN';
    treatmentResponse: string;
  };

  // Barriers and risks
  detectedBarriers: AdherenceBarrier[];
  riskAssessment?: RiskAssessment;

  // Actionable recommendations
  alerts: AdherenceAlert[];
  recommendations: string[];

  // Historical trend
  adherenceTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';
  historicalData?: HistoricalAdherence[];
}

export interface AdherenceBarrier {
  type: 'REFILL_GAP' | 'DISCONTINUATION' | 'COST' | 'SIDE_EFFECTS' | 'FORGETFULNESS' | 'ACCESS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  affectedMedication?: string;
}

export interface RiskAssessment {
  riskScore: number; // 0.00-1.00
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  recommendedInterventions: string[];
  interventionPriority: 'ROUTINE' | 'ENHANCED' | 'INTENSIVE';
}

export interface AdherenceAlert {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  action: string;
  reasoning: string[];
}

export interface HistoricalAdherence {
  date: string;
  score: number;
  category: string;
}

/**
 * COMPREHENSIVE COMPOSITE ADHERENCE MONITORING
 *
 * Combines multiple adherence measurement methods:
 * 1. MPR (Medication Possession Ratio) from pharmacy data
 * 2. Lab-based treatment response from eGFR/uACR trends
 * 3. Patient self-reported adherence
 *
 * Calculates weighted composite score and provides actionable insights.
 */
export async function monitorCompositeAdherence(
  input: CompositeAdherenceInput
): Promise<CompositeAdherenceOutput> {
  const {
    patient_id,
    measurement_period_days = 90,
    include_predictions = true,
  } = input;

  // 1. Get active treatments for the patient
  const activeTreatments = await getActiveTreatments(patient_id);

  if (activeTreatments.length === 0) {
    return createNoTreatmentResponse(patient_id);
  }

  // 2. Calculate component scores
  const mprComponent = await calculateMPRComponent(patient_id, measurement_period_days);
  const labComponent = await calculateLabBasedComponent(patient_id, activeTreatments);
  const selfReportComponent = await getSelfReportedComponent(patient_id, measurement_period_days);

  // 3. Calculate composite score using database function
  const compositeResult = await calculateComposite(
    mprComponent?.score,
    labComponent?.score,
    selfReportComponent?.score
  );

  // 4. Get clinical context
  const clinicalContext = await getClinicalContext(patient_id);

  // 5. Detect barriers
  const barriers = await detectAllBarriers(
    patient_id,
    mprComponent,
    selfReportComponent,
    compositeResult.composite_score
  );

  // 6. Get historical trend
  const historicalData = await getAdherenceHistory(patient_id, 6); // Last 6 data points
  const adherenceTrend = calculateTrend(historicalData);

  // 7. Risk assessment (if requested)
  let riskAssessment: RiskAssessment | undefined;
  if (include_predictions) {
    riskAssessment = await assessAdherenceRisk(patient_id, compositeResult.composite_score);
  }

  // 8. Generate alerts and recommendations
  const alerts = generateSmartAlerts(
    compositeResult,
    clinicalContext,
    barriers,
    riskAssessment
  );
  const recommendations = generateRecommendations(
    compositeResult,
    barriers,
    riskAssessment,
    clinicalContext
  );

  // 9. Save composite score to database
  await saveCompositeScore(
    patient_id,
    compositeResult,
    mprComponent,
    labComponent,
    selfReportComponent,
    clinicalContext,
    barriers
  );

  // 10. Build per-medication breakdown
  const medications = await getMedicationAdherenceBreakdown(patient_id, activeTreatments);

  return {
    patientId: patient_id,
    compositeScore: compositeResult.composite_score,
    compositePercentage: Math.round(compositeResult.composite_score * 100),
    adherenceCategory: compositeResult.adherence_category,
    scoringMethod: compositeResult.scoring_method,
    components: {
      mpr: mprComponent,
      labBased: labComponent,
      selfReported: selfReportComponent,
    },
    medications,
    clinicalContext,
    detectedBarriers: barriers,
    riskAssessment,
    alerts,
    recommendations,
    adherenceTrend,
    historicalData,
  };
}

async function getActiveTreatments(patient_id: string): Promise<any[]> {
  // First, try to get treatments from patient_treatments table
  const result = await pool.query(
    `SELECT id, medication_name, medication_class, started_date, started_cycle, current_adherence
     FROM patient_treatments
     WHERE patient_id = $1 AND status = 'active'`,
    [patient_id]
  );

  // If we have treatments in the proper table, return them
  if (result.rows.length > 0) {
    return result.rows;
  }

  // Otherwise, fall back to checking the patients table for legacy treatment flags
  const patientResult = await pool.query(
    `SELECT
       ckd_treatment_active,
       ckd_treatment_type,
       on_ras_inhibitor,
       on_sglt2i
     FROM patients
     WHERE id = $1`,
    [patient_id]
  );

  if (patientResult.rows.length === 0 || !patientResult.rows[0].ckd_treatment_active) {
    return []; // No active treatment
  }

  // Build synthetic treatment records from patient flags
  const patient = patientResult.rows[0];
  const syntheticTreatments = [];

  // Add main CKD treatment if specified
  if (patient.ckd_treatment_type) {
    syntheticTreatments.push({
      id: `synthetic-${patient_id}-primary`,
      medication_name: patient.ckd_treatment_type,
      medication_class: 'CKD Treatment',
      started_date: null,
      started_cycle: null,
      current_adherence: null,
      synthetic: true
    });
  }

  // Add RAS inhibitor if flag is set
  if (patient.on_ras_inhibitor) {
    syntheticTreatments.push({
      id: `synthetic-${patient_id}-ras`,
      medication_name: 'RAS Inhibitor (ACE-I/ARB)',
      medication_class: 'Antihypertensive',
      started_date: null,
      started_cycle: null,
      current_adherence: null,
      synthetic: true
    });
  }

  // Add SGLT2i if flag is set
  if (patient.on_sglt2i) {
    syntheticTreatments.push({
      id: `synthetic-${patient_id}-sglt2i`,
      medication_name: 'SGLT2 Inhibitor',
      medication_class: 'Antidiabetic/Renoprotective',
      started_date: null,
      started_cycle: null,
      current_adherence: null,
      synthetic: true
    });
  }

  return syntheticTreatments;
}

async function calculateMPRComponent(
  patient_id: string,
  period_days: number
): Promise<AdherenceComponent | undefined> {
  // Check if medication_requests table exists and has data
  const tableCheck = await pool.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_name = 'medication_requests'
     )`
  );

  if (!tableCheck.rows[0].exists) {
    return undefined; // MPR not available without pharmacy data
  }

  const result = await pool.query(
    `SELECT
       COUNT(*) as refill_count,
       SUM(days_supply) as total_days_supply
     FROM medication_requests
     WHERE patient_id = $1
       AND fill_date >= CURRENT_DATE - INTERVAL '${period_days} days'`,
    [patient_id]
  );

  if (result.rows[0].refill_count === 0) {
    return undefined;
  }

  const mpr = Math.min(1.0, result.rows[0].total_days_supply / period_days);

  return {
    score: mpr,
    percentage: Math.round(mpr * 100),
    available: true,
    weight: 0.5, // Will be adjusted in composite calculation
    source: 'Pharmacy fill records',
    details: {
      refillCount: result.rows[0].refill_count,
      daysSupplied: result.rows[0].total_days_supply,
      periodDays: period_days,
    },
  };
}

async function calculateLabBasedComponent(
  patient_id: string,
  treatments: any[]
): Promise<AdherenceComponent | undefined> {
  // Get baseline and current labs
  const labQuery = `
    SELECT observation_type, value_numeric as value, observation_date
    FROM observations
    WHERE patient_id = $1
      AND observation_type IN ('eGFR', 'uACR')
    ORDER BY observation_date DESC
    LIMIT 6
  `;

  const labResult = await pool.query(labQuery, [patient_id]);

  if (labResult.rows.length < 2) {
    return undefined;
  }

  // Parse lab data
  let latestEgfr: number | null = null;
  let previousEgfr: number | null = null;
  let latestUacr: number | null = null;
  let previousUacr: number | null = null;

  for (const lab of labResult.rows) {
    if (lab.observation_type === 'eGFR') {
      if (latestEgfr === null) latestEgfr = parseFloat(lab.value);
      else if (previousEgfr === null) previousEgfr = parseFloat(lab.value);
    }
    if (lab.observation_type === 'uACR') {
      if (latestUacr === null) latestUacr = parseFloat(lab.value);
      else if (previousUacr === null) previousUacr = parseFloat(lab.value);
    }
  }

  // Calculate expected vs actual response
  let adherenceScore = 0.8; // Default moderate adherence

  if (latestEgfr !== null && previousEgfr !== null) {
    const egfrChange = latestEgfr - previousEgfr;

    // Expected benefit from CKD treatments: +3 to +5 mL/min for SGLT2i, stabilization for RAS
    const expectedBenefit = treatments.some((t) => t.medication_class === 'SGLT2I') ? 4 : 1;

    if (egfrChange >= expectedBenefit * 0.8) {
      adherenceScore = 0.95; // Excellent response
    } else if (egfrChange >= expectedBenefit * 0.5) {
      adherenceScore = 0.85; // Good response
    } else if (egfrChange >= 0) {
      adherenceScore = 0.75; // Stable
    } else if (egfrChange >= -5) {
      adherenceScore = 0.60; // Mild decline
    } else {
      adherenceScore = 0.40; // Significant decline suggests poor adherence
    }
  }

  if (latestUacr !== null && previousUacr !== null && previousUacr > 0) {
    const uacrChange = ((latestUacr - previousUacr) / previousUacr) * 100;

    // Expected: -30% reduction with good adherence
    if (uacrChange <= -25) {
      adherenceScore = Math.max(adherenceScore, 0.95);
    } else if (uacrChange <= -15) {
      adherenceScore = Math.max(adherenceScore, 0.85);
    } else if (uacrChange <= 0) {
      adherenceScore = Math.max(adherenceScore, 0.75);
    } else {
      adherenceScore = Math.min(adherenceScore, 0.65); // Worsening suggests issues
    }
  }

  return {
    score: adherenceScore,
    percentage: Math.round(adherenceScore * 100),
    available: true,
    weight: 0.3,
    source: 'Lab trend analysis',
    details: {
      latestEgfr,
      previousEgfr,
      latestUacr,
      previousUacr,
      egfrChange: latestEgfr && previousEgfr ? latestEgfr - previousEgfr : null,
      uacrChangePercent:
        latestUacr && previousUacr
          ? Math.round(((latestUacr - previousUacr) / previousUacr) * 100)
          : null,
    },
  };
}

async function getSelfReportedComponent(
  patient_id: string,
  period_days: number
): Promise<AdherenceComponent | undefined> {
  const result = await pool.query(
    `SELECT self_reported_score, reported_at, days_missed, reporting_period_days
     FROM patient_reported_adherence
     WHERE patient_id = $1
       AND reported_at >= CURRENT_DATE - INTERVAL '${period_days} days'
     ORDER BY reported_at DESC
     LIMIT 1`,
    [patient_id]
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  const row = result.rows[0];

  return {
    score: parseFloat(row.self_reported_score),
    percentage: Math.round(parseFloat(row.self_reported_score) * 100),
    available: true,
    weight: 0.2,
    source: 'Patient self-report',
    details: {
      reportedAt: row.reported_at,
      daysMissed: row.days_missed,
      reportingPeriod: row.reporting_period_days,
    },
  };
}

async function calculateComposite(
  mpr_score?: number,
  lab_score?: number,
  self_score?: number
): Promise<any> {
  const result = await pool.query(
    `SELECT * FROM calculate_composite_adherence($1, $2, $3)`,
    [mpr_score, lab_score, self_score]
  );

  return result.rows[0];
}

async function getClinicalContext(patient_id: string): Promise<any> {
  const labQuery = `
    SELECT observation_type, value_numeric as value, observation_date
    FROM observations
    WHERE patient_id = $1
      AND observation_type IN ('eGFR', 'uACR')
    ORDER BY observation_date DESC
    LIMIT 4
  `;

  const labResult = await pool.query(labQuery, [patient_id]);

  let latestEgfr: number | null = null;
  let previousEgfr: number | null = null;
  let latestUacr: number | null = null;
  let previousUacr: number | null = null;

  for (const lab of labResult.rows) {
    if (lab.observation_type === 'eGFR') {
      if (latestEgfr === null) latestEgfr = parseFloat(lab.value);
      else if (previousEgfr === null) previousEgfr = parseFloat(lab.value);
    }
    if (lab.observation_type === 'uACR') {
      if (latestUacr === null) latestUacr = parseFloat(lab.value);
      else if (previousUacr === null) previousUacr = parseFloat(lab.value);
    }
  }

  const egfrTrend =
    latestEgfr !== null && previousEgfr !== null
      ? latestEgfr - previousEgfr > 5
        ? 'IMPROVING'
        : latestEgfr - previousEgfr < -5
          ? 'WORSENING'
          : 'STABLE'
      : 'UNKNOWN';

  const uacrTrend =
    latestUacr !== null && previousUacr !== null
      ? ((latestUacr - previousUacr) / previousUacr) * 100 < -15
        ? 'IMPROVING'
        : ((latestUacr - previousUacr) / previousUacr) * 100 > 15
          ? 'WORSENING'
          : 'STABLE'
      : 'UNKNOWN';

  let treatmentResponse = 'Monitoring ongoing';
  if (egfrTrend === 'IMPROVING' || uacrTrend === 'IMPROVING') {
    treatmentResponse = 'Positive treatment response - kidney function improving';
  } else if (egfrTrend === 'WORSENING' || uacrTrend === 'WORSENING') {
    treatmentResponse = 'Concerning - kidney function declining despite treatment';
  } else {
    treatmentResponse = 'Stable disease - treatment maintaining kidney function';
  }

  return {
    latestEgfr,
    latestUacr,
    egfrTrend,
    uacrTrend,
    treatmentResponse,
  };
}

async function detectAllBarriers(
  patient_id: string,
  mprComponent: AdherenceComponent | undefined,
  selfComponent: AdherenceComponent | undefined,
  compositeScore: number
): Promise<AdherenceBarrier[]> {
  const barriers: AdherenceBarrier[] = [];

  // Check self-reported barriers
  if (selfComponent?.available) {
    const result = await pool.query(
      `SELECT reported_barriers, barrier_details
       FROM patient_reported_adherence
       WHERE patient_id = $1
       ORDER BY reported_at DESC
       LIMIT 1`,
      [patient_id]
    );

    if (result.rows.length > 0 && result.rows[0].reported_barriers) {
      const reportedBarriers = result.rows[0].reported_barriers;
      if (reportedBarriers.includes('cost')) {
        barriers.push({
          type: 'COST',
          severity: 'HIGH',
          description: 'Patient reported cost as barrier to adherence',
        });
      }
      if (reportedBarriers.includes('side_effects')) {
        barriers.push({
          type: 'SIDE_EFFECTS',
          severity: 'HIGH',
          description: 'Patient experiencing medication side effects',
        });
      }
      if (reportedBarriers.includes('forgetfulness')) {
        barriers.push({
          type: 'FORGETFULNESS',
          severity: 'MEDIUM',
          description: 'Patient reports difficulty remembering medications',
        });
      }
    }
  }

  // Infer barriers from low adherence without clear cause
  if (compositeScore < 0.75 && barriers.length === 0) {
    barriers.push({
      type: 'ACCESS',
      severity: 'MEDIUM',
      description: 'Low adherence without identified specific barrier - assess access and understanding',
    });
  }

  return barriers;
}

async function getAdherenceHistory(
  patient_id: string,
  limit: number
): Promise<HistoricalAdherence[]> {
  const result = await pool.query(
    `SELECT calculated_at, composite_score, adherence_category
     FROM composite_adherence_scores
     WHERE patient_id = $1
     ORDER BY calculated_at DESC
     LIMIT $2`,
    [patient_id, limit]
  );

  return result.rows.map((row) => ({
    date: row.calculated_at,
    score: parseFloat(row.composite_score),
    category: row.adherence_category,
  })).reverse();
}

function calculateTrend(history: HistoricalAdherence[]): 'IMPROVING' | 'STABLE' | 'DECLINING' | 'UNKNOWN' {
  if (history.length < 2) return 'UNKNOWN';

  const recent = history.slice(-3);
  const avgRecent = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;

  const older = history.slice(0, -3);
  if (older.length === 0) return 'UNKNOWN';
  const avgOlder = older.reduce((sum, h) => sum + h.score, 0) / older.length;

  const change = avgRecent - avgOlder;

  if (change > 0.05) return 'IMPROVING';
  if (change < -0.05) return 'DECLINING';
  return 'STABLE';
}

async function assessAdherenceRisk(
  patient_id: string,
  currentAdherence: number
): Promise<RiskAssessment> {
  // Get patient data for risk assessment
  const patientData = await pool.query(
    `SELECT
       EXTRACT(YEAR FROM AGE(date_of_birth)) as age,
       (SELECT COUNT(*) FROM patient_medications WHERE patient_id = $1 AND is_active = true) as med_count,
       (SELECT COUNT(*) FROM patient_risk_factors WHERE patient_id = $1) as comorbidity_count
     FROM patients
     WHERE id = $1`,
    [patient_id]
  );

  if (patientData.rows.length === 0) {
    return createDefaultRiskAssessment();
  }

  const { age, med_count, comorbidity_count } = patientData.rows[0];

  const riskResult = await pool.query(
    `SELECT * FROM assess_adherence_risk($1, $2, $3, $4, $5)`,
    [patient_id, age || 50, med_count || 1, comorbidity_count || 0, currentAdherence]
  );

  const risk = riskResult.rows[0];

  const interventions = generateInterventions(risk.risk_category, currentAdherence);
  const priority =
    risk.risk_category === 'HIGH' ? 'INTENSIVE' : risk.risk_category === 'MEDIUM' ? 'ENHANCED' : 'ROUTINE';

  return {
    riskScore: parseFloat(risk.risk_score),
    riskCategory: risk.risk_category,
    riskFactors: risk.risk_factors || [],
    recommendedInterventions: interventions,
    interventionPriority: priority,
  };
}

function generateInterventions(riskCategory: string, adherence: number): string[] {
  const interventions: string[] = [];

  if (riskCategory === 'HIGH' || adherence < 0.75) {
    interventions.push('Schedule urgent adherence counseling visit');
    interventions.push('Evaluate for medication synchronization program');
    interventions.push('Assess financial barriers and apply for patient assistance if needed');
    interventions.push('Consider pill organizer or medication reminder app');
  } else if (riskCategory === 'MEDIUM' || adherence < 0.90) {
    interventions.push('Brief adherence discussion at next scheduled visit');
    interventions.push('Provide educational materials on CKD medication importance');
    interventions.push('Consider simplifying medication regimen if possible');
  } else {
    interventions.push('Continue positive reinforcement');
    interventions.push('Maintain current monitoring schedule');
  }

  return interventions;
}

function generateSmartAlerts(
  composite: any,
  clinical: any,
  barriers: AdherenceBarrier[],
  risk?: RiskAssessment
): AdherenceAlert[] {
  const alerts: AdherenceAlert[] = [];

  // Critical: Poor adherence + Clinical worsening
  if (composite.composite_score < 0.90 && (clinical.egfrTrend === 'WORSENING' || clinical.uacrTrend === 'WORSENING')) {
    alerts.push({
      priority: 'CRITICAL',
      message: `Poor adherence (${Math.round(composite.composite_score * 100)}%) with declining kidney function`,
      action: 'URGENT: Immediate patient contact and adherence intervention required',
      reasoning: [
        'Kidney function actively worsening',
        'Current adherence level insufficient',
        'Risk of accelerated CKD progression',
      ],
    });
  }

  // High: Good adherence but worsening (treatment failure)
  else if (composite.composite_score >= 0.90 && (clinical.egfrTrend === 'WORSENING' || clinical.uacrTrend === 'WORSENING')) {
    alerts.push({
      priority: 'HIGH',
      message: `Good adherence but kidney function declining - possible treatment inadequacy`,
      action: 'Consider nephrology referral or treatment intensification',
      reasoning: [
        'Patient is adherent to current therapy',
        'Disease progression continues despite adherence',
        'May need additional or alternative CKD therapies',
      ],
    });
  }

  // High: Poor adherence
  else if (composite.composite_score < 0.75) {
    alerts.push({
      priority: 'HIGH',
      message: `Poor medication adherence (${Math.round(composite.composite_score * 100)}%)`,
      action: 'Schedule adherence assessment visit within 1 week',
      reasoning: [
        'Adherence <75% associated with 2x higher progression risk',
        'Significant barrier likely present',
        barriers.length > 0 ? `Identified barriers: ${barriers.map((b) => b.type).join(', ')}` : 'Barrier assessment needed',
      ],
    });
  }

  // Medium: Suboptimal adherence
  else if (composite.composite_score < 0.90) {
    alerts.push({
      priority: 'MEDIUM',
      message: `Suboptimal adherence (${Math.round(composite.composite_score * 100)}%)`,
      action: 'Address at next routine visit',
      reasoning: [
        'Adherence below optimal 90% threshold',
        'Brief intervention likely to improve outcomes',
      ],
    });
  }

  // Low: Good adherence
  else {
    alerts.push({
      priority: 'LOW',
      message: 'Excellent medication adherence maintained',
      action: 'Continue current support',
      reasoning: ['Optimal adherence level achieved', clinical.treatmentResponse],
    });
  }

  return alerts;
}

function generateRecommendations(
  composite: any,
  barriers: AdherenceBarrier[],
  risk: RiskAssessment | undefined,
  clinical: any
): string[] {
  const recommendations: string[] = [];

  // Barrier-specific recommendations
  for (const barrier of barriers) {
    switch (barrier.type) {
      case 'COST':
        recommendations.push('Explore patient assistance programs and generic alternatives');
        break;
      case 'SIDE_EFFECTS':
        recommendations.push('Evaluate for dose adjustment or alternative medication');
        break;
      case 'FORGETFULNESS':
        recommendations.push('Provide pill organizer and recommend medication reminder app');
        break;
      case 'ACCESS':
        recommendations.push('Assess pharmacy access and consider mail-order or 90-day supplies');
        break;
    }
  }

  // Risk-based recommendations
  if (risk?.recommendedInterventions) {
    recommendations.push(...risk.recommendedInterventions);
  }

  // Clinical context recommendations
  if (clinical.egfrTrend === 'WORSENING' && composite.composite_score >= 0.90) {
    recommendations.push('Despite good adherence, consider therapy intensification or nephrology consultation');
  } else if (clinical.egfrTrend === 'IMPROVING' || clinical.uacrTrend === 'IMPROVING') {
    recommendations.push('Positive clinical response - reinforce adherence behaviors and continue current plan');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue current adherence monitoring and support');
  }

  return [...new Set(recommendations)]; // Remove duplicates
}

async function saveCompositeScore(
  patient_id: string,
  composite: any,
  mpr: AdherenceComponent | undefined,
  lab: AdherenceComponent | undefined,
  self: AdherenceComponent | undefined,
  clinical: any,
  barriers: AdherenceBarrier[]
): Promise<void> {
  const cycleResult = await pool.query('SELECT get_current_cycle() as cycle');
  const currentCycle = cycleResult.rows[0].cycle;

  await pool.query(
    `INSERT INTO composite_adherence_scores (
      patient_id, cycle_number, calculated_at,
      mpr_score, mpr_available, mpr_weight,
      lab_based_score, lab_based_available, lab_weight,
      self_reported_score, self_reported_available, self_report_weight,
      composite_score, scoring_method, adherence_category,
      egfr_at_calculation, uacr_at_calculation,
      egfr_trend, uacr_trend,
      detected_barriers, barrier_severity
    ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
    [
      patient_id,
      currentCycle,
      mpr?.score,
      mpr?.available || false,
      composite.mpr_weight,
      lab?.score,
      lab?.available || false,
      composite.lab_weight,
      self?.score,
      self?.available || false,
      composite.self_report_weight,
      composite.composite_score,
      composite.scoring_method,
      composite.adherence_category,
      clinical.latestEgfr,
      clinical.latestUacr,
      clinical.egfrTrend,
      clinical.uacrTrend,
      barriers.map((b) => b.type),
      barriers.length > 0 ? barriers[0].severity : 'LOW',
    ]
  );

  // Update patient_treatments with latest adherence
  await pool.query(
    `UPDATE patient_treatments
     SET latest_composite_adherence = $1,
         adherence_category = $2,
         last_adherence_update = NOW()
     WHERE patient_id = $3 AND status = 'active'`,
    [composite.composite_score, composite.adherence_category, patient_id]
  );
}

async function getMedicationAdherenceBreakdown(
  patient_id: string,
  treatments: any[]
): Promise<MedicationAdherenceDetail[]> {
  return treatments.map((t) => ({
    medicationName: t.medication_name,
    medicationType: t.medication_class,
    adherence: t.current_adherence || 0.8,
    category:
      (t.current_adherence || 0.8) >= 0.9 ? 'GOOD' : (t.current_adherence || 0.8) >= 0.75 ? 'SUBOPTIMAL' : 'POOR',
  }));
}

function createNoTreatmentResponse(patient_id: string): CompositeAdherenceOutput {
  return {
    patientId: patient_id,
    compositeScore: 0,
    compositePercentage: 0,
    adherenceCategory: 'POOR',
    scoringMethod: 'no_treatment',
    components: {},
    medications: [],
    clinicalContext: {
      latestEgfr: null,
      latestUacr: null,
      egfrTrend: 'UNKNOWN',
      uacrTrend: 'UNKNOWN',
      treatmentResponse: 'No active treatments',
    },
    detectedBarriers: [],
    alerts: [
      {
        priority: 'HIGH',
        message: 'Patient not on any CKD treatment',
        action: 'Review for treatment eligibility',
        reasoning: ['No active medications tracked', 'Assess for treatment indications'],
      },
    ],
    recommendations: ['Assess patient for CKD treatment eligibility', 'Review KDIGO guidelines'],
    adherenceTrend: 'UNKNOWN',
  };
}

function createDefaultRiskAssessment(): RiskAssessment {
  return {
    riskScore: 0.5,
    riskCategory: 'MEDIUM',
    riskFactors: ['Insufficient data for detailed risk assessment'],
    recommendedInterventions: ['Monitor adherence closely', 'Collect baseline adherence data'],
    interventionPriority: 'ROUTINE',
  };
}
