import { pool } from '../database.js';

export interface QueryLabResultsInput {
  patient_id: string;
  observation_type?: 'eGFR' | 'uACR' | 'Creatinine' | 'HbA1c' | 'Albumin' | 'All';
  date_range?: {
    start: string;
    end: string;
  };
  limit?: number;
}

export interface LabResult {
  observationType: string;
  value: number;
  unit: string;
  observedDate: string;
  status: string;
  referenceRange: string;
  interpretation?: string;
}

export async function queryLabResults(input: QueryLabResultsInput): Promise<LabResult[]> {
  const {
    patient_id,
    observation_type = 'All',
    date_range,
    limit = 20,
  } = input;

  let query = `
    SELECT
      observation_type, value, unit, observed_date,
      status, reference_range
    FROM observations
    WHERE patient_id = $1
  `;

  const params: any[] = [patient_id];
  let paramIndex = 2;

  // Filter by observation type if specified
  if (observation_type !== 'All') {
    query += ` AND observation_type = $${paramIndex}`;
    params.push(observation_type);
    paramIndex++;
  }

  // Filter by date range if specified
  if (date_range) {
    query += ` AND observed_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    params.push(date_range.start, date_range.end);
    paramIndex += 2;
  }

  query += ` ORDER BY observed_date DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await pool.query(query, params);

  // Add interpretations based on lab values
  return result.rows.map(lab => {
    const labResult: LabResult = {
      observationType: lab.observation_type,
      value: lab.value,
      unit: lab.unit,
      observedDate: lab.observed_date,
      status: lab.status,
      referenceRange: lab.reference_range,
    };

    // Add clinical interpretation
    labResult.interpretation = interpretLabValue(
      lab.observation_type,
      lab.value,
      lab.status
    );

    return labResult;
  });
}

function interpretLabValue(type: string, value: number, status: string): string {
  switch (type) {
    case 'eGFR':
      if (value >= 90) return 'Normal kidney function';
      if (value >= 60) return 'Mildly decreased kidney function (Stage 2 CKD)';
      if (value >= 45) return 'Mild-moderate decrease (Stage 3a CKD)';
      if (value >= 30) return 'Moderate-severe decrease (Stage 3b CKD)';
      if (value >= 15) return 'Severely decreased kidney function (Stage 4 CKD)';
      return 'Kidney failure (Stage 5 CKD)';

    case 'uACR':
      if (value < 30) return 'Normal albumin excretion';
      if (value < 300) return 'Moderately increased albuminuria (A2)';
      return 'Severely increased albuminuria (A3)';

    case 'HbA1c':
      if (value < 5.7) return 'Normal (no diabetes)';
      if (value < 6.5) return 'Prediabetes';
      if (value < 7.0) return 'Diabetes - well controlled';
      if (value < 8.0) return 'Diabetes - suboptimal control';
      return 'Diabetes - poor control';

    case 'Creatinine':
      return status === 'abnormal' ? 'Elevated - kidney function may be impaired' : 'Normal';

    default:
      return status === 'abnormal' ? 'Abnormal - clinical correlation advised' : 'Within normal limits';
  }
}
