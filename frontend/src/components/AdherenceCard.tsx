import React from 'react';

export interface AdherenceData {
  compositeScore: number; // 0.00-1.00
  compositePercentage: number; // 0-100
  adherenceCategory: 'GOOD' | 'SUBOPTIMAL' | 'POOR';
  scoringMethod: string;
  components: {
    mpr?: AdherenceComponent;
    labBased?: AdherenceComponent;
    selfReported?: AdherenceComponent;
  };
  medications: MedicationAdherence[];
  clinicalContext: {
    latestEgfr: number | null;
    latestUacr: number | null;
    egfrTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN';
    uacrTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'UNKNOWN';
    treatmentResponse: string;
  };
  detectedBarriers: AdherenceBarrier[];
  riskAssessment?: RiskAssessment;
  alerts: AdherenceAlert[];
  recommendations: string[];
  adherenceTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';
  historicalData?: HistoricalAdherence[];
}

export interface AdherenceComponent {
  score: number;
  percentage: number;
  available: boolean;
  weight: number;
  source: string;
  details?: any;
}

export interface MedicationAdherence {
  medicationName: string;
  medicationType: string;
  adherence: number;
  category: 'GOOD' | 'SUBOPTIMAL' | 'POOR';
}

export interface AdherenceBarrier {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  affectedMedication?: string;
}

export interface RiskAssessment {
  riskScore: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  recommendedInterventions: string[];
  interventionPriority: 'ROUTINE' | 'ENHANCED' | 'INTENSIVE';
}

export interface AdherenceAlert {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  action: string;
  reasoning: string[];
}

export interface HistoricalAdherence {
  date: string;
  score: number;
  category: string;
}

interface AdherenceCardProps {
  adherenceData: AdherenceData | null;
  loading?: boolean;
}

export const AdherenceCard: React.FC<AdherenceCardProps> = ({ adherenceData, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!adherenceData) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Treatment Adherence</h3>
        <p className="text-sm text-gray-600">
          No adherence data available. Patient may not be on active treatment.
        </p>
      </div>
    );
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'GOOD':
        return 'text-green-700 bg-green-50';
      case 'SUBOPTIMAL':
        return 'text-yellow-700 bg-yellow-50';
      case 'POOR':
        return 'text-red-700 bg-red-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  const getCategoryBorderColor = (category: string) => {
    switch (category) {
      case 'GOOD':
        return 'border-green-200';
      case 'SUBOPTIMAL':
        return 'border-yellow-200';
      case 'POOR':
        return 'border-red-200';
      default:
        return 'border-gray-200';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING':
        return '📈';
      case 'STABLE':
        return '➡️';
      case 'WORSENING':
      case 'DECLINING':
        return '📉';
      default:
        return '❔';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 border-red-300 text-red-900';
      case 'HIGH':
        return 'bg-orange-100 border-orange-300 text-orange-900';
      case 'MEDIUM':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      case 'LOW':
        return 'bg-blue-100 border-blue-300 text-blue-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return '🔴';
      case 'MEDIUM':
        return '🟡';
      case 'LOW':
        return '🟢';
      default:
        return '⚪';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow border-2 ${getCategoryBorderColor(adherenceData.adherenceCategory)} p-6 mb-6`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">💊 Treatment Adherence</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getCategoryColor(adherenceData.adherenceCategory)}`}>
          {adherenceData.adherenceCategory}
        </div>
      </div>

      {/* Overall Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Adherence</span>
          <span className="text-2xl font-bold text-gray-900">{adherenceData.compositePercentage}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              adherenceData.adherenceCategory === 'GOOD'
                ? 'bg-green-500'
                : adherenceData.adherenceCategory === 'SUBOPTIMAL'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${adherenceData.compositePercentage}%` }}
          />
        </div>

        <p className="text-xs text-gray-500 mt-1">
          Based on {adherenceData.scoringMethod.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Trend Indicator */}
      {adherenceData.adherenceTrend !== 'UNKNOWN' && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getTrendIcon(adherenceData.adherenceTrend)}</span>
            <span className="text-sm font-medium text-gray-700">
              Adherence Trend: <span className="capitalize">{adherenceData.adherenceTrend.toLowerCase()}</span>
            </span>
          </div>
        </div>
      )}

      {/* Component Scores */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Measurement Sources</h4>
        <div className="space-y-2">
          {adherenceData.components.mpr && adherenceData.components.mpr.available && (
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700">Pharmacy Records (MPR)</span>
                <p className="text-xs text-gray-500">{adherenceData.components.mpr.source}</p>
              </div>
              <span className="text-sm font-semibold text-blue-700">{adherenceData.components.mpr.percentage}%</span>
            </div>
          )}

          {adherenceData.components.labBased && adherenceData.components.labBased.available && (
            <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700">Lab-Based Response</span>
                <p className="text-xs text-gray-500">{adherenceData.components.labBased.source}</p>
              </div>
              <span className="text-sm font-semibold text-purple-700">{adherenceData.components.labBased.percentage}%</span>
            </div>
          )}

          {adherenceData.components.selfReported && adherenceData.components.selfReported.available && (
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700">Patient Self-Report</span>
                <p className="text-xs text-gray-500">{adherenceData.components.selfReported.source}</p>
              </div>
              <span className="text-sm font-semibold text-green-700">{adherenceData.components.selfReported.percentage}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Per-Medication Breakdown */}
      {adherenceData.medications.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">📊 By Medication</h4>
          <div className="space-y-2">
            {adherenceData.medications.map((med, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{med.medicationName}</div>
                  <div className="text-xs text-gray-500">{med.medicationType}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{Math.round(med.adherence * 100)}%</span>
                  <span className={`text-xs px-2 py-1 rounded ${getCategoryColor(med.category)}`}>
                    {med.category === 'GOOD' ? '✓' : med.category === 'SUBOPTIMAL' ? '⚠' : '✗'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clinical Correlation */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">📈 Clinical Correlation</h4>
        <div className="grid grid-cols-2 gap-3">
          {adherenceData.clinicalContext.latestEgfr !== null && (
            <div className="p-3 bg-blue-50 rounded">
              <div className="text-xs text-gray-600">eGFR</div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold">{adherenceData.clinicalContext.latestEgfr}</span>
                <span className="text-xs">{getTrendIcon(adherenceData.clinicalContext.egfrTrend)}</span>
                <span className="text-xs text-gray-600 capitalize">
                  {adherenceData.clinicalContext.egfrTrend.toLowerCase()}
                </span>
              </div>
            </div>
          )}

          {adherenceData.clinicalContext.latestUacr !== null && (
            <div className="p-3 bg-purple-50 rounded">
              <div className="text-xs text-gray-600">uACR</div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold">{adherenceData.clinicalContext.latestUacr}</span>
                <span className="text-xs">{getTrendIcon(adherenceData.clinicalContext.uacrTrend)}</span>
                <span className="text-xs text-gray-600 capitalize">
                  {adherenceData.clinicalContext.uacrTrend.toLowerCase()}
                </span>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-700 mt-2 italic">{adherenceData.clinicalContext.treatmentResponse}</p>
      </div>

      {/* Detected Barriers */}
      {adherenceData.detectedBarriers.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">🔍 Detected Barriers</h4>
          <div className="space-y-2">
            {adherenceData.detectedBarriers.map((barrier, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <span className="text-sm">{getSeverityIcon(barrier.severity)}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{barrier.type.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-gray-600">{barrier.description}</div>
                  {barrier.affectedMedication && (
                    <div className="text-xs text-gray-500 mt-1">Affects: {barrier.affectedMedication}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Assessment */}
      {adherenceData.riskAssessment && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">⚠️ Non-Adherence Risk</h4>
          <div className={`p-3 rounded border ${
            adherenceData.riskAssessment.riskCategory === 'HIGH'
              ? 'bg-red-50 border-red-200'
              : adherenceData.riskAssessment.riskCategory === 'MEDIUM'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Risk Level: {adherenceData.riskAssessment.riskCategory}</span>
              <span className="text-sm font-semibold">
                {Math.round(adherenceData.riskAssessment.riskScore * 100)}%
              </span>
            </div>
            {adherenceData.riskAssessment.riskFactors.length > 0 && (
              <div className="text-xs text-gray-700">
                <div className="font-medium mb-1">Risk Factors:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {adherenceData.riskAssessment.riskFactors.map((factor, idx) => (
                    <li key={idx}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {adherenceData.alerts.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">🚨 Alerts</h4>
          <div className="space-y-2">
            {adherenceData.alerts.map((alert, idx) => (
              <div key={idx} className={`p-3 rounded border ${getPriorityColor(alert.priority)}`}>
                <div className="font-medium text-sm mb-1">{alert.message}</div>
                <div className="text-xs mb-2">
                  <strong>Action:</strong> {alert.action}
                </div>
                {alert.reasoning.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">Reasoning</summary>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 ml-2">
                      {alert.reasoning.map((reason, ridx) => (
                        <li key={ridx}>{reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {adherenceData.recommendations.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">💡 Recommendations</h4>
          <ul className="space-y-2">
            {adherenceData.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Adherence Trend Chart */}
      {adherenceData.historicalData && adherenceData.historicalData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">📊 Adherence History</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            {/* Simple line chart visualization */}
            <div className="flex items-end justify-between h-32 gap-1">
              {adherenceData.historicalData.map((point, idx) => {
                const heightPercentage = point.score * 100;
                const color =
                  point.category === 'GOOD'
                    ? 'bg-green-500'
                    : point.category === 'SUBOPTIMAL'
                    ? 'bg-yellow-500'
                    : 'bg-red-500';

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                      <div
                        className={`w-full ${color} rounded-t transition-all duration-300 hover:opacity-75`}
                        style={{ height: `${heightPercentage}%` }}
                        title={`${new Date(point.date).toLocaleDateString()}: ${Math.round(point.score * 100)}%`}
                      />
                    </div>
                    <div className="text-xs text-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap">
                      {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600">Good (≥90%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-gray-600">Suboptimal (75-89%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-gray-600">Poor (&lt;75%)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
