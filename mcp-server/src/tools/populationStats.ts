import { pool } from '../database.js';

export interface PopulationStatsInput {
  filters?: {
    has_diabetes?: boolean;
    has_hypertension?: boolean;
    on_sglt2i?: boolean;
    on_ras_inhibitor?: boolean;
    risk_level?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    age_min?: number;
    age_max?: number;
  };
  group_by?: 'risk_level' | 'ckd_stage' | 'medication' | 'comorbidity';
}

export interface PopulationStatsOutput {
  totalPatients: number;
  filtered: number;
  demographics?: {
    avgAge: number;
    genderDistribution: { male: number; female: number };
  };
  comorbidities?: {
    diabetes: number;
    hypertension: number;
    heartFailure: number;
    cad: number;
  };
  treatments?: {
    rasInhibitor: number;
    sglt2i: number;
    combinationTherapy: number;
  };
  riskDistribution?: Array<{
    riskLevel: string;
    count: number;
    percentage: number;
  }>;
  groupedData?: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
}

export async function getPopulationStats(input: PopulationStatsInput): Promise<PopulationStatsOutput> {
  const { filters, group_by } = input;

  // Build WHERE clause from filters
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters) {
    if (filters.has_diabetes !== undefined) {
      conditions.push(`has_diabetes = $${paramIndex++}`);
      params.push(filters.has_diabetes);
    }
    if (filters.has_hypertension !== undefined) {
      conditions.push(`has_hypertension = $${paramIndex++}`);
      params.push(filters.has_hypertension);
    }
    if (filters.on_sglt2i !== undefined) {
      conditions.push(`on_sglt2i = $${paramIndex++}`);
      params.push(filters.on_sglt2i);
    }
    if (filters.on_ras_inhibitor !== undefined) {
      conditions.push(`on_ras_inhibitor = $${paramIndex++}`);
      params.push(filters.on_ras_inhibitor);
    }
    if (filters.age_min !== undefined) {
      conditions.push(`EXTRACT(YEAR FROM AGE(date_of_birth)) >= $${paramIndex++}`);
      params.push(filters.age_min);
    }
    if (filters.age_max !== undefined) {
      conditions.push(`EXTRACT(YEAR FROM AGE(date_of_birth)) <= $${paramIndex++}`);
      params.push(filters.age_max);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total patient count
  const totalQuery = 'SELECT COUNT(*) as total FROM patients';
  const totalResult = await pool.query(totalQuery);
  const totalPatients = parseInt(totalResult.rows[0].total);

  // Get filtered count and demographics
  const statsQuery = `
    SELECT
      COUNT(*) as filtered,
      AVG(EXTRACT(YEAR FROM AGE(date_of_birth))) as avg_age,
      COUNT(*) FILTER (WHERE gender = 'M') as male_count,
      COUNT(*) FILTER (WHERE gender = 'F') as female_count,
      COUNT(*) FILTER (WHERE has_diabetes = true) as diabetes_count,
      COUNT(*) FILTER (WHERE has_hypertension = true) as hypertension_count,
      COUNT(*) FILTER (WHERE has_heart_failure = true) as heart_failure_count,
      COUNT(*) FILTER (WHERE has_cad = true) as cad_count,
      COUNT(*) FILTER (WHERE on_ras_inhibitor = true) as ras_count,
      COUNT(*) FILTER (WHERE on_sglt2i = true) as sglt2i_count,
      COUNT(*) FILTER (WHERE on_ras_inhibitor = true AND on_sglt2i = true) as combo_count
    FROM patients
    ${whereClause}
  `;

  const statsResult = await pool.query(statsQuery, params);
  const stats = statsResult.rows[0];

  const output: PopulationStatsOutput = {
    totalPatients,
    filtered: parseInt(stats.filtered),
    demographics: {
      avgAge: Math.round(stats.avg_age),
      genderDistribution: {
        male: parseInt(stats.male_count),
        female: parseInt(stats.female_count),
      },
    },
    comorbidities: {
      diabetes: parseInt(stats.diabetes_count),
      hypertension: parseInt(stats.hypertension_count),
      heartFailure: parseInt(stats.heart_failure_count),
      cad: parseInt(stats.cad_count),
    },
    treatments: {
      rasInhibitor: parseInt(stats.ras_count),
      sglt2i: parseInt(stats.sglt2i_count),
      combinationTherapy: parseInt(stats.combo_count),
    },
  };

  // Get risk distribution if filtering by risk level or grouping by risk
  if (filters?.risk_level || group_by === 'risk_level') {
    const riskQuery = `
      SELECT
        pra.risk_level,
        COUNT(*) as count
      FROM patient_risk_assessments pra
      JOIN patients p ON p.id = pra.patient_id
      ${whereClause}
      GROUP BY pra.risk_level
      ORDER BY
        CASE pra.risk_level
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MODERATE' THEN 3
          WHEN 'LOW' THEN 4
        END
    `;

    const riskResult = await pool.query(riskQuery, params);
    output.riskDistribution = riskResult.rows.map(row => ({
      riskLevel: row.risk_level,
      count: parseInt(row.count),
      percentage: Math.round((parseInt(row.count) / stats.filtered) * 100),
    }));
  }

  // Handle grouping
  if (group_by) {
    output.groupedData = await getGroupedData(group_by, whereClause, params);
  }

  return output;
}

async function getGroupedData(
  groupBy: string,
  whereClause: string,
  params: any[]
): Promise<Array<{ category: string; count: number; percentage: number }>> {
  let groupQuery: string;

  switch (groupBy) {
    case 'ckd_stage':
      groupQuery = `
        SELECT
          pra.ckd_stage as category,
          COUNT(*) as count
        FROM patient_risk_assessments pra
        JOIN patients p ON p.id = pra.patient_id
        ${whereClause}
        GROUP BY pra.ckd_stage
        ORDER BY pra.ckd_stage
      `;
      break;

    case 'medication':
      groupQuery = `
        SELECT
          CASE
            WHEN on_ras_inhibitor AND on_sglt2i THEN 'Both RAS + SGLT2i'
            WHEN on_ras_inhibitor THEN 'RAS Inhibitor Only'
            WHEN on_sglt2i THEN 'SGLT2i Only'
            ELSE 'Neither'
          END as category,
          COUNT(*) as count
        FROM patients
        ${whereClause}
        GROUP BY category
        ORDER BY count DESC
      `;
      break;

    case 'comorbidity':
      groupQuery = `
        SELECT
          CASE
            WHEN has_diabetes AND has_hypertension THEN 'Diabetes + Hypertension'
            WHEN has_diabetes THEN 'Diabetes Only'
            WHEN has_hypertension THEN 'Hypertension Only'
            ELSE 'No Major Comorbidities'
          END as category,
          COUNT(*) as count
        FROM patients
        ${whereClause}
        GROUP BY category
        ORDER BY count DESC
      `;
      break;

    default:
      return [];
  }

  const result = await pool.query(groupQuery, params);
  const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

  return result.rows.map(row => ({
    category: row.category,
    count: parseInt(row.count),
    percentage: Math.round((parseInt(row.count) / total) * 100),
  }));
}
