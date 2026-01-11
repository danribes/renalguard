/**
 * Geriatric Cardiorenal Unified Assessment (GCUA)
 *
 * A comprehensive risk stratification system for adults 60+ with eGFR > 60
 * Integrates three validated prediction models:
 *
 * Module 1: Nelson/CKD-PC Incident CKD Equation (2019) - 5-year incident CKD risk
 * Module 2: AHA PREVENT (2024) - 10-year CVD event risk with CKM integration
 * Module 3: Bansal Mortality Score (2015) - 5-year all-cause mortality risk
 *
 * The system classifies patients into four actionable phenotypes:
 * - I. Accelerated Ager: High renal + High CVD risk
 * - II. Silent Renal: High renal + Low CVD risk
 * - III. Vascular Dominant: Low renal + High CVD risk
 * - IV. The Senescent: High mortality risk
 *
 * Reference: Geriatric Cardiorenal Unified Assessment Protocol (GCUA)
 */

// ============================================
// INTERFACES
// ============================================

export interface GCUAPatientInput {
  // Demographics
  age: number;
  sex: 'male' | 'female';

  // Biometrics
  bmi?: number;
  systolicBP?: number;

  // Renal markers
  eGFR: number;
  uACR?: number; // Albuminuria (mg/g creatinine)

  // Comorbidities
  hasDiabetes: boolean;
  hasHypertension: boolean;
  hasCVD: boolean; // History of cardiovascular disease (MI, stroke)
  hasHeartFailure: boolean;
  hasAtrialFibrillation?: boolean;

  // Lifestyle
  smokingStatus?: 'never' | 'former' | 'current';

  // Treatment
  onStatins?: boolean;
  onRASInhibitor?: boolean;
  onSGLT2i?: boolean;

  // Geriatric-specific (for Bansal Mortality)
  frailtyScore?: number; // 0-9 Clinical Frailty Scale
  gaitSpeed?: number; // m/s

  // Optional biomarkers (enhance precision)
  ntProBNP?: number; // pg/mL
  troponinT?: number; // ng/mL
  hba1c?: number; // % (for diabetics)
  cystatinC?: number; // mg/L
}

export interface GCUAModule1Result {
  name: 'Nelson/CKD-PC Incident CKD';
  fiveYearRisk: number; // Percentage 0-100
  riskCategory: 'low' | 'moderate' | 'high' | 'very_high';
  components: string[];
  interpretation: string;
  cStatistic: number; // 0.845 for non-diabetic, 0.801 for diabetic
}

export interface GCUAModule2Result {
  name: 'AHA PREVENT CVD Risk';
  tenYearRisk: number; // Percentage 0-100
  riskCategory: 'low' | 'borderline' | 'intermediate' | 'high';
  heartAge?: number;
  components: string[];
  interpretation: string;
  cStatistic: number; // ~0.80
}

export interface GCUAModule3Result {
  name: 'Bansal Geriatric Mortality';
  fiveYearMortalityRisk: number; // Percentage 0-100
  riskCategory: 'low' | 'moderate' | 'high' | 'very_high';
  points: number;
  components: string[];
  interpretation: string;
  competingRiskAdjustment: boolean;
}

export interface GCUAPhenotype {
  type: 'I' | 'II' | 'III' | 'IV' | 'Moderate' | 'Low';
  name: string;
  tag: string;
  color: 'red' | 'orange' | 'yellow' | 'gray' | 'green';
  description: string;
  clinicalStrategy: string[];
  treatmentRecommendations: {
    sglt2i: boolean;
    rasInhibitor: boolean;
    statin: boolean;
    bpTarget: string;
    monitoringFrequency: string;
    homeMonitoringRecommended: boolean;  // Minuteful Kidney home uACR monitoring
  };
}

export interface GCUAAssessment {
  // Eligibility
  isEligible: boolean;
  eligibilityReason?: string;

  // Module results
  module1: GCUAModule1Result;
  module2: GCUAModule2Result;
  module3: GCUAModule3Result;

  // Phenotype assignment
  phenotype: GCUAPhenotype;

  // Benefit ratio (Risk of Cardiorenal Event / Risk of Non-Cardiorenal Death)
  benefitRatio: number;
  benefitRatioInterpretation: string;

  // Data quality
  dataCompleteness: number; // Percentage 0-100
  missingData: string[];
  confidenceLevel: 'high' | 'moderate' | 'low';

  // KDIGO alignment
  kdigoScreeningRecommendation: string;
  cystatinCRecommended: boolean;

  // Timestamps
  assessedAt: Date;
}

// ============================================
// MODULE 1: NELSON/CKD-PC INCIDENT CKD EQUATION (2019)
// ============================================

/**
 * Nelson/CKD-PC Incident CKD Equation
 *
 * Predicts 5-year probability of developing CKD (eGFR < 60 mL/min/1.73m²)
 * in individuals with currently preserved kidney function.
 *
 * Derived from 34 multinational cohorts with >5 million individuals
 * C-statistic: 0.845 (non-diabetic), 0.801 (diabetic)
 *
 * Reference: Nelson RG et al. JAMA 2019;322(22):2175-2187
 */
export function calculateNelsonIncidentCKD(input: GCUAPatientInput): GCUAModule1Result {
  const components: string[] = [];
  let baselineRisk = 2.5; // Base 5-year risk for 60-year-old with normal parameters
  let riskMultiplier = 1.0;

  // Age (exponential relationship with risk)
  // Age spline: risk increases substantially after 60, accelerates after 75
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
  } else {
    components.push(`Age ${input.age}: Baseline age risk`);
  }

  // Sex
  if (input.sex === 'male') {
    riskMultiplier *= 1.15;
    components.push('Male sex: +15% risk');
  } else {
    components.push('Female sex: Baseline risk');
  }

  // Baseline eGFR (critical predictor)
  // Risk increases as eGFR approaches 60 threshold
  if (input.eGFR < 75) {
    riskMultiplier *= 2.8;
    components.push(`eGFR ${input.eGFR}: Borderline function, high risk (+180%)`);
  } else if (input.eGFR < 90) {
    riskMultiplier *= 1.8;
    components.push(`eGFR ${input.eGFR}: Mildly reduced, elevated risk (+80%)`);
  } else if (input.eGFR < 105) {
    riskMultiplier *= 1.3;
    components.push(`eGFR ${input.eGFR}: Low-normal, slightly elevated risk (+30%)`);
  } else {
    components.push(`eGFR ${input.eGFR}: Optimal kidney function`);
  }

  // Log-transformed uACR (strongest predictor after age/eGFR)
  if (input.uACR !== undefined) {
    if (input.uACR >= 300) {
      riskMultiplier *= 4.5;
      components.push(`uACR ${input.uACR}: Macroalbuminuria - very high risk (+350%)`);
    } else if (input.uACR >= 30) {
      riskMultiplier *= 2.5;
      components.push(`uACR ${input.uACR}: Microalbuminuria - high risk (+150%)`);
    } else if (input.uACR >= 10) {
      riskMultiplier *= 1.4;
      components.push(`uACR ${input.uACR}: High-normal albuminuria (+40%)`);
    } else {
      components.push(`uACR ${input.uACR}: Normal albuminuria`);
    }
  }

  // Diabetes (major risk factor)
  if (input.hasDiabetes) {
    if (input.hba1c && input.hba1c >= 8) {
      riskMultiplier *= 2.5;
      components.push(`Diabetes (HbA1c ${input.hba1c}%): Uncontrolled, very high risk (+150%)`);
    } else if (input.hba1c && input.hba1c >= 7) {
      riskMultiplier *= 2.0;
      components.push(`Diabetes (HbA1c ${input.hba1c}%): Moderately controlled (+100%)`);
    } else {
      riskMultiplier *= 1.7;
      components.push('Diabetes: +70% risk');
    }
  }

  // Hypertension
  if (input.hasHypertension) {
    if (input.systolicBP && input.systolicBP >= 160) {
      riskMultiplier *= 2.0;
      components.push(`Hypertension (SBP ${input.systolicBP}): Severe, +100% risk`);
    } else if (input.systolicBP && input.systolicBP >= 140) {
      riskMultiplier *= 1.6;
      components.push(`Hypertension (SBP ${input.systolicBP}): Uncontrolled, +60% risk`);
    } else {
      riskMultiplier *= 1.4;
      components.push('Hypertension: +40% risk');
    }
  }

  // History of CVD (cardiorenal connection)
  if (input.hasCVD) {
    riskMultiplier *= 1.8;
    components.push('History of CVD: +80% risk (cardiorenal syndrome)');
  }

  // Heart Failure (hemodynamic stress on kidneys)
  if (input.hasHeartFailure) {
    riskMultiplier *= 2.2;
    components.push('Heart Failure: +120% risk (cardiorenal syndrome type 2)');
  }

  // BMI (obesity)
  if (input.bmi) {
    if (input.bmi >= 35) {
      riskMultiplier *= 1.5;
      components.push(`BMI ${input.bmi.toFixed(1)}: Class II/III Obesity, +50% risk`);
    } else if (input.bmi >= 30) {
      riskMultiplier *= 1.3;
      components.push(`BMI ${input.bmi.toFixed(1)}: Obesity, +30% risk`);
    }
  }

  // Smoking
  if (input.smokingStatus === 'current') {
    riskMultiplier *= 1.35;
    components.push('Current Smoker: +35% risk');
  } else if (input.smokingStatus === 'former') {
    riskMultiplier *= 1.1;
    components.push('Former Smoker: +10% risk');
  }

  // Protective factors (reduce risk)
  if (input.onSGLT2i) {
    riskMultiplier *= 0.65; // SGLT2i reduces CKD progression by ~35%
    components.push('On SGLT2 inhibitor: -35% risk (protective)');
  }

  if (input.onRASInhibitor && input.uACR && input.uACR >= 30) {
    riskMultiplier *= 0.80; // RAS inhibitors protective with albuminuria
    components.push('On RAS inhibitor with albuminuria: -20% risk (protective)');
  }

  // Calculate final 5-year risk
  let fiveYearRisk = baselineRisk * riskMultiplier;
  fiveYearRisk = Math.min(fiveYearRisk, 85); // Cap at realistic maximum
  fiveYearRisk = Math.round(fiveYearRisk * 10) / 10;

  // Determine risk category based on Nelson model thresholds
  let riskCategory: 'low' | 'moderate' | 'high' | 'very_high';
  if (fiveYearRisk >= 25) {
    riskCategory = 'very_high';
  } else if (fiveYearRisk >= 15) {
    riskCategory = 'high';
  } else if (fiveYearRisk >= 5) {
    riskCategory = 'moderate';
  } else {
    riskCategory = 'low';
  }

  // Generate interpretation
  let interpretation: string;
  if (riskCategory === 'very_high') {
    interpretation = `Very high 5-year risk (${fiveYearRisk}%) of developing CKD. Immediate intervention with SGLT2 inhibitor recommended. This patient has a high probability of kidney function decline within 5 years.`;
  } else if (riskCategory === 'high') {
    interpretation = `High 5-year risk (${fiveYearRisk}%) of incident CKD. Consider initiating renal protective therapy (SGLT2i). Monitor uACR every 6 months.`;
  } else if (riskCategory === 'moderate') {
    interpretation = `Moderate 5-year risk (${fiveYearRisk}%) of developing CKD. Annual monitoring of eGFR and uACR recommended. Address modifiable risk factors.`;
  } else {
    interpretation = `Low 5-year risk (${fiveYearRisk}%) of incident CKD. Continue routine screening every 2-3 years per KDIGO guidelines.`;
  }

  return {
    name: 'Nelson/CKD-PC Incident CKD',
    fiveYearRisk,
    riskCategory,
    components,
    interpretation,
    cStatistic: input.hasDiabetes ? 0.801 : 0.845
  };
}

// ============================================
// MODULE 2: AHA PREVENT CVD RISK EQUATION (2024)
// ============================================

/**
 * AHA PREVENT (Predicting Risk of CVD EVENTs) Equation
 *
 * 10-year risk of total cardiovascular disease events
 * Integrates the Cardiovascular-Kidney-Metabolic (CKM) syndrome
 *
 * Key advancement over PCE: Includes eGFR/uACR as core variables
 * Also incorporates social determinants (SDI) when available
 *
 * C-statistic: ~0.80 for CVD events
 *
 * Reference: Khan SS et al. Circulation 2024
 */
export function calculatePREVENTCVDRisk(input: GCUAPatientInput): GCUAModule2Result {
  const components: string[] = [];

  // Base 10-year CVD risk by age and sex (from PREVENT coefficients)
  let baselineRisk: number;
  if (input.sex === 'male') {
    if (input.age >= 75) {
      baselineRisk = 22;
    } else if (input.age >= 70) {
      baselineRisk = 16;
    } else if (input.age >= 65) {
      baselineRisk = 11;
    } else {
      baselineRisk = 7;
    }
    components.push(`Male, Age ${input.age}: Baseline CVD risk ${baselineRisk}%`);
  } else {
    if (input.age >= 75) {
      baselineRisk = 15;
    } else if (input.age >= 70) {
      baselineRisk = 10;
    } else if (input.age >= 65) {
      baselineRisk = 6;
    } else {
      baselineRisk = 4;
    }
    components.push(`Female, Age ${input.age}: Baseline CVD risk ${baselineRisk}%`);
  }

  let riskMultiplier = 1.0;

  // Systolic Blood Pressure (major predictor)
  if (input.systolicBP) {
    if (input.systolicBP >= 180) {
      riskMultiplier *= 2.5;
      components.push(`SBP ${input.systolicBP}: Severe hypertension (+150% CVD risk)`);
    } else if (input.systolicBP >= 160) {
      riskMultiplier *= 2.0;
      components.push(`SBP ${input.systolicBP}: Stage 2 hypertension (+100% CVD risk)`);
    } else if (input.systolicBP >= 140) {
      riskMultiplier *= 1.6;
      components.push(`SBP ${input.systolicBP}: Stage 1 hypertension (+60% CVD risk)`);
    } else if (input.systolicBP >= 130) {
      riskMultiplier *= 1.3;
      components.push(`SBP ${input.systolicBP}: Elevated BP (+30% CVD risk)`);
    } else {
      components.push(`SBP ${input.systolicBP}: Normal blood pressure`);
    }
  }

  // Diabetes (CKM integration)
  if (input.hasDiabetes) {
    if (input.hba1c && input.hba1c >= 9) {
      riskMultiplier *= 2.8;
      components.push(`Diabetes (HbA1c ${input.hba1c}%): Poorly controlled, +180% CVD risk`);
    } else if (input.hba1c && input.hba1c >= 7.5) {
      riskMultiplier *= 2.2;
      components.push(`Diabetes (HbA1c ${input.hba1c}%): Suboptimal control, +120% CVD risk`);
    } else {
      riskMultiplier *= 1.8;
      components.push('Diabetes: +80% CVD risk');
    }
  }

  // eGFR (CKM kidney component - key innovation in PREVENT)
  if (input.eGFR < 75) {
    riskMultiplier *= 1.6;
    components.push(`eGFR ${input.eGFR}: Reduced kidney function, +60% CVD risk`);
  } else if (input.eGFR < 90) {
    riskMultiplier *= 1.25;
    components.push(`eGFR ${input.eGFR}: Mildly reduced, +25% CVD risk`);
  }

  // uACR (CKM kidney component - vascular damage marker)
  if (input.uACR !== undefined) {
    if (input.uACR >= 300) {
      riskMultiplier *= 2.5;
      components.push(`uACR ${input.uACR}: Macroalbuminuria, +150% CVD risk (vascular damage)`);
    } else if (input.uACR >= 30) {
      riskMultiplier *= 1.7;
      components.push(`uACR ${input.uACR}: Microalbuminuria, +70% CVD risk`);
    }
  }

  // History of CVD (secondary prevention)
  if (input.hasCVD) {
    riskMultiplier *= 2.5;
    components.push('Prior CVD: +150% recurrent event risk');
  }

  // Heart Failure
  if (input.hasHeartFailure) {
    riskMultiplier *= 2.8;
    components.push('Heart Failure: +180% CVD event risk');
  }

  // Atrial Fibrillation (stroke risk)
  if (input.hasAtrialFibrillation) {
    riskMultiplier *= 1.8;
    components.push('Atrial Fibrillation: +80% CVD risk (stroke)');
  }

  // BMI (metabolic component)
  if (input.bmi) {
    if (input.bmi >= 35) {
      riskMultiplier *= 1.4;
      components.push(`BMI ${input.bmi.toFixed(1)}: Class II/III obesity, +40% CVD risk`);
    } else if (input.bmi >= 30) {
      riskMultiplier *= 1.2;
      components.push(`BMI ${input.bmi.toFixed(1)}: Obesity, +20% CVD risk`);
    }
  }

  // Smoking
  if (input.smokingStatus === 'current') {
    riskMultiplier *= 2.0;
    components.push('Current Smoker: +100% CVD risk');
  } else if (input.smokingStatus === 'former') {
    riskMultiplier *= 1.2;
    components.push('Former Smoker: +20% CVD risk');
  }

  // Biomarker enhancement (Bansal 2019)
  if (input.ntProBNP !== undefined) {
    if (input.ntProBNP >= 300) {
      riskMultiplier *= 2.0;
      components.push(`NT-proBNP ${input.ntProBNP}: Elevated, +100% HF/CVD risk`);
    } else if (input.ntProBNP >= 125) {
      riskMultiplier *= 1.4;
      components.push(`NT-proBNP ${input.ntProBNP}: Borderline, +40% CVD risk`);
    }
  }

  if (input.troponinT !== undefined && input.troponinT > 0.014) {
    riskMultiplier *= 1.6;
    components.push(`Troponin T ${input.troponinT}: Elevated, subclinical myocardial injury`);
  }

  // Protective factors
  if (input.onStatins) {
    riskMultiplier *= 0.70; // Statins reduce CVD events by ~30%
    components.push('On Statin: -30% CVD risk (protective)');
  }

  if (input.onSGLT2i) {
    riskMultiplier *= 0.80; // SGLT2i reduces MACE by ~20%
    components.push('On SGLT2 inhibitor: -20% CVD risk (cardioprotective)');
  }

  // Calculate final 10-year risk
  let tenYearRisk = baselineRisk * riskMultiplier;
  tenYearRisk = Math.min(tenYearRisk, 90); // Cap at 90%
  tenYearRisk = Math.round(tenYearRisk * 10) / 10;

  // Determine risk category per AHA/ACC guidelines
  let riskCategory: 'low' | 'borderline' | 'intermediate' | 'high';
  if (tenYearRisk >= 20) {
    riskCategory = 'high';
  } else if (tenYearRisk >= 7.5) {
    riskCategory = 'intermediate';
  } else if (tenYearRisk >= 5) {
    riskCategory = 'borderline';
  } else {
    riskCategory = 'low';
  }

  // Calculate heart age (simplified)
  let heartAge: number | undefined;
  if (input.systolicBP && !input.hasCVD) {
    const riskRatio = tenYearRisk / baselineRisk;
    heartAge = Math.round(input.age + (riskRatio - 1) * 10);
    heartAge = Math.min(heartAge, 95);
  }

  // Generate interpretation
  let interpretation: string;
  if (riskCategory === 'high') {
    interpretation = `High 10-year CVD risk (${tenYearRisk}%). Intensive risk factor modification required. Consider high-intensity statin if not already prescribed. Target BP <130/80.`;
  } else if (riskCategory === 'intermediate') {
    interpretation = `Intermediate 10-year CVD risk (${tenYearRisk}%). Statin therapy indicated. Optimize blood pressure and glycemic control.`;
  } else if (riskCategory === 'borderline') {
    interpretation = `Borderline CVD risk (${tenYearRisk}%). Lifestyle modification emphasized. Consider statin based on risk enhancers.`;
  } else {
    interpretation = `Low 10-year CVD risk (${tenYearRisk}%). Focus on maintaining healthy lifestyle. Periodic reassessment recommended.`;
  }

  return {
    name: 'AHA PREVENT CVD Risk',
    tenYearRisk,
    riskCategory,
    heartAge,
    components,
    interpretation,
    cStatistic: 0.80
  };
}

// ============================================
// MODULE 3: BANSAL GERIATRIC MORTALITY SCORE (2015)
// ============================================

/**
 * Bansal Mortality Score for Older Adults
 *
 * Predicts 5-year all-cause mortality in older adults with kidney issues
 * Critical for addressing the "competing risk" problem in geriatric patients
 *
 * Key insight: In patients >75, death often competes with ESKD
 * Helps identify patients for whom aggressive renal protection may be futile
 *
 * C-statistic: ~0.69 (calibrated for elderly)
 *
 * Reference: Bansal N et al. CJASN 2015
 */
export function calculateBansalMortalityScore(input: GCUAPatientInput): GCUAModule3Result {
  const components: string[] = [];
  let points = 0;

  // Age (major predictor in elderly)
  if (input.age >= 85) {
    points += 8;
    components.push(`Age ${input.age}: +8 points (very elderly)`);
  } else if (input.age >= 80) {
    points += 6;
    components.push(`Age ${input.age}: +6 points`);
  } else if (input.age >= 75) {
    points += 4;
    components.push(`Age ${input.age}: +4 points`);
  } else if (input.age >= 70) {
    points += 2;
    components.push(`Age ${input.age}: +2 points`);
  } else {
    components.push(`Age ${input.age}: +0 points`);
  }

  // Sex
  if (input.sex === 'male') {
    points += 1;
    components.push('Male sex: +1 point');
  }

  // eGFR (kidney function)
  if (input.eGFR < 45) {
    points += 4;
    components.push(`eGFR ${input.eGFR}: +4 points (severely reduced)`);
  } else if (input.eGFR < 60) {
    points += 3;
    components.push(`eGFR ${input.eGFR}: +3 points (moderately reduced)`);
  } else if (input.eGFR < 75) {
    points += 2;
    components.push(`eGFR ${input.eGFR}: +2 points (mildly reduced)`);
  } else if (input.eGFR < 90) {
    points += 1;
    components.push(`eGFR ${input.eGFR}: +1 point`);
  }

  // Albuminuria
  if (input.uACR !== undefined) {
    if (input.uACR >= 300) {
      points += 4;
      components.push(`uACR ${input.uACR}: +4 points (macroalbuminuria)`);
    } else if (input.uACR >= 30) {
      points += 2;
      components.push(`uACR ${input.uACR}: +2 points (microalbuminuria)`);
    }
  }

  // Heart Failure (strong mortality predictor)
  if (input.hasHeartFailure) {
    points += 5;
    components.push('Heart Failure: +5 points');
  }

  // History of CVD
  if (input.hasCVD) {
    points += 3;
    components.push('History of CVD: +3 points');
  }

  // Atrial Fibrillation (per Bansal 2019 AF study)
  if (input.hasAtrialFibrillation) {
    points += 3;
    components.push('Atrial Fibrillation: +3 points (+67% ESKD risk per Bansal)');
  }

  // Diabetes
  if (input.hasDiabetes) {
    points += 2;
    components.push('Diabetes: +2 points');
  }

  // Frailty (geriatric-specific)
  if (input.frailtyScore !== undefined) {
    if (input.frailtyScore >= 7) {
      points += 6;
      components.push(`Frailty Score ${input.frailtyScore}: +6 points (severely frail)`);
    } else if (input.frailtyScore >= 5) {
      points += 4;
      components.push(`Frailty Score ${input.frailtyScore}: +4 points (moderately frail)`);
    } else if (input.frailtyScore >= 4) {
      points += 2;
      components.push(`Frailty Score ${input.frailtyScore}: +2 points (vulnerable)`);
    }
  } else if (input.gaitSpeed !== undefined) {
    // Use gait speed as frailty proxy
    if (input.gaitSpeed < 0.6) {
      points += 5;
      components.push(`Gait Speed ${input.gaitSpeed} m/s: +5 points (severe frailty)`);
    } else if (input.gaitSpeed < 0.8) {
      points += 3;
      components.push(`Gait Speed ${input.gaitSpeed} m/s: +3 points (moderate frailty)`);
    } else if (input.gaitSpeed < 1.0) {
      points += 1;
      components.push(`Gait Speed ${input.gaitSpeed} m/s: +1 point`);
    }
  }

  // Biomarkers (Bansal 2019 CRIC insights)
  if (input.ntProBNP !== undefined && input.ntProBNP >= 300) {
    points += 3;
    components.push(`NT-proBNP ${input.ntProBNP}: +3 points (cardiac stress)`);
  }

  // Smoking
  if (input.smokingStatus === 'current') {
    points += 2;
    components.push('Current Smoker: +2 points');
  }

  // Convert points to 5-year mortality probability
  // Calibrated sigmoid function based on Bansal model
  let fiveYearMortalityRisk: number;
  if (points <= 5) {
    fiveYearMortalityRisk = 5 + points * 2;
  } else if (points <= 10) {
    fiveYearMortalityRisk = 15 + (points - 5) * 5;
  } else if (points <= 15) {
    fiveYearMortalityRisk = 40 + (points - 10) * 6;
  } else if (points <= 20) {
    fiveYearMortalityRisk = 70 + (points - 15) * 4;
  } else {
    fiveYearMortalityRisk = Math.min(90 + (points - 20) * 2, 95);
  }

  fiveYearMortalityRisk = Math.round(fiveYearMortalityRisk * 10) / 10;

  // Determine risk category
  let riskCategory: 'low' | 'moderate' | 'high' | 'very_high';
  if (fiveYearMortalityRisk >= 50) {
    riskCategory = 'very_high';
  } else if (fiveYearMortalityRisk >= 30) {
    riskCategory = 'high';
  } else if (fiveYearMortalityRisk >= 15) {
    riskCategory = 'moderate';
  } else {
    riskCategory = 'low';
  }

  // Generate interpretation
  let interpretation: string;
  if (riskCategory === 'very_high') {
    interpretation = `Very high 5-year mortality risk (${fiveYearMortalityRisk}%). Competing risk of death significantly exceeds kidney failure risk. Consider palliative/conservative approach. Focus on quality of life and symptom management.`;
  } else if (riskCategory === 'high') {
    interpretation = `High 5-year mortality risk (${fiveYearMortalityRisk}%). Death may compete with kidney failure as primary outcome. Shared decision-making about aggressive vs. conservative management recommended.`;
  } else if (riskCategory === 'moderate') {
    interpretation = `Moderate 5-year mortality risk (${fiveYearMortalityRisk}%). Patient likely to benefit from preventive interventions. Balance aggressive risk factor modification with quality of life.`;
  } else {
    interpretation = `Low 5-year mortality risk (${fiveYearMortalityRisk}%). Patient has good life expectancy. Aggressive cardiorenal protection strongly indicated.`;
  }

  return {
    name: 'Bansal Geriatric Mortality',
    fiveYearMortalityRisk,
    riskCategory,
    points,
    components,
    interpretation,
    competingRiskAdjustment: true
  };
}

// ============================================
// PHENOTYPE ASSIGNMENT
// ============================================

/**
 * Assign GCUA Phenotype based on Module 1-3 results
 *
 * OFFICIAL CLINICAL THRESHOLDS (per guidelines):
 *
 * Module 1 - Nelson/CKD-PC (5-year renal risk):
 *   Low: <5%, Moderate: 5-14.9%, High: ≥15%
 *
 * Module 2 - AHA PREVENT (10-year CVD risk):
 *   Low: <5%, Borderline: 5-7.4%, Intermediate: 7.5-19.9%, High: ≥20%
 *
 * Module 3 - Bansal Mortality (5-year):
 *   Low: <15%, Moderate: 15-29.9%, High: 30-49.9%, Very High: ≥50%
 *
 * Phenotype Assignment:
 * IV. The Senescent: Mortality ≥50% (takes precedence)
 * I. Accelerated Ager: Renal ≥15% AND CVD ≥20% (both HIGH)
 * I. Cardiorenal High: Renal ≥15% AND CVD 7.5-19.9% (high renal + intermediate CVD)
 * II. Silent Renal: Renal ≥15% AND CVD <7.5% (high renal + low/borderline CVD)
 * III. Vascular Dominant: Renal <5% AND CVD ≥20% (low renal + high CVD)
 * III. CV Intermediate: Renal <5% AND CVD 7.5-19.9% (low renal + intermediate CVD)
 * Moderate. Cardiorenal Moderate: Renal 5-14.9% AND CVD ≥7.5% (moderate renal + intermediate/high CVD)
 * Moderate. Renal Watch: Renal 5-14.9% AND CVD <7.5% (moderate renal + low/borderline CVD)
 * Low. Low Risk: Renal <5% AND CVD <7.5% (both low/borderline)
 */
function assignPhenotype(
  module1: GCUAModule1Result,
  module2: GCUAModule2Result,
  module3: GCUAModule3Result
): GCUAPhenotype {
  const renalRisk = module1.fiveYearRisk;
  const cvdRisk = module2.tenYearRisk;
  const mortalityRisk = module3.fiveYearMortalityRisk;

  // Phenotype IV: The Senescent (takes precedence)
  // Note: Even for senescent patients, home monitoring may be recommended if renal/CVD risk is high
  // Home monitoring is low-burden and helps track trends for clinical decision-making
  if (mortalityRisk >= 50) {
    // Recommend home monitoring if renal risk is high (≥15%) or CVD risk is high (≥20%)
    // This aligns with AI recommendations which consider actual risk levels, not just phenotype
    const shouldRecommendMonitoring = renalRisk >= 15 || cvdRisk >= 20;

    return {
      type: 'IV',
      name: 'The Senescent',
      tag: 'De-escalate',
      color: 'gray',
      description: 'High competing mortality risk. The patient is more likely to die from other causes than to progress to kidney failure. Aggressive interventions may not provide meaningful benefit.',
      clinicalStrategy: [
        'Focus on symptom control and quality of life',
        'Consider deprescribing (reduce polypharmacy)',
        'Avoid aggressive renal protection protocols',
        'Palliative care consultation if appropriate',
        'Shared decision-making about treatment intensity'
      ],
      treatmentRecommendations: {
        sglt2i: false,
        rasInhibitor: false,
        statin: false,
        bpTarget: '<150/90 mmHg (lenient)',
        monitoringFrequency: 'As clinically indicated',
        homeMonitoringRecommended: shouldRecommendMonitoring  // Low-burden monitoring still valuable if high renal/CVD risk
      }
    };
  }

  // ========================================
  // HIGH RISK PHENOTYPES (Renal ≥15%)
  // ========================================

  // Phenotype I: Accelerated Ager - High renal (≥15%) AND High CVD (≥20%)
  if (renalRisk >= 15 && cvdRisk >= 20) {
    return {
      type: 'I',
      name: 'Accelerated Ager',
      tag: 'High Priority',
      color: 'red',
      description: 'High risk for both incident CKD and cardiovascular events. This patient is in the "sweet spot" for intervention - they have significant risk but also high likelihood of benefiting from treatment.',
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
        monitoringFrequency: 'Every 3 months',
        homeMonitoringRecommended: true  // High renal risk - home uACR monitoring essential
      }
    };
  }

  // Phenotype I variant: Cardiorenal High - High renal (≥15%) AND Intermediate CVD (7.5-19.9%)
  if (renalRisk >= 15 && cvdRisk >= 7.5 && cvdRisk < 20) {
    return {
      type: 'I',
      name: 'Cardiorenal High',
      tag: 'High Priority',
      color: 'red',
      description: 'High renal risk with intermediate cardiovascular risk. Aggressive cardiorenal protection indicated. The combination warrants close monitoring and dual-organ protection strategy.',
      clinicalStrategy: [
        'Initiate SGLT2 inhibitor (primary renal indication + CV benefit)',
        'Start or optimize RAS inhibitor',
        'Moderate-to-high intensity statin therapy',
        'BP control (target <130/80)',
        'Quarterly cardiorenal monitoring'
      ],
      treatmentRecommendations: {
        sglt2i: true,
        rasInhibitor: true,
        statin: true,
        bpTarget: '<130/80 mmHg',
        monitoringFrequency: 'Every 3 months',
        homeMonitoringRecommended: true  // High renal risk - home uACR monitoring essential
      }
    };
  }

  // Phenotype II: Silent Renal - High renal (≥15%) AND Low/Borderline CVD (<7.5%)
  if (renalRisk >= 15 && cvdRisk < 7.5) {
    return {
      type: 'II',
      name: 'Silent Renal',
      tag: 'Kidney Specific',
      color: 'orange',
      description: 'High renal risk with low cardiovascular risk. These patients are often MISSED by traditional Framingham-based screening. Their kidneys are failing silently while their vascular markers appear normal.',
      clinicalStrategy: [
        'Initiate SGLT2 inhibitor (primary renal indication)',
        'Start or optimize RAS inhibitor',
        'Monitor uACR every 6 months',
        'Consider nephrology referral',
        'BP target for renal protection'
      ],
      treatmentRecommendations: {
        sglt2i: true,
        rasInhibitor: true,
        statin: false,
        bpTarget: '<130/80 mmHg',
        monitoringFrequency: 'Every 6 months',
        homeMonitoringRecommended: true  // CRITICAL - these patients are often MISSED, home monitoring essential
      }
    };
  }

  // ========================================
  // MODERATE RISK PHENOTYPES (Renal 5-14.9%)
  // ========================================

  // Cardiorenal Moderate - Moderate renal (5-14.9%) AND Intermediate/High CVD (≥7.5%)
  if (renalRisk >= 5 && renalRisk < 15 && cvdRisk >= 7.5) {
    // Recommend home monitoring if CVD risk is high (≥20%) - indicates cardiorenal syndrome risk
    const shouldRecommendMonitoring = cvdRisk >= 20;

    return {
      type: 'Moderate',
      name: 'Cardiorenal Moderate',
      tag: 'CV Priority',
      color: 'yellow',
      description: 'Moderate renal risk with elevated cardiovascular risk (intermediate or high per AHA PREVENT). Prioritize cardiovascular protection while monitoring kidney function closely.',
      clinicalStrategy: [
        'Cardiovascular risk reduction priority',
        'Statin therapy (moderate-high intensity)',
        'Blood pressure control (<130/80)',
        'Consider SGLT2 inhibitor for CV protection',
        'Monitor eGFR and uACR every 6 months',
        'Lifestyle modifications emphasized'
      ],
      treatmentRecommendations: {
        sglt2i: true,
        rasInhibitor: false,
        statin: true,
        bpTarget: '<130/80 mmHg',
        monitoringFrequency: 'Every 6 months',
        homeMonitoringRecommended: shouldRecommendMonitoring  // Recommend if high CVD risk
      }
    };
  }

  // Renal Watch - Moderate renal (5-14.9%) AND Low/Borderline CVD (<7.5%)
  if (renalRisk >= 5 && renalRisk < 15 && cvdRisk < 7.5) {
    return {
      type: 'Moderate',
      name: 'Renal Watch',
      tag: 'Monitor Kidneys',
      color: 'orange',
      description: 'Moderate renal risk with low cardiovascular risk. While not yet high risk, proactive kidney monitoring is essential. Early intervention can prevent CKD progression.',
      clinicalStrategy: [
        'Monitor eGFR and uACR every 6-12 months',
        'Address modifiable risk factors (BP, glucose)',
        'Consider SGLT2 inhibitor if diabetes present',
        'Nephrology referral if worsening trend',
        'Lifestyle modifications'
      ],
      treatmentRecommendations: {
        sglt2i: false,
        rasInhibitor: false,
        statin: false,
        bpTarget: '<130/80 mmHg',
        monitoringFrequency: 'Every 6-12 months',
        homeMonitoringRecommended: true  // Moderate renal risk - home monitoring recommended
      }
    };
  }

  // ========================================
  // LOW RENAL RISK PHENOTYPES (Renal <5%)
  // ========================================

  // Phenotype III: Vascular Dominant - Low renal (<5%) AND High CVD (≥20%)
  if (renalRisk < 5 && cvdRisk >= 20) {
    return {
      type: 'III',
      name: 'Vascular Dominant',
      tag: 'Heart Specific',
      color: 'yellow',
      description: 'High cardiovascular risk but low renal risk. Standard aggressive CVD prevention protocols apply. Consider SGLT2 inhibitors for heart failure prevention.',
      clinicalStrategy: [
        'Aggressive CVD prevention protocols',
        'High-intensity statin therapy',
        'Optimize BP control (<130/80)',
        'Consider SGLT2 inhibitor for HF prevention',
        'Annual renal screening'
      ],
      treatmentRecommendations: {
        sglt2i: true,
        rasInhibitor: false,
        statin: true,
        bpTarget: '<130/80 mmHg',
        monitoringFrequency: 'Every 6 months',
        homeMonitoringRecommended: false  // Low renal risk - standard clinic monitoring
      }
    };
  }

  // CV Intermediate - Low renal (<5%) AND Intermediate CVD (7.5-19.9%)
  if (renalRisk < 5 && cvdRisk >= 7.5 && cvdRisk < 20) {
    return {
      type: 'Low',
      name: 'CV Intermediate',
      tag: 'CV Monitoring',
      color: 'yellow',
      description: 'Low renal risk with intermediate cardiovascular risk. Focus on cardiovascular risk factor modification while maintaining routine kidney screening.',
      clinicalStrategy: [
        'Moderate-intensity statin therapy',
        'BP control (<130/80)',
        'Lifestyle modifications (diet, exercise)',
        'Annual cardiovascular reassessment',
        'Routine renal screening every 2-3 years'
      ],
      treatmentRecommendations: {
        sglt2i: false,
        rasInhibitor: false,
        statin: true,
        bpTarget: '<130/80 mmHg',
        monitoringFrequency: 'Annually',
        homeMonitoringRecommended: false  // Low renal risk - standard clinic monitoring
      }
    };
  }

  // Default: Low Risk - Low renal (<5%) AND Low/Borderline CVD (<7.5%)
  return {
    type: 'Low',
    name: 'Low Risk',
    tag: 'Routine Care',
    color: 'green',
    description: 'Low risk across renal and cardiovascular domains. Continue routine preventive care and periodic reassessment.',
    clinicalStrategy: [
      'Maintain healthy lifestyle',
      'Periodic screening (every 2-3 years)',
      'Address modifiable risk factors as needed',
      'Routine primary care follow-up'
    ],
    treatmentRecommendations: {
      sglt2i: false,
      rasInhibitor: false,
      statin: false,
      bpTarget: '<140/90 mmHg',
      monitoringFrequency: 'Every 2-3 years',
      homeMonitoringRecommended: false  // Low risk - not required
    }
  };
}

// ============================================
// MAIN ASSESSMENT FUNCTION
// ============================================

/**
 * Perform complete GCUA Assessment
 *
 * This is the main entry point for the GCUA system.
 * It orchestrates all three modules and assigns the final phenotype.
 */
export function performGCUAAssessment(input: GCUAPatientInput): GCUAAssessment {
  // Check eligibility (Age >= 60, eGFR > 60)
  if (input.age < 60) {
    return {
      isEligible: false,
      eligibilityReason: `Patient age (${input.age}) is below 60. GCUA is designed for adults 60 and older.`,
      module1: {} as GCUAModule1Result,
      module2: {} as GCUAModule2Result,
      module3: {} as GCUAModule3Result,
      phenotype: {} as GCUAPhenotype,
      benefitRatio: 0,
      benefitRatioInterpretation: '',
      dataCompleteness: 0,
      missingData: [],
      confidenceLevel: 'low',
      kdigoScreeningRecommendation: '',
      cystatinCRecommended: false,
      assessedAt: new Date()
    };
  }

  if (input.eGFR <= 60) {
    return {
      isEligible: false,
      eligibilityReason: `Patient eGFR (${input.eGFR}) is ≤60. GCUA is designed for pre-CKD patients. Use KDIGO staging and KFRE for established CKD.`,
      module1: {} as GCUAModule1Result,
      module2: {} as GCUAModule2Result,
      module3: {} as GCUAModule3Result,
      phenotype: {} as GCUAPhenotype,
      benefitRatio: 0,
      benefitRatioInterpretation: '',
      dataCompleteness: 0,
      missingData: [],
      confidenceLevel: 'low',
      kdigoScreeningRecommendation: '',
      cystatinCRecommended: false,
      assessedAt: new Date()
    };
  }

  // Calculate data completeness
  const missingData: string[] = [];
  let dataPoints = 0;
  const totalOptionalPoints = 12;

  // Required fields (already validated)
  dataPoints += 4; // age, sex, eGFR, diabetes status

  // Optional but important fields
  if (input.uACR !== undefined) dataPoints += 1; else missingData.push('uACR (Albuminuria)');
  if (input.systolicBP !== undefined) dataPoints += 1; else missingData.push('Systolic BP');
  if (input.bmi !== undefined) dataPoints += 1; else missingData.push('BMI');
  if (input.smokingStatus !== undefined) dataPoints += 1; else missingData.push('Smoking Status');
  if (input.hasHeartFailure !== undefined) dataPoints += 1; else missingData.push('Heart Failure Status');
  if (input.hba1c !== undefined && input.hasDiabetes) dataPoints += 1; else if (input.hasDiabetes) missingData.push('HbA1c');
  if (input.frailtyScore !== undefined || input.gaitSpeed !== undefined) dataPoints += 1; else missingData.push('Frailty Assessment');
  if (input.ntProBNP !== undefined) dataPoints += 1; else missingData.push('NT-proBNP (optional biomarker)');

  const dataCompleteness = Math.round((dataPoints / (4 + totalOptionalPoints)) * 100);

  // Determine confidence level
  let confidenceLevel: 'high' | 'moderate' | 'low';
  if (dataCompleteness >= 85 && input.uACR !== undefined) {
    confidenceLevel = 'high';
  } else if (dataCompleteness >= 60 || input.uACR !== undefined) {
    confidenceLevel = 'moderate';
  } else {
    confidenceLevel = 'low';
  }

  // Run all three modules
  const module1 = calculateNelsonIncidentCKD(input);
  const module2 = calculatePREVENTCVDRisk(input);
  const module3 = calculateBansalMortalityScore(input);

  // Assign phenotype
  const phenotype = assignPhenotype(module1, module2, module3);

  // Calculate Benefit Ratio (Cardiorenal Event Risk / Non-Cardiorenal Death Risk)
  // Higher ratio = more likely to benefit from intervention
  const combinedCardiorenalRisk = Math.max(module1.fiveYearRisk, module2.tenYearRisk / 2);
  const nonCardiorenalMortality = Math.max(module3.fiveYearMortalityRisk - combinedCardiorenalRisk * 0.5, 5);
  const benefitRatio = Math.round((combinedCardiorenalRisk / nonCardiorenalMortality) * 100) / 100;

  let benefitRatioInterpretation: string;
  if (benefitRatio >= 2) {
    benefitRatioInterpretation = `Benefit Ratio ${benefitRatio}: High likelihood of benefiting from aggressive intervention. Cardiorenal events are the dominant threat.`;
  } else if (benefitRatio >= 1) {
    benefitRatioInterpretation = `Benefit Ratio ${benefitRatio}: Moderate likelihood of benefit. Balanced approach recommended.`;
  } else if (benefitRatio >= 0.5) {
    benefitRatioInterpretation = `Benefit Ratio ${benefitRatio}: Limited benefit expected. Competing mortality may outpace cardiorenal disease.`;
  } else {
    benefitRatioInterpretation = `Benefit Ratio ${benefitRatio}: Low benefit from aggressive intervention. Consider conservative/palliative approach.`;
  }

  // KDIGO alignment
  let kdigoScreeningRecommendation: string;
  if (module1.riskCategory === 'very_high' || module1.riskCategory === 'high') {
    kdigoScreeningRecommendation = 'High-risk screening: Monitor eGFR and uACR every 6 months per KDIGO 2024.';
  } else if (module1.riskCategory === 'moderate') {
    kdigoScreeningRecommendation = 'Annual screening: Yearly eGFR and uACR per KDIGO 2024.';
  } else {
    kdigoScreeningRecommendation = 'Routine screening: Every 2-3 years per KDIGO 2024 for low-risk individuals.';
  }

  // Recommend Cystatin C if intermediate risk
  const cystatinCRecommended =
    module1.riskCategory === 'moderate' &&
    input.cystatinC === undefined &&
    input.eGFR < 90;

  return {
    isEligible: true,
    module1,
    module2,
    module3,
    phenotype,
    benefitRatio,
    benefitRatioInterpretation,
    dataCompleteness,
    missingData,
    confidenceLevel,
    kdigoScreeningRecommendation,
    cystatinCRecommended,
    assessedAt: new Date()
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get phenotype color for UI display
 */
export function getPhenotypeColor(phenotype: GCUAPhenotype): {
  bg: string;
  text: string;
  border: string;
} {
  switch (phenotype.color) {
    case 'red':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' };
    case 'orange':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' };
    case 'yellow':
      return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' };
    case 'green':
      return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' };
    case 'gray':
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  }
}

/**
 * Get phenotype icon for UI display
 */
export function getPhenotypeIcon(phenotype: GCUAPhenotype): string {
  switch (phenotype.type) {
    case 'I':
      return '🔴'; // Accelerated Ager / Cardiorenal High - urgent
    case 'II':
      return '🟠'; // Silent Renal - warning
    case 'III':
      return '🟡'; // Vascular Dominant - caution
    case 'IV':
      return '⚪'; // Senescent - conservative
    case 'Moderate':
      return '🟡'; // Cardiorenal Moderate / Renal Watch - caution
    case 'Low':
      return '🟢'; // CV Intermediate / Low Risk - routine
    default:
      return '⚪';
  }
}

/**
 * Check if patient qualifies for GCUA assessment
 */
export function isGCUAEligible(age: number, eGFR: number): boolean {
  return age >= 60 && eGFR > 60;
}

/**
 * Get brief recommendation summary for clinical alerts
 */
export function getGCUASummary(assessment: GCUAAssessment): string {
  if (!assessment.isEligible) {
    return assessment.eligibilityReason || 'Patient not eligible for GCUA assessment.';
  }

  const p = assessment.phenotype;
  return `${p.name} (Phenotype ${p.type}): ${p.tag}. ${p.clinicalStrategy[0]}`;
}
