import { pool } from '../database.js';

export interface PatientDataInput {
  patient_id: string;
  include_labs?: boolean;
  include_risk?: boolean;
}

export interface PatientDataOutput {
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
    dateOfBirth: string;
  };
  vitals: {
    weight: number;
    height: number;
    bmi: number;
  };
  comorbidities: {
    diabetes: boolean;
    hypertension: boolean;
    heartFailure: boolean;
    cad: boolean;
    cvdHistory: boolean;
    familyHistoryEsrd: boolean;
  };
  medications: {
    rasInhibitor: boolean;
    sglt2i: boolean;
    nephrotoxicMeds: string | null;
  };
  status: {
    smokingStatus: string | null;
    nephrologistReferral: boolean;
    lastVisit: string | null;
    nextVisit: string | null;
  };
  recentLabs?: Array<{
    type: string;
    value: number;
    unit: string;
    date: string;
    status: string;
    referenceRange: string;
  }>;
  riskAssessment?: {
    kdigoCategory: string;
    ckdStage: string;
    riskLevel: string;
    riskScore: number;
    recommendations: string | null;
  };
}

export async function getPatientData(input: PatientDataInput): Promise<PatientDataOutput> {
  const { patient_id, include_labs = true, include_risk = true } = input;

  // Get patient demographics and basic info
  const patientQuery = `
    SELECT
      id, medical_record_number, first_name, last_name,
      date_of_birth, gender, weight, height,
      smoking_status, has_diabetes, has_hypertension,
      has_heart_failure, has_cad, cvd_history, family_history_esrd,
      on_ras_inhibitor, on_sglt2i, nephrotoxic_meds,
      nephrologist_referral, last_visit_date, next_visit_date,
      EXTRACT(YEAR FROM AGE(date_of_birth)) as age
    FROM patients
    WHERE id = $1
  `;

  const patientResult = await pool.query(patientQuery, [patient_id]);

  if (patientResult.rows.length === 0) {
    throw new Error(`Patient not found: ${patient_id}`);
  }

  const patient = patientResult.rows[0];

  const calculateBMI = (weight: number, height: number): number => {
    if (!weight || !height) return 0;
    const heightInMeters = height / 100;
    return Number((weight / (heightInMeters * heightInMeters)).toFixed(1));
  };

  const output: PatientDataOutput = {
    patient: {
      id: patient.id,
      mrn: patient.medical_record_number,
      firstName: patient.first_name,
      lastName: patient.last_name,
      age: patient.age,
      gender: patient.gender,
      dateOfBirth: patient.date_of_birth,
    },
    vitals: {
      weight: patient.weight,
      height: patient.height,
      bmi: calculateBMI(patient.weight, patient.height),
    },
    comorbidities: {
      diabetes: patient.has_diabetes,
      hypertension: patient.has_hypertension,
      heartFailure: patient.has_heart_failure,
      cad: patient.has_cad,
      cvdHistory: patient.cvd_history,
      familyHistoryEsrd: patient.family_history_esrd,
    },
    medications: {
      rasInhibitor: patient.on_ras_inhibitor,
      sglt2i: patient.on_sglt2i,
      nephrotoxicMeds: patient.nephrotoxic_meds,
    },
    status: {
      smokingStatus: patient.smoking_status,
      nephrologistReferral: patient.nephrologist_referral,
      lastVisit: patient.last_visit_date,
      nextVisit: patient.next_visit_date,
    },
  };

  // Get recent lab results if requested
  if (include_labs) {
    const labQuery = `
      SELECT
        observation_type, value, unit, observed_date,
        status, reference_range
      FROM observations
      WHERE patient_id = $1
      ORDER BY observed_date DESC
      LIMIT 20
    `;

    const labResult = await pool.query(labQuery, [patient_id]);
    output.recentLabs = labResult.rows.map(lab => ({
      type: lab.observation_type,
      value: lab.value,
      unit: lab.unit,
      date: lab.observed_date,
      status: lab.status,
      referenceRange: lab.reference_range,
    }));
  }

  // Get risk assessment if requested
  if (include_risk) {
    const riskQuery = `
      SELECT
        kdigo_category, ckd_stage, risk_level, risk_score, recommendations
      FROM patient_risk_assessments
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const riskResult = await pool.query(riskQuery, [patient_id]);
    if (riskResult.rows.length > 0) {
      const risk = riskResult.rows[0];
      output.riskAssessment = {
        kdigoCategory: risk.kdigo_category,
        ckdStage: risk.ckd_stage,
        riskLevel: risk.risk_level,
        riskScore: risk.risk_score,
        recommendations: risk.recommendations,
      };
    }
  }

  return output;
}
