import { pool } from '../database.js';

/**
 * COMPREHENSIVE CKD ORCHESTRATOR - Master Pipeline
 *
 * This is the "orchestrator tool" pattern that creates ONE master entry point
 * instead of requiring the LLM to piece together multiple tool outputs.
 *
 * The LLM passes the patient ID once, and the logic runs clinical, safety,
 * and adherence checks in a strictly defined order.
 *
 * PIPELINE FLOW:
 * 1. Clinical Calc: Compute eGFR & Stage (KDIGO)
 * 2. Risk Stratification: Use the Stage to determine "Risk Color" (Green/Yellow/Orange/Red)
 * 3. Protocol Check: Use "Risk Color" to determine monitoring intervals vs actual screening dates
 * 4. Safety Check: Use eGFR to check medication safety (Jardiance, RAS inhibitors)
 * 5. Adherence Check: Medication refill gaps and overdue tests
 * 6. Opportunity Analysis: Should patient start treatment?
 */

export interface ComprehensiveCKDAnalysisInput {
  patient_id: string;
}

export interface ComprehensiveCKDAnalysisOutput {
  patient_summary: PatientSummary;
  critical_alerts: string[];
  action_plan: string[];
  clinical_details: ClinicalDetails;
}

interface PatientSummary {
  eGFR: string;
  stage: string;
  risk_category: string;
  key_comorbidities: string[];
}

interface ClinicalDetails {
  demographics: {
    age: number;
    sex: string;
  };
  lab_values: {
    creatinine: number | null;
    uacr: number | null;
    egfr: number;
    hba1c: number | null;
  };
  risk_stratification: {
    gfr_category: string;
    albuminuria_category: string;
    risk_color: string;
    monitoring_interval_days: number;
  };
  medications: {
    jardiance: MedicationStatus | null;
    ras_inhibitor: MedicationStatus | null;
  };
  screening_adherence: ScreeningStatus[];
}

interface MedicationStatus {
  is_taking: boolean;
  last_refill_date: string | null;
  days_since_refill: number | null;
  safety_analysis: string;
  dosing_recommendation: string;
}

interface ScreeningStatus {
  test_name: string;
  last_date: string | null;
  days_overdue: number | null;
  status: string;
}

// ==========================================
// PURE LOGIC HELPERS (No database calls)
// ==========================================

/**
 * Calculate eGFR using CKD-EPI 2021 formula (race-free)
 */
function calcEGFR(creatinine: number, age: number, sex: string): number {
  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const scrK = creatinine / kappa;
  const minVal = Math.min(scrK, 1);
  const maxVal = Math.max(scrK, 1);
  const factor = sex === 'female' ? 1.012 : 1.0;

  const egfr = 142 * Math.pow(minVal, alpha) * Math.pow(maxVal, -1.200) * Math.pow(0.9938, age) * factor;
  return Math.round(egfr * 10) / 10;
}

/**
 * Get KDIGO Risk based on eGFR and uACR
 * Returns: Risk Color, G-Stage, A-Stage, Recommended Monitoring Interval (days)
 */
function getKDIGORisk(egfr: number, uacr: number | null): {
  riskColor: string;
  gStage: string;
  aStage: string;
  monitoringIntervalDays: number;
} {
  // G-Staging
  let gStage: string;
  if (egfr >= 90) gStage = 'G1';
  else if (egfr >= 60) gStage = 'G2';
  else if (egfr >= 45) gStage = 'G3a';
  else if (egfr >= 30) gStage = 'G3b';
  else if (egfr >= 15) gStage = 'G4';
  else gStage = 'G5';

  // A-Staging (Handle missing uACR by assuming A1 for staging, but flagging later)
  const valUacr = uacr !== null ? uacr : 10;
  let aStage: string;
  if (valUacr < 30) aStage = 'A1';
  else if (valUacr <= 300) aStage = 'A2';
  else aStage = 'A3';

  // Risk Heatmap Logic (Simplified KDIGO 2024)
  // Red (Very High): G4, G5, or A3 (any G), or G3b-A2
  if (gStage === 'G4' || gStage === 'G5' || aStage === 'A3' || (gStage === 'G3b' && aStage === 'A2')) {
    return {
      riskColor: 'Red (Very High Risk)',
      gStage,
      aStage: uacr !== null ? aStage : 'Ax (Missing uACR)',
      monitoringIntervalDays: 90 // Monitor every 3 months
    };
  }

  // Orange (High): G3a-A2, G3b-A1
  if ((gStage === 'G3a' && aStage === 'A2') || (gStage === 'G3b' && aStage === 'A1')) {
    return {
      riskColor: 'Orange (High Risk)',
      gStage,
      aStage: uacr !== null ? aStage : 'Ax (Missing uACR)',
      monitoringIntervalDays: 180 // Monitor every 6 months
    };
  }

  // Yellow (Moderate): G1/G2-A2, G3a-A1
  if ((gStage === 'G1' || gStage === 'G2') && aStage === 'A2' || (gStage === 'G3a' && aStage === 'A1')) {
    return {
      riskColor: 'Yellow (Moderate Risk)',
      gStage,
      aStage: uacr !== null ? aStage : 'Ax (Missing uACR)',
      monitoringIntervalDays: 365 // Monitor annually
    };
  }

  // Green (Low): G1/G2-A1
  return {
    riskColor: 'Green (Low Risk)',
    gStage,
    aStage: uacr !== null ? aStage : 'Ax (Missing uACR)',
    monitoringIntervalDays: 365
  };
}

/**
 * Check Jardiance (SGLT2i) Safety
 */
function checkJardiance(egfr: number, conditions: string[]): {
  analysis: string;
  action: string;
} {
  const hasT1D = conditions.some(c => c.toLowerCase().includes('type 1'));

  if (hasT1D) {
    return {
      analysis: 'CONTRAINDICATED (Type 1 Diabetes)',
      action: 'STOP IMMEDIATELY'
    };
  }

  if (egfr < 20) {
    return {
      analysis: 'Contraindicated for initiation (eGFR < 20)',
      action: 'Do not start / Discontinue if not on dialysis'
    };
  }

  if (egfr < 30) {
    return {
      analysis: 'Safe for Heart/Kidney protection, ineffective for Glucose',
      action: 'Use 10mg only. Do not use for glycemic control.'
    };
  }

  if (egfr < 45) {
    return {
      analysis: 'Safe',
      action: '10mg recommended'
    };
  }

  return {
    analysis: 'Safe',
    action: 'Continue 10mg'
  };
}

/**
 * Check date adherence - returns days overdue (negative if early, positive if late)
 */
function checkDates(lastDateStr: string | null, requiredIntervalDays: number): number | null {
  if (!lastDateStr) return null;

  try {
    const lastDate = new Date(lastDateStr);
    const now = new Date();
    const deltaDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return deltaDays - requiredIntervalDays;
  } catch {
    return null;
  }
}

// ==========================================
// MAIN ORCHESTRATOR FUNCTION
// ==========================================

export async function comprehensiveCKDAnalysis(
  input: ComprehensiveCKDAnalysisInput
): Promise<ComprehensiveCKDAnalysisOutput> {
  const { patient_id } = input;

  // ========== STEP 0: FETCH ALL PATIENT DATA IN ONE QUERY ==========
  // This is more efficient than multiple tool calls

  const patientDataQuery = `
    WITH latest_labs AS (
      SELECT DISTINCT ON (observation_type)
        observation_type,
        value_numeric as value,
        observation_date,
        EXTRACT(DAY FROM NOW() - observation_date) as days_ago
      FROM observations
      WHERE patient_id = $1
        AND observation_type IN ('eGFR', 'uACR', 'serum_creatinine', 'HbA1c', 'blood_pressure_systolic')
      ORDER BY observation_type, observation_date DESC
    ),
    patient_info AS (
      SELECT
        CONCAT(first_name, ' ', last_name) as name,
        date_of_birth,
        EXTRACT(YEAR FROM AGE(date_of_birth)) as age,
        gender as sex,
        COALESCE(
          (SELECT array_agg(condition_name)
           FROM conditions
           WHERE patient_id = $1 AND clinical_status = 'active'),
          ARRAY[]::text[]
        ) as conditions
      FROM patients
      WHERE id = $1
    ),
    jardiance_med AS (
      SELECT
        medication_name,
        start_date,
        EXTRACT(DAY FROM NOW() - start_date) as days_since_start
      FROM patient_medications
      WHERE patient_id = $1
        AND medication_name ILIKE '%jardiance%'
        AND is_active = true
      LIMIT 1
    ),
    jardiance_refill AS (
      SELECT
        refill_date,
        EXTRACT(DAY FROM NOW() - refill_date) as days_since_refill
      FROM jardiance_refills
      WHERE patient_id = $1
      ORDER BY refill_date DESC
      LIMIT 1
    ),
    ras_med AS (
      SELECT
        medication_name,
        start_date
      FROM patient_medications
      WHERE patient_id = $1
        AND (medication_name ILIKE '%lisinopril%'
             OR medication_name ILIKE '%losartan%'
             OR medication_name ILIKE '%enalapril%')
        AND is_active = true
      LIMIT 1
    ),
    ras_refill AS (
      SELECT
        NULL::timestamp as refill_date,
        NULL::numeric as days_since_refill
    )
    SELECT
      p.name,
      p.age,
      p.sex,
      p.conditions,
      (SELECT value FROM latest_labs WHERE observation_type = 'serum_creatinine') as creatinine,
      (SELECT value FROM latest_labs WHERE observation_type = 'uACR') as uacr,
      (SELECT value FROM latest_labs WHERE observation_type = 'eGFR') as egfr_db,
      (SELECT value FROM latest_labs WHERE observation_type = 'HbA1c') as hba1c,
      (SELECT observation_date FROM latest_labs WHERE observation_type = 'uACR') as last_uacr_date,
      (SELECT observation_date FROM latest_labs WHERE observation_type = 'eGFR') as last_egfr_date,
      (SELECT observation_date FROM latest_labs WHERE observation_type = 'HbA1c') as last_hba1c_date,
      j.medication_name as jardiance_name,
      jr.refill_date as jardiance_refill_date,
      jr.days_since_refill as jardiance_days_since_refill,
      r.medication_name as ras_name,
      rr.refill_date as ras_refill_date,
      rr.days_since_refill as ras_days_since_refill
    FROM patient_info p
    LEFT JOIN jardiance_med j ON true
    LEFT JOIN jardiance_refill jr ON true
    LEFT JOIN ras_med r ON true
    LEFT JOIN ras_refill rr ON true
  `;

  const result = await pool.query(patientDataQuery, [patient_id]);

  if (result.rows.length === 0) {
    throw new Error(`Patient not found: ${patient_id}`);
  }

  const data = result.rows[0];
  const age = parseInt(data.age);
  const sex = data.sex;
  const conditions: string[] = data.conditions || [];
  const creatinine = data.creatinine ? parseFloat(data.creatinine) : null;
  const uacr = data.uacr ? parseFloat(data.uacr) : null;
  const hba1c = data.hba1c ? parseFloat(data.hba1c) : null;

  // Initialize report structure
  const report: ComprehensiveCKDAnalysisOutput = {
    patient_summary: {
      eGFR: '',
      stage: '',
      risk_category: '',
      key_comorbidities: conditions
    },
    critical_alerts: [],
    action_plan: [],
    clinical_details: {
      demographics: { age, sex },
      lab_values: {
        creatinine,
        uacr,
        egfr: 0,
        hba1c
      },
      risk_stratification: {
        gfr_category: '',
        albuminuria_category: '',
        risk_color: '',
        monitoring_interval_days: 0
      },
      medications: {
        jardiance: null,
        ras_inhibitor: null
      },
      screening_adherence: []
    }
  };

  // ========== STEP 1: CLINICAL CALCULATION ==========
  // Calculate eGFR if we have creatinine
  let egfr: number;
  if (creatinine) {
    egfr = calcEGFR(creatinine, age, sex);
  } else if (data.egfr_db) {
    egfr = parseFloat(data.egfr_db);
  } else {
    throw new Error('Cannot perform analysis: No creatinine or eGFR value available');
  }

  report.clinical_details.lab_values.egfr = egfr;

  // ========== STEP 2: RISK STRATIFICATION ==========
  const riskData = getKDIGORisk(egfr, uacr);

  report.patient_summary.eGFR = `${egfr} mL/min/1.73m²`;
  report.patient_summary.stage = `${riskData.gStage} / ${riskData.aStage}`;
  report.patient_summary.risk_category = riskData.riskColor;

  report.clinical_details.risk_stratification = {
    gfr_category: riskData.gStage,
    albuminuria_category: riskData.aStage,
    risk_color: riskData.riskColor,
    monitoring_interval_days: riskData.monitoringIntervalDays
  };

  // ========== STEP 3: uACR GAP CHECK (Undiagnosed High Risk) ==========
  const hasRiskFactors = conditions.some(c =>
    c.toLowerCase().includes('diabetes') ||
    c.toLowerCase().includes('hypertension') ||
    c.toLowerCase().includes('type 2')
  );

  if (hasRiskFactors && uacr === null) {
    report.critical_alerts.push(
      'MISSING CRITICAL SCREENING: Patient has Diabetes/HTN but no uACR value.'
    );
    report.action_plan.push(
      'Order Spot Urine Albumin-to-Creatinine Ratio (uACR) immediately.'
    );
  }

  // ========== STEP 4: PROTOCOL ADHERENCE (Screening Dates) ==========
  const screeningInterval = riskData.monitoringIntervalDays;

  // Check uACR adherence
  const uacrOverdue = checkDates(data.last_uacr_date, screeningInterval);
  if (uacrOverdue === null && hasRiskFactors) {
    report.action_plan.push('Schedule uACR screening (No history found).');
  } else if (uacrOverdue !== null && uacrOverdue > 0) {
    report.critical_alerts.push(
      `Screening Overdue: uACR is ${uacrOverdue} days late based on ${riskData.riskColor} risk profile.`
    );
    report.action_plan.push('Schedule follow-up labs (BMP + uACR).');
  }

  report.clinical_details.screening_adherence.push({
    test_name: 'uACR',
    last_date: data.last_uacr_date,
    days_overdue: uacrOverdue,
    status: uacrOverdue === null ? 'MISSING' : (uacrOverdue > 0 ? 'OVERDUE' : 'UP TO DATE')
  });

  // Check eGFR/Creatinine adherence
  const egfrOverdue = checkDates(data.last_egfr_date, screeningInterval);
  if (egfrOverdue !== null && egfrOverdue > 0) {
    report.critical_alerts.push(
      `Screening Overdue: eGFR/Creatinine is ${egfrOverdue} days late.`
    );
  }

  report.clinical_details.screening_adherence.push({
    test_name: 'eGFR/Creatinine',
    last_date: data.last_egfr_date,
    days_overdue: egfrOverdue,
    status: egfrOverdue === null ? 'MISSING' : (egfrOverdue > 0 ? 'OVERDUE' : 'UP TO DATE')
  });

  // Check HbA1c for diabetic patients
  const hasDiabetes = conditions.some(c => c.toLowerCase().includes('diabetes'));
  if (hasDiabetes) {
    const hba1cOverdue = checkDates(data.last_hba1c_date, 90); // Every 3 months for diabetics
    if (hba1cOverdue !== null && hba1cOverdue > 0) {
      report.critical_alerts.push(
        `Screening Overdue: HbA1c is ${hba1cOverdue} days late (diabetic patient).`
      );
      report.action_plan.push('Order HbA1c test.');
    }

    report.clinical_details.screening_adherence.push({
      test_name: 'HbA1c',
      last_date: data.last_hba1c_date,
      days_overdue: hba1cOverdue,
      status: hba1cOverdue === null ? 'MISSING' : (hba1cOverdue > 0 ? 'OVERDUE' : 'UP TO DATE')
    });
  }

  // ========== STEP 5: MEDICATION SAFETY & ADHERENCE (Jardiance) ==========
  const isTakingJardiance = !!data.jardiance_name;

  if (isTakingJardiance) {
    // Safety Check
    const jardinanceSafety = checkJardiance(egfr, conditions);

    report.clinical_details.medications.jardiance = {
      is_taking: true,
      last_refill_date: data.jardiance_refill_date,
      days_since_refill: data.jardiance_days_since_refill,
      safety_analysis: jardinanceSafety.analysis,
      dosing_recommendation: jardinanceSafety.action
    };

    if (jardinanceSafety.analysis.includes('CONTRAINDICATED') ||
        jardinanceSafety.action.includes('Do not start')) {
      report.critical_alerts.push(
        `DRUG SAFETY ALERT: Jardiance - ${jardinanceSafety.analysis}`
      );
      report.action_plan.push(
        `Review Jardiance: ${jardinanceSafety.action}`
      );
    }

    // Adherence Check (Refills) - assuming 30 day supply
    const refillGap = data.jardiance_days_since_refill;
    if (refillGap !== null && refillGap > 40) { // 30 days + 10 day grace
      const daysOverdue = refillGap - 30;
      report.critical_alerts.push(
        `NON-ADHERENCE: Jardiance refill is ${daysOverdue} days overdue.`
      );
      report.action_plan.push(
        'Assess barriers to medication adherence (cost, side effects).'
      );
    }
  } else {
    // ========== STEP 6: OPPORTUNITY TO START (If indicated but not taking) ==========
    // Indication: eGFR 20-90 + (Heart Failure OR CKD OR T2D)
    if (egfr > 20 && egfr < 90) {
      let shouldStart = false;

      if (conditions.some(c => c.toLowerCase().includes('heart failure'))) {
        shouldStart = true;
      }

      // CKD Indication: eGFR < 60 or uACR > 200
      if (egfr < 60 || (uacr !== null && uacr > 200)) {
        shouldStart = true;
      }

      // Type 2 Diabetes
      if (conditions.some(c => c.toLowerCase().includes('type 2'))) {
        shouldStart = true;
      }

      if (shouldStart) {
        report.action_plan.push(
          `Consider initiating Jardiance 10mg for renal/cardiac protection (eGFR ${egfr} is eligible).`
        );
      }
    }

    report.clinical_details.medications.jardiance = {
      is_taking: false,
      last_refill_date: null,
      days_since_refill: null,
      safety_analysis: 'Not taking',
      dosing_recommendation: 'Not applicable'
    };
  }

  // ========== RAS INHIBITOR CHECK ==========
  const isTakingRAS = !!data.ras_name;

  if (isTakingRAS) {
    report.clinical_details.medications.ras_inhibitor = {
      is_taking: true,
      last_refill_date: data.ras_refill_date,
      days_since_refill: data.ras_days_since_refill,
      safety_analysis: 'Safe (monitor potassium)',
      dosing_recommendation: 'Continue current dose'
    };

    // Check adherence
    const rasRefillGap = data.ras_days_since_refill;
    if (rasRefillGap !== null && rasRefillGap > 40) {
      const daysOverdue = rasRefillGap - 30;
      report.critical_alerts.push(
        `NON-ADHERENCE: RAS inhibitor refill is ${daysOverdue} days overdue.`
      );
    }
  } else {
    // Check if patient should be on RAS inhibitor
    if ((egfr >= 30) && (uacr !== null && uacr > 30)) {
      report.action_plan.push(
        'Consider initiating RAS inhibitor (ACEi/ARB) for albuminuria reduction.'
      );
    }

    report.clinical_details.medications.ras_inhibitor = {
      is_taking: false,
      last_refill_date: null,
      days_since_refill: null,
      safety_analysis: 'Not taking',
      dosing_recommendation: 'Not applicable'
    };
  }

  return report;
}
