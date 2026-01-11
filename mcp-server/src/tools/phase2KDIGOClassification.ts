import { pool } from '../database.js';

export interface KDIGOClassificationInput {
  patient_id: string;
}

export interface KDIGOClassificationOutput {
  gfrCategory: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';
  albuminuriaCategory: 'A1' | 'A2' | 'A3';
  kdigoRiskLevel: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  ckdStage: string;
  currentEgfr: number;
  currentUacr: number;
  trajectoryAnalysis: TrajectoryAnalysis | null;
  monitoringPlan: MonitoringPlan;
  clinicalInsights: string[];
  recommendations: string[];
}

export interface TrajectoryAnalysis {
  egfrDeclineRate: number; // mL/min/year
  progressionRisk: 'RAPID' | 'MODERATE' | 'SLOW' | 'STABLE';
  timePoints: number;
  firstEgfr: number;
  lastEgfr: number;
  monthsElapsed: number;
  alert: string | null;
}

export interface MonitoringPlan {
  labFrequency: string;
  clinicVisits: string;
  minutefulKidneyFrequency: string;
}

/**
 * PHASE 2: CKD DIAGNOSIS & STAGING
 *
 * Implements KDIGO classification system using eGFR and uACR values.
 * Includes trajectory analysis for rapid progression detection.
 *
 * Based on: Unified CKD Specification v3.0, Phase 2
 */
export async function classifyKDIGO(input: KDIGOClassificationInput): Promise<KDIGOClassificationOutput> {
  const { patient_id } = input;

  // Get latest eGFR and uACR
  const latestLabsQuery = `
    SELECT observation_type, value, observed_date
    FROM observations
    WHERE patient_id = $1
      AND observation_type IN ('eGFR', 'uACR')
    ORDER BY observed_date DESC
  `;

  const labsResult = await pool.query(latestLabsQuery, [patient_id]);

  let currentEgfr: number | null = null;
  let currentUacr: number | null = null;

  for (const lab of labsResult.rows) {
    if (lab.observation_type === 'eGFR' && currentEgfr === null) {
      currentEgfr = parseFloat(lab.value);
    }
    if (lab.observation_type === 'uACR' && currentUacr === null) {
      currentUacr = parseFloat(lab.value);
    }
    if (currentEgfr !== null && currentUacr !== null) break;
  }

  if (currentEgfr === null || currentUacr === null) {
    throw new Error('Insufficient lab data for KDIGO classification. Missing eGFR or uACR values.');
  }

  // Determine GFR category
  const gfrCategory = determineGFRCategory(currentEgfr);

  // Determine albuminuria category
  const albuminuriaCategory = determineAlbuminuriaCategory(currentUacr);

  // Get KDIGO risk level from matrix
  const kdigoRiskLevel = getKDIGORiskLevel(gfrCategory, albuminuriaCategory);

  // Determine CKD stage description
  const ckdStage = determineCKDStage(gfrCategory, albuminuriaCategory);

  // Perform trajectory analysis (if historical data available)
  const trajectoryAnalysis = await analyzeTrajectory(patient_id, currentEgfr);

  // Get monitoring plan based on risk level
  const monitoringPlan = getMonitoringPlan(kdigoRiskLevel, albuminuriaCategory);

  // Generate clinical insights
  const clinicalInsights = generateClinicalInsights(
    gfrCategory,
    albuminuriaCategory,
    currentEgfr,
    currentUacr,
    trajectoryAnalysis
  );

  // Generate recommendations
  const recommendations = await generateKDIGORecommendations(
    patient_id,
    gfrCategory,
    albuminuriaCategory,
    kdigoRiskLevel,
    trajectoryAnalysis
  );

  return {
    gfrCategory,
    albuminuriaCategory,
    kdigoRiskLevel,
    ckdStage,
    currentEgfr,
    currentUacr,
    trajectoryAnalysis,
    monitoringPlan,
    clinicalInsights,
    recommendations,
  };
}

function determineGFRCategory(egfr: number): 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5' {
  if (egfr >= 90) return 'G1';
  if (egfr >= 60) return 'G2';
  if (egfr >= 45) return 'G3a';
  if (egfr >= 30) return 'G3b';
  if (egfr >= 15) return 'G4';
  return 'G5';
}

function determineAlbuminuriaCategory(uacr: number): 'A1' | 'A2' | 'A3' {
  if (uacr < 30) return 'A1';
  if (uacr < 300) return 'A2';
  return 'A3';
}

function getKDIGORiskLevel(
  gfrCategory: string,
  albuminuriaCategory: string
): 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' {
  // KDIGO Risk Matrix
  const riskMatrix: Record<string, Record<string, 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'>> = {
    G1: { A1: 'GREEN', A2: 'YELLOW', A3: 'ORANGE' },
    G2: { A1: 'GREEN', A2: 'YELLOW', A3: 'ORANGE' },
    G3a: { A1: 'YELLOW', A2: 'ORANGE', A3: 'RED' },
    G3b: { A1: 'ORANGE', A2: 'RED', A3: 'RED' },
    G4: { A1: 'RED', A2: 'RED', A3: 'RED' },
    G5: { A1: 'RED', A2: 'RED', A3: 'RED' },
  };

  return riskMatrix[gfrCategory]?.[albuminuriaCategory] || 'RED';
}

function determineCKDStage(gfrCategory: string, albuminuriaCategory: string): string {
  const stageNumber = gfrCategory.substring(1); // Extract number from G1, G2, etc.
  return `CKD Stage ${stageNumber} with ${albuminuriaCategory} albuminuria`;
}

async function analyzeTrajectory(
  patient_id: string,
  currentEgfr: number
): Promise<TrajectoryAnalysis | null> {
  // Get historical eGFR values
  const historyQuery = `
    SELECT value, observed_date
    FROM observations
    WHERE patient_id = $1
      AND observation_type = 'eGFR'
    ORDER BY observed_date ASC
  `;

  const historyResult = await pool.query(historyQuery, [patient_id]);

  if (historyResult.rows.length < 2) {
    return null; // Need at least 2 data points for trajectory
  }

  const measurements = historyResult.rows.map(row => ({
    egfr: parseFloat(row.value),
    date: new Date(row.observed_date),
  }));

  const firstMeasurement = measurements[0];
  const lastMeasurement = measurements[measurements.length - 1];

  // Calculate time elapsed in months
  const monthsElapsed =
    (lastMeasurement.date.getTime() - firstMeasurement.date.getTime()) /
    (1000 * 60 * 60 * 24 * 30.44);

  if (monthsElapsed < 3) {
    return null; // Need at least 3 months of data
  }

  // Calculate annualized decline rate
  const egfrChange = lastMeasurement.egfr - firstMeasurement.egfr;
  const egfrDeclineRate = (egfrChange / monthsElapsed) * 12;

  // Determine progression risk
  let progressionRisk: 'RAPID' | 'MODERATE' | 'SLOW' | 'STABLE';
  let alert: string | null = null;

  if (egfrDeclineRate < -5) {
    progressionRisk = 'RAPID';
    alert = 'CRITICAL: Rapid decline >5 mL/min/year - Immediate intervention + nephrology referral';
  } else if (egfrDeclineRate < -3) {
    progressionRisk = 'MODERATE';
    alert = 'HIGH: Moderate decline 3-5 mL/min/year - Optimize treatment + close monitoring';
  } else if (egfrDeclineRate < -1) {
    progressionRisk = 'SLOW';
    alert = 'MODERATE: Slow decline 1-3 mL/min/year - Continue treatment + standard monitoring';
  } else {
    progressionRisk = 'STABLE';
    alert = null;
  }

  return {
    egfrDeclineRate,
    progressionRisk,
    timePoints: measurements.length,
    firstEgfr: firstMeasurement.egfr,
    lastEgfr: lastMeasurement.egfr,
    monthsElapsed: Math.round(monthsElapsed),
    alert,
  };
}

function getMonitoringPlan(
  riskLevel: string,
  albuminuriaCategory: string
): MonitoringPlan {
  let labFrequency: string;
  let clinicVisits: string;
  let minutefulKidneyFrequency: string;

  switch (riskLevel) {
    case 'RED':
      labFrequency = 'Every 1-3 months';
      clinicVisits = 'Every 1-3 months';
      minutefulKidneyFrequency = 'Monthly - High-priority CKD monitoring with at-home convenience';
      break;
    case 'ORANGE':
      labFrequency = 'Every 3-6 months';
      clinicVisits = 'Every 3-6 months';
      minutefulKidneyFrequency = 'Every 3-6 months - Regular monitoring recommended';
      break;
    case 'YELLOW':
      labFrequency = 'Every 6-12 months';
      clinicVisits = 'Every 6-12 months';
      minutefulKidneyFrequency = albuminuriaCategory !== 'A1' ? 'Every 6-12 months - Helps track albuminuria trends' : 'Not needed - Low risk';
      break;
    case 'GREEN':
    default:
      labFrequency = 'Annually';
      clinicVisits = 'Annually';
      minutefulKidneyFrequency = 'Not needed - Standard annual lab screening adequate';
      break;
  }

  return {
    labFrequency,
    clinicVisits,
    minutefulKidneyFrequency,
  };
}

function generateClinicalInsights(
  gfrCategory: string,
  albuminuriaCategory: string,
  egfr: number,
  uacr: number,
  trajectory: TrajectoryAnalysis | null
): string[] {
  const insights: string[] = [];

  // GFR interpretation
  const stageNumber = gfrCategory.substring(1);
  if (egfr < 60) {
    insights.push(
      `CKD Stage ${stageNumber}: Kidney function at ${Math.round((egfr / 90) * 100)}% of normal`
    );
  } else if (gfrCategory === 'G2') {
    insights.push(`Mildly reduced kidney function (eGFR ${egfr})`);
  } else {
    insights.push(`Normal to near-normal kidney function (eGFR ${egfr})`);
  }

  // Albuminuria significance
  if (albuminuriaCategory === 'A3') {
    insights.push(
      `Severe albuminuria (uACR ${uacr} mg/g) indicates significant kidney damage and increased cardiovascular risk`
    );
  } else if (albuminuriaCategory === 'A2') {
    insights.push(`Moderate albuminuria (uACR ${uacr} mg/g) suggests early kidney damage`);
  } else {
    insights.push(`Normal albumin excretion (uACR ${uacr} mg/g)`);
  }

  // Trajectory insights
  if (trajectory) {
    if (trajectory.progressionRisk === 'RAPID') {
      insights.push(
        `⚠️ URGENT: Rapid eGFR decline (${Math.abs(trajectory.egfrDeclineRate).toFixed(1)} mL/min/year) - High risk of progression to kidney failure`
      );
    } else if (trajectory.progressionRisk === 'MODERATE') {
      insights.push(
        `Moderate eGFR decline (${Math.abs(trajectory.egfrDeclineRate).toFixed(1)} mL/min/year) - Active CKD progression`
      );
    } else if (trajectory.progressionRisk === 'STABLE') {
      insights.push(
        `Stable kidney function over ${trajectory.monthsElapsed} months - Current treatment appears effective`
      );
    }
  }

  // Combined risk
  if (gfrCategory === 'G3b' || gfrCategory === 'G4' || gfrCategory === 'G5') {
    insights.push('Advanced CKD - Nephrology involvement strongly recommended');
  }

  if (albuminuriaCategory === 'A3' && (gfrCategory === 'G3a' || gfrCategory === 'G3b')) {
    insights.push('Combined moderate CKD + severe albuminuria = Very High cardiovascular risk');
  }

  return insights;
}

async function generateKDIGORecommendations(
  patient_id: string,
  gfrCategory: string,
  albuminuriaCategory: string,
  riskLevel: string,
  trajectory: TrajectoryAnalysis | null
): Promise<string[]> {
  const recommendations: string[] = [];

  // Get patient comorbidities for context
  const patientQuery = `
    SELECT has_diabetes, has_hypertension, on_ras_inhibitor, on_sglt2i
    FROM patients
    WHERE id = $1
  `;

  const patientResult = await pool.query(patientQuery, [patient_id]);
  const patient = patientResult.rows[0];

  // Nephrology referral
  if (riskLevel === 'RED' || gfrCategory === 'G5') {
    recommendations.push('URGENT: Nephrology referral for kidney failure management');
  } else if (gfrCategory === 'G4') {
    recommendations.push('Nephrology referral for advanced CKD management');
  } else if (gfrCategory === 'G3b' || (gfrCategory === 'G3a' && albuminuriaCategory === 'A3')) {
    recommendations.push('Consider nephrology referral for co-management');
  }

  // Trajectory-based recommendations
  if (trajectory?.progressionRisk === 'RAPID') {
    recommendations.push('URGENT: Review and optimize all CKD therapies immediately');
    recommendations.push('Investigate reversible causes of rapid decline');
  }

  // RAS inhibitor recommendation
  if (albuminuriaCategory !== 'A1' && !patient.on_ras_inhibitor) {
    recommendations.push('Start ACE inhibitor or ARB for proteinuria reduction (KDIGO Grade 1A)');
  }

  // SGLT2i recommendation
  if (
    patient.has_diabetes &&
    albuminuriaCategory !== 'A1' &&
    gfrCategory !== 'G5' &&
    !patient.on_sglt2i
  ) {
    recommendations.push('Consider SGLT2 inhibitor (Jardiance) for CKD + diabetes (KDIGO Grade 1A)');
  }

  // Blood pressure management
  if (albuminuriaCategory !== 'A1') {
    recommendations.push('Target blood pressure <130/80 mmHg');
  } else {
    recommendations.push('Target blood pressure <140/90 mmHg');
  }

  // Lifestyle
  recommendations.push('Dietary sodium restriction (<2g/day)');
  recommendations.push('Maintain healthy weight and physical activity');

  // Monitoring
  recommendations.push(`Follow monitoring plan: ${getMonitoringPlan(riskLevel, albuminuriaCategory).labFrequency} lab checks`);

  return recommendations;
}
