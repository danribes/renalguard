import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  Activity,
  Heart,
  Brain,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  BarChart3
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface GCUAStats {
  overall: {
    total_assessed: number;
    eligible_count: number;
    accelerated_ager_count: number;
    silent_renal_count: number;
    vascular_dominant_count: number;
    senescent_count: number;
    avg_renal_risk: number;
    avg_cvd_risk: number;
    avg_mortality_risk: number;
  };
  byPhenotype: Array<{
    phenotype_type: string;
    phenotype_name: string;
    phenotype_tag: string;
    patient_count: number;
    avg_renal_risk: number;
    avg_cvd_risk: number;
    avg_mortality_risk: number;
    avg_benefit_ratio: number;
    high_confidence_count: number;
    moderate_confidence_count: number;
    low_confidence_count: number;
  }>;
}

interface HighRiskPatient {
  patient_id: string;
  mrn: string;
  patient_name: string;
  age: number;
  gender: string;
  phenotype_type: string;
  phenotype_name: string;
  phenotype_tag: string;
  phenotype_color: string;
  renal_risk: number;
  cvd_risk: number;
  mortality_risk: number;
  benefit_ratio: number;
  confidence_level: string;
  assessed_at: string;
}

interface MissingUACRPatient {
  patient_id: string;
  mrn: string;
  patient_name: string;
  age: number;
  gender: string;
  current_egfr: number | null;
  has_diabetes: boolean;
  has_hypertension: boolean;
  estimated_risk_without_uacr: string;
  action_required: string;
}

interface GCUADashboardProps {
  onPatientSelect?: (patientId: string) => void;
}

// ============================================
// Utility Functions
// ============================================

function getPhenotypeIcon(type: string) {
  switch (type) {
    case 'I': return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case 'II': return <Activity className="h-5 w-5 text-orange-500" />;
    case 'III': return <Heart className="h-5 w-5 text-yellow-500" />;
    case 'IV': return <Brain className="h-5 w-5 text-gray-500" />;
    case 'Moderate': return <Activity className="h-5 w-5 text-yellow-500" />;
    case 'Low': return <Shield className="h-5 w-5 text-green-500" />;
    default: return <Users className="h-5 w-5 text-gray-400" />;
  }
}

function getPhenotypeColor(color: string) {
  switch (color) {
    case 'red': return 'border-red-300 bg-red-50';
    case 'orange': return 'border-orange-300 bg-orange-50';
    case 'yellow': return 'border-yellow-300 bg-yellow-50';
    case 'gray': return 'border-gray-300 bg-gray-100';
    case 'green': return 'border-green-300 bg-green-50';
    default: return 'border-gray-200 bg-gray-50';
  }
}

function getRiskBadgeColor(risk: number, type: 'renal' | 'cvd' | 'mortality') {
  if (type === 'renal') {
    if (risk >= 25) return 'bg-red-100 text-red-800';
    if (risk >= 15) return 'bg-orange-100 text-orange-800';
    if (risk >= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  } else if (type === 'cvd') {
    if (risk >= 20) return 'bg-red-100 text-red-800';
    if (risk >= 10) return 'bg-orange-100 text-orange-800';
    if (risk >= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  } else {
    if (risk >= 50) return 'bg-gray-200 text-gray-800';
    if (risk >= 30) return 'bg-red-100 text-red-800';
    if (risk >= 15) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  }
}

// ============================================
// Component
// ============================================

export const GCUADashboard: React.FC<GCUADashboardProps> = ({ onPatientSelect }) => {
  const [stats, setStats] = useState<GCUAStats | null>(null);
  const [highRiskPatients, setHighRiskPatients] = useState<HighRiskPatient[]>([]);
  const [missingUACRPatients, setMissingUACRPatients] = useState<MissingUACRPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkCalculating, setBulkCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'high-risk' | 'missing-data'>('overview');
  const [expandedPhenotype, setExpandedPhenotype] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const fetchData = async () => {
    try {
      setLoading(true);

      const [statsRes, highRiskRes, missingRes] = await Promise.all([
        fetch(`${API_URL}/api/gcua/statistics`),
        fetch(`${API_URL}/api/gcua/high-risk`),
        fetch(`${API_URL}/api/gcua/missing-uacr`)
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (highRiskRes.ok) {
        const data = await highRiskRes.json();
        setHighRiskPatients(data.patients || []);
      }

      if (missingRes.ok) {
        const data = await missingRes.json();
        setMissingUACRPatients(data.patients || []);
      }
    } catch (error) {
      console.error('Error fetching GCUA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runBulkCalculation = async () => {
    if (!window.confirm('This will calculate GCUA assessments for all eligible patients (60+ with eGFR > 60). This may take a few minutes. Continue?')) {
      return;
    }

    try {
      setBulkCalculating(true);
      const response = await fetch(`${API_URL}/api/gcua/bulk-calculate`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        alert(`GCUA Bulk Calculation Complete!\n\nTotal Patients: ${data.results.total}\nCalculated: ${data.results.calculated}\nEligible: ${data.results.eligible}\nIneligible: ${data.results.ineligible}\nErrors: ${data.results.errors}`);
        await fetchData();
      }
    } catch (error) {
      console.error('Error running bulk calculation:', error);
      alert('Error running bulk calculation. Please try again.');
    } finally {
      setBulkCalculating(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">GCUA Population Dashboard</h2>
              <p className="text-purple-200 text-sm">Geriatric Cardiorenal Unified Assessment - Silent Hunter</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="h-5 w-5 text-white" />
            </button>
            <button
              onClick={runBulkCalculation}
              disabled={bulkCalculating}
              className="px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              {bulkCalculating ? 'Calculating...' : 'Run Bulk Assessment'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('high-risk')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'high-risk'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            High-Risk Patients ({highRiskPatients.length})
          </button>
          <button
            onClick={() => setActiveTab('missing-data')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'missing-data'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search className="h-4 w-4 inline mr-2" />
            Missing uACR ({missingUACRPatients.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Accelerated Agers</span>
                </div>
                <div className="text-3xl font-bold text-red-800">{stats.overall.accelerated_ager_count}</div>
                <p className="text-xs text-red-600 mt-1">High Priority - Immediate Action</p>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                <div className="flex items-center gap-2 text-orange-700 mb-2">
                  <Activity className="h-5 w-5" />
                  <span className="font-medium">Silent Renal</span>
                </div>
                <div className="text-3xl font-bold text-orange-800">{stats.overall.silent_renal_count}</div>
                <p className="text-xs text-orange-600 mt-1">Often Missed by Framingham</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-700 mb-2">
                  <Heart className="h-5 w-5" />
                  <span className="font-medium">Vascular Dominant</span>
                </div>
                <div className="text-3xl font-bold text-yellow-800">{stats.overall.vascular_dominant_count}</div>
                <p className="text-xs text-yellow-600 mt-1">Standard CVD Prevention</p>
              </div>

              <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-4 border border-gray-300">
                <div className="flex items-center gap-2 text-gray-700 mb-2">
                  <Brain className="h-5 w-5" />
                  <span className="font-medium">Senescent</span>
                </div>
                <div className="text-3xl font-bold text-gray-800">{stats.overall.senescent_count}</div>
                <p className="text-xs text-gray-600 mt-1">Conservative Management</p>
              </div>
            </div>

            {/* Average Risks */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Population Average Risks</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.overall.avg_renal_risk}%</div>
                  <div className="text-xs text-gray-500">5-Year Renal Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.overall.avg_cvd_risk}%</div>
                  <div className="text-xs text-gray-500">10-Year CVD Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{stats.overall.avg_mortality_risk}%</div>
                  <div className="text-xs text-gray-500">5-Year Mortality</div>
                </div>
              </div>
            </div>

            {/* Phenotype Details */}
            {stats.byPhenotype && stats.byPhenotype.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Phenotype Details</h3>
                <div className="space-y-2">
                  {stats.byPhenotype.map((phenotype) => (
                    <div
                      key={phenotype.phenotype_type}
                      className="bg-white border rounded-lg overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedPhenotype(
                          expandedPhenotype === phenotype.phenotype_type ? null : phenotype.phenotype_type
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {getPhenotypeIcon(phenotype.phenotype_type)}
                          <div>
                            <span className="font-medium text-gray-900">
                              Phenotype {phenotype.phenotype_type}: {phenotype.phenotype_name}
                            </span>
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {phenotype.phenotype_tag}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-gray-700">{phenotype.patient_count} patients</span>
                          {expandedPhenotype === phenotype.phenotype_type ? (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      {expandedPhenotype === phenotype.phenotype_type && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Avg Renal Risk:</span>
                              <span className="ml-2 font-medium">{phenotype.avg_renal_risk}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Avg CVD Risk:</span>
                              <span className="ml-2 font-medium">{phenotype.avg_cvd_risk}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Avg Mortality:</span>
                              <span className="ml-2 font-medium">{phenotype.avg_mortality_risk}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Avg Benefit Ratio:</span>
                              <span className="ml-2 font-medium">{phenotype.avg_benefit_ratio}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Confidence: High ({phenotype.high_confidence_count}) | Moderate ({phenotype.moderate_confidence_count}) | Low ({phenotype.low_confidence_count})
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* High-Risk Patients Tab */}
        {activeTab === 'high-risk' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Patients classified as Phenotype I (Accelerated Ager) or Phenotype II (Silent Renal) - these patients are at highest risk and most likely to benefit from intervention.
            </p>
            {highRiskPatients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No high-risk patients found. Run bulk assessment to identify patients.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phenotype</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Renal Risk</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">CVD Risk</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mortality</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Benefit Ratio</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Assessed</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {highRiskPatients.map((patient) => (
                      <tr
                        key={patient.patient_id}
                        className={`hover:bg-gray-50 cursor-pointer ${getPhenotypeColor(patient.phenotype_color)}`}
                        onClick={() => onPatientSelect?.(patient.patient_id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{patient.patient_name}</div>
                          <div className="text-xs text-gray-500">{patient.mrn} | {patient.age}y {patient.gender}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getPhenotypeIcon(patient.phenotype_type)}
                            <div>
                              <div className="text-sm font-medium">{patient.phenotype_name}</div>
                              <div className="text-xs text-gray-500">{patient.phenotype_tag}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskBadgeColor(patient.renal_risk, 'renal')}`}>
                            {patient.renal_risk}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskBadgeColor(patient.cvd_risk, 'cvd')}`}>
                            {patient.cvd_risk}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskBadgeColor(patient.mortality_risk, 'mortality')}`}>
                            {patient.mortality_risk}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium">{patient.benefit_ratio}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {new Date(patient.assessed_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Missing uACR Tab */}
        {activeTab === 'missing-data' && (
          <div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Search className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-800">Silent Hunter: Data Audit</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    These patients are 60+ years old and eligible for GCUA assessment, but are missing uACR (albumin-to-creatinine ratio) data.
                    Ordering a uACR test will unlock their full cardiorenal risk profile and may reveal "Silent Renal" phenotypes that Framingham would miss.
                  </p>
                </div>
              </div>
            </div>

            {missingUACRPatients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>All eligible patients have uACR data. Great job!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">eGFR</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Diabetes</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hypertension</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estimated Risk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {missingUACRPatients.map((patient) => (
                      <tr
                        key={patient.patient_id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => onPatientSelect?.(patient.patient_id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{patient.patient_name}</div>
                          <div className="text-xs text-gray-500">{patient.mrn} | {patient.age}y {patient.gender}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {patient.current_egfr ? (
                            <span className="font-medium">{patient.current_egfr}</span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {patient.has_diabetes ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {patient.has_hypertension ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            patient.estimated_risk_without_uacr === 'Very High' ? 'bg-red-100 text-red-700' :
                            patient.estimated_risk_without_uacr === 'High' ? 'bg-orange-100 text-orange-700' :
                            patient.estimated_risk_without_uacr === 'Elevated' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {patient.estimated_risk_without_uacr}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-600">
                          Order uACR
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GCUADashboard;
