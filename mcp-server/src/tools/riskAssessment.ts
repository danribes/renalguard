import { pool } from '../database.js';

export interface CalculateRiskInput {
  patient_id: string;
}

export interface RiskAssessmentOutput {
  kdigoCategory: string;
  ckdStage: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  recommendations: string[];
  monitoring: {
    frequency: string;
    tests: string[];
  };
  clinicalInsights: string[];
}

export async function calculateCKDRisk(input: CalculateRiskInput): Promise<RiskAssessmentOutput> {
  const { patient_id } = input;

  // Get latest eGFR and uACR
  const labQuery = `
    SELECT observation_type, value, observed_date
    FROM observations
    WHERE patient_id = $1
      AND observation_type IN ('eGFR', 'uACR')
    ORDER BY observed_date DESC
  `;

  const labResult = await pool.query(labQuery, [patient_id]);

  let egfr: number | null = null;
  let uacr: number | null = null;

  for (const lab of labResult.rows) {
    if (lab.observation_type === 'eGFR' && egfr === null) {
      egfr = lab.value;
    }
    if (lab.observation_type === 'uACR' && uacr === null) {
      uacr = lab.value;
    }
    if (egfr !== null && uacr !== null) break;
  }

  if (egfr === null || uacr === null) {
    throw new Error('Insufficient lab data for risk assessment. Missing eGFR or uACR values.');
  }

  // Get patient comorbidities for enhanced risk stratification
  const patientQuery = `
    SELECT has_diabetes, has_hypertension, has_heart_failure, has_cad,
           cvd_history, EXTRACT(YEAR FROM AGE(date_of_birth)) as age
    FROM patients
    WHERE id = $1
  `;

  const patientResult = await pool.query(patientQuery, [patient_id]);
  const patient = patientResult.rows[0];

  // Determine CKD stage based on eGFR
  const ckdStage = determineCKDStage(egfr);

  // Determine albuminuria category
  const albuminuriaCategory = determineAlbuminuriaCategory(uacr);

  // KDIGO risk category
  const kdigoCategory = getKDIGOCategory(ckdStage, albuminuriaCategory);

  // Calculate risk level
  const { riskLevel, riskScore } = calculateRiskLevel(
    egfr,
    uacr,
    patient
  );

  // Generate recommendations
  const recommendations = generateRecommendations(
    riskLevel,
    ckdStage,
    albuminuriaCategory,
    patient
  );

  // Determine monitoring frequency
  const monitoring = getMonitoringPlan(kdigoCategory, riskLevel);

  // Generate clinical insights
  const clinicalInsights = generateClinicalInsights(
    egfr,
    uacr,
    ckdStage,
    albuminuriaCategory,
    patient
  );

  return {
    kdigoCategory,
    ckdStage,
    riskLevel,
    riskScore,
    recommendations,
    monitoring,
    clinicalInsights,
  };
}

function determineCKDStage(egfr: number): string {
  if (egfr >= 90) return 'G1';
  if (egfr >= 60) return 'G2';
  if (egfr >= 45) return 'G3a';
  if (egfr >= 30) return 'G3b';
  if (egfr >= 15) return 'G4';
  return 'G5';
}

function determineAlbuminuriaCategory(uacr: number): string {
  if (uacr < 30) return 'A1';
  if (uacr < 300) return 'A2';
  return 'A3';
}

function getKDIGOCategory(ckdStage: string, albuminuriaCategory: string): string {
  // KDIGO risk classification matrix
  const riskMatrix: { [key: string]: { [key: string]: string } } = {
    G1: { A1: 'Green', A2: 'Yellow', A3: 'Orange' },
    G2: { A1: 'Green', A2: 'Yellow', A3: 'Orange' },
    G3a: { A1: 'Yellow', A2: 'Orange', A3: 'Red' },
    G3b: { A1: 'Orange', A2: 'Red', A3: 'Red' },
    G4: { A1: 'Red', A2: 'Red', A3: 'Red' },
    G5: { A1: 'Red', A2: 'Red', A3: 'Red' },
  };

  return riskMatrix[ckdStage]?.[albuminuriaCategory] || 'Unknown';
}

function calculateRiskLevel(
  egfr: number,
  uacr: number,
  patient: any
): { riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'; riskScore: number } {
  let score = 0;

  // eGFR contribution
  if (egfr < 15) score += 50;
  else if (egfr < 30) score += 40;
  else if (egfr < 45) score += 30;
  else if (egfr < 60) score += 20;
  else if (egfr < 90) score += 10;

  // uACR contribution
  if (uacr >= 300) score += 30;
  else if (uacr >= 30) score += 15;

  // Comorbidity contributions
  if (patient.has_diabetes) score += 15;
  if (patient.has_hypertension) score += 10;
  if (patient.has_heart_failure) score += 15;
  if (patient.cvd_history) score += 10;
  if (patient.age > 65) score += 10;

  // Determine risk level from score
  let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  if (score >= 70) riskLevel = 'CRITICAL';
  else if (score >= 50) riskLevel = 'HIGH';
  else if (score >= 30) riskLevel = 'MODERATE';
  else riskLevel = 'LOW';

  return { riskLevel, riskScore: score };
}

function generateRecommendations(
  riskLevel: string,
  ckdStage: string,
  albuminuriaCategory: string,
  patient: any
): string[] {
  const recommendations: string[] = [];

  // Nephrology referral
  if (riskLevel === 'CRITICAL' || ckdStage === 'G5' || ckdStage === 'G4') {
    recommendations.push('Urgent nephrology referral recommended');
  } else if (riskLevel === 'HIGH' || ckdStage === 'G3b') {
    recommendations.push('Consider nephrology referral');
  }

  // Medication recommendations
  if (patient.has_diabetes || albuminuriaCategory !== 'A1') {
    recommendations.push('Consider ACE inhibitor or ARB for kidney protection');
  }

  if (patient.has_diabetes && ckdStage !== 'G5') {
    recommendations.push('Consider SGLT2 inhibitor if eGFR ≥20');
  }

  // Blood pressure management
  if (patient.has_hypertension || albuminuriaCategory !== 'A1') {
    recommendations.push('Target blood pressure <130/80 mmHg');
  }

  // Lifestyle modifications
  recommendations.push('Dietary sodium restriction (<2g/day)');
  recommendations.push('Maintain healthy weight and physical activity');

  if (patient.smoking_status === 'current') {
    recommendations.push('Smoking cessation critical for kidney health');
  }

  return recommendations;
}

function getMonitoringPlan(
  kdigoCategory: string,
  riskLevel: string
): { frequency: string; tests: string[] } {
  const tests = ['eGFR', 'uACR', 'Creatinine', 'Electrolytes'];

  let frequency: string;
  if (riskLevel === 'CRITICAL' || kdigoCategory === 'Red') {
    frequency = 'Every 3 months';
    tests.push('CBC', 'PTH', 'Vitamin D');
  } else if (riskLevel === 'HIGH' || kdigoCategory === 'Orange') {
    frequency = 'Every 6 months';
  } else if (riskLevel === 'MODERATE' || kdigoCategory === 'Yellow') {
    frequency = 'Annually';
  } else {
    frequency = 'Every 1-2 years';
  }

  return { frequency, tests };
}

function generateClinicalInsights(
  egfr: number,
  uacr: number,
  ckdStage: string,
  albuminuriaCategory: string,
  patient: any
): string[] {
  const insights: string[] = [];

  // eGFR interpretation
  if (egfr < 60) {
    insights.push(`CKD Stage ${ckdStage.substring(1)}: Kidney function at ${egfr}% of normal`);
  }

  // Albuminuria significance
  if (albuminuriaCategory === 'A3') {
    insights.push('Severe albuminuria indicates significant kidney damage and increased CV risk');
  } else if (albuminuriaCategory === 'A2') {
    insights.push('Moderate albuminuria suggests early kidney damage');
  }

  // Combined risk
  if (patient.has_diabetes && albuminuriaCategory !== 'A1') {
    insights.push('Diabetic nephropathy likely; aggressive glycemic control needed');
  }

  // Progression risk
  if (egfr < 45 || albuminuriaCategory === 'A3') {
    insights.push('High risk of CKD progression; close monitoring essential');
  }

  return insights;
}
