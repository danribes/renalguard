/**
 * KDIGO CKD Classification Utility
 * Calculates health state, risk level, and CKD stage based on eGFR and uACR
 *
 * IMPORTANT: KDIGO is a staging/prognosis system for patients who ALREADY have CKD.
 * For non-CKD patients, we use the SCORED model to assess risk of hidden/future disease.
 */

export interface KDIGOClassification {
  // GFR Category
  gfr_category: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';
  gfr_description: string;

  // Albuminuria Category
  albuminuria_category: 'A1' | 'A2' | 'A3';
  albuminuria_description: string;

  // Health State
  health_state: string; // e.g., "G3a-A2"

  // Risk Assessment
  risk_level: 'low' | 'moderate' | 'high' | 'very_high';
  risk_color: 'green' | 'yellow' | 'orange' | 'red';

  // CKD Status
  has_ckd: boolean;
  ckd_stage: number | null; // 1-5, null if no CKD
  ckd_stage_name: string;

  // Clinical Flags
  requires_nephrology_referral: boolean;
  requires_dialysis_planning: boolean;
  recommend_ras_inhibitor: boolean;
  recommend_sglt2i: boolean;

  // Monitoring
  target_bp: string;
  monitoring_frequency: string;

  // SCORED assessment (for non-CKD patients) - detects current hidden disease
  scored_points?: number;
  scored_risk_level?: 'low' | 'high';

  // Framingham assessment (for non-CKD patients) - predicts future 10-year risk
  framingham_risk_percentage?: number;
  framingham_risk_level?: 'low' | 'moderate' | 'high';
}

/**
 * Patient demographics for SCORED and Framingham models
 */
export interface PatientDemographics {
  age: number;
  gender: 'male' | 'female';
  has_hypertension?: boolean;
  has_diabetes?: boolean;
  has_cvd?: boolean; // Cardiovascular disease (MI, stroke, heart failure)
  has_pvd?: boolean; // Peripheral vascular disease
  // Additional fields for Framingham model
  smoking_status?: 'never' | 'former' | 'current';
  bmi?: number; // Body Mass Index
}

/**
 * Calculate SCORED (Screening for Occult REnal Disease) risk score
 * This is the validated tool for finding "occult" (hidden) kidney disease in non-CKD individuals
 *
 * Reference: Bang et al. - SCORED model
 *
 * Scoring:
 * - Age 50-59: +2, Age 60-69: +3, Age ≥70: +4
 * - Female: +1
 * - Hypertension: +1
 * - Diabetes: +1
 * - CVD: +1
 * - PVD: +1
 * - Proteinuria (uACR ≥30): +1
 *
 * Risk Levels:
 * - Low Risk (0-3): Low probability of undetected CKD, routine annual screening
 * - High Risk (≥4): ~20% chance of already having undetected CKD, immediate screening required
 */
export function calculateSCORED(demographics: PatientDemographics, uacr: number): {
  points: number;
  risk_level: 'low' | 'high';
  components: string[];
} {
  let points = 0;
  const components: string[] = [];

  // Age scoring
  if (demographics.age >= 70) {
    points += 4;
    components.push('Age ≥70 (+4)');
  } else if (demographics.age >= 60) {
    points += 3;
    components.push('Age 60-69 (+3)');
  } else if (demographics.age >= 50) {
    points += 2;
    components.push('Age 50-59 (+2)');
  }

  // Gender
  if (demographics.gender === 'female') {
    points += 1;
    components.push('Female (+1)');
  }

  // Comorbidities
  if (demographics.has_hypertension) {
    points += 1;
    components.push('Hypertension (+1)');
  }

  if (demographics.has_diabetes) {
    points += 1;
    components.push('Diabetes (+1)');
  }

  if (demographics.has_cvd) {
    points += 1;
    components.push('Cardiovascular Disease (+1)');
  }

  if (demographics.has_pvd) {
    points += 1;
    components.push('Peripheral Vascular Disease (+1)');
  }

  // Proteinuria (if uACR ≥30, indicates microalbuminuria)
  if (uacr >= 30) {
    points += 1;
    components.push('Proteinuria/High uACR (+1)');
  }

  // Risk level determination
  const risk_level = points >= 4 ? 'high' : 'low';

  return { points, risk_level, components };
}

/**
 * Calculate Framingham Kidney Disease Risk Score
 * Predicts 10-year risk of developing CKD (eGFR < 60) in patients who currently have normal kidney function
 *
 * Reference: O'Seaghdha et al., Framingham CKD Risk Prediction Model
 *
 * This is a PROGNOSTIC tool (predicts future disease) vs SCORED which is a SCREENING tool (detects current hidden disease)
 *
 * Risk Factors:
 * - Age (continuous - older = higher risk)
 * - Sex (male slightly higher risk)
 * - Diabetes (+significant risk)
 * - Hypertension (+significant risk)
 * - Cardiovascular Disease (+major risk multiplier)
 * - Current Smoking (+moderate risk)
 * - BMI (obesity increases risk)
 * - Albuminuria (if known, major predictor)
 *
 * Risk Levels:
 * - Low Risk (<10%): Standard preventive care
 * - Moderate Risk (10-20%): Enhanced monitoring, stricter BP/glucose targets
 * - High Risk (>20%): Aggressive intervention - high likelihood of developing CKD
 */
export function calculateFramingham(demographics: PatientDemographics, uacr?: number): {
  risk_percentage: number;
  risk_level: 'low' | 'moderate' | 'high';
  components: string[];
} {
  const components: string[] = [];
  let baselineRisk = 5; // Baseline 10-year risk percentage for healthy 50-year-old

  // Age contribution (exponential with age)
  // Age 40-49: ~5% baseline, 50-59: ~8%, 60-69: ~15%, 70+: ~25%
  if (demographics.age < 40) {
    baselineRisk = 3;
    components.push('Age <40: Low baseline risk');
  } else if (demographics.age < 50) {
    baselineRisk = 5;
    components.push('Age 40-49: Moderate baseline risk');
  } else if (demographics.age < 60) {
    baselineRisk = 8;
    components.push('Age 50-59: Elevated baseline risk');
  } else if (demographics.age < 70) {
    baselineRisk = 15;
    components.push('Age 60-69: High baseline risk');
  } else {
    baselineRisk = 25;
    components.push('Age ≥70: Very high baseline risk');
  }

  let riskMultiplier = 1.0;

  // Sex (males have slightly higher risk in some age groups)
  if (demographics.gender === 'male' && demographics.age >= 50) {
    riskMultiplier *= 1.15;
    components.push('Male (age ≥50): +15% risk');
  }

  // Diabetes (major risk factor - approximately doubles risk)
  if (demographics.has_diabetes) {
    riskMultiplier *= 1.8;
    components.push('Diabetes: +80% risk (major factor)');
  }

  // Hypertension (major risk factor - ~60% increase)
  if (demographics.has_hypertension) {
    riskMultiplier *= 1.6;
    components.push('Hypertension: +60% risk (major factor)');
  }

  // Cardiovascular Disease (STRONGEST predictor - cardiorenal syndrome)
  // CVD history approximately triples the risk
  if (demographics.has_cvd) {
    riskMultiplier *= 2.8;
    components.push('Cardiovascular Disease: +180% risk (strongest predictor)');
  }

  // Current Smoking (~40% increase)
  if (demographics.smoking_status === 'current') {
    riskMultiplier *= 1.4;
    components.push('Current Smoking: +40% risk');
  } else if (demographics.smoking_status === 'former') {
    riskMultiplier *= 1.15;
    components.push('Former Smoking: +15% risk');
  }

  // BMI/Obesity (BMI >30 increases risk ~30-50%)
  // Ensure BMI is a number (may come as string from database)
  const bmiValue = demographics.bmi ? Number(demographics.bmi) : undefined;
  if (bmiValue && !isNaN(bmiValue) && bmiValue >= 35) {
    riskMultiplier *= 1.5;
    components.push(`BMI ${bmiValue.toFixed(1)} (Class II/III Obesity): +50% risk`);
  } else if (bmiValue && !isNaN(bmiValue) && bmiValue >= 30) {
    riskMultiplier *= 1.3;
    components.push(`BMI ${bmiValue.toFixed(1)} (Obesity): +30% risk`);
  } else if (bmiValue && !isNaN(bmiValue) && bmiValue >= 25) {
    riskMultiplier *= 1.1;
    components.push(`BMI ${bmiValue.toFixed(1)} (Overweight): +10% risk`);
  }

  // Albuminuria (if available - VERY strong predictor, can triple risk)
  if (uacr !== undefined && uacr >= 30) {
    if (uacr >= 300) {
      riskMultiplier *= 3.5;
      components.push('Macroalbuminuria (uACR >300): +250% risk (critical)');
    } else {
      riskMultiplier *= 2.2;
      components.push('Microalbuminuria (uACR 30-300): +120% risk (major warning sign)');
    }
  }

  // Calculate final 10-year risk percentage
  let risk_percentage = baselineRisk * riskMultiplier;

  // Cap at realistic maximum (very few patients exceed 80% 10-year risk)
  risk_percentage = Math.min(risk_percentage, 80);

  // Round to 1 decimal place
  risk_percentage = Math.round(risk_percentage * 10) / 10;

  // Determine risk level based on validated thresholds
  let risk_level: 'low' | 'moderate' | 'high';
  if (risk_percentage < 10) {
    risk_level = 'low';
  } else if (risk_percentage <= 20) {
    risk_level = 'moderate';
  } else {
    risk_level = 'high';
  }

  return { risk_percentage, risk_level, components };
}

/**
 * Determine non-CKD risk level based on SCORED score and lab values
 *
 * Border values for non-CKD patients:
 * - eGFR: >90 (normal/low risk), 60-89 (borderline/medium), <60 (high risk - this becomes CKD diagnosis)
 * - uACR: <30 (normal/low risk), 30-300 (microalbuminuria/medium risk), >300 (macroalbuminuria/high risk)
 */
export function getNonCKDRiskLevel(
  egfr: number,
  uacr: number,
  scoredPoints: number
): {
  risk_level: 'low' | 'moderate' | 'high';
  risk_color: 'green' | 'yellow' | 'orange';
  reasoning: string[];
} {
  const reasoning: string[] = [];

  // Start with SCORED assessment
  let baseRisk: 'low' | 'moderate' | 'high' = scoredPoints >= 4 ? 'high' : 'low';

  if (scoredPoints >= 4) {
    reasoning.push(`SCORED score ${scoredPoints} indicates ≥20% chance of undetected CKD`);
  } else {
    reasoning.push(`SCORED score ${scoredPoints} indicates low probability of hidden disease`);
  }

  // Evaluate eGFR (borderline values are concerning even without CKD diagnosis)
  if (egfr >= 90) {
    reasoning.push('eGFR >90: Normal kidney filtration');
  } else if (egfr >= 60) {
    reasoning.push('eGFR 60-89: Borderline - mild decline, monitor closely');
    // Borderline eGFR elevates risk
    if (baseRisk === 'low') {
      baseRisk = 'moderate';
    }
  }

  // Evaluate uACR (this is critical - microalbuminuria is the first sign of kidney damage)
  if (uacr < 30) {
    reasoning.push('uACR <30: No proteinuria');
  } else if (uacr <= 300) {
    reasoning.push('uACR 30-300: Microalbuminuria - early kidney damage detected');
    // Microalbuminuria significantly elevates risk
    if (baseRisk === 'low') {
      baseRisk = 'moderate';
    } else if (baseRisk === 'moderate') {
      baseRisk = 'high';
    }
  } else {
    reasoning.push('uACR >300: Macroalbuminuria - severe kidney damage');
    baseRisk = 'high';
  }

  // Combine factors for final risk
  let finalRisk: 'low' | 'moderate' | 'high' = baseRisk;

  // Special case: High SCORED + microalbuminuria = definitely high risk
  if (scoredPoints >= 4 && uacr >= 30) {
    finalRisk = 'high';
    reasoning.push('HIGH RISK: Multiple risk factors + kidney damage markers present');
  }

  const risk_color = finalRisk === 'high' ? 'orange' : finalRisk === 'moderate' ? 'yellow' : 'green';

  return { risk_level: finalRisk, risk_color, reasoning };
}

/**
 * Determine GFR category from eGFR value
 */
export function getGFRCategory(egfr: number): { category: string; description: string } {
  if (egfr >= 90) {
    return { category: 'G1', description: 'Normal or High' };
  } else if (egfr >= 60) {
    return { category: 'G2', description: 'Mildly Decreased' };
  } else if (egfr >= 45) {
    return { category: 'G3a', description: 'Mild to Moderate Decrease' };
  } else if (egfr >= 30) {
    return { category: 'G3b', description: 'Moderate to Severe Decrease' };
  } else if (egfr >= 15) {
    return { category: 'G4', description: 'Severely Decreased' };
  } else {
    return { category: 'G5', description: 'Kidney Failure' };
  }
}

/**
 * Determine Albuminuria category from uACR value
 */
export function getAlbuminuriaCategory(uacr: number): { category: string; description: string } {
  if (uacr < 30) {
    return { category: 'A1', description: 'Normal to Mildly Increased' };
  } else if (uacr <= 300) {
    return { category: 'A2', description: 'Moderately Increased' };
  } else {
    return { category: 'A3', description: 'Severely Increased' };
  }
}

/**
 * Determine CKD stage
 */
export function getCKDStage(egfr: number, uacr: number): { stage: number | null; name: string; has_ckd: boolean } {
  // Stage 5: Kidney Failure
  if (egfr < 15) {
    return { stage: 5, name: 'Stage 5 (Kidney Failure)', has_ckd: true };
  }

  // Stage 4: Severely Decreased
  if (egfr < 30) {
    return { stage: 4, name: 'Stage 4 (Severe)', has_ckd: true };
  }

  // Stage 3b: Moderate to Severe
  if (egfr < 45) {
    return { stage: 3, name: 'Stage 3b (Moderate to Severe)', has_ckd: true };
  }

  // Stage 3a: Mild to Moderate (always CKD)
  if (egfr < 60) {
    return { stage: 3, name: 'Stage 3a (Mild to Moderate)', has_ckd: true };
  }

  // Stage 2: Mild decrease with kidney damage (requires proteinuria)
  if (egfr >= 60 && egfr < 90 && uacr >= 30) {
    return { stage: 2, name: 'Stage 2 (Mild Decrease with Damage)', has_ckd: true };
  }

  // Stage 1: Normal/High with kidney damage (requires proteinuria)
  if (egfr >= 90 && uacr >= 30) {
    return { stage: 1, name: 'Stage 1 (Normal Function with Damage)', has_ckd: true };
  }

  // No CKD
  return { stage: null, name: 'No CKD', has_ckd: false };
}

/**
 * Calculate KDIGO risk level based on GFR and Albuminuria categories
 * Following KDIGO 2024 risk stratification matrix
 */
export function getKDIGORiskLevel(gfrCat: string, albCat: string): {
  risk_level: 'low' | 'moderate' | 'high' | 'very_high';
  risk_color: 'green' | 'yellow' | 'orange' | 'red';
} {
  // Very High Risk (Red)
  if (gfrCat === 'G5' || gfrCat === 'G4') {
    return { risk_level: 'very_high', risk_color: 'red' };
  }

  if (gfrCat === 'G3b' && (albCat === 'A2' || albCat === 'A3')) {
    return { risk_level: 'very_high', risk_color: 'red' };
  }

  if (gfrCat === 'G3a' && albCat === 'A3') {
    return { risk_level: 'very_high', risk_color: 'red' };
  }

  // High Risk (Orange)
  if (gfrCat === 'G3b' && albCat === 'A1') {
    return { risk_level: 'high', risk_color: 'orange' };
  }

  if (gfrCat === 'G3a' && albCat === 'A2') {
    return { risk_level: 'high', risk_color: 'orange' };
  }

  if ((gfrCat === 'G1' || gfrCat === 'G2') && albCat === 'A3') {
    return { risk_level: 'high', risk_color: 'orange' };
  }

  // Moderate Risk (Yellow)
  if (gfrCat === 'G3a' && albCat === 'A1') {
    return { risk_level: 'moderate', risk_color: 'yellow' };
  }

  if ((gfrCat === 'G1' || gfrCat === 'G2') && albCat === 'A2') {
    return { risk_level: 'moderate', risk_color: 'yellow' };
  }

  // Low Risk (Green)
  return { risk_level: 'low', risk_color: 'green' };
}

/**
 * Complete KDIGO classification
 */
export function classifyKDIGO(egfr: number, uacr: number): KDIGOClassification {
  const gfrInfo = getGFRCategory(egfr);
  const albInfo = getAlbuminuriaCategory(uacr);
  const ckdInfo = getCKDStage(egfr, uacr);
  const riskInfo = getKDIGORiskLevel(gfrInfo.category, albInfo.category);

  const health_state = `${gfrInfo.category}-${albInfo.category}`;

  // Clinical recommendations
  const requires_nephrology = gfrInfo.category === 'G4' || gfrInfo.category === 'G5' ||
                              (gfrInfo.category === 'G3b') ||
                              (albInfo.category === 'A3');

  const requires_dialysis = gfrInfo.category === 'G5' ||
                           (gfrInfo.category === 'G4' && egfr < 20);

  const recommend_ras = albInfo.category === 'A2' || albInfo.category === 'A3';
  const recommend_sglt2i = ckdInfo.stage !== null && ckdInfo.stage >= 2 && ckdInfo.stage <= 4;

  // BP target based on proteinuria
  const target_bp = albInfo.category === 'A1' ? '<140/90 mmHg' : '<130/80 mmHg';

  // Monitoring frequency based on risk
  let monitoring_frequency: string;
  switch (riskInfo.risk_level) {
    case 'very_high':
      monitoring_frequency = 'Every 1-3 months';
      break;
    case 'high':
      monitoring_frequency = 'Every 3-6 months';
      break;
    case 'moderate':
      monitoring_frequency = 'Every 6-12 months';
      break;
    default:
      monitoring_frequency = 'Annually';
  }

  return {
    gfr_category: gfrInfo.category as any,
    gfr_description: gfrInfo.description,
    albuminuria_category: albInfo.category as any,
    albuminuria_description: albInfo.description,
    health_state,
    risk_level: riskInfo.risk_level,
    risk_color: riskInfo.risk_color,
    has_ckd: ckdInfo.has_ckd,
    ckd_stage: ckdInfo.stage,
    ckd_stage_name: ckdInfo.name,
    requires_nephrology_referral: requires_nephrology,
    requires_dialysis_planning: requires_dialysis,
    recommend_ras_inhibitor: recommend_ras,
    recommend_sglt2i: recommend_sglt2i,
    target_bp,
    monitoring_frequency
  };
}

/**
 * Get CKD severity classification based on stage
 */
export function getCKDSeverity(ckdStage: number | null): 'mild' | 'moderate' | 'severe' | 'kidney_failure' | null {
  if (ckdStage === null) return null;

  switch (ckdStage) {
    case 1:
    case 2:
      return 'mild';
    case 3:
      return 'moderate';
    case 4:
      return 'severe';
    case 5:
      return 'kidney_failure';
    default:
      return null;
  }
}

/**
 * Get human-readable severity label
 */
export function getCKDSeverityLabel(severity: 'mild' | 'moderate' | 'severe' | 'kidney_failure' | null): string {
  switch (severity) {
    case 'mild':
      return 'Mild CKD';
    case 'moderate':
      return 'Moderate CKD';
    case 'severe':
      return 'Severe CKD';
    case 'kidney_failure':
      return 'Kidney Failure';
    default:
      return 'No CKD';
  }
}

/**
 * Get monitoring frequency category for database storage
 */
export function getMonitoringFrequencyCategory(kdigo: KDIGOClassification): string {
  switch (kdigo.risk_level) {
    case 'very_high':
      return 'monthly'; // Every 1-3 months
    case 'high':
      return 'quarterly'; // Every 3-6 months
    case 'moderate':
      return 'biannually'; // Every 6-12 months
    default:
      return 'annually'; // Annually
  }
}

/**
 * Complete KDIGO classification WITH SCORED assessment for non-CKD patients
 * This is the clinically appropriate function that combines:
 * - KDIGO staging for CKD patients
 * - SCORED model risk assessment for non-CKD patients
 */
export function classifyKDIGOWithSCORED(
  egfr: number,
  uacr: number,
  demographics?: PatientDemographics
): KDIGOClassification {
  const gfrInfo = getGFRCategory(egfr);
  const albInfo = getAlbuminuriaCategory(uacr);
  const ckdInfo = getCKDStage(egfr, uacr);
  const health_state = `${gfrInfo.category}-${albInfo.category}`;

  let riskInfo: any;
  let scored_points: number | undefined;
  let scored_risk_level: 'low' | 'high' | undefined;
  let framingham_risk_percentage: number | undefined;
  let framingham_risk_level: 'low' | 'moderate' | 'high' | undefined;

  if (!ckdInfo.has_ckd && demographics) {
    // Non-CKD patient WITH demographics - calculate BOTH SCORED and Framingham

    // SCORED: Detects current hidden disease
    const scoredResult = calculateSCORED(demographics, uacr);
    scored_points = scoredResult.points;
    scored_risk_level = scoredResult.risk_level;

    // Framingham: Predicts future 10-year risk
    const framinghamResult = calculateFramingham(demographics, uacr);
    framingham_risk_percentage = framinghamResult.risk_percentage;
    framingham_risk_level = framinghamResult.risk_level;

    // Use SCORED for primary risk classification (default model for detection)
    const nonCKDRisk = getNonCKDRiskLevel(egfr, uacr, scoredResult.points);
    riskInfo = {
      risk_level: nonCKDRisk.risk_level,
      risk_color: nonCKDRisk.risk_color
    };

    console.log(`[Risk Assessment] Patient (Age ${demographics.age}, ${demographics.gender})`);
    console.log(`  SCORED Points: ${scored_points} (${scored_risk_level} risk)`);
    console.log(`  SCORED Components: ${scoredResult.components.join(', ')}`);
    console.log(`  Framingham 10-Year Risk: ${framingham_risk_percentage}% (${framingham_risk_level} risk)`);
    console.log(`  Framingham Components: ${framinghamResult.components.join('; ')}`);
    console.log(`  Final Risk: ${riskInfo.risk_level} (${riskInfo.risk_color})`);
    console.log(`  Reasoning: ${nonCKDRisk.reasoning.join('; ')}`);
  } else {
    // CKD patient OR no demographics available - use KDIGO risk matrix
    riskInfo = getKDIGORiskLevel(gfrInfo.category, albInfo.category);
  }

  // Clinical recommendations
  const requires_nephrology = gfrInfo.category === 'G4' || gfrInfo.category === 'G5' ||
                              (gfrInfo.category === 'G3b') ||
                              (albInfo.category === 'A3');

  const requires_dialysis = gfrInfo.category === 'G5' ||
                           (gfrInfo.category === 'G4' && egfr < 20);

  const recommend_ras = albInfo.category === 'A2' || albInfo.category === 'A3';
  const recommend_sglt2i = ckdInfo.stage !== null && ckdInfo.stage >= 2 && ckdInfo.stage <= 4;

  // BP target based on proteinuria
  const target_bp = albInfo.category === 'A1' ? '<140/90 mmHg' : '<130/80 mmHg';

  // Monitoring frequency based on risk
  let monitoring_frequency: string;
  switch (riskInfo.risk_level) {
    case 'very_high':
      monitoring_frequency = 'Every 1-3 months';
      break;
    case 'high':
      monitoring_frequency = 'Every 3-6 months';
      break;
    case 'moderate':
      monitoring_frequency = 'Every 6-12 months';
      break;
    default:
      monitoring_frequency = 'Annually';
  }

  return {
    gfr_category: gfrInfo.category as any,
    gfr_description: gfrInfo.description,
    albuminuria_category: albInfo.category as any,
    albuminuria_description: albInfo.description,
    health_state,
    risk_level: riskInfo.risk_level,
    risk_color: riskInfo.risk_color,
    has_ckd: ckdInfo.has_ckd,
    ckd_stage: ckdInfo.stage,
    ckd_stage_name: ckdInfo.name,
    requires_nephrology_referral: requires_nephrology,
    requires_dialysis_planning: requires_dialysis,
    recommend_ras_inhibitor: recommend_ras,
    recommend_sglt2i: recommend_sglt2i,
    target_bp,
    monitoring_frequency,
    scored_points,
    scored_risk_level,
    framingham_risk_percentage,
    framingham_risk_level
  };
}

/**
 * Get risk category label for patient list grouping (NEW NOMENCLATURE)
 */
export function getRiskCategoryLabel(classification: KDIGOClassification): string {
  if (!classification.has_ckd) {
    // Non-CKD patients
    switch (classification.risk_level) {
      case 'low':
        return 'Low Risk';
      case 'moderate':
        return 'Moderate Risk';
      case 'high':
      case 'very_high':
        return 'High Risk';
      default:
        return 'Low Risk';
    }
  } else {
    // CKD patients - Use severity-based labels
    const severity = getCKDSeverity(classification.ckd_stage);
    return getCKDSeverityLabel(severity);
  }
}
