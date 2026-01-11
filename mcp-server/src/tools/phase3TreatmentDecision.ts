import { pool } from '../database.js';

export interface TreatmentDecisionInput {
  patient_id: string;
}

export interface TreatmentRecommendation {
  medication: string;
  indication: 'STRONG' | 'MODERATE' | 'CONTRAINDICATED' | 'NOT_INDICATED';
  evidence: string;
  reasoning: string[];
  safetyMonitoring: string[];
  contraindications: string[];
}

export interface TreatmentDecisionOutput {
  jardiance: TreatmentRecommendation;
  rasInhibitor: TreatmentRecommendation;
  minutefulKidney: MinutefulKidneyRecommendation;
  overallPlan: string[];
}

export interface MinutefulKidneyRecommendation {
  recommended: boolean;
  frequency: string | null;
  rationale: string;
  adherenceBenefits: string;
}

/**
 * PHASE 3: TREATMENT INITIATION DECISION SUPPORT
 *
 * Evaluates eligibility for:
 * - Jardiance (SGLT2 inhibitor)
 * - RAS inhibitors (ACEi/ARB)
 * - Minuteful Kidney home monitoring (FDA-cleared smartphone uACR test)
 *
 * Based on: Unified CKD Specification v3.0, Phase 3
 */
export async function assessTreatmentOptions(input: TreatmentDecisionInput): Promise<TreatmentDecisionOutput> {
  const { patient_id } = input;

  // Get comprehensive patient data
  const patientQuery = `
    SELECT
      has_diabetes,
      has_hypertension,
      has_heart_failure,
      on_ras_inhibitor,
      on_sglt2i,
      nephrologist_referral
    FROM patients
    WHERE id = $1
  `;

  const patientResult = await pool.query(patientQuery, [patient_id]);
  if (patientResult.rows.length === 0) {
    throw new Error(`Patient not found: ${patient_id}`);
  }

  const patient = patientResult.rows[0];

  // Get latest eGFR and uACR
  const labQuery = `
    SELECT observation_type, value
    FROM observations
    WHERE patient_id = $1
      AND observation_type IN ('eGFR', 'uACR', 'Potassium')
    ORDER BY observed_date DESC
  `;

  const labResult = await pool.query(labQuery, [patient_id]);

  let egfr: number | null = null;
  let uacr: number | null = null;
  let potassium: number | null = null;

  for (const lab of labResult.rows) {
    if (lab.observation_type === 'eGFR' && egfr === null) {
      egfr = parseFloat(lab.value);
    }
    if (lab.observation_type === 'uACR' && uacr === null) {
      uacr = parseFloat(lab.value);
    }
    if (lab.observation_type === 'Potassium' && potassium === null) {
      potassium = parseFloat(lab.value);
    }
  }

  if (egfr === null || uacr === null) {
    throw new Error('Insufficient lab data. Need eGFR and uACR for treatment assessment.');
  }

  // Assess Jardiance (SGLT2i) eligibility
  const jardiance = assessJardianceEligibility({
    hasDiabetes: patient.has_diabetes,
    egfr,
    uacr,
    onSglt2i: patient.on_sglt2i,
  });

  // Assess RAS inhibitor eligibility
  const rasInhibitor = assessRASInhibitorEligibility({
    uacr,
    egfr,
    potassium,
    onRasInhibitor: patient.on_ras_inhibitor,
    hasHeartFailure: patient.has_heart_failure,
  });

  // Assess Minuteful Kidney home monitoring need
  const minutefulKidney = assessMinutefulKidneyNeed({
    egfr,
    uacr,
    hasDiabetes: patient.has_diabetes,
    onSglt2i: patient.on_sglt2i,
  });

  // Generate overall treatment plan
  const overallPlan = generateOverallPlan(jardiance, rasInhibitor, minutefulKidney);

  return {
    jardiance,
    rasInhibitor,
    minutefulKidney,
    overallPlan,
  };
}

interface JardianceAssessmentData {
  hasDiabetes: boolean;
  egfr: number;
  uacr: number;
  onSglt2i: boolean;
}

function assessJardianceEligibility(data: JardianceAssessmentData): TreatmentRecommendation {
  const reasoning: string[] = [];
  const contraindications: string[] = [];
  const safetyMonitoring: string[] = [
    'Monitor for genital mycotic infections',
    'Educate on diabetic ketoacidosis symptoms',
    'Check eGFR and electrolytes at 2-4 weeks, then per monitoring plan',
    'Monitor volume status (especially if on diuretics)',
  ];

  let indication: 'STRONG' | 'MODERATE' | 'CONTRAINDICATED' | 'NOT_INDICATED';
  let evidence: string;

  // Already on SGLT2i
  if (data.onSglt2i) {
    return {
      medication: 'Jardiance (Empagliflozin)',
      indication: 'NOT_INDICATED',
      evidence: 'Patient already on SGLT2 inhibitor',
      reasoning: ['Patient is currently receiving SGLT2i therapy'],
      safetyMonitoring: ['Continue current safety monitoring'],
      contraindications: [],
    };
  }

  // Check contraindications
  if (data.egfr < 20) {
    contraindications.push('eGFR <20 mL/min - Below approved threshold');
    indication = 'CONTRAINDICATED';
    evidence = 'EMPA-KIDNEY trial excluded eGFR <20';
    reasoning.push('Efficacy and safety not established below eGFR 20');
    reasoning.push('Consider only if patient approaching dialysis and cardiovascular benefits needed');

    return {
      medication: 'Jardiance (Empagliflozin)',
      indication,
      evidence,
      reasoning,
      safetyMonitoring: [],
      contraindications,
    };
  }

  // STRONG INDICATION (Grade 1A Evidence)
  if (
    (data.hasDiabetes && data.egfr >= 20 && data.uacr >= 200) ||
    (!data.hasDiabetes && data.egfr >= 20 && data.egfr <= 75 && data.uacr >= 200)
  ) {
    indication = 'STRONG';
    evidence = 'KDIGO Grade 1A - EMPA-KIDNEY trial: 28% reduction in kidney disease progression';

    if (data.hasDiabetes) {
      reasoning.push('Type 2 Diabetes + eGFR ≥20 + significant albuminuria (uACR ≥200)');
      reasoning.push('Strong evidence for CKD progression reduction');
      reasoning.push('Additional cardiovascular benefits (EMPA-REG OUTCOME)');
    } else {
      reasoning.push('Non-diabetic CKD + eGFR 20-75 + significant albuminuria (uACR ≥200)');
      reasoning.push('EMPA-KIDNEY showed benefit in non-diabetics');
    }

    reasoning.push('28% relative risk reduction for kidney disease progression or CV death');
    reasoning.push('Benefits seen across all eGFR levels ≥20');
  }
  // MODERATE INDICATION (Grade 2B Evidence)
  else if (data.hasDiabetes && data.egfr >= 20 && data.uacr >= 30 && data.uacr < 200) {
    indication = 'MODERATE';
    evidence = 'KDIGO Grade 2B - Proven benefit in diabetic kidney disease with moderate albuminuria';

    reasoning.push('Type 2 Diabetes with moderate albuminuria (uACR 30-200)');
    reasoning.push('Evidence from diabetic nephropathy trials');
    reasoning.push('May slow progression and provide CV protection');
    reasoning.push('Consider after optimizing RAS inhibition');
  }
  // NOT INDICATED
  else {
    indication = 'NOT_INDICATED';
    evidence = 'Current evidence supports use primarily with significant albuminuria (uACR ≥200)';

    reasoning.push(`Current uACR ${data.uacr} mg/g does not meet threshold for strong indication`);
    if (!data.hasDiabetes) {
      reasoning.push('Non-diabetic patients need uACR ≥200 for EMPA-KIDNEY benefit');
    }
    reasoning.push('May reassess if albuminuria worsens or additional evidence emerges');
  }

  return {
    medication: 'Jardiance (Empagliflozin)',
    indication,
    evidence,
    reasoning,
    safetyMonitoring,
    contraindications,
  };
}

interface RASInhibitorAssessmentData {
  uacr: number;
  egfr: number;
  potassium: number | null;
  onRasInhibitor: boolean;
  hasHeartFailure: boolean;
}

function assessRASInhibitorEligibility(data: RASInhibitorAssessmentData): TreatmentRecommendation {
  const reasoning: string[] = [];
  const contraindications: string[] = [];
  const safetyMonitoring: string[] = [
    'Check potassium and creatinine 1-2 weeks after initiation or dose change',
    'Monitor for hyperkalemia (K+ >5.5 mEq/L)',
    'Check eGFR - expect small decrease (<30%) after starting',
    'Monitor for angioedema symptoms',
  ];

  let indication: 'STRONG' | 'MODERATE' | 'CONTRAINDICATED' | 'NOT_INDICATED';
  let evidence: string;

  // Already on RAS inhibitor
  if (data.onRasInhibitor) {
    return {
      medication: 'RAS Inhibitor (ACEi or ARB)',
      indication: 'NOT_INDICATED',
      evidence: 'Patient already on RAS inhibitor therapy',
      reasoning: [
        'Patient is currently receiving ACE inhibitor or ARB',
        'Continue current therapy and monitoring',
      ],
      safetyMonitoring: ['Continue potassium and creatinine monitoring'],
      contraindications: [],
    };
  }

  // Check contraindications
  if (data.potassium && data.potassium > 5.5) {
    contraindications.push('Hyperkalemia (K+ >5.5 mEq/L) - Relative contraindication');
    reasoning.push('Address hyperkalemia first (diet counseling, diuretic adjustment)');
    reasoning.push('May initiate RAS inhibitor at low dose with close monitoring');
  }

  if (data.egfr < 15) {
    contraindications.push('Advanced CKD (eGFR <15) - Use with caution');
    reasoning.push('Nephrology consultation recommended for advanced CKD');
  }

  // STRONG INDICATION
  if (data.uacr >= 30) {
    indication = 'STRONG';
    evidence = 'KDIGO Grade 1A - First-line therapy for albuminuria (30-40% proteinuria reduction)';

    reasoning.push(`Albuminuria present (uACR ${data.uacr} mg/g)`);
    reasoning.push('RAS inhibitors are standard of care for proteinuric CKD');
    reasoning.push('Proven to slow CKD progression and reduce cardiovascular events');
    reasoning.push('Should be initiated BEFORE considering SGLT2 inhibitors');

    if (data.hasHeartFailure) {
      reasoning.push('Additional benefit for heart failure management');
    }

    reasoning.push('Start at low dose and titrate to maximum tolerated dose');
  }
  // MODERATE INDICATION
  else if (data.egfr < 60) {
    indication = 'MODERATE';
    evidence = 'KDIGO Grade 2B - May benefit CKD without albuminuria for CV protection';

    reasoning.push('CKD present (eGFR <60) without significant albuminuria');
    reasoning.push('Consider for cardiovascular risk reduction');
    reasoning.push('Weaker evidence compared to proteinuric CKD');
  }
  // NOT INDICATED
  else {
    indication = 'NOT_INDICATED';
    evidence = 'Primary indication is albuminuria or hypertension';

    reasoning.push('Normal kidney function and minimal albuminuria');
    reasoning.push('Consider only if hypertension present');
  }

  return {
    medication: 'RAS Inhibitor (ACEi or ARB)',
    indication,
    evidence,
    reasoning,
    safetyMonitoring,
    contraindications,
  };
}

interface MinutefulKidneyAssessmentData {
  egfr: number;
  uacr: number;
  hasDiabetes: boolean;
  onSglt2i: boolean;
}

function assessMinutefulKidneyNeed(data: MinutefulKidneyAssessmentData): MinutefulKidneyRecommendation {
  let recommended: boolean;
  let frequency: string | null;
  let rationale: string;
  let adherenceBenefits: string;

  // HIGH PRIORITY - Active CKD with treatment
  if ((data.egfr < 60 || data.uacr >= 30) && data.onSglt2i) {
    recommended = true;

    if (data.egfr < 30 || data.uacr >= 300) {
      frequency = 'Weekly';
      rationale =
        'Advanced CKD with proteinuria on disease-modifying therapy. Weekly at-home monitoring enables early detection of worsening kidney function.';
      adherenceBenefits = 'High adherence expected - At-home convenience removes clinic visit barriers; instant smartphone results increase engagement. May prevent ER visits and hospitalizations.';
    } else if (data.egfr < 45 || data.uacr >= 100) {
      frequency = 'Bi-weekly';
      rationale = 'Moderate CKD on SGLT2 inhibitor. Bi-weekly at-home monitoring tracks treatment response and empowers patient self-management.';
      adherenceBenefits = 'Moderate-High adherence - FDA-cleared smartphone test with 99% usability across ages 18-80; computer vision eliminates reading errors. Helps optimize therapy.';
    } else {
      frequency = 'Monthly';
      rationale =
        'Mild-moderate CKD with albuminuria. Monthly at-home monitoring assesses stability and medication adherence without clinic visits.';
      adherenceBenefits = 'Moderate adherence - Direct-to-door kits achieve ~50% completion in previously non-compliant populations; automated EMR integration ensures follow-up.';
    }
  }
  // MODERATE PRIORITY - CKD without treatment or diabetes
  else if (data.egfr < 60 || data.uacr >= 30 || data.hasDiabetes) {
    recommended = true;
    frequency = 'Monthly';
    rationale =
      'CKD risk factors present. Monthly at-home monitoring recommended to establish baseline and detect progression early.';
    adherenceBenefits = 'Moderate adherence - Removes logistical barriers (transportation, time off work); ~90% of patients prefer at-home testing over clinic visits.';
  }
  // LOW PRIORITY
  else {
    recommended = false;
    frequency = null;
    rationale = 'Normal kidney function without significant risk factors. Standard lab monitoring sufficient.';
    adherenceBenefits = 'Not applicable - Annual clinical screening adequate for low-risk patients.';
  }

  return {
    recommended,
    frequency,
    rationale,
    adherenceBenefits,
  };
}

function generateOverallPlan(
  jardiance: TreatmentRecommendation,
  rasInhibitor: TreatmentRecommendation,
  minutefulKidney: MinutefulKidneyRecommendation
): string[] {
  const plan: string[] = [];

  // Treatment sequence
  if (rasInhibitor.indication === 'STRONG') {
    plan.push('FIRST PRIORITY: Initiate or optimize RAS inhibitor (ACEi or ARB)');
    plan.push('  - RAS inhibitors are first-line for albuminuria');
    plan.push('  - Start low, go slow, titrate to max tolerated dose');
  }

  if (jardiance.indication === 'STRONG') {
    if (rasInhibitor.indication === 'STRONG' && !rasInhibitor.reasoning[0].includes('already')) {
      plan.push('SECOND PRIORITY: Add Jardiance (SGLT2i) after RAS inhibitor established');
      plan.push('  - Wait 2-4 weeks after RAS inhibitor to ensure tolerability');
    } else {
      plan.push('HIGH PRIORITY: Initiate Jardiance (SGLT2i) for CKD protection');
    }
    plan.push('  - Strong evidence for slowing CKD progression (28% risk reduction)');
  } else if (jardiance.indication === 'MODERATE') {
    plan.push('CONSIDER: Jardiance may provide additional benefit');
    plan.push('  - Discuss risks/benefits with patient');
    plan.push('  - Consider after optimizing other therapies');
  }

  // Minuteful Kidney Home Monitoring
  if (minutefulKidney.recommended) {
    plan.push(`Minuteful Kidney Home Monitoring: ${minutefulKidney.frequency || 'Recommended'}`);
    plan.push(`  - ${minutefulKidney.rationale}`);
    plan.push(`  - Adherence: ${minutefulKidney.adherenceBenefits}`);
  }

  // General recommendations
  plan.push('Monitor adherence and clinical outcomes closely');
  plan.push('Adjust therapy based on patient response and tolerance');

  return plan;
}
