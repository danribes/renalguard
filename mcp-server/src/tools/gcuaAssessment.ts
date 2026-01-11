import { pool } from '../database.js';

/**
 * GCUA MCP Tool - Geriatric Cardiorenal Unified Assessment
 *
 * Implements the GCUA risk stratification system for adults 60+ with eGFR > 60.
 * Integrates three validated prediction models:
 *
 * Module 1: Nelson/CKD-PC Incident CKD Equation (2019) - 5-year incident CKD risk
 * Module 2: AHA PREVENT (2024) - 10-year CVD event risk with CKM integration
 * Module 3: Bansal Mortality Score (2015) - 5-year all-cause mortality risk
 *
 * Assigns patients to one of four actionable phenotypes:
 * - I. Accelerated Ager: High renal + High CVD risk
 * - II. Silent Renal: High renal + Low CVD risk (often MISSED by Framingham)
 * - III. Vascular Dominant: Low renal + High CVD risk
 * - IV. The Senescent: High mortality risk
 *
 * Reference: Geriatric Cardiorenal Unified Assessment Protocol
 */

export interface GCUAInput {
  patient_id: string;
}

interface GCUAModule {
  name: string;
  risk: number;
  riskCategory: string;
  components: string[];
  interpretation: string;
}

interface GCUAPhenotype {
  type: string;
  name: string;
  tag: string;
  color: string;
  description: string;
  clinicalStrategy: string[];
  treatmentRecommendations: {
    sglt2i: boolean;
    rasInhibitor: boolean;
    statin: boolean;
    bpTarget: string;
    monitoringFrequency: string;
  };
}

export interface GCUAOutput {
  isEligible: boolean;
  eligibilityReason?: string;
  patientInfo: {
    age: number;
    sex: string;
    eGFR: number | null;
    uACR: number | null;
  };
  module1: GCUAModule | null;
  module2: GCUAModule | null;
  module3: GCUAModule | null;
  phenotype: GCUAPhenotype | null;
  benefitRatio: number | null;
  benefitRatioInterpretation: string;
  missingData: string[];
  confidenceLevel: 'high' | 'moderate' | 'low';
  kdigoScreeningRecommendation: string;
  recommendations: string[];
}

export async function assessGCUA(input: GCUAInput): Promise<GCUAOutput> {
  const { patient_id } = input;

  // Get comprehensive patient data
  const patientQuery = `
    SELECT
      p.id,
      p.date_of_birth,
      p.gender,
      EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as age,
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
  `;

  const patientResult = await pool.query(patientQuery, [patient_id]);
  if (patientResult.rows.length === 0) {
    throw new Error(`Patient not found: ${patient_id}`);
  }

  const patient = patientResult.rows[0];
  const missingData: string[] = [];

  // Get latest labs if not in risk factors
  let eGFR = patient.current_egfr ? parseFloat(patient.current_egfr) : null;
  let uACR = patient.current_uacr ? parseFloat(patient.current_uacr) : null;

  if (!eGFR) {
    const egfrResult = await pool.query(`
      SELECT value_numeric FROM observations
      WHERE patient_id = $1 AND observation_type = 'eGFR'
      ORDER BY observation_date DESC LIMIT 1
    `, [patient_id]);
    eGFR = egfrResult.rows[0]?.value_numeric ? parseFloat(egfrResult.rows[0].value_numeric) : null;
  }

  if (!uACR) {
    const uacrResult = await pool.query(`
      SELECT value_numeric FROM observations
      WHERE patient_id = $1 AND observation_type = 'uACR'
      ORDER BY observation_date DESC LIMIT 1
    `, [patient_id]);
    uACR = uacrResult.rows[0]?.value_numeric ? parseFloat(uacrResult.rows[0].value_numeric) : null;
  }

  // Track missing data
  if (!uACR) missingData.push('uACR (Albuminuria)');
  if (!patient.average_bp_systolic) missingData.push('Systolic BP');
  if (!patient.current_bmi) missingData.push('BMI');
  if (!patient.smoking_status) missingData.push('Smoking Status');

  // Get conditions for additional comorbidities
  const conditionsResult = await pool.query(`
    SELECT condition_code, condition_name FROM conditions
    WHERE patient_id = $1 AND clinical_status = 'active'
  `, [patient_id]);

  const conditions = conditionsResult.rows;
  const hasAtrialFibrillation = conditions.some((c: any) =>
    c.condition_code?.includes('I48') ||
    c.condition_name?.toLowerCase().includes('atrial fibrillation')
  );

  const hasHeartFailure = patient.has_heart_failure || conditions.some((c: any) =>
    c.condition_code?.includes('I50') ||
    c.condition_name?.toLowerCase().includes('heart failure')
  );

  const hasCVD = patient.has_cvd ||
    patient.has_coronary_artery_disease ||
    patient.has_stroke_history ||
    conditions.some((c: any) =>
      c.condition_code?.startsWith('I2') ||
      c.condition_code?.startsWith('I63')
    );

  const age = patient.age;
  const sex = patient.gender?.toLowerCase() === 'female' ? 'female' : 'male';

  // Check GCUA eligibility: Age >= 60 AND eGFR > 60
  if (age < 60) {
    return {
      isEligible: false,
      eligibilityReason: `Patient age (${age}) is below 60. GCUA is designed for adults 60 and older.`,
      patientInfo: { age, sex, eGFR, uACR },
      module1: null,
      module2: null,
      module3: null,
      phenotype: null,
      benefitRatio: null,
      benefitRatioInterpretation: '',
      missingData,
      confidenceLevel: 'low',
      kdigoScreeningRecommendation: '',
      recommendations: ['Use standard risk assessment tools for patients under 60']
    };
  }

  if (eGFR !== null && eGFR <= 60) {
    return {
      isEligible: false,
      eligibilityReason: `Patient eGFR (${eGFR}) is <= 60. GCUA is designed for pre-CKD patients. Use KDIGO staging and KFRE for established CKD.`,
      patientInfo: { age, sex, eGFR, uACR },
      module1: null,
      module2: null,
      module3: null,
      phenotype: null,
      benefitRatio: null,
      benefitRatioInterpretation: '',
      missingData,
      confidenceLevel: 'low',
      kdigoScreeningRecommendation: '',
      recommendations: ['Use KDIGO classification for CKD staging', 'Use KFRE for kidney failure risk prediction']
    };
  }

  if (!eGFR) {
    return {
      isEligible: false,
      eligibilityReason: 'Missing eGFR data. Cannot perform GCUA assessment.',
      patientInfo: { age, sex, eGFR, uACR },
      module1: null,
      module2: null,
      module3: null,
      phenotype: null,
      benefitRatio: null,
      benefitRatioInterpretation: '',
      missingData: ['eGFR', ...missingData],
      confidenceLevel: 'low',
      kdigoScreeningRecommendation: '',
      recommendations: ['Order eGFR test to enable GCUA assessment']
    };
  }

  // Calculate Module 1: Nelson/CKD-PC Incident CKD Risk
  const module1 = calculateNelsonIncidentCKD({
    age,
    sex,
    eGFR,
    uACR,
    hasDiabetes: Boolean(patient.has_diabetes),
    hasHypertension: Boolean(patient.has_hypertension),
    hasCVD: Boolean(hasCVD),
    hasHeartFailure: Boolean(hasHeartFailure),
    bmi: patient.current_bmi ? parseFloat(patient.current_bmi) : undefined,
    systolicBP: patient.average_bp_systolic ? parseInt(patient.average_bp_systolic) : undefined,
    smokingStatus: patient.smoking_status,
    hba1c: patient.hba1c ? parseFloat(patient.hba1c) : undefined
  });

  // Calculate Module 2: AHA PREVENT CVD Risk
  const module2 = calculatePREVENTCVDRisk({
    age,
    sex,
    eGFR,
    uACR,
    hasDiabetes: Boolean(patient.has_diabetes),
    hasHypertension: Boolean(patient.has_hypertension),
    hasCVD: Boolean(hasCVD),
    hasHeartFailure: Boolean(hasHeartFailure),
    hasAtrialFibrillation,
    bmi: patient.current_bmi ? parseFloat(patient.current_bmi) : undefined,
    systolicBP: patient.average_bp_systolic ? parseInt(patient.average_bp_systolic) : undefined,
    smokingStatus: patient.smoking_status,
    hba1c: patient.hba1c ? parseFloat(patient.hba1c) : undefined
  });

  // Calculate Module 3: Bansal Mortality Score
  const module3 = calculateBansalMortality({
    age,
    sex,
    eGFR,
    uACR,
    hasDiabetes: Boolean(patient.has_diabetes),
    hasHypertension: Boolean(patient.has_hypertension),
    hasCVD: Boolean(hasCVD),
    hasHeartFailure: Boolean(hasHeartFailure),
    hasAtrialFibrillation,
    smokingStatus: patient.smoking_status
  });

  // Assign phenotype
  const phenotype = assignPhenotype(module1.risk, module2.risk, module3.risk);

  // Calculate benefit ratio
  const combinedCardiorenalRisk = Math.max(module1.risk, module2.risk / 2);
  const nonCardiorenalMortality = Math.max(module3.risk - combinedCardiorenalRisk * 0.5, 5);
  const benefitRatio = Math.round((combinedCardiorenalRisk / nonCardiorenalMortality) * 100) / 100;

  let benefitRatioInterpretation: string;
  if (benefitRatio >= 2) {
    benefitRatioInterpretation = `Benefit Ratio ${benefitRatio}: High likelihood of benefiting from aggressive intervention.`;
  } else if (benefitRatio >= 1) {
    benefitRatioInterpretation = `Benefit Ratio ${benefitRatio}: Moderate likelihood of benefit. Balanced approach recommended.`;
  } else if (benefitRatio >= 0.5) {
    benefitRatioInterpretation = `Benefit Ratio ${benefitRatio}: Limited benefit expected from aggressive intervention.`;
  } else {
    benefitRatioInterpretation = `Benefit Ratio ${benefitRatio}: Low benefit from aggressive intervention. Consider conservative approach.`;
  }

  // Determine confidence level
  let confidenceLevel: 'high' | 'moderate' | 'low';
  if (missingData.length <= 1 && uACR !== null) {
    confidenceLevel = 'high';
  } else if (missingData.length <= 3 || uACR !== null) {
    confidenceLevel = 'moderate';
  } else {
    confidenceLevel = 'low';
  }

  // KDIGO screening recommendation
  let kdigoScreeningRecommendation: string;
  if (module1.riskCategory === 'very_high' || module1.riskCategory === 'high') {
    kdigoScreeningRecommendation = 'High-risk: Monitor eGFR and uACR every 6 months per KDIGO 2024.';
  } else if (module1.riskCategory === 'moderate') {
    kdigoScreeningRecommendation = 'Moderate-risk: Annual eGFR and uACR per KDIGO 2024.';
  } else {
    kdigoScreeningRecommendation = 'Low-risk: Screen every 2-3 years per KDIGO 2024.';
  }

  // Generate recommendations
  const recommendations = [
    ...phenotype.clinicalStrategy,
    kdigoScreeningRecommendation
  ];

  if (!uACR) {
    recommendations.unshift('ORDER uACR: Missing albuminuria data reduces assessment confidence. Order uACR to unlock full risk profile.');
  }

  return {
    isEligible: true,
    patientInfo: { age, sex, eGFR, uACR },
    module1: {
      name: module1.name,
      risk: module1.risk,
      riskCategory: module1.riskCategory,
      components: module1.components,
      interpretation: module1.interpretation
    },
    module2: {
      name: module2.name,
      risk: module2.risk,
      riskCategory: module2.riskCategory,
      components: module2.components,
      interpretation: module2.interpretation
    },
    module3: {
      name: module3.name,
      risk: module3.risk,
      riskCategory: module3.riskCategory,
      components: module3.components,
      interpretation: module3.interpretation
    },
    phenotype,
    benefitRatio,
    benefitRatioInterpretation,
    missingData,
    confidenceLevel,
    kdigoScreeningRecommendation,
    recommendations
  };
}

// ============================================
// Module Calculation Functions
// ============================================

interface ModuleInput {
  age: number;
  sex: string;
  eGFR: number;
  uACR: number | null;
  hasDiabetes: boolean;
  hasHypertension: boolean;
  hasCVD: boolean;
  hasHeartFailure: boolean;
  hasAtrialFibrillation?: boolean;
  bmi?: number;
  systolicBP?: number;
  smokingStatus?: string;
  hba1c?: number;
}

function calculateNelsonIncidentCKD(input: ModuleInput): GCUAModule {
  const components: string[] = [];
  let baselineRisk = 2.5;
  let riskMultiplier = 1.0;

  // Age
  if (input.age >= 80) {
    riskMultiplier *= 3.2;
    components.push(`Age ${input.age}: Very high age-related risk (+220%)`);
  } else if (input.age >= 75) {
    riskMultiplier *= 2.4;
    components.push(`Age ${input.age}: High age-related risk (+140%)`);
  } else if (input.age >= 70) {
    riskMultiplier *= 1.8;
    components.push(`Age ${input.age}: Elevated age-related risk (+80%)`);
  } else if (input.age >= 65) {
    riskMultiplier *= 1.4;
    components.push(`Age ${input.age}: Moderate age-related risk (+40%)`);
  }

  // Sex
  if (input.sex === 'male') {
    riskMultiplier *= 1.15;
    components.push('Male sex: +15% risk');
  }

  // eGFR
  if (input.eGFR < 75) {
    riskMultiplier *= 2.8;
    components.push(`eGFR ${input.eGFR}: Borderline function, high risk (+180%)`);
  } else if (input.eGFR < 90) {
    riskMultiplier *= 1.8;
    components.push(`eGFR ${input.eGFR}: Mildly reduced (+80%)`);
  }

  // uACR
  if (input.uACR !== null) {
    if (input.uACR >= 300) {
      riskMultiplier *= 4.5;
      components.push(`uACR ${input.uACR}: Macroalbuminuria (+350%)`);
    } else if (input.uACR >= 30) {
      riskMultiplier *= 2.5;
      components.push(`uACR ${input.uACR}: Microalbuminuria (+150%)`);
    }
  }

  // Diabetes
  if (input.hasDiabetes) {
    riskMultiplier *= input.hba1c && input.hba1c >= 8 ? 2.5 : 1.7;
    components.push(`Diabetes: +${input.hba1c && input.hba1c >= 8 ? 150 : 70}% risk`);
  }

  // Hypertension
  if (input.hasHypertension) {
    riskMultiplier *= 1.5;
    components.push('Hypertension: +50% risk');
  }

  // CVD
  if (input.hasCVD) {
    riskMultiplier *= 1.8;
    components.push('History of CVD: +80% risk');
  }

  // Heart Failure
  if (input.hasHeartFailure) {
    riskMultiplier *= 2.2;
    components.push('Heart Failure: +120% risk');
  }

  let risk = Math.min(baselineRisk * riskMultiplier, 85);
  risk = Math.round(risk * 10) / 10;

  let riskCategory: string;
  if (risk >= 25) riskCategory = 'very_high';
  else if (risk >= 15) riskCategory = 'high';
  else if (risk >= 5) riskCategory = 'moderate';
  else riskCategory = 'low';

  return {
    name: 'Nelson/CKD-PC Incident CKD (2019)',
    risk,
    riskCategory,
    components,
    interpretation: `${risk}% 5-year risk of developing CKD (eGFR < 60). C-statistic: ${input.hasDiabetes ? 0.801 : 0.845}`
  };
}

function calculatePREVENTCVDRisk(input: ModuleInput): GCUAModule {
  const components: string[] = [];

  let baselineRisk: number;
  if (input.sex === 'male') {
    baselineRisk = input.age >= 75 ? 22 : input.age >= 70 ? 16 : input.age >= 65 ? 11 : 7;
  } else {
    baselineRisk = input.age >= 75 ? 15 : input.age >= 70 ? 10 : input.age >= 65 ? 6 : 4;
  }
  components.push(`${input.sex === 'male' ? 'Male' : 'Female'}, Age ${input.age}: Baseline ${baselineRisk}%`);

  let riskMultiplier = 1.0;

  // Blood pressure
  if (input.systolicBP && input.systolicBP >= 160) {
    riskMultiplier *= 2.0;
    components.push(`SBP ${input.systolicBP}: Stage 2 hypertension (+100%)`);
  } else if (input.systolicBP && input.systolicBP >= 140) {
    riskMultiplier *= 1.6;
    components.push(`SBP ${input.systolicBP}: Stage 1 hypertension (+60%)`);
  }

  // Diabetes
  if (input.hasDiabetes) {
    riskMultiplier *= 2.0;
    components.push('Diabetes: +100% CVD risk');
  }

  // eGFR (CKM kidney component)
  if (input.eGFR < 75) {
    riskMultiplier *= 1.6;
    components.push(`eGFR ${input.eGFR}: Reduced kidney function (+60%)`);
  }

  // uACR (CKM kidney component)
  if (input.uACR !== null && input.uACR >= 30) {
    riskMultiplier *= input.uACR >= 300 ? 2.5 : 1.7;
    components.push(`uACR ${input.uACR}: ${input.uACR >= 300 ? 'Macroalbuminuria (+150%)' : 'Microalbuminuria (+70%)'}`);
  }

  // Heart Failure
  if (input.hasHeartFailure) {
    riskMultiplier *= 2.8;
    components.push('Heart Failure: +180% CVD risk');
  }

  // Prior CVD
  if (input.hasCVD) {
    riskMultiplier *= 2.5;
    components.push('Prior CVD: +150% recurrent event risk');
  }

  // AF
  if (input.hasAtrialFibrillation) {
    riskMultiplier *= 1.8;
    components.push('Atrial Fibrillation: +80% CVD risk');
  }

  let risk = Math.min(baselineRisk * riskMultiplier, 90);
  risk = Math.round(risk * 10) / 10;

  let riskCategory: string;
  if (risk >= 20) riskCategory = 'high';
  else if (risk >= 7.5) riskCategory = 'intermediate';
  else if (risk >= 5) riskCategory = 'borderline';
  else riskCategory = 'low';

  return {
    name: 'AHA PREVENT CVD Risk (2024)',
    risk,
    riskCategory,
    components,
    interpretation: `${risk}% 10-year CVD event risk. C-statistic: ~0.80`
  };
}

function calculateBansalMortality(input: ModuleInput): GCUAModule {
  const components: string[] = [];
  let points = 0;

  // Age
  if (input.age >= 85) {
    points += 8;
    components.push(`Age ${input.age}: +8 points`);
  } else if (input.age >= 80) {
    points += 6;
    components.push(`Age ${input.age}: +6 points`);
  } else if (input.age >= 75) {
    points += 4;
    components.push(`Age ${input.age}: +4 points`);
  } else if (input.age >= 70) {
    points += 2;
    components.push(`Age ${input.age}: +2 points`);
  }

  // Sex
  if (input.sex === 'male') {
    points += 1;
    components.push('Male sex: +1 point');
  }

  // eGFR
  if (input.eGFR < 60) {
    points += 4;
    components.push(`eGFR ${input.eGFR}: +4 points`);
  } else if (input.eGFR < 75) {
    points += 2;
    components.push(`eGFR ${input.eGFR}: +2 points`);
  }

  // uACR
  if (input.uACR !== null) {
    if (input.uACR >= 300) {
      points += 4;
      components.push(`uACR ${input.uACR}: +4 points`);
    } else if (input.uACR >= 30) {
      points += 2;
      components.push(`uACR ${input.uACR}: +2 points`);
    }
  }

  // Heart Failure
  if (input.hasHeartFailure) {
    points += 5;
    components.push('Heart Failure: +5 points');
  }

  // CVD
  if (input.hasCVD) {
    points += 3;
    components.push('History of CVD: +3 points');
  }

  // AF
  if (input.hasAtrialFibrillation) {
    points += 3;
    components.push('Atrial Fibrillation: +3 points');
  }

  // Diabetes
  if (input.hasDiabetes) {
    points += 2;
    components.push('Diabetes: +2 points');
  }

  // Convert points to mortality risk
  let risk: number;
  if (points <= 5) {
    risk = 5 + points * 2;
  } else if (points <= 10) {
    risk = 15 + (points - 5) * 5;
  } else if (points <= 15) {
    risk = 40 + (points - 10) * 6;
  } else if (points <= 20) {
    risk = 70 + (points - 15) * 4;
  } else {
    risk = Math.min(90 + (points - 20) * 2, 95);
  }
  risk = Math.round(risk * 10) / 10;

  let riskCategory: string;
  if (risk >= 50) riskCategory = 'very_high';
  else if (risk >= 30) riskCategory = 'high';
  else if (risk >= 15) riskCategory = 'moderate';
  else riskCategory = 'low';

  return {
    name: 'Bansal Geriatric Mortality (2015)',
    risk,
    riskCategory,
    components,
    interpretation: `${risk}% 5-year mortality risk (competing risk). Points: ${points}. C-statistic: ~0.69`
  };
}

function assignPhenotype(renalRisk: number, cvdRisk: number, mortalityRisk: number): GCUAPhenotype {
  // Phenotype IV: The Senescent (takes precedence)
  if (mortalityRisk >= 50) {
    return {
      type: 'IV',
      name: 'The Senescent',
      tag: 'De-escalate',
      color: 'gray',
      description: 'High competing mortality risk. Patient more likely to die from other causes than progress to kidney failure.',
      clinicalStrategy: [
        'Focus on symptom control and quality of life',
        'Consider deprescribing (reduce polypharmacy)',
        'Avoid aggressive renal protection protocols',
        'Palliative care consultation if appropriate'
      ],
      treatmentRecommendations: {
        sglt2i: false,
        rasInhibitor: false,
        statin: false,
        bpTarget: '<150/90 mmHg (lenient)',
        monitoringFrequency: 'As clinically indicated'
      }
    };
  }

  // Phenotype I: Accelerated Ager
  if (renalRisk >= 15 && cvdRisk >= 10) {
    return {
      type: 'I',
      name: 'Accelerated Ager',
      tag: 'High Priority',
      color: 'red',
      description: 'High risk for both incident CKD and cardiovascular events. Sweet spot for intervention.',
      clinicalStrategy: [
        'Initiate SGLT2 inhibitor (renal + cardiac protection)',
        'Start or optimize RAS inhibitor',
        'High-intensity statin therapy',
        'Aggressive BP control (target <120/80)',
        'Quarterly cardiorenal monitoring'
      ],
      treatmentRecommendations: {
        sglt2i: true,
        rasInhibitor: true,
        statin: true,
        bpTarget: '<120/80 mmHg (aggressive)',
        monitoringFrequency: 'Every 3 months'
      }
    };
  }

  // Phenotype II: Silent Renal
  if (renalRisk >= 15 && cvdRisk < 10) {
    return {
      type: 'II',
      name: 'Silent Renal',
      tag: 'Kidney Specific',
      color: 'orange',
      description: 'High renal risk with low cardiovascular risk. Often MISSED by Framingham-based screening.',
      clinicalStrategy: [
        'Initiate SGLT2 inhibitor (primary renal indication)',
        'Monitor uACR every 6 months',
        'Consider nephrology referral',
        'BP target for renal protection',
        'Annual cardiovascular reassessment'
      ],
      treatmentRecommendations: {
        sglt2i: true,
        rasInhibitor: true,
        statin: false,
        bpTarget: '<130/80 mmHg',
        monitoringFrequency: 'Every 6 months (uACR biannually)'
      }
    };
  }

  // Phenotype III: Vascular Dominant
  if (renalRisk < 5 && cvdRisk >= 10) {
    return {
      type: 'III',
      name: 'Vascular Dominant',
      tag: 'Heart Specific',
      color: 'yellow',
      description: 'High cardiovascular risk but low renal risk. Standard CVD prevention protocols apply.',
      clinicalStrategy: [
        'Standard CVD prevention protocols',
        'Statin therapy (moderate-high intensity)',
        'Optimize BP control',
        'SGLT2 inhibitor optional (for HF prevention)',
        'Annual renal screening'
      ],
      treatmentRecommendations: {
        sglt2i: false,
        rasInhibitor: false,
        statin: true,
        bpTarget: '<130/80 mmHg',
        monitoringFrequency: 'Annually'
      }
    };
  }

  // Default: Low risk
  return {
    type: 'III',
    name: 'Low Risk',
    tag: 'Monitor',
    color: 'yellow',
    description: 'Low risk across all domains. Continue routine preventive care.',
    clinicalStrategy: [
      'Maintain healthy lifestyle',
      'Periodic screening (every 2-3 years)',
      'Address modifiable risk factors'
    ],
    treatmentRecommendations: {
      sglt2i: false,
      rasInhibitor: false,
      statin: false,
      bpTarget: '<140/90 mmHg',
      monitoringFrequency: 'Every 2-3 years'
    }
  };
}
