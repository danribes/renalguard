import { pool } from '../database.js';

export interface CalculateEGFRInput {
  patient_id: string;
  creatinine_mgdl?: number; // Optional - if not provided, will use latest from DB
}

export interface CalculateEGFROutput {
  egfr: number;
  formula: 'CKD-EPI 2021';
  creatinine_mgdl: number;
  age: number;
  sex: 'male' | 'female';
  interpretation: string;
  category: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';
  clinical_significance: string;
  data_source: 'provided' | 'database';
}

/**
 * Calculate eGFR using CKD-EPI 2021 Formula (Race-free)
 *
 * This is the current gold standard for kidney function assessment.
 * Reference: Inker et al. NEJM 2021
 *
 * Formula: eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^-1.200 × 0.9938^age × 1.012 [if female]
 *
 * Where:
 * - Scr = Serum Creatinine (mg/dL)
 * - κ = 0.7 (female) or 0.9 (male)
 * - α = -0.241 (female) or -0.302 (male)
 */
export async function calculateEGFR(input: CalculateEGFRInput): Promise<CalculateEGFROutput> {
  const { patient_id, creatinine_mgdl } = input;

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

  // Get creatinine value
  let creatinine: number;
  let dataSource: 'provided' | 'database';

  if (creatinine_mgdl !== undefined) {
    creatinine = creatinine_mgdl;
    dataSource = 'provided';
  } else {
    // Get latest creatinine from database
    const creatinineQuery = `
      SELECT value
      FROM observations
      WHERE patient_id = $1
        AND observation_type = 'Creatinine'
      ORDER BY observed_date DESC
      LIMIT 1
    `;

    const creatinineResult = await pool.query(creatinineQuery, [patient_id]);
    if (creatinineResult.rows.length === 0) {
      throw new Error('No creatinine value found in database. Please provide creatinine_mgdl parameter.');
    }

    creatinine = parseFloat(creatinineResult.rows[0].value);
    dataSource = 'database';
  }

  // Validate creatinine
  if (creatinine <= 0 || creatinine > 20) {
    throw new Error(`Invalid creatinine value: ${creatinine} mg/dL`);
  }

  // CKD-EPI 2021 Calculation
  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const sexFactor = sex === 'female' ? 1.012 : 1.0;

  const scrOverKappa = creatinine / kappa;
  const minVal = Math.min(scrOverKappa, 1);
  const maxVal = Math.max(scrOverKappa, 1);

  const egfr = 142 * Math.pow(minVal, alpha) * Math.pow(maxVal, -1.200) * Math.pow(0.9938, age) * sexFactor;
  const roundedEGFR = Math.round(egfr * 10) / 10;

  // Determine GFR category
  const category = determineGFRCategory(roundedEGFR);

  // Generate interpretation
  const interpretation = generateInterpretation(roundedEGFR, category);
  const clinicalSignificance = getClinicalSignificance(category, age);

  return {
    egfr: roundedEGFR,
    formula: 'CKD-EPI 2021',
    creatinine_mgdl: creatinine,
    age,
    sex,
    interpretation,
    category,
    clinical_significance: clinicalSignificance,
    data_source: dataSource,
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

function generateInterpretation(egfr: number, category: string): string {
  const interpretations: Record<string, string> = {
    G1: `Normal or high kidney function (eGFR ≥90). ${egfr >= 120 ? 'Note: Very high values may indicate hyperfiltration.' : ''}`,
    G2: `Mildly decreased kidney function (eGFR 60-89). Generally normal if no other kidney damage markers.`,
    G3a: `Mild to moderate CKD (eGFR 45-59). Monitor closely and address reversible causes.`,
    G3b: `Moderate to severe CKD (eGFR 30-44). Nephrology consultation recommended.`,
    G4: `Severe CKD (eGFR 15-29). Pre-dialysis planning needed. Nephrology management essential.`,
    G5: `Kidney failure (eGFR <15). Requires dialysis or transplant evaluation.`,
  };

  return interpretations[category] || 'Unable to determine interpretation';
}

function getClinicalSignificance(category: string, age: number): string {
  if (category === 'G1' || category === 'G2') {
    if (age > 70 && category === 'G2') {
      return 'Mild decline may be age-related. Check for albuminuria to assess true CKD risk.';
    }
    return 'No immediate concern if albuminuria is absent. Continue routine screening.';
  }

  if (category === 'G3a') {
    return 'CKD confirmed. Assess for proteinuria, optimize BP and glucose control, review medications for renal dosing.';
  }

  if (category === 'G3b') {
    return 'Moderate CKD. High risk for progression. Require nephrology co-management, medication adjustments, and cardiovascular risk reduction.';
  }

  if (category === 'G4') {
    return 'Advanced CKD. Prepare for kidney replacement therapy. Manage complications (anemia, bone disease, acidosis). Avoid nephrotoxins.';
  }

  if (category === 'G5') {
    return 'Kidney failure. Urgent nephrology referral for dialysis access planning or transplant evaluation. Manage uremic symptoms.';
  }

  return 'Consult nephrology for management guidance.';
}
