import { pool } from '../database.js';

export interface AssessMedicationSafetyInput {
  patient_id: string;
  medication_name?: string; // Optional: Check specific medication
}

export interface MedicationAlert {
  medication: string;
  alert_type: 'CONTRAINDICATED' | 'DOSE_REDUCTION' | 'CAUTION' | 'SAFE' | 'SICK_DAY_HOLD';
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  reason: string;
  current_egfr: number;
  recommendation: string;
  reference: string;
  dosing_guidance?: string; // Specific dose recommendation
  monitoring_requirements?: string[]; // What to monitor
}

export interface AssessMedicationSafetyOutput {
  patient_egfr: number;
  egfr_category: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';
  medication_alerts: MedicationAlert[];
  nephrotoxic_medications: string[];
  safe_medications: string[];
  general_recommendations: string[];
}

/**
 * Assess Medication Safety Based on Kidney Function
 *
 * Evaluates current medications for:
 * - Renal dose adjustments needed
 * - Contraindications in CKD
 * - Nephrotoxic drug exposure
 * - Safe alternatives
 *
 * Based on:
 * - FDA prescribing information
 * - KDOQI Drug Dosing Guidelines
 * - NKF KDOQI Clinical Practice Guidelines
 */
export async function assessMedicationSafety(
  input: AssessMedicationSafetyInput
): Promise<AssessMedicationSafetyOutput> {
  const { patient_id, medication_name } = input;

  // Get latest eGFR
  const egfrQuery = `
    SELECT value_numeric as value
    FROM observations
    WHERE patient_id = $1
      AND observation_type = 'eGFR'
    ORDER BY observation_date DESC
    LIMIT 1
  `;

  const egfrResult = await pool.query(egfrQuery, [patient_id]);
  if (egfrResult.rows.length === 0) {
    throw new Error('No eGFR data available for medication safety assessment');
  }

  const egfr = parseFloat(egfrResult.rows[0].value);
  const egfrCategory = determineGFRCategory(egfr);

  // Get patient medications and conditions from database
  const patientQuery = `
    SELECT
      on_sglt2i,
      on_ras_inhibitor,
      nephrotoxic_meds,
      has_diabetes,
      has_hypertension,
      has_heart_failure,
      ckd_treatment_active,
      EXISTS(SELECT 1 FROM conditions
             WHERE patient_id = $1
             AND condition_name ILIKE '%Type 1 Diabetes%'
             AND clinical_status = 'active') as has_type1_diabetes,
      EXISTS(SELECT 1 FROM conditions
             WHERE patient_id = $1
             AND condition_name ILIKE '%Polycystic Kidney%'
             AND clinical_status = 'active') as has_pkd,
      EXISTS(SELECT 1 FROM conditions
             WHERE patient_id = $1
             AND condition_name ILIKE '%Dialysis%'
             AND clinical_status = 'active') as is_on_dialysis
    FROM patients
    WHERE id = $1
  `;

  const patientResult = await pool.query(patientQuery, [patient_id]);
  if (patientResult.rows.length === 0) {
    throw new Error(`Patient not found: ${patient_id}`);
  }

  const patient = patientResult.rows[0];

  // Get uACR for comprehensive assessment
  const uacrQuery = `
    SELECT value_numeric as value
    FROM observations
    WHERE patient_id = $1
      AND observation_type = 'uACR'
    ORDER BY observation_date DESC
    LIMIT 1
  `;
  const uacrResult = await pool.query(uacrQuery, [patient_id]);
  const uacr = uacrResult.rows.length > 0 ? parseFloat(uacrResult.rows[0].value) : null;

  // Build medication list
  const currentMedications: string[] = [];
  if (patient.on_sglt2i) currentMedications.push('SGLT2 inhibitor');
  if (patient.on_ras_inhibitor) currentMedications.push('ACE inhibitor/ARB');
  if (patient.nephrotoxic_meds) {
    currentMedications.push(...patient.nephrotoxic_meds.split(',').map((m: string) => m.trim()));
  }

  // Common medications to check
  const medicationsToCheck = medication_name
    ? [medication_name]
    : [
        ...currentMedications,
        'Metformin',
        'NSAIDs',
        'Gabapentin',
        'Allopurinol',
        'Digoxin',
        'Atorvastatin',
        'Insulin',
        'Contrast dye',
      ];

  // Assess each medication
  const alerts: MedicationAlert[] = [];
  const nephrotoxic: string[] = [];
  const safe: string[] = [];

  for (const med of medicationsToCheck) {
    const alert = assessMedication(med, egfr, egfrCategory);
    if (alert) {
      if (alert.alert_type === 'CONTRAINDICATED' || alert.alert_type === 'DOSE_REDUCTION') {
        alerts.push(alert);
      }
      if (alert.alert_type === 'CAUTION' && alert.reason.includes('nephrotoxic')) {
        nephrotoxic.push(med);
      }
      if (alert.alert_type === 'SAFE') {
        safe.push(med);
      }
    }
  }

  // Generate general recommendations
  const recommendations = generateGeneralRecommendations(egfr, egfrCategory, alerts, patient);

  return {
    patient_egfr: egfr,
    egfr_category: egfrCategory,
    medication_alerts: alerts,
    nephrotoxic_medications: nephrotoxic,
    safe_medications: safe,
    general_recommendations: recommendations,
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

function assessMedication(
  medication: string,
  egfr: number,
  category: string
): MedicationAlert | null {
  const med = medication.toLowerCase();

  // METFORMIN - Diabetic medication with renal contraindications
  if (med.includes('metformin')) {
    if (egfr < 30) {
      return {
        medication: 'Metformin',
        alert_type: 'CONTRAINDICATED',
        severity: 'CRITICAL',
        reason: 'Risk of lactic acidosis in severe CKD',
        current_egfr: egfr,
        recommendation: '🔴 DISCONTINUE immediately. Switch to insulin or DPP-4 inhibitor (sitagliptin)',
        reference: 'FDA Black Box Warning: eGFR <30 contraindicated',
      };
    }
    if (egfr < 45) {
      return {
        medication: 'Metformin',
        alert_type: 'DOSE_REDUCTION',
        severity: 'HIGH',
        reason: 'Increased risk of lactic acidosis',
        current_egfr: egfr,
        recommendation: 'Reduce dose to 500-1000 mg/day. Monitor closely. Discontinue if eGFR <30',
        reference: 'FDA: Max 1000 mg/day if eGFR 30-45',
      };
    }
    return {
      medication: 'Metformin',
      alert_type: 'SAFE',
      severity: 'LOW',
      reason: 'Safe at current kidney function',
      current_egfr: egfr,
      recommendation: 'Standard dosing acceptable. Monitor eGFR every 3-6 months',
      reference: 'FDA: Safe if eGFR ≥45',
    };
  }

  // NSAIDs - Nephrotoxic, avoid in CKD
  if (med.includes('nsaid') || med.includes('ibuprofen') || med.includes('naproxen')) {
    if (egfr < 60) {
      return {
        medication: 'NSAIDs',
        alert_type: 'CONTRAINDICATED',
        severity: 'CRITICAL',
        reason: 'Nephrotoxic - causes acute kidney injury, accelerates CKD progression',
        current_egfr: egfr,
        recommendation: '🔴 AVOID. Use acetaminophen for pain. Avoid COX-2 inhibitors as well',
        reference: 'KDIGO: Avoid NSAIDs in CKD Stage 3+',
      };
    }
    return {
      medication: 'NSAIDs',
      alert_type: 'CAUTION',
      severity: 'MODERATE',
      reason: 'Potentially nephrotoxic',
      current_egfr: egfr,
      recommendation: 'Use lowest effective dose for shortest duration. Monitor kidney function',
      reference: 'KDIGO: Use with caution in CKD',
    };
  }

  // GABAPENTIN - Requires dose reduction
  if (med.includes('gabapentin')) {
    if (egfr < 60) {
      const dosing = getGabapentinDosing(egfr);
      return {
        medication: 'Gabapentin',
        alert_type: 'DOSE_REDUCTION',
        severity: 'HIGH',
        reason: 'Renally cleared - accumulates in CKD',
        current_egfr: egfr,
        recommendation: `Adjust dose: ${dosing}`,
        reference: 'FDA Prescribing Information',
      };
    }
    return {
      medication: 'Gabapentin',
      alert_type: 'SAFE',
      severity: 'LOW',
      reason: 'Standard dosing acceptable',
      current_egfr: egfr,
      recommendation: 'Normal dosing: 300-1200 mg TID',
      reference: 'FDA: Standard dosing if eGFR ≥60',
    };
  }

  // ALLOPURINOL - Dose reduction needed
  if (med.includes('allopurinol')) {
    if (egfr < 60) {
      return {
        medication: 'Allopurinol',
        alert_type: 'DOSE_REDUCTION',
        severity: 'MODERATE',
        reason: 'Active metabolite accumulates',
        current_egfr: egfr,
        recommendation: getAllopurinolDosing(egfr),
        reference: 'ACR Gout Guidelines',
      };
    }
  }

  // DIGOXIN - Narrow therapeutic index
  if (med.includes('digoxin')) {
    if (egfr < 60) {
      return {
        medication: 'Digoxin',
        alert_type: 'DOSE_REDUCTION',
        severity: 'HIGH',
        reason: 'Renally cleared - risk of toxicity',
        current_egfr: egfr,
        recommendation: 'Reduce dose to 0.0625-0.125 mg daily. Monitor levels closely (target 0.5-0.9 ng/mL)',
        reference: 'FDA: Dose reduction required in CKD',
      };
    }
  }

  // ACE INHIBITORS / ARBs - Generally safe but monitor
  if (med.includes('ace') || med.includes('arb') || med.includes('lisinopril') || med.includes('losartan')) {
    if (egfr < 30) {
      return {
        medication: 'ACE inhibitor/ARB',
        alert_type: 'CAUTION',
        severity: 'HIGH',
        reason: 'Risk of hyperkalemia and acute GFR decline',
        current_egfr: egfr,
        recommendation: 'Continue if tolerated. Check K+ and creatinine 1-2 weeks after initiation. Discontinue if GFR drops >30%',
        reference: 'KDIGO: Monitor closely in advanced CKD',
      };
    }
    return {
      medication: 'ACE inhibitor/ARB',
      alert_type: 'SAFE',
      severity: 'LOW',
      reason: 'Renoprotective in CKD',
      current_egfr: egfr,
      recommendation: 'Continue. Monitor K+ and creatinine periodically',
      reference: 'KDIGO Grade 1A: Use in CKD with albuminuria',
    };
  }

  // SGLT2 INHIBITORS - Safe in CKD, but efficacy varies
  if (med.includes('sglt2') || med.includes('empagliflozin') || med.includes('dapagliflozin')) {
    if (egfr < 20) {
      return {
        medication: 'SGLT2 inhibitor',
        alert_type: 'CAUTION',
        severity: 'MODERATE',
        reason: 'Limited efficacy at very low GFR',
        current_egfr: egfr,
        recommendation: 'Continue for cardiovascular benefit, but glycemic efficacy reduced. Safe to continue per EMPA-KIDNEY',
        reference: 'EMPA-KIDNEY 2023: Safe down to eGFR 20',
      };
    }
    return {
      medication: 'SGLT2 inhibitor',
      alert_type: 'SAFE',
      severity: 'LOW',
      reason: 'Renoprotective and cardioprotective',
      current_egfr: egfr,
      recommendation: 'Continue. Monitor for genital infections and volume depletion',
      reference: 'KDIGO Grade 1A: Use in CKD + diabetes',
    };
  }

  // CONTRAST DYE - Requires prophylaxis
  if (med.includes('contrast')) {
    if (egfr < 45) {
      return {
        medication: 'IV Contrast Dye',
        alert_type: 'CAUTION',
        severity: 'CRITICAL',
        reason: 'Risk of contrast-induced nephropathy',
        current_egfr: egfr,
        recommendation: '⚠️ Use only if essential. Hydrate with IV NS 1 mL/kg/hr 12h before and after. Avoid if eGFR <30',
        reference: 'ACR Contrast Manual: Prophylaxis required if eGFR <45',
      };
    }
  }

  // STATINS - Generally safe
  if (med.includes('statin') || med.includes('atorvastatin')) {
    return {
      medication: 'Statin',
      alert_type: 'SAFE',
      severity: 'LOW',
      reason: 'No dose adjustment needed',
      current_egfr: egfr,
      recommendation: 'Safe in CKD. Continue for cardiovascular protection',
      reference: 'KDIGO: Statins recommended in CKD',
    };
  }

  return null;
}

function getGabapentinDosing(egfr: number): string {
  if (egfr >= 60) return 'Standard: 300-1200 mg TID';
  if (egfr >= 30) return 'Reduce to 200-700 mg TID (50% reduction)';
  if (egfr >= 15) return 'Reduce to 100-300 mg daily (75% reduction)';
  return 'Reduce to 100-300 mg every other day';
}

function getAllopurinolDosing(egfr: number): string {
  if (egfr >= 60) return 'Standard: 100-300 mg daily';
  if (egfr >= 30) return 'Reduce to 50-100 mg daily';
  if (egfr >= 15) return 'Start 50 mg daily, titrate slowly';
  return 'Avoid or use 50 mg every other day with close monitoring';
}

function generateGeneralRecommendations(
  egfr: number,
  category: string,
  alerts: MedicationAlert[],
  patient: any
): string[] {
  const recommendations: string[] = [];

  // Critical alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  if (criticalAlerts.length > 0) {
    recommendations.push('🔴 CRITICAL MEDICATION ALERTS - Review immediately:');
    criticalAlerts.forEach(alert => {
      recommendations.push(`   • ${alert.medication}: ${alert.recommendation}`);
    });
  }

  // General CKD medication principles
  if (egfr < 60) {
    recommendations.push('General CKD Medication Management:');
    recommendations.push('• Review ALL medications for renal dosing at every visit');
    recommendations.push('• Avoid nephrotoxins: NSAIDs, aminoglycosides, high-dose PPIs');
    recommendations.push('• Monitor potassium closely if on ACEi/ARB + spironolactone');
  }

  if (egfr < 45) {
    recommendations.push('• Hold metformin if patient hospitalized or receives IV contrast');
    recommendations.push('• Avoid gadolinium-based MRI contrast (risk of nephrogenic systemic fibrosis)');
  }

  if (egfr < 30) {
    recommendations.push('• Consider nephrology consultation for medication review');
    recommendations.push('• Prepare patient education on medication safety in CKD');
  }

  // Diabetes-specific
  if (patient.has_diabetes) {
    if (egfr < 45 && !patient.on_sglt2i) {
      recommendations.push('• Consider adding SGLT2 inhibitor (cardio/renoprotective)');
    }
    recommendations.push('• Adjust insulin doses as GFR declines (risk of hypoglycemia)');
  }

  return recommendations;
}
