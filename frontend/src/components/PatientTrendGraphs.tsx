import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Observation {
  observation_type: string;
  value_numeric?: number;
  value_text?: string;
  unit?: string;
  observation_date: string;
  month_number?: number;
  notes?: string;
}

interface PatientTrendGraphsProps {
  observations: Observation[];
  isTreated: boolean;
}

export const PatientTrendGraphs: React.FC<PatientTrendGraphsProps> = ({ observations, isTreated }) => {
  // Process observations to prevent duplicate calendar months
  // Group by calendar month + year, keeping only the LATEST observation for each type
  const processedObservations = observations.reduce((acc, obs) => {
    if (!obs.observation_date) {
      console.warn('[PatientTrendGraphs] Skipping observation without date:', obs);
      return acc;
    }

    const observationDate = new Date(obs.observation_date);
    if (isNaN(observationDate.getTime())) {
      console.warn('[PatientTrendGraphs] Skipping observation with invalid date:', obs);
      return acc;
    }

    // Create a unique key based on calendar month/year AND observation type
    // This ensures we only keep one value per type per calendar month
    const monthYearKey = `${observationDate.getFullYear()}-${String(observationDate.getMonth() + 1).padStart(2, '0')}`;
    const uniqueKey = `${monthYearKey}-${obs.observation_type}`;

    // If this key doesn't exist OR this observation is more recent, update it
    if (!acc[uniqueKey] || new Date(obs.observation_date) > new Date(acc[uniqueKey].observation_date)) {
      acc[uniqueKey] = {
        ...obs,
        monthYearKey,
        sortDate: observationDate.getTime()
      };
    }

    return acc;
  }, {} as Record<string, any>);

  // Group deduplicated observations by calendar month for chart display
  const groupedByMonth = Object.values(processedObservations).reduce((acc, obs) => {
    const monthYearKey = obs.monthYearKey;

    if (!acc[monthYearKey]) {
      const observationDate = new Date(obs.observation_date);
      acc[monthYearKey] = {
        monthYearKey,
        date: observationDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        sortDate: obs.sortDate
      };
    }

    // Add the observation value to the appropriate column
    if (obs.value_numeric !== undefined) {
      acc[monthYearKey][obs.observation_type] = obs.value_numeric;
    }

    return acc;
  }, {} as Record<string, any>);

  // Convert to array and sort by actual date (not month_number)
  const timeSeriesData = Object.values(groupedByMonth).sort((a: any, b: any) => a.sortDate - b.sortDate);

  // Debug logging to verify data deduplication
  console.log('[PatientTrendGraphs] Processed time series data:', timeSeriesData);
  console.log('[PatientTrendGraphs] Number of unique calendar months:', timeSeriesData.length);

  // Helper function to check if a metric has multiple distinct timepoints
  const hasMultipleTimepoints = (dataKey: string) => {
    const validPoints = timeSeriesData.filter((d: any) => d[dataKey] !== undefined && d[dataKey] !== null);
    console.log(`[PatientTrendGraphs] ${dataKey} has ${validPoints.length} timepoints:`, validPoints.map((p: any) => ({ date: p.date, value: p[dataKey] })));
    return validPoints.length > 1;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    try {
      return (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => {
            if (!entry || entry.value === undefined || entry.value === null) {
              return null;
            }
            return (
              <p key={index} style={{ color: entry.color || '#000' }} className="text-sm">
                {entry.name || 'Value'}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
              </p>
            );
          }).filter(Boolean)}
        </div>
      );
    } catch (err) {
      console.error('[CustomTooltip] Error rendering tooltip:', err);
      return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-4">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          Patient Health Trends Over Time
          {isTreated && (
            <span className="ml-4 px-3 py-1 bg-green-500 text-white text-sm rounded-full">
              Under Treatment
            </span>
          )}
          {!isTreated && (
            <span className="ml-4 px-3 py-1 bg-orange-500 text-white text-sm rounded-full">
              Not Treated
            </span>
          )}
        </h2>
      </div>

      <div className="p-8 space-y-8">
        {/* eGFR Trend */}
        {timeSeriesData.some((d: any) => d.eGFR) && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">📊</span>
              Kidney Function (eGFR)
              <span className="ml-3 text-sm font-normal text-gray-600">
                Higher is better • Target: &gt;60 mL/min/1.73m²
              </span>
              {!hasMultipleTimepoints('eGFR') && (
                <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Baseline only - awaiting follow-up
                </span>
              )}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  label={{ value: 'mL/min/1.73m²', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {/* Reference zones */}
                <ReferenceLine y={60} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Normal (>60)', fill: '#10b981', fontSize: 11 }} />
                <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Severe (<30)', fill: '#f59e0b', fontSize: 11 }} />
                <Line
                  type="linear"
                  dataKey="eGFR"
                  stroke={isTreated ? "#10b981" : "#ef4444"}
                  strokeWidth={3}
                  dot={{ fill: isTreated ? "#10b981" : "#ef4444", r: 8 }}
                  name="eGFR"
                  unit="mL/min/1.73m²"
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* uACR Trend */}
        {timeSeriesData.some((d: any) => d.uACR) && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🔬</span>
              Protein in Urine (uACR)
              <span className="ml-3 text-sm font-normal text-gray-600">
                Lower is better • Normal: &lt;30 mg/g
              </span>
              {!hasMultipleTimepoints('uACR') && (
                <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Baseline only - awaiting follow-up
                </span>
              )}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  label={{ value: 'mg/g', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {/* Reference zones */}
                <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Normal (<30)', fill: '#10b981', fontSize: 11 }} />
                <ReferenceLine y={300} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Severe (>300)', fill: '#ef4444', fontSize: 11 }} />
                <Line
                  type="linear"
                  dataKey="uACR"
                  stroke={isTreated ? "#10b981" : "#ef4444"}
                  strokeWidth={3}
                  dot={{ fill: isTreated ? "#10b981" : "#ef4444", r: 8 }}
                  name="uACR"
                  unit="mg/g"
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Blood Pressure Trend */}
        {timeSeriesData.some((d: any) => d.blood_pressure_systolic) && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">❤️</span>
              Blood Pressure
              <span className="ml-3 text-sm font-normal text-gray-600">
                Target: &lt;130/80 mmHg for CKD patients
              </span>
              {!hasMultipleTimepoints('blood_pressure_systolic') && (
                <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Baseline only - awaiting follow-up
                </span>
              )}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  label={{ value: 'mmHg', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  domain={[60, 180]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {/* Reference lines */}
                <ReferenceLine y={130} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Target Systolic (130)', fill: '#10b981', fontSize: 11 }} />
                <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Target Diastolic (80)', fill: '#10b981', fontSize: 11 }} />
                <Line
                  type="linear"
                  dataKey="blood_pressure_systolic"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ fill: "#ef4444", r: 8 }}
                  name="Systolic"
                  unit="mmHg"
                  connectNulls={true}
                />
                <Line
                  type="linear"
                  dataKey="blood_pressure_diastolic"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ fill: "#3b82f6", r: 8 }}
                  name="Diastolic"
                  unit="mmHg"
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* HbA1c Trend (for diabetic patients) */}
        {timeSeriesData.some((d: any) => d.HbA1c) && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🩸</span>
              Diabetes Control (HbA1c)
              <span className="ml-3 text-sm font-normal text-gray-600">
                Target: &lt;7% for most patients
              </span>
              {!hasMultipleTimepoints('HbA1c') && (
                <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Baseline only - awaiting follow-up
                </span>
              )}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis
                  label={{ value: '%', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  domain={[4, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {/* Reference line */}
                <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Target (<7%)', fill: '#10b981', fontSize: 11 }} />
                <Line
                  type="linear"
                  dataKey="HbA1c"
                  stroke={isTreated ? "#8b5cf6" : "#f97316"}
                  strokeWidth={3}
                  dot={{ fill: isTreated ? "#8b5cf6" : "#f97316", r: 8 }}
                  name="HbA1c"
                  unit="%"
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
