import { pool } from '../database.js';

export interface PreDiagnosisRiskInput {
  patient_id: string;
}

export interface RiskFactor {
  factor: string;
  points: number;
  category: string;
}

export interface PreDiagnosisRiskOutput {
  riskTier: 'TIER_1_HIGH' | 'TIER_2_MODERATE' | 'TIER_3_LOW';
  riskScore: number;
  riskFactors: RiskFactor[];
  missingData: string[];
  priority: 'URGENT' | 'ROUTINE' | 'STANDARD';
  testingTimeline: string;
  expectedYield: string;
  recommendations: string[];
  minutefulKidneyRecommendation: string;
}

/**
 * PHASE 1: PRE-DIAGNOSIS RISK ASSESSMENT
 *
 * Implements 3-tier risk stratification when eGFR/uACR data is unavailable.
 * Uses comorbidities, medications, vitals, and other clinical indicators.
 *
 * Based on: Unified CKD Specification v3.0, Phase 1
 */
export async function assessPreDiagnosisRisk(input: PreDiagnosisRiskInput): Promise<PreDiagnosisRiskOutput> {
  const { patient_id } = input;

  // Get comprehensive patient data
  const patientQuery = `
    SELECT
      EXTRACT(YEAR FROM AGE(date_of_birth)) as age,
      has_diabetes,
      has_hypertension,
      has_heart_failure,
      has_cad,
      cvd_history,
      family_history_esrd,
      on_ras_inhibitor,
      on_sglt2i,
      nephrotoxic_meds,
      weight,
      height
    FROM patients
    WHERE id = $1
  `;

  const patientResult = await pool.query(patientQuery, [patient_id]);
  if (patientResult.rows.length === 0) {
    throw new Error(`Patient not found: ${patient_id}`);
  }

  const patient = patientResult.rows[0];

  // Get latest vitals (blood pressure)
  const vitalsQuery = `
    SELECT value, unit
    FROM observations
    WHERE patient_id = $1
      AND observation_type IN ('Systolic Blood Pressure', 'Diastolic Blood Pressure')
    ORDER BY observed_date DESC
    LIMIT 2
  `;

  const vitalsResult = await pool.query(vitalsQuery, [patient_id]);
  let sbp: number | null = null;

  for (const vital of vitalsResult.rows) {
    if (vital.observation_type === 'Systolic Blood Pressure') {
      sbp = parseFloat(vital.value);
    }
  }

  // Get latest eGFR and uACR (if available)
  const labQuery = `
    SELECT observation_type, value
    FROM observations
    WHERE patient_id = $1
      AND observation_type IN ('eGFR', 'uACR')
    ORDER BY observed_date DESC
    LIMIT 2
  `;

  const labResult = await pool.query(labQuery, [patient_id]);
  let egfr: number | null = null;
  let uacr: number | null = null;

  for (const lab of labResult.rows) {
    if (lab.observation_type === 'eGFR' && egfr === null) {
      egfr = parseFloat(lab.value);
    }
    if (lab.observation_type === 'uACR' && uacr === null) {
      uacr = parseFloat(lab.value);
    }
  }

  // Calculate BMI
  const calculateBMI = (weight: number, height: number): number | null => {
    if (!weight || !height) return null;
    const heightInMeters = height / 100;
    return weight / (heightInMeters * heightInMeters);
  };

  const bmi = calculateBMI(patient.weight, patient.height);

  // Run enhanced risk scoring algorithm
  return calculateEnhancedRiskScore({
    age: patient.age,
    hasDiabetes: patient.has_diabetes,
    hasHypertension: patient.has_hypertension,
    hasHeartFailure: patient.has_heart_failure,
    hasCad: patient.has_cad,
    cvdHistory: patient.cvd_history,
    familyHistoryEsrd: patient.family_history_esrd,
    onRasInhibitor: patient.on_ras_inhibitor,
    onSglt2i: patient.on_sglt2i,
    nephrotoxicMeds: patient.nephrotoxic_meds,
    sbp,
    bmi,
    egfr,
    uacr,
  });
}

interface PatientRiskData {
  age: number;
  hasDiabetes: boolean;
  hasHypertension: boolean;
  hasHeartFailure: boolean;
  hasCad: boolean;
  cvdHistory: boolean;
  familyHistoryEsrd: boolean;
  onRasInhibitor: boolean;
  onSglt2i: boolean;
  nephrotoxicMeds: string | null;
  sbp: number | null;
  bmi: number | null;
  egfr: number | null;
  uacr: number | null;
}

function calculateEnhancedRiskScore(data: PatientRiskData): PreDiagnosisRiskOutput {
  let riskScore = 0;
  const riskFactors: RiskFactor[] = [];
  const missingData: string[] = [];

  // STEP 1: High-risk comorbidities (20-30 points)
  if (data.hasDiabetes && data.age > 40) {
    riskScore += 30;
    riskFactors.push({
      factor: 'Type 2 Diabetes + Age >40 (Very High Risk)',
      points: 30,
      category: 'Comorbidity',
    });
  }

  if (data.hasDiabetes && data.hasHypertension) {
    riskScore += 30;
    riskFactors.push({
      factor: 'Combined Diabetes + Hypertension (Very High Risk)',
      points: 30,
      category: 'Comorbidity',
    });
  }

  if (data.hasHeartFailure) {
    riskScore += 25;
    riskFactors.push({
      factor: 'Heart Failure (Cardiorenal Syndrome)',
      points: 25,
      category: 'Comorbidity',
    });
  }

  if (data.familyHistoryEsrd && (data.hasDiabetes || data.hasHypertension)) {
    riskScore += 20;
    riskFactors.push({
      factor: 'Family history of ESRD + risk factors',
      points: 20,
      category: 'Family History',
    });
  }

  // STEP 2: BLOOD PRESSURE ASSESSMENT (10-25 points)
  if (data.sbp !== null) {
    if (data.sbp >= 160) {
      riskScore += 25;
      riskFactors.push({
        factor: `Severe Hypertension (SBP ${data.sbp} mmHg)`,
        points: 25,
        category: 'Vitals',
      });
    } else if (data.sbp >= 140) {
      riskScore += 15;
      riskFactors.push({
        factor: `Uncontrolled Hypertension (SBP ${data.sbp} mmHg)`,
        points: 15,
        category: 'Vitals',
      });
    } else if (data.sbp >= 130 && data.hasDiabetes) {
      riskScore += 10;
      riskFactors.push({
        factor: `Elevated BP in diabetic (SBP ${data.sbp} mmHg)`,
        points: 10,
        category: 'Vitals',
      });
    }
  } else {
    missingData.push('Systolic Blood Pressure');
  }

  // STEP 3: MEDICATION PROXIES (only if labs/vitals missing)
  if (data.onSglt2i) {
    riskScore += 30;
    riskFactors.push({
      factor: 'Taking SGLT2 inhibitor (Confirmed CKD with proteinuria)',
      points: 30,
      category: 'Medication Proxy',
    });
  }

  if (data.onRasInhibitor && data.sbp === null) {
    riskScore += 10;
    riskFactors.push({
      factor: 'On RAS inhibitor (Hypertension likely)',
      points: 10,
      category: 'Medication Proxy',
    });
  }

  if (data.nephrotoxicMeds) {
    riskScore += 12;
    riskFactors.push({
      factor: 'Chronic nephrotoxic medication exposure',
      points: 12,
      category: 'Medication Risk',
    });
  }

  // STEP 4: OBESITY (8-15 points)
  if (data.bmi !== null) {
    if (data.bmi >= 35) {
      riskScore += 15;
      riskFactors.push({
        factor: `Severe Obesity (BMI ${data.bmi.toFixed(1)})`,
        points: 15,
        category: 'Vitals',
      });
    } else if (data.bmi >= 30) {
      riskScore += 10;
      riskFactors.push({
        factor: `Obesity (BMI ${data.bmi.toFixed(1)})`,
        points: 10,
        category: 'Vitals',
      });
    }
  } else {
    missingData.push('BMI (weight/height)');
  }

  // STEP 5: LAB VALUES (if available - highest priority, overrides other scores)
  if (data.egfr !== null) {
    if (data.egfr < 60) {
      riskScore += 40; // Override - this is confirmed CKD
      riskFactors.push({
        factor: `Reduced eGFR (${data.egfr} mL/min) - Confirmed CKD`,
        points: 40,
        category: 'Lab Value',
      });
    } else if (data.egfr < 90) {
      riskScore += 10;
      riskFactors.push({
        factor: `Mildly reduced eGFR (${data.egfr} mL/min)`,
        points: 10,
        category: 'Lab Value',
      });
    }
  } else {
    missingData.push('eGFR');
  }

  if (data.uacr !== null) {
    if (data.uacr >= 30) {
      riskScore += 35; // Confirmed proteinuria
      riskFactors.push({
        factor: `Albuminuria present (uACR ${data.uacr} mg/g)`,
        points: 35,
        category: 'Lab Value',
      });
    }
  } else {
    missingData.push('uACR');
  }

  // STEP 6: STRATIFY RISK LEVEL
  let riskTier: 'TIER_1_HIGH' | 'TIER_2_MODERATE' | 'TIER_3_LOW';
  let priority: 'URGENT' | 'ROUTINE' | 'STANDARD';
  let testingTimeline: string;
  let expectedYield: string;
  let minutefulKidneyRecommendation: string;

  if (riskScore >= 40) {
    riskTier = 'TIER_1_HIGH';
    priority = 'URGENT';
    testingTimeline = 'Order tests immediately (this week)';
    expectedYield = '40-60% will have abnormal results';
    minutefulKidneyRecommendation = 'Minuteful Kidney home monitoring STRONGLY RECOMMENDED - FDA-cleared smartphone uACR test for convenient at-home monitoring';
  } else if (riskScore >= 20) {
    riskTier = 'TIER_2_MODERATE';
    priority = 'ROUTINE';
    testingTimeline = 'Order tests at next visit (1-3 months)';
    expectedYield = '20-35% will have abnormal results';
    minutefulKidneyRecommendation = 'Minuteful Kidney recommended if tests show CKD - improves adherence through at-home convenience';
  } else {
    riskTier = 'TIER_3_LOW';
    priority = 'STANDARD';
    testingTimeline = 'Standard screening (annual or at age 40)';
    expectedYield = '<10% will have abnormal results';
    minutefulKidneyRecommendation = 'Standard lab monitoring adequate; consider Minuteful Kidney if CKD risk factors develop';
  }

  const recommendations = generatePreDiagnosisRecommendations(
    riskTier,
    missingData,
    data
  );

  return {
    riskTier,
    riskScore,
    riskFactors,
    missingData,
    priority,
    testingTimeline,
    expectedYield,
    recommendations,
    minutefulKidneyRecommendation,
  };
}

function generatePreDiagnosisRecommendations(
  tier: string,
  missingData: string[],
  data: PatientRiskData
): string[] {
  const recommendations: string[] = [];

  if (tier === 'TIER_1_HIGH') {
    recommendations.push('Order baseline eGFR and uACR immediately (this week)');
    recommendations.push('Consider nephrology referral if results abnormal');
    recommendations.push('Optimize blood pressure and glycemic control');
  } else if (tier === 'TIER_2_MODERATE') {
    recommendations.push('Order eGFR and uACR at next visit');
    recommendations.push('Monitor and control risk factors');
  } else {
    recommendations.push('Continue standard preventive care');
    recommendations.push('Re-assess if risk factors develop');
  }

  // Missing data recommendations
  if (missingData.includes('eGFR') || missingData.includes('uACR')) {
    recommendations.push('Baseline kidney function testing needed for accurate risk assessment');
  }

  if (missingData.includes('Systolic Blood Pressure')) {
    recommendations.push('Measure blood pressure at next visit');
  }

  // Specific clinical recommendations
  if (data.hasHypertension && data.sbp && data.sbp >= 140) {
    recommendations.push('Intensify blood pressure management (target <130/80 mmHg)');
  }

  if (data.hasDiabetes) {
    recommendations.push('Optimize glycemic control (target HbA1c <7%)');
  }

  if (data.bmi && data.bmi >= 30) {
    recommendations.push('Weight loss counseling and lifestyle modification');
  }

  return recommendations;
}
