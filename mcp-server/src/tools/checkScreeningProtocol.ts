import { pool } from '../database.js';

export interface CheckScreeningProtocolInput {
  patient_id: string;
}

export interface ScreeningGap {
  test: string;
  last_performed?: string; // Date or "Never"
  days_overdue: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  guideline: string;
  reason: string;
}

export interface CheckScreeningProtocolOutput {
  patient_summary: {
    age: number;
    has_diabetes: boolean;
    has_hypertension: boolean;
    has_ckd: boolean;
    ckd_stage?: string;
  };
  protocol_adherence_status: 'Compliant' | 'Minor Gaps' | 'Major Gaps' | 'Critical Gaps';
  screening_gaps: ScreeningGap[];
  recommendations: string[];
  next_due_tests: Array<{ test: string; due_date: string }>;
}

/**
 * Check Screening Protocol Adherence
 *
 * Evaluates whether a patient is receiving appropriate CKD screening tests
 * based on their risk factors and current diagnosis.
 *
 * KDIGO 2024 Guidelines:
 * - HIGH RISK (DM/HTN): Annual eGFR + uACR screening
 * - DIAGNOSED CKD: eGFR + uACR frequency based on stage/risk
 * - CKD + Diabetes: HbA1c every 3-6 months
 * - CKD Stage 3+: Annual lipid panel, CBC, PTH, vitamin D
 */
export async function checkScreeningProtocol(
  input: CheckScreeningProtocolInput
): Promise<CheckScreeningProtocolOutput> {
  const { patient_id } = input;

  // Get patient data
  const patientQuery = `
    SELECT
      EXTRACT(YEAR FROM AGE(date_of_birth))::integer as age,
      has_diabetes,
      has_hypertension,
      has_heart_failure,
      on_sglt2i,
      on_ras_inhibitor
    FROM patients
    WHERE id = $1
  `;

  const patientResult = await pool.query(patientQuery, [patient_id]);
  if (patientResult.rows.length === 0) {
    throw new Error(`Patient not found: ${patient_id}`);
  }

  const patient = patientResult.rows[0];

  // Get all observation dates
  const observationsQuery = `
    SELECT
      observation_type,
      MAX(observed_date) as last_date,
      EXTRACT(DAY FROM NOW() - MAX(observed_date))::integer as days_since
    FROM observations
    WHERE patient_id = $1
    GROUP BY observation_type
  `;

  const observationsResult = await pool.query(observationsQuery, [patient_id]);
  const lastTests: Record<string, { date: Date; daysSince: number }> = {};

  for (const obs of observationsResult.rows) {
    lastTests[obs.observation_type] = {
      date: obs.last_date,
      daysSince: obs.days_since || 0,
    };
  }

  // Determine CKD status
  let hasCKD = false;
  let ckdStage: string | undefined;
  let egfrValue: number | null = null;
  let uacrValue: number | null = null;

  if (lastTests['eGFR']) {
    const egfrQuery = `
      SELECT value FROM observations
      WHERE patient_id = $1 AND observation_type = 'eGFR'
      ORDER BY observed_date DESC LIMIT 1
    `;
    const egfrResult = await pool.query(egfrQuery, [patient_id]);
    if (egfrResult.rows.length > 0) {
      egfrValue = parseFloat(egfrResult.rows[0].value);
      if (egfrValue < 60) {
        hasCKD = true;
      }
    }
  }

  if (lastTests['uACR']) {
    const uacrQuery = `
      SELECT value FROM observations
      WHERE patient_id = $1 AND observation_type = 'uACR'
      ORDER BY observed_date DESC LIMIT 1
    `;
    const uacrResult = await pool.query(uacrQuery, [patient_id]);
    if (uacrResult.rows.length > 0) {
      uacrValue = parseFloat(uacrResult.rows[0].value);
      if (uacrValue >= 30) {
        hasCKD = true;
      }
    }
  }

  // Determine CKD stage if CKD present
  if (hasCKD && egfrValue !== null) {
    if (egfrValue >= 60) ckdStage = 'G1-G2 with albuminuria';
    else if (egfrValue >= 45) ckdStage = 'G3a';
    else if (egfrValue >= 30) ckdStage = 'G3b';
    else if (egfrValue >= 15) ckdStage = 'G4';
    else ckdStage = 'G5';
  }

  // Check for screening gaps
  const screeningGaps: ScreeningGap[] = [];

  // 1. eGFR Screening
  checkEGFRScreening(patient, lastTests, hasCKD, ckdStage, screeningGaps);

  // 2. uACR Screening
  checkUACRScreening(patient, lastTests, hasCKD, ckdStage, screeningGaps);

  // 3. HbA1c Screening (if diabetic)
  if (patient.has_diabetes) {
    checkHbA1cScreening(lastTests, hasCKD, screeningGaps);
  }

  // 4. CKD Complication Screening (if CKD Stage 3+)
  if (hasCKD && ckdStage && !ckdStage.includes('G1-G2')) {
    checkCKDComplicationScreening(lastTests, screeningGaps);
  }

  // Determine overall adherence status
  const adherenceStatus = determineAdherenceStatus(screeningGaps);

  // Generate recommendations
  const recommendations = generateScreeningRecommendations(screeningGaps, patient, hasCKD);

  // Calculate next due tests
  const nextDueTests = calculateNextDueTests(lastTests, patient, hasCKD, ckdStage);

  return {
    patient_summary: {
      age: patient.age,
      has_diabetes: patient.has_diabetes,
      has_hypertension: patient.has_hypertension,
      has_ckd: hasCKD,
      ckd_stage: ckdStage,
    },
    protocol_adherence_status: adherenceStatus,
    screening_gaps: screeningGaps,
    recommendations,
    next_due_tests: nextDueTests,
  };
}

function checkEGFRScreening(
  patient: any,
  lastTests: Record<string, { date: Date; daysSince: number }>,
  hasCKD: boolean,
  ckdStage: string | undefined,
  gaps: ScreeningGap[]
): void {
  const egfrTest = lastTests['eGFR'];
  let requiredFrequencyDays: number;
  let guideline: string;
  let reason: string;

  if (hasCKD) {
    // CKD patients need more frequent monitoring
    if (ckdStage === 'G5' || ckdStage === 'G4') {
      requiredFrequencyDays = 90; // Every 3 months
      guideline = 'KDIGO 2024: CKD Stage 4-5 requires eGFR every 1-3 months';
      reason = `Advanced CKD (Stage ${ckdStage})`;
    } else if (ckdStage === 'G3b') {
      requiredFrequencyDays = 180; // Every 6 months
      guideline = 'KDIGO 2024: CKD Stage 3b requires eGFR every 3-6 months';
      reason = `Moderate CKD (Stage ${ckdStage})`;
    } else {
      requiredFrequencyDays = 365; // Annually
      guideline = 'KDIGO 2024: CKD Stage 1-3a requires annual eGFR';
      reason = 'Mild CKD';
    }
  } else if (patient.has_diabetes || patient.has_hypertension) {
    // High-risk patients need annual screening
    requiredFrequencyDays = 365;
    guideline = 'KDIGO 2024: Annual eGFR for high-risk patients (DM/HTN)';
    reason = 'High-risk condition (Diabetes or Hypertension)';
  } else {
    return; // No screening needed for low-risk patients
  }

  if (!egfrTest) {
    gaps.push({
      test: 'eGFR (Kidney Function)',
      last_performed: 'Never',
      days_overdue: 999, // Arbitrary large number for "never tested"
      urgency: hasCKD ? 'CRITICAL' : 'HIGH',
      guideline,
      reason: `${reason} - No baseline eGFR on record`,
    });
  } else if (egfrTest.daysSince > requiredFrequencyDays) {
    const daysOverdue = egfrTest.daysSince - requiredFrequencyDays;
    gaps.push({
      test: 'eGFR (Kidney Function)',
      last_performed: egfrTest.date.toISOString().split('T')[0],
      days_overdue: daysOverdue,
      urgency: daysOverdue > 180 ? 'CRITICAL' : daysOverdue > 90 ? 'HIGH' : 'MODERATE',
      guideline,
      reason: `${reason} - Last test ${egfrTest.daysSince} days ago`,
    });
  }
}

function checkUACRScreening(
  patient: any,
  lastTests: Record<string, { date: Date; daysSince: number }>,
  hasCKD: boolean,
  ckdStage: string | undefined,
  gaps: ScreeningGap[]
): void {
  const uacrTest = lastTests['uACR'];
  let requiredFrequencyDays: number;
  let guideline: string;
  let reason: string;

  if (hasCKD) {
    requiredFrequencyDays = 365; // Annual for CKD patients
    guideline = 'KDIGO 2024: Annual uACR for CKD patients';
    reason = 'CKD diagnosis - monitor proteinuria progression';
  } else if (patient.has_diabetes || patient.has_hypertension) {
    requiredFrequencyDays = 365;
    guideline = 'ADA/KDIGO: Annual uACR screening for diabetes/hypertension';
    reason = 'High-risk condition requiring albuminuria screening';
  } else {
    return;
  }

  if (!uacrTest) {
    gaps.push({
      test: 'uACR (Urine Albumin)',
      last_performed: 'Never',
      days_overdue: 999,
      urgency: patient.has_diabetes ? 'CRITICAL' : 'HIGH',
      guideline,
      reason: `${reason} - CRITICAL GAP: uACR never measured`,
    });
  } else if (uacrTest.daysSince > requiredFrequencyDays) {
    const daysOverdue = uacrTest.daysSince - requiredFrequencyDays;
    gaps.push({
      test: 'uACR (Urine Albumin)',
      last_performed: uacrTest.date.toISOString().split('T')[0],
      days_overdue: daysOverdue,
      urgency: daysOverdue > 180 ? 'HIGH' : 'MODERATE',
      guideline,
      reason: `${reason} - Last test ${uacrTest.daysSince} days ago`,
    });
  }
}

function checkHbA1cScreening(
  lastTests: Record<string, { date: Date; daysSince: number }>,
  hasCKD: boolean,
  gaps: ScreeningGap[]
): void {
  const hba1cTest = lastTests['HbA1c'];
  const requiredFrequencyDays = hasCKD ? 90 : 180; // 3 months if CKD, 6 months otherwise
  const guideline = hasCKD
    ? 'ADA: HbA1c every 3 months for diabetics with CKD'
    : 'ADA: HbA1c every 3-6 months for diabetics';

  if (!hba1cTest) {
    gaps.push({
      test: 'HbA1c (Glucose Control)',
      last_performed: 'Never',
      days_overdue: 999,
      urgency: 'HIGH',
      guideline,
      reason: 'Diabetic patient missing glycemic control monitoring',
    });
  } else if (hba1cTest.daysSince > requiredFrequencyDays) {
    const daysOverdue = hba1cTest.daysSince - requiredFrequencyDays;
    gaps.push({
      test: 'HbA1c (Glucose Control)',
      last_performed: hba1cTest.date.toISOString().split('T')[0],
      days_overdue: daysOverdue,
      urgency: daysOverdue > 180 ? 'HIGH' : 'MODERATE',
      guideline,
      reason: `Glycemic control monitoring overdue by ${daysOverdue} days`,
    });
  }
}

function checkCKDComplicationScreening(
  lastTests: Record<string, { date: Date; daysSince: number }>,
  gaps: ScreeningGap[]
): void {
  const requiredFrequencyDays = 365; // Annual screening

  // CBC for anemia
  if (!lastTests['CBC'] || lastTests['CBC'].daysSince > requiredFrequencyDays) {
    gaps.push({
      test: 'CBC (Complete Blood Count)',
      last_performed: lastTests['CBC']?.date.toISOString().split('T')[0] || 'Never',
      days_overdue: lastTests['CBC'] ? lastTests['CBC'].daysSince - requiredFrequencyDays : 999,
      urgency: 'MODERATE',
      guideline: 'KDIGO: Annual CBC for CKD Stage 3+ (anemia screening)',
      reason: 'CKD patients at risk for anemia',
    });
  }

  // PTH for bone mineral disorder
  if (!lastTests['PTH'] || lastTests['PTH'].daysSince > requiredFrequencyDays) {
    gaps.push({
      test: 'PTH (Parathyroid Hormone)',
      last_performed: lastTests['PTH']?.date.toISOString().split('T')[0] || 'Never',
      days_overdue: lastTests['PTH'] ? lastTests['PTH'].daysSince - requiredFrequencyDays : 999,
      urgency: 'LOW',
      guideline: 'KDIGO: PTH monitoring for CKD-MBD',
      reason: 'Screen for secondary hyperparathyroidism',
    });
  }
}

function determineAdherenceStatus(gaps: ScreeningGap[]): 'Compliant' | 'Minor Gaps' | 'Major Gaps' | 'Critical Gaps' {
  if (gaps.length === 0) return 'Compliant';

  const hasCritical = gaps.some(gap => gap.urgency === 'CRITICAL');
  const hasMultipleHigh = gaps.filter(gap => gap.urgency === 'HIGH').length >= 2;

  if (hasCritical || hasMultipleHigh) return 'Critical Gaps';
  if (gaps.some(gap => gap.urgency === 'HIGH')) return 'Major Gaps';
  return 'Minor Gaps';
}

function generateScreeningRecommendations(
  gaps: ScreeningGap[],
  patient: any,
  hasCKD: boolean
): string[] {
  const recommendations: string[] = [];

  if (gaps.length === 0) {
    recommendations.push('✅ Patient is compliant with all screening protocols');
    recommendations.push('Continue current monitoring schedule');
    return recommendations;
  }

  // Prioritize critical gaps
  const criticalGaps = gaps.filter(g => g.urgency === 'CRITICAL');
  const highGaps = gaps.filter(g => g.urgency === 'HIGH');

  if (criticalGaps.length > 0) {
    recommendations.push('🔴 URGENT: Order the following tests immediately (this week):');
    criticalGaps.forEach(gap => {
      recommendations.push(`   • ${gap.test} - ${gap.reason}`);
    });
  }

  if (highGaps.length > 0) {
    recommendations.push('🟠 HIGH PRIORITY: Order the following tests within 2-4 weeks:');
    highGaps.forEach(gap => {
      recommendations.push(`   • ${gap.test} - ${gap.reason}`);
    });
  }

  // General recommendations
  if (patient.has_diabetes && !hasCKD) {
    recommendations.push('Set up annual CKD screening reminder for diabetic patient');
  }

  if (hasCKD) {
    recommendations.push('Ensure patient is enrolled in CKD monitoring program');
    recommendations.push('Consider Minuteful Kidney home monitoring (FDA-cleared smartphone uACR test) for convenient at-home tracking');
  }

  return recommendations;
}

function calculateNextDueTests(
  lastTests: Record<string, { date: Date; daysSince: number }>,
  patient: any,
  hasCKD: boolean,
  ckdStage: string | undefined
): Array<{ test: string; due_date: string }> {
  const nextDue: Array<{ test: string; due_date: string }> = [];

  // Calculate due dates based on last test + required frequency
  if (lastTests['eGFR']) {
    const frequencyDays = hasCKD && (ckdStage === 'G4' || ckdStage === 'G5') ? 90 : 365;
    const dueDate = new Date(lastTests['eGFR'].date);
    dueDate.setDate(dueDate.getDate() + frequencyDays);
    nextDue.push({ test: 'eGFR', due_date: dueDate.toISOString().split('T')[0] });
  }

  if (lastTests['uACR']) {
    const dueDate = new Date(lastTests['uACR'].date);
    dueDate.setDate(dueDate.getDate() + 365);
    nextDue.push({ test: 'uACR', due_date: dueDate.toISOString().split('T')[0] });
  }

  if (patient.has_diabetes && lastTests['HbA1c']) {
    const frequencyDays = hasCKD ? 90 : 180;
    const dueDate = new Date(lastTests['HbA1c'].date);
    dueDate.setDate(dueDate.getDate() + frequencyDays);
    nextDue.push({ test: 'HbA1c', due_date: dueDate.toISOString().split('T')[0] });
  }

  return nextDue.sort((a, b) => a.due_date.localeCompare(b.due_date));
}
