import { pool } from '../database.js';

export interface AdherenceMonitoringInput {
  patient_id: string;
  medication_type: 'SGLT2i' | 'RAS_inhibitor' | 'ALL';
  measurement_period_days?: number; // Default 90 days
}

export interface MedicationAdherence {
  medicationName: string;
  medicationType: string;
  mpr: number; // Medication Possession Ratio (%)
  adherenceStatus: 'GOOD' | 'SUBOPTIMAL' | 'POOR';
  daysSupplied: number;
  daysCovered: number;
  measurementPeriodDays: number;
  refillRecords: RefillRecord[];
  barriers: AdherenceBarrier[];
}

export interface RefillRecord {
  fillDate: string;
  daysSupply: number;
  prescriber: string;
}

export interface AdherenceBarrier {
  barrierType: 'REFILL_GAP' | 'DISCONTINUATION' | 'DECREASING_FREQUENCY' | 'COST' | 'SIDE_EFFECTS';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AdherenceAlert {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  action: string;
  reasoning: string[];
}

export interface AdherenceMonitoringOutput {
  medications: MedicationAdherence[];
  overallAdherence: number;
  alerts: AdherenceAlert[];
  clinicalCorrelation: ClinicalCorrelation | null;
  recommendations: string[];
}

export interface ClinicalCorrelation {
  latestEgfr: number | null;
  latestUacr: number | null;
  egfrTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN';
  uacrTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN';
  adherenceImpact: string;
}

/**
 * PHASE 4: TREATMENT ADHERENCE MONITORING
 *
 * Calculates Medication Possession Ratio (MPR) from prescription fill records.
 * Detects adherence barriers and generates smart alerts linking adherence to outcomes.
 *
 * Based on: Unified CKD Specification v3.0, Phase 4
 */
export async function monitorAdherence(input: AdherenceMonitoringInput): Promise<AdherenceMonitoringOutput> {
  const { patient_id, medication_type = 'ALL', measurement_period_days = 90 } = input;

  // Get prescription fill records for the measurement period
  const medicationFilter =
    medication_type === 'SGLT2i'
      ? `medication_name ILIKE '%empagliflozin%' OR medication_name ILIKE '%dapagliflozin%' OR medication_name ILIKE '%jardiance%' OR medication_name ILIKE '%farxiga%'`
      : medication_type === 'RAS_inhibitor'
        ? `medication_name ILIKE '%lisinopril%' OR medication_name ILIKE '%enalapril%' OR medication_name ILIKE '%losartan%' OR medication_name ILIKE '%valsartan%'`
        : `(medication_name ILIKE '%empagliflozin%' OR medication_name ILIKE '%jardiance%' OR medication_name ILIKE '%lisinopril%' OR medication_name ILIKE '%losartan%')`;

  // Note: This assumes we have a medication_requests or prescriptions table
  // Adjust based on actual schema
  const prescriptionsQuery = `
    SELECT
      medication_name,
      fill_date,
      days_supply,
      prescriber_name
    FROM medication_requests
    WHERE patient_id = $1
      AND fill_date >= CURRENT_DATE - INTERVAL '${measurement_period_days} days'
      AND (${medicationFilter})
    ORDER BY medication_name, fill_date ASC
  `;

  const prescriptionsResult = await pool.query(prescriptionsQuery, [patient_id]);

  if (prescriptionsResult.rows.length === 0) {
    return {
      medications: [],
      overallAdherence: 0,
      alerts: [
        {
          priority: 'HIGH',
          message: 'No prescription fill records found',
          action: 'Verify patient is prescribed CKD medications',
          reasoning: [
            'Cannot calculate adherence without pharmacy data',
            'Patient may not be initiated on therapy',
            'Or pharmacy records not integrated',
          ],
        },
      ],
      clinicalCorrelation: null,
      recommendations: ['Verify CKD medication orders', 'Check pharmacy integration'],
    };
  }

  // Group prescriptions by medication
  const medicationGroups = groupByMedication(prescriptionsResult.rows);

  // Calculate adherence for each medication
  const medications: MedicationAdherence[] = [];

  for (const [medName, refills] of Object.entries(medicationGroups)) {
    const adherenceData = calculateMPR(medName, refills, measurement_period_days);
    medications.push(adherenceData);
  }

  // Calculate overall adherence (average MPR)
  const overallAdherence =
    medications.reduce((sum, med) => sum + med.mpr, 0) / medications.length;

  // Get clinical correlation (lab trends)
  const clinicalCorrelation = await getClinicalCorrelation(patient_id);

  // Generate smart alerts
  const alerts = generateAdherenceAlerts(medications, overallAdherence, clinicalCorrelation);

  // Generate recommendations
  const recommendations = generateAdherenceRecommendations(
    medications,
    overallAdherence,
    clinicalCorrelation
  );

  return {
    medications,
    overallAdherence,
    alerts,
    clinicalCorrelation,
    recommendations,
  };
}

function groupByMedication(prescriptions: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};

  for (const rx of prescriptions) {
    const medName = rx.medication_name;
    if (!groups[medName]) {
      groups[medName] = [];
    }
    groups[medName].push({
      fillDate: rx.fill_date,
      daysSupply: rx.days_supply,
      prescriber: rx.prescriber_name,
    });
  }

  return groups;
}

function calculateMPR(
  medicationName: string,
  refills: any[],
  measurementPeriodDays: number
): MedicationAdherence {
  // Sort refills by date
  refills.sort((a, b) => new Date(a.fillDate).getTime() - new Date(b.fillDate).getTime());

  // Calculate total days supplied
  const totalDaysSupplied = refills.reduce((sum, refill) => sum + refill.daysSupply, 0);

  // Calculate days covered (accounting for overlaps)
  let daysCovered = 0;
  let currentCoverageEnd = new Date(refills[0].fillDate);

  for (const refill of refills) {
    const fillDate = new Date(refill.fillDate);
    const supplyEnd = new Date(fillDate);
    supplyEnd.setDate(supplyEnd.getDate() + refill.daysSupply);

    if (fillDate > currentCoverageEnd) {
      // Gap in coverage
      const daysCoveredThisRefill = refill.daysSupply;
      daysCovered += daysCoveredThisRefill;
      currentCoverageEnd = supplyEnd;
    } else {
      // Overlapping or continuous coverage
      const daysExtended = Math.max(
        0,
        (supplyEnd.getTime() - currentCoverageEnd.getTime()) / (1000 * 60 * 60 * 24)
      );
      daysCovered += daysExtended;
      currentCoverageEnd = supplyEnd;
    }
  }

  // Calculate MPR
  const mpr = Math.min(100, (daysCovered / measurementPeriodDays) * 100);

  // Determine adherence status
  let adherenceStatus: 'GOOD' | 'SUBOPTIMAL' | 'POOR';
  if (mpr >= 90) {
    adherenceStatus = 'GOOD';
  } else if (mpr >= 75) {
    adherenceStatus = 'SUBOPTIMAL';
  } else {
    adherenceStatus = 'POOR';
  }

  // Determine medication type
  const isSGLT2i =
    medicationName.toLowerCase().includes('empagliflozin') ||
    medicationName.toLowerCase().includes('jardiance') ||
    medicationName.toLowerCase().includes('dapagliflozin') ||
    medicationName.toLowerCase().includes('farxiga');

  const medicationType = isSGLT2i ? 'SGLT2 Inhibitor' : 'RAS Inhibitor';

  // Detect barriers
  const barriers = detectAdherenceBarriers(refills, mpr);

  return {
    medicationName,
    medicationType,
    mpr: Math.round(mpr),
    adherenceStatus,
    daysSupplied: totalDaysSupplied,
    daysCovered: Math.round(daysCovered),
    measurementPeriodDays,
    refillRecords: refills,
    barriers,
  };
}

function detectAdherenceBarriers(refills: any[], mpr: number): AdherenceBarrier[] {
  const barriers: AdherenceBarrier[] = [];

  if (refills.length === 0) return barriers;

  // Sort by date
  refills.sort((a, b) => new Date(a.fillDate).getTime() - new Date(b.fillDate).getTime());

  // Check for REFILL GAPS (>7 days beyond expected refill)
  for (let i = 1; i < refills.length; i++) {
    const previousFill = refills[i - 1];
    const currentFill = refills[i];

    const expectedRefillDate = new Date(previousFill.fillDate);
    expectedRefillDate.setDate(expectedRefillDate.getDate() + previousFill.daysSupply);

    const actualRefillDate = new Date(currentFill.fillDate);
    const gapDays =
      (actualRefillDate.getTime() - expectedRefillDate.getTime()) / (1000 * 60 * 60 * 24);

    if (gapDays > 7) {
      barriers.push({
        barrierType: 'REFILL_GAP',
        description: `${Math.round(gapDays)}-day gap between refills`,
        severity: gapDays > 14 ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  // Check for DISCONTINUATION (no refill for >14 days after supply should run out)
  const lastFill = refills[refills.length - 1];
  const lastSupplyEnd = new Date(lastFill.fillDate);
  lastSupplyEnd.setDate(lastSupplyEnd.getDate() + lastFill.daysSupply);

  const daysSinceLastSupply = (Date.now() - lastSupplyEnd.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLastSupply > 14) {
    barriers.push({
      barrierType: 'DISCONTINUATION',
      description: `No refill for ${Math.round(daysSinceLastSupply)} days after supply ran out`,
      severity: 'HIGH',
    });
  }

  // Check for DECREASING FREQUENCY (refill intervals increasing over time)
  if (refills.length >= 3) {
    const intervals: number[] = [];
    for (let i = 1; i < refills.length; i++) {
      const interval =
        (new Date(refills[i].fillDate).getTime() - new Date(refills[i - 1].fillDate).getTime()) /
        (1000 * 60 * 60 * 24);
      intervals.push(interval);
    }

    const firstInterval = intervals[0];
    const lastInterval = intervals[intervals.length - 1];

    if (lastInterval > firstInterval * 1.5) {
      barriers.push({
        barrierType: 'DECREASING_FREQUENCY',
        description: 'Refill intervals increasing over time - possible waning adherence',
        severity: 'MEDIUM',
      });
    }
  }

  // If MPR is low but no specific pattern detected, flag as general adherence issue
  if (mpr < 75 && barriers.length === 0) {
    barriers.push({
      barrierType: 'COST',
      description: 'Low adherence without clear gap pattern - possible cost or access barrier',
      severity: 'MEDIUM',
    });
  }

  return barriers;
}

async function getClinicalCorrelation(patient_id: string): Promise<ClinicalCorrelation | null> {
  // Get latest eGFR and uACR
  const labQuery = `
    SELECT observation_type, value, observed_date
    FROM observations
    WHERE patient_id = $1
      AND observation_type IN ('eGFR', 'uACR')
    ORDER BY observed_date DESC
    LIMIT 4
  `;

  const labResult = await pool.query(labQuery, [patient_id]);

  if (labResult.rows.length < 2) {
    return null; // Need at least 2 data points for trend
  }

  let latestEgfr: number | null = null;
  let previousEgfr: number | null = null;
  let latestUacr: number | null = null;
  let previousUacr: number | null = null;

  for (const lab of labResult.rows) {
    if (lab.observation_type === 'eGFR') {
      if (latestEgfr === null) {
        latestEgfr = parseFloat(lab.value);
      } else if (previousEgfr === null) {
        previousEgfr = parseFloat(lab.value);
      }
    }
    if (lab.observation_type === 'uACR') {
      if (latestUacr === null) {
        latestUacr = parseFloat(lab.value);
      } else if (previousUacr === null) {
        previousUacr = parseFloat(lab.value);
      }
    }
  }

  // Determine trends
  let egfrTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN' = 'UNKNOWN';
  let uacrTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN' = 'UNKNOWN';

  if (latestEgfr !== null && previousEgfr !== null) {
    const egfrChange = latestEgfr - previousEgfr;
    if (egfrChange > 5) {
      egfrTrend = 'IMPROVING';
    } else if (egfrChange < -5) {
      egfrTrend = 'WORSENING';
    } else {
      egfrTrend = 'STABLE';
    }
  }

  if (latestUacr !== null && previousUacr !== null) {
    const uacrChange = ((latestUacr - previousUacr) / previousUacr) * 100;
    if (uacrChange < -15) {
      uacrTrend = 'IMPROVING';
    } else if (uacrChange > 15) {
      uacrTrend = 'WORSENING';
    } else {
      uacrTrend = 'STABLE';
    }
  }

  // Assess adherence impact
  let adherenceImpact = '';
  if (egfrTrend === 'WORSENING' || uacrTrend === 'WORSENING') {
    adherenceImpact = 'Clinical worsening detected - adherence critical to prevent further decline';
  } else if (egfrTrend === 'IMPROVING' || uacrTrend === 'IMPROVING') {
    adherenceImpact = 'Clinical improvement - maintaining good adherence essential to sustain benefits';
  } else {
    adherenceImpact = 'Stable clinical status - continue current adherence level';
  }

  return {
    latestEgfr,
    latestUacr,
    egfrTrend,
    uacrTrend,
    adherenceImpact,
  };
}

function generateAdherenceAlerts(
  medications: MedicationAdherence[],
  overallAdherence: number,
  clinicalCorrelation: ClinicalCorrelation | null
): AdherenceAlert[] {
  const alerts: AdherenceAlert[] = [];

  for (const med of medications) {
    // CRITICAL: Poor adherence + Clinical worsening
    if (
      med.mpr < 90 &&
      clinicalCorrelation &&
      (clinicalCorrelation.egfrTrend === 'WORSENING' ||
        clinicalCorrelation.uacrTrend === 'WORSENING')
    ) {
      alerts.push({
        priority: 'CRITICAL',
        message: `${med.medicationName}: Poor adherence (MPR ${med.mpr}%) with clinical worsening`,
        action: 'URGENT: Immediate patient outreach required',
        reasoning: [
          'Adherence <90% linked to worsening kidney function',
          'Risk of accelerated CKD progression',
          'May need intensive adherence support or alternative therapy',
        ],
      });
    }
    // HIGH: Good adherence + Clinical worsening (treatment failure)
    else if (
      med.mpr >= 90 &&
      clinicalCorrelation &&
      (clinicalCorrelation.egfrTrend === 'WORSENING' ||
        clinicalCorrelation.uacrTrend === 'WORSENING')
    ) {
      alerts.push({
        priority: 'HIGH',
        message: `${med.medicationName}: Good adherence (MPR ${med.mpr}%) but clinical worsening`,
        action: 'Consider treatment failure - nephrology referral or therapy adjustment',
        reasoning: [
          'Patient is adherent but kidney function declining',
          'Current therapy may be inadequate',
          'Consider adding additional CKD therapies or specialist consultation',
        ],
      });
    }
    // MEDIUM: Suboptimal adherence + Stable status
    else if (med.mpr < 90 && med.mpr >= 75) {
      alerts.push({
        priority: 'MEDIUM',
        message: `${med.medicationName}: Suboptimal adherence (MPR ${med.mpr}%)`,
        action: 'Patient counseling recommended at next visit',
        reasoning: [
          'Adherence below optimal 90% threshold',
          'Brief intervention may improve adherence',
          'Identify and address barriers',
        ],
      });
    }
    // MEDIUM: Poor adherence
    else if (med.mpr < 75) {
      alerts.push({
        priority: 'HIGH',
        message: `${med.medicationName}: Poor adherence (MPR ${med.mpr}%)`,
        action: 'Urgent visit to assess barriers and re-educate',
        reasoning: [
          'MPR <75% associated with 2.1x higher CKD progression risk',
          'Significant adherence barrier likely present',
          'Immediate intervention needed',
        ],
      });
    }
  }

  // Overall good adherence message
  if (overallAdherence >= 90 && alerts.length === 0) {
    alerts.push({
      priority: 'LOW',
      message: 'Excellent medication adherence',
      action: 'Continue current support and monitoring',
      reasoning: ['Patient demonstrating optimal adherence (≥90%)', 'Current approach effective'],
    });
  }

  return alerts;
}

function generateAdherenceRecommendations(
  medications: MedicationAdherence[],
  overallAdherence: number,
  clinicalCorrelation: ClinicalCorrelation | null
): string[] {
  const recommendations: string[] = [];

  if (overallAdherence < 75) {
    recommendations.push('Schedule urgent patient visit to assess adherence barriers');
    recommendations.push('Consider interventions: pill boxes, medication synchronization, financial assistance');
    recommendations.push('Evaluate for side effects or tolerability issues');
  } else if (overallAdherence < 90) {
    recommendations.push('Brief adherence counseling at next visit');
    recommendations.push('Review barriers: cost, side effects, refill access');
    recommendations.push('Consider simplifying regimen if possible');
  }

  // Specific barrier-based recommendations
  for (const med of medications) {
    for (const barrier of med.barriers) {
      if (barrier.barrierType === 'COST') {
        recommendations.push(`Address potential cost barrier for ${med.medicationName} - explore patient assistance programs`);
      } else if (barrier.barrierType === 'DISCONTINUATION') {
        recommendations.push(`Investigate discontinuation of ${med.medicationName} - check for side effects or patient decision`);
      }
    }
  }

  // Clinical correlation recommendations
  if (clinicalCorrelation) {
    if (clinicalCorrelation.egfrTrend === 'WORSENING' && overallAdherence >= 90) {
      recommendations.push('Despite good adherence, kidney function declining - consider therapy intensification');
      recommendations.push('Nephrology consultation for advanced CKD management');
    } else if (clinicalCorrelation.egfrTrend === 'IMPROVING' || clinicalCorrelation.uacrTrend === 'IMPROVING') {
      recommendations.push('Clinical improvement observed - reinforce positive adherence behaviors');
      recommendations.push('Continue current treatment plan');
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue current adherence monitoring');
    recommendations.push('Maintain positive reinforcement at visits');
  }

  return recommendations;
}
