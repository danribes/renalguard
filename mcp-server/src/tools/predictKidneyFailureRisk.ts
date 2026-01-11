import { pool } from '../database.js';

export interface PredictKidneyFailureRiskInput {
  patient_id: string;
  time_horizon?: 2 | 5; // Years (default: 5)
}

export interface PredictKidneyFailureRiskOutput {
  kfre_2_year_risk?: number; // Percentage
  kfre_5_year_risk?: number; // Percentage
  risk_category: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High';
  clinical_interpretation: string;
  recommendations: string[];
  input_values: {
    age: number;
    sex: 'male' | 'female';
    egfr: number;
    uacr: number;
  };
  formula_version: '4-variable KFRE (Tangri et al.)';
}

/**
 * Predict Kidney Failure Risk using KFRE (Kidney Failure Risk Equation)
 *
 * The KFRE is a validated tool to predict the risk of kidney failure (dialysis/transplant)
 * within 2 or 5 years for patients with CKD Stage 3-5.
 *
 * Reference: Tangri et al. JAMA 2011, 2016
 * Validation: Externally validated in >30 countries, >700,000 patients
 *
 * 4-Variable Model Uses:
 * - Age
 * - Sex
 * - eGFR (mL/min/1.73m²)
 * - uACR (mg/g)
 *
 * Note: 8-variable model adds albumin, phosphorus, bicarbonate, calcium
 * but offers only marginal improvement. We use 4-variable for practicality.
 */
export async function predictKidneyFailureRisk(
  input: PredictKidneyFailureRiskInput
): Promise<PredictKidneyFailureRiskOutput> {
  const { patient_id, time_horizon = 5 } = input;

  // Get patient demographics
  const patientQuery = `
    SELECT
      EXTRACT(YEAR FROM AGE(date_of_birth))::integer as age,
      gender
    FROM patients
    WHERE id = $1
  `;

  const patientResult = await pool.query(patientQuery, [patient_id]);
  if (patientResult.rows.length === 0) {
    throw new Error(`Patient not found: ${patient_id}`);
  }

  const patient = patientResult.rows[0];
  const age = patient.age;
  const sex = patient.gender.toLowerCase() as 'male' | 'female';

  // Get latest eGFR and uACR
  const labQuery = `
    SELECT observation_type, value
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
      egfr = parseFloat(lab.value);
    }
    if (lab.observation_type === 'uACR' && uacr === null) {
      uacr = parseFloat(lab.value);
    }
    if (egfr !== null && uacr !== null) break;
  }

  if (egfr === null || uacr === null) {
    throw new Error('Insufficient lab data for KFRE calculation. Missing eGFR or uACR values.');
  }

  // KFRE is most accurate for CKD Stage 3-5 (eGFR < 60)
  if (egfr >= 60) {
    return {
      risk_category: 'Very Low',
      clinical_interpretation: `KFRE not applicable: eGFR ${egfr} mL/min indicates normal to mildly reduced kidney function (Stage G1-G2). KFRE is designed for CKD Stage 3-5 (eGFR <60). Risk of kidney failure within 5 years is <1%.`,
      recommendations: [
        'KFRE calculation not needed at this eGFR level',
        'Continue standard CKD monitoring and risk factor management',
        'Re-assess if eGFR declines below 60',
      ],
      input_values: { age, sex, egfr, uacr },
      formula_version: '4-variable KFRE (Tangri et al.)',
    };
  }

  // Calculate KFRE
  const kfre2Year = calculateKFRE(age, sex, egfr, uacr, 2);
  const kfre5Year = calculateKFRE(age, sex, egfr, uacr, 5);

  // Determine risk category (based on 5-year risk)
  const riskCategory = categorizeRisk(kfre5Year);

  // Generate clinical interpretation
  const interpretation = generateInterpretation(kfre2Year, kfre5Year, egfr, uacr);

  // Generate recommendations
  const recommendations = generateRecommendations(kfre5Year, egfr, riskCategory);

  return {
    kfre_2_year_risk: kfre2Year,
    kfre_5_year_risk: kfre5Year,
    risk_category: riskCategory,
    clinical_interpretation: interpretation,
    recommendations,
    input_values: { age, sex, egfr, uacr },
    formula_version: '4-variable KFRE (Tangri et al.)',
  };
}

/**
 * Calculate KFRE using the 4-variable North American calibration
 *
 * Formula:
 * Risk = 1 - S(t)^exp(X)
 *
 * Where:
 * - S(t) = baseline survival (0.9832 for 2-year, 0.9365 for 5-year)
 * - X = linear predictor from patient values
 */
function calculateKFRE(
  age: number,
  sex: 'male' | 'female',
  egfr: number,
  uacr: number,
  timeHorizon: 2 | 5
): number {
  // Sex encoding: 1 = male, 0 = female
  const sexValue = sex === 'male' ? 1 : 0;

  // Natural log of uACR (handle zero by using small value)
  const logACR = Math.log(Math.max(uacr, 0.1));

  // Coefficient values from Tangri et al. (North American calibration)
  // Note: These are the validated published coefficients
  const coefficients = {
    age: -0.2201,
    sex: 0.2467,
    egfr: -0.5567,
    logACR: 0.4510,
  };

  // Mean centering values (from original validation cohort)
  const means = {
    age: 7.036, // (age/10)
    sex: 0.5642,
    egfr: 7.222, // (eGFR/5)
    logACR: 5.137,
  };

  // Calculate linear predictor
  const linearPredictor =
    coefficients.age * (age / 10 - means.age) +
    coefficients.sex * (sexValue - means.sex) +
    coefficients.egfr * (egfr / 5 - means.egfr) +
    coefficients.logACR * (logACR - means.logACR);

  // Baseline survival probability
  const baselineSurvival = timeHorizon === 2 ? 0.9832 : 0.9365;

  // Calculate risk
  const risk = 1 - Math.pow(baselineSurvival, Math.exp(linearPredictor));

  // Convert to percentage and round
  return Math.round(risk * 1000) / 10; // Round to 1 decimal place
}

function categorizeRisk(risk5Year: number): 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High' {
  if (risk5Year < 1) return 'Very Low';
  if (risk5Year < 3) return 'Low';
  if (risk5Year < 10) return 'Moderate';
  if (risk5Year < 25) return 'High';
  return 'Very High';
}

function generateInterpretation(risk2Year: number, risk5Year: number, egfr: number, uacr: number): string {
  const interpretations: string[] = [];

  interpretations.push(
    `Based on current kidney function (eGFR ${egfr} mL/min) and proteinuria (uACR ${uacr} mg/g):`
  );

  interpretations.push(`• 2-year kidney failure risk: ${risk2Year}%`);
  interpretations.push(`• 5-year kidney failure risk: ${risk5Year}%`);

  if (risk5Year >= 25) {
    interpretations.push(
      '\n⚠️ VERY HIGH RISK: >25% chance of requiring dialysis or transplant within 5 years. Urgent nephrology referral and kidney replacement therapy planning required.'
    );
  } else if (risk5Year >= 10) {
    interpretations.push(
      '\n⚠️ HIGH RISK: 10-25% chance of kidney failure within 5 years. Nephrology management essential. Begin pre-dialysis education and access planning.'
    );
  } else if (risk5Year >= 3) {
    interpretations.push(
      '\nMODERATE RISK: 3-10% chance of kidney failure within 5 years. Aggressive CKD management and close monitoring needed.'
    );
  } else if (risk5Year >= 1) {
    interpretations.push(
      '\nLOW RISK: 1-3% chance of kidney failure within 5 years. Continue CKD management and regular monitoring.'
    );
  } else {
    interpretations.push(
      '\nVERY LOW RISK: <1% chance of kidney failure within 5 years. Standard CKD care and monitoring appropriate.'
    );
  }

  return interpretations.join('\n');
}

function generateRecommendations(
  risk5Year: number,
  egfr: number,
  category: string
): string[] {
  const recommendations: string[] = [];

  if (risk5Year >= 25) {
    recommendations.push('🔴 URGENT nephrology referral (within 1 week)');
    recommendations.push('Begin kidney replacement therapy education (dialysis/transplant options)');
    recommendations.push('Plan vascular access (fistula creation if HD candidate)');
    recommendations.push('Transplant evaluation if eligible');
    recommendations.push('Intensify CKD therapies (SGLT2i, RAS inhibitor if not contraindicated)');
  } else if (risk5Year >= 10) {
    recommendations.push('🟠 Nephrology referral (within 1 month)');
    recommendations.push('Pre-dialysis patient education program');
    recommendations.push('Discuss kidney replacement options with patient');
    recommendations.push('Optimize all CKD therapies');
    recommendations.push('Monthly monitoring of kidney function');
  } else if (risk5Year >= 3) {
    recommendations.push('🟡 Consider nephrology consultation');
    recommendations.push('Aggressive management of CKD risk factors');
    recommendations.push('Ensure patient on SGLT2 inhibitor + RAS blocker if eligible');
    recommendations.push('Monitor eGFR every 3-6 months');
    recommendations.push('Cardiovascular risk reduction');
  } else if (risk5Year >= 1) {
    recommendations.push('Continue current CKD management plan');
    recommendations.push('Standard monitoring (eGFR every 6-12 months)');
    recommendations.push('Optimize blood pressure and glycemic control');
  } else {
    recommendations.push('Standard CKD care appropriate');
    recommendations.push('Annual monitoring sufficient');
    recommendations.push('Focus on preventing CKD progression');
  }

  // Add eGFR-specific recommendations
  if (egfr < 20) {
    recommendations.push('⚠️ eGFR <20: Prepare for imminent kidney failure');
    recommendations.push('Avoid nephrotoxins (NSAIDs, contrast, aminoglycosides)');
    recommendations.push('Adjust medication doses for GFR <20');
  } else if (egfr < 30) {
    recommendations.push('Review all medications for renal dosing (eGFR <30)');
    recommendations.push('Screen for CKD complications (anemia, bone disease, acidosis)');
  }

  return recommendations;
}
