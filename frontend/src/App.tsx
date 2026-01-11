import { useState, useEffect } from 'react';
import PatientFilters from './components/PatientFilters';
import { DoctorChatBar } from './components/DoctorChatBar';
import { PatientTrendGraphs } from './components/PatientTrendGraphs';
import { AdherenceCard, AdherenceData } from './components/AdherenceCard';
import { GCUARiskCard, GCUAAssessmentData } from './components/GCUARiskCard';
import DoctorAssignmentInterface from './components/DoctorAssignmentInterface';
import { LandingPage } from './components/LandingPage';

interface KDIGOClassification {
  gfr_category: string;
  gfr_description: string;
  albuminuria_category: string;
  albuminuria_description: string;
  health_state: string;
  risk_level: string;
  risk_color: string;
  has_ckd: boolean;
  ckd_stage: number | null;
  ckd_stage_name: string;
  requires_nephrology_referral: boolean;
  requires_dialysis_planning: boolean;
  recommend_ras_inhibitor: boolean;
  recommend_sglt2i: boolean;
  target_bp: string;
  monitoring_frequency: string;
  // SCORED assessment (for non-CKD patients)
  scored_points?: number;
  scored_risk_level?: 'low' | 'high';
  // Framingham assessment (for non-CKD patients)
  framingham_risk_percentage?: number;
  framingham_risk_level?: 'low' | 'moderate' | 'high';
}

interface Patient {
  id: string;
  medical_record_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  email?: string;
  phone?: string;
  last_visit_date?: string;
  created_at: string;
  kdigo_classification?: KDIGOClassification;
  risk_category?: string;
  non_ckd_risk_level?: 'low' | 'moderate' | 'high';  // Risk level from non_ckd_patient_data table
  // New tracking data from separate tables
  is_monitored?: boolean;
  monitoring_device?: string | null;
  is_treated?: boolean;
  // Legacy fields (for backward compatibility)
  home_monitoring_device?: string | null;
  home_monitoring_active?: boolean;
  ckd_treatment_active?: boolean;
  ckd_treatment_type?: string | null;
  evolution_summary?: string;
  // Latest comment for patient list
  latest_comment?: {
    summary: string;
    change_type: string;
    severity: string;
    date: string;
    cycle: number;
    clinical_summary?: string;
    recommended_actions?: string[];
  } | null;
}

interface Observation {
  observation_type: string;
  value_numeric?: number;
  value_text?: string;
  unit?: string;
  observation_date: string;
  notes?: string;
  month_number?: number;
}

interface Condition {
  condition_code: string;
  condition_name: string;
  clinical_status: string;
  onset_date?: string;
  severity?: string;
  notes?: string;
}

interface RiskAssessment {
  risk_score: number;
  risk_level: string;
  recommendations: string[];
  reasoning: string;
  assessed_at: string;
}

interface HealthStateComment {
  id: string;
  patient_id: string;
  comment_text: string;
  comment_type: string;
  health_state_from: string | null;
  health_state_to: string | null;
  risk_level_from: string | null;
  risk_level_to: string | null;
  change_type: string | null;
  is_ckd_patient: boolean;
  severity_from: string | null;
  severity_to: string | null;
  cycle_number: number;
  egfr_from: number | null;
  egfr_to: number | null;
  egfr_change: number | null;
  uacr_from: number | null;
  uacr_to: number | null;
  uacr_change: number | null;
  clinical_summary: string | null;
  recommended_actions: string[] | null;
  mitigation_measures: string[] | null;
  acknowledgment_text: string | null;
  severity: string;
  created_at: string;
  visibility: string;
  is_pinned: boolean;
  is_read: boolean;
}

interface PatientDetail extends Patient {
  weight?: number;
  height?: number;
  smoking_status?: string;
  cvd_history?: boolean;
  family_history_esrd?: boolean;
  on_ras_inhibitor?: boolean;
  on_sglt2i?: boolean;
  nephrotoxic_meds?: boolean;
  nephrologist_referral?: boolean;
  diagnosis_date?: string;
  next_visit_date?: string;
  observations: Observation[];
  conditions: Condition[];
  risk_assessment?: RiskAssessment | null;
  kdigo_classification: KDIGOClassification;
  risk_category: string;
  home_monitoring_device?: string | null;
  home_monitoring_active?: boolean;
  ckd_treatment_active?: boolean;
  ckd_treatment_type?: string | null;
  // Comprehensive variables
  systolic_bp?: number;
  diastolic_bp?: number;
  bp_control_status?: string;
  heart_rate?: number;
  oxygen_saturation?: number;
  bmi?: number;
  // Comorbidities
  has_diabetes?: boolean;
  has_type1_diabetes?: boolean;
  has_type2_diabetes?: boolean;
  has_hypertension?: boolean;
  has_essential_hypertension?: boolean;
  has_renovascular_hypertension?: boolean;
  has_hypertensive_ckd?: boolean;
  has_heart_failure?: boolean;
  has_cad?: boolean;
  has_mi?: boolean;
  has_atrial_fibrillation?: boolean;
  has_stroke?: boolean;
  has_peripheral_vascular_disease?: boolean;
  has_aki_history?: boolean;
  has_lupus?: boolean;
  has_ra?: boolean;
  has_obesity?: boolean;
  has_metabolic_syndrome?: boolean;
  has_hyperlipidemia?: boolean;
  has_uti?: boolean;
  has_kidney_stones?: boolean;
  has_gout?: boolean;
  has_polycystic_kidney_disease?: boolean;
  resistant_hypertension?: boolean;
  antihypertensive_count?: number;
  // Clinical symptoms
  appetite?: string;
  pedal_edema?: boolean;
  anemia?: boolean;
  chronic_nsaid_use_months?: number;
  chronic_ppi_use_months?: number;
  diabetes_duration_years?: number;
  previous_aki_episodes?: number;
  // Monitoring
  monitoring_status?: string;
  current_risk_score?: number;
}

function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
  const [adherenceData, setAdherenceData] = useState<AdherenceData | null>(null);
  const [loadingAdherence, setLoadingAdherence] = useState(false);
  const [gcuaAssessment, setGcuaAssessment] = useState<GCUAAssessmentData | null>(null);
  const [loadingGCUA, setLoadingGCUA] = useState(false);
  const [gcuaEligible, setGcuaEligible] = useState<boolean | null>(null);
  const [gcuaError, setGcuaError] = useState<string | null>(null);
  const [gcuaEligibilityReason, setGcuaEligibilityReason] = useState<string | null>(null);
  const [healthStateComments, setHealthStateComments] = useState<HealthStateComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [populating, setPopulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingPatient, setUpdatingPatient] = useState(false);
  const [resettingPatient, setResettingPatient] = useState(false);

  // Doctor Assistant Chat states for patient detail view
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Filter states
  const [activeFilters, setActiveFilters] = useState<{
    patientType: 'all' | 'ckd' | 'non-ckd' | 'health-state-changed';
    ckdSeverity: string | null;
    ckdTreatment: string | null;
    nonCkdRisk: string | null;
    nonCkdMonitoring: string | null;
    healthStateChangeDays: number;
    healthStateChangeType: 'any' | 'improved' | 'worsened';
  }>({
    patientType: 'all',
    ckdSeverity: null,
    ckdTreatment: null,
    nonCkdRisk: null,
    nonCkdMonitoring: null,
    healthStateChangeDays: 30,
    healthStateChangeType: 'any'
  });

  const [statistics, setStatistics] = useState<any>(null);
  const [showDoctorAssignment, setShowDoctorAssignment] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchPatients();
    fetchStatistics();
  }, []);

  // Fetch patients when filters change
  useEffect(() => {
    if (activeFilters.patientType !== 'all' || activeFilters.ckdSeverity || activeFilters.nonCkdRisk) {
      fetchFilteredPatients();
    }
  }, [activeFilters]);

  // Clear chat messages when patient changes
  useEffect(() => {
    setChatMessages([]);
    setChatInput('');
  }, [selectedPatient?.id]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/patients`);

      if (!response.ok) {
        throw new Error(`Failed to fetch patients: ${response.status}`);
      }

      const data = await response.json();
      setPatients(data.patients || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients');
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_URL}/api/patients/statistics`);

      if (!response.ok) {
        throw new Error(`Failed to fetch statistics: ${response.status}`);
      }

      const data = await response.json();
      setStatistics(data.statistics);

    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  const fetchFilteredPatients = async () => {
    try {
      setLoading(true);
      setError(null);

      // Special handling for health state change filter
      if (activeFilters.patientType === 'health-state-changed') {
        const params = new URLSearchParams();
        params.append('days', activeFilters.healthStateChangeDays.toString());
        params.append('change_type', activeFilters.healthStateChangeType);

        const url = `${API_URL}/api/patients/with-health-state-changes?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch patients with health state changes: ${response.status}`);
        }

        const data = await response.json();
        setPatients(data.patients || []);
        setLoading(false);
        return;
      }

      // Build query parameters based on active filters
      const params = new URLSearchParams();

      if (activeFilters.patientType === 'ckd') {
        params.append('has_ckd', 'true');

        if (activeFilters.ckdSeverity) {
          params.append('severity', activeFilters.ckdSeverity);
        }

        if (activeFilters.ckdTreatment) {
          params.append('is_treated', activeFilters.ckdTreatment === 'treated' ? 'true' : 'false');
        }
      } else if (activeFilters.patientType === 'non-ckd') {
        params.append('has_ckd', 'false');

        if (activeFilters.nonCkdRisk) {
          params.append('risk_level', activeFilters.nonCkdRisk);
        }

        if (activeFilters.nonCkdMonitoring) {
          params.append('is_monitored', activeFilters.nonCkdMonitoring === 'monitored' ? 'true' : 'false');
        }
      }

      const url = `${API_URL}/api/patients/filter?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch filtered patients: ${response.status}`);
      }

      const data = await response.json();
      setPatients(data.patients || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load filtered patients');
      console.error('Error fetching filtered patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: any) => {
    setActiveFilters(newFilters);

    // If resetting to all patients, fetch all
    if (newFilters.patientType === 'all' && !newFilters.ckdSeverity && !newFilters.nonCkdRisk) {
      fetchPatients();
    }
  };

  const handleResetAll = async () => {
    if (!window.confirm('⚠️ WARNING: This will reset ALL patients to their original baseline state, removing all updates and comments. Are you sure you want to continue?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/patients/reset-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reset all patients');
      }

      const result = await response.json();
      console.log('[Reset All] Success:', result);

      // Show success message
      alert(`✅ Success!\n\nAll patients have been reset to their original baseline.\n\nDeleted:\n- ${result.deleted_observations} generated observations\n- ${result.deleted_comments} comments\n\nYou can now simulate patient evolution from scratch.`);

      // Refresh the patient list and statistics
      await fetchPatients();
      await fetchStatistics();

      // Reset to "All Patients" filter
      setActiveFilters({
        patientType: 'all',
        ckdSeverity: null,
        ckdTreatment: null,
        nonCkdRisk: null,
        nonCkdMonitoring: null,
        healthStateChangeDays: 30,
        healthStateChangeType: 'any'
      });

    } catch (error) {
      console.error('Error resetting all patients:', error);
      alert('❌ Error: Failed to reset all patients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientDetail = async (patientId: string) => {
    try {
      setLoadingDetail(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/patients/${patientId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch patient details: ${response.status}`);
      }

      const data = await response.json();

      // Log the response for debugging
      console.log('[FETCH_DETAIL] Patient detail response:', data);
      console.log('[FETCH_DETAIL] Has kdigo_classification:', !!data.patient?.kdigo_classification);
      console.log('[FETCH_DETAIL] Has risk_category:', !!data.patient?.risk_category);
      console.log('[FETCH_DETAIL] Risk category value:', data.patient?.risk_category);

      // Ensure required fields are present
      if (!data.patient) {
        console.error('[FETCH_DETAIL] No patient data in response');
        throw new Error('No patient data received from server');
      }

      if (!data.patient.kdigo_classification) {
        console.error('[FETCH_DETAIL] Missing kdigo_classification in patient data');
        throw new Error('Patient data is missing KDIGO classification');
      }

      if (!data.patient.risk_category) {
        console.error('[FETCH_DETAIL] Missing risk_category in patient data');
        console.error('[FETCH_DETAIL] Full patient object:', data.patient);
        throw new Error('Patient data is missing risk category');
      }

      if (!data.patient.observations) {
        console.warn('Missing observations in patient data');
        data.patient.observations = [];
      }

      if (!data.patient.conditions) {
        console.warn('Missing conditions in patient data');
        data.patient.conditions = [];
      }

      // Validate critical demographic fields
      if (!data.patient.date_of_birth) {
        console.warn('[FETCH_DETAIL] Missing date_of_birth, setting default');
        data.patient.date_of_birth = '1970-01-01';
      }

      // Validate observations have valid dates
      if (data.patient.observations && data.patient.observations.length > 0) {
        data.patient.observations = data.patient.observations.filter((obs: any) => {
          if (!obs.observation_date) {
            console.warn('[FETCH_DETAIL] Observation missing date, filtering out:', obs);
            return false;
          }
          const date = new Date(obs.observation_date);
          if (isNaN(date.getTime())) {
            console.warn('[FETCH_DETAIL] Observation has invalid date, filtering out:', obs);
            return false;
          }
          return true;
        });
      }

      setSelectedPatient(data.patient);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load patient details';
      setError(errorMessage);
      console.error('[FETCH_DETAIL] Error fetching patient details:', err);
      // Don't clear selectedPatient here - keep showing old data with error message
      // This prevents the UI from getting into an invalid state
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchHealthStateComments = async (patientId: string) => {
    try {
      setLoadingComments(true);

      const response = await fetch(`${API_URL}/api/patients/${patientId}/comments?limit=50`);

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'success' && data.comments) {
        setHealthStateComments(data.comments);
        console.log(`[FETCH_COMMENTS] Loaded ${data.comments.length} comments for patient`);
      } else {
        setHealthStateComments([]);
      }

    } catch (err) {
      console.error('[FETCH_COMMENTS] Error fetching health state comments:', err);
      setHealthStateComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const fetchAdherenceData = async (patientId: string) => {
    try {
      setLoadingAdherence(true);

      const response = await fetch(`${API_URL}/api/patients/${patientId}/adherence`);

      if (!response.ok) {
        // If adherence endpoint returns 404 or 500, patient may not have treatment data
        if (response.status === 404 || response.status === 500) {
          console.log(`[FETCH_ADHERENCE] No adherence data available for patient`);
          setAdherenceData(null);
          return;
        }
        throw new Error(`Failed to fetch adherence data: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'success' && data.adherence) {
        setAdherenceData(data.adherence);
        console.log(`[FETCH_ADHERENCE] Loaded adherence data for patient`);
      } else {
        setAdherenceData(null);
      }

    } catch (err) {
      console.error('[FETCH_ADHERENCE] Error fetching adherence data:', err);
      setAdherenceData(null);
    } finally {
      setLoadingAdherence(false);
    }
  };

  const fetchGCUAAssessment = async (patientId: string) => {
    try {
      setLoadingGCUA(true);
      setGcuaAssessment(null);
      setGcuaEligible(null);
      setGcuaError(null);
      setGcuaEligibilityReason(null);

      const response = await fetch(`${API_URL}/api/gcua/assessment/${patientId}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[FETCH_GCUA] No GCUA data available for patient');
          // 404 means patient missing required data - set error
          const errorData = await response.json().catch(() => ({}));
          setGcuaError(errorData.message || 'Patient missing required data (age, eGFR) for GCUA assessment');
          setGcuaEligible(false);
          return;
        }
        throw new Error(`Failed to fetch GCUA assessment: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'success') {
        if (data.isEligible === false) {
          setGcuaEligible(false);
          setGcuaEligibilityReason(data.reason || null);
          console.log('[FETCH_GCUA] Patient not eligible for GCUA:', data.reason);
          return;
        }

        if (data.assessment) {
          setGcuaAssessment(data.assessment);
          setGcuaEligible(true);
          console.log('[FETCH_GCUA] Loaded GCUA assessment:', data.assessment.phenotype?.name);
        } else {
          // No assessment yet but patient is eligible
          setGcuaEligible(true);
          console.log('[FETCH_GCUA] Patient eligible but no assessment yet');
        }
      }

    } catch (err) {
      console.error('[FETCH_GCUA] Error fetching GCUA assessment:', err);
      setGcuaAssessment(null);
      setGcuaError(err instanceof Error ? err.message : 'Failed to fetch GCUA assessment');
    } finally {
      setLoadingGCUA(false);
    }
  };

  const calculateGCUA = async () => {
    if (!selectedPatient) return;

    try {
      setLoadingGCUA(true);
      setGcuaError(null);

      const response = await fetch(`${API_URL}/api/gcua/calculate/${selectedPatient.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Try to get error message from response
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Failed to calculate GCUA: ${response.status}`;
        setGcuaError(errorMessage);
        console.error('[CALC_GCUA] API Error:', errorMessage);
        return;
      }

      const data = await response.json();

      if (data.status === 'success' && data.assessment) {
        if (data.assessment.isEligible) {
          setGcuaAssessment(data.assessment);
          setGcuaEligible(true);
          setGcuaEligibilityReason(null);
          setGcuaError(null);
          console.log('[CALC_GCUA] Calculated GCUA:', data.assessment.phenotype?.name);
        } else {
          setGcuaEligible(false);
          setGcuaEligibilityReason(data.assessment.eligibilityReason || null);
          setGcuaAssessment(null);
          console.log('[CALC_GCUA] Patient not eligible:', data.assessment.eligibilityReason);
        }
      } else if (data.status === 'error') {
        setGcuaError(data.message || 'Failed to calculate GCUA assessment');
      }

    } catch (err) {
      console.error('[CALC_GCUA] Error calculating GCUA:', err);
      setGcuaError(err instanceof Error ? err.message : 'Failed to calculate GCUA assessment. Please check if the backend is running.');
    } finally {
      setLoadingGCUA(false);
    }
  };

  const handlePatientClick = async (patientId: string) => {
    await fetchPatientDetail(patientId);
    await fetchHealthStateComments(patientId);
    await fetchAdherenceData(patientId);
    await fetchGCUAAssessment(patientId);
  };

  const updatePatientRecords = async () => {
    if (!selectedPatient) return;

    try {
      setUpdatingPatient(true);
      setError(null);

      console.log('[UPDATE] Starting patient records update for:', selectedPatient.id);

      const response = await fetch(`${API_URL}/api/patients/${selectedPatient.id}/update-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to update patient records: ${response.status}`);
      }

      const data = await response.json();
      console.log('[UPDATE] Update response:', data);

      // Refresh patient details to show new data
      console.log('[UPDATE] Fetching updated patient details...');
      await fetchPatientDetail(selectedPatient.id);
      console.log('[UPDATE] Patient details refreshed successfully');

      // Refresh health state comments to show any new comments (including AI analysis)
      console.log('[UPDATE] Refreshing comments to show AI analysis...');
      await fetchHealthStateComments(selectedPatient.id);

      // Refresh adherence data to reflect new lab trends
      console.log('[UPDATE] Refreshing adherence data...');
      await fetchAdherenceData(selectedPatient.id);

      // Refresh GCUA assessment to reflect updated risk
      console.log('[UPDATE] Refreshing GCUA assessment...');
      await fetchGCUAAssessment(selectedPatient.id);

      // Refresh patient list to show updated risk level in main list
      console.log('[UPDATE] Refreshing patient list...');
      if (activeFilters.patientType !== 'all' || activeFilters.ckdSeverity || activeFilters.nonCkdRisk) {
        await fetchFilteredPatients();
      } else {
        await fetchPatients();
      }
      console.log('[UPDATE] Patient list refreshed successfully');

      // Show success message
      const stateChangeMessage = data.health_state_changed
        ? ` Health state changed: ${data.previous_health_state} → ${data.new_health_state}.`
        : '';
      const aiAnalysisMessage = data.ai_comment_id
        ? ' AI analysis generated - check Health State Evolution below!'
        : '';
      alert(`Successfully generated cycle ${data.cycle_number} for patient. ${data.treatment_status === 'treated' ? 'Treatment improvements reflected.' : 'Natural progression simulated.'}${stateChangeMessage}${aiAnalysisMessage}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update patient records');
      console.error('[UPDATE] Error updating patient records:', err);
      alert('Failed to update patient records. Please try again.');
    } finally {
      setUpdatingPatient(false);
      console.log('[UPDATE] Update process completed');
    }
  };

  const resetPatientRecords = async () => {
    if (!selectedPatient) return;

    // Confirm before resetting
    const confirmed = window.confirm(
      'Are you sure you want to reset this patient\'s records? This will remove all generated data and keep only the original data.'
    );

    if (!confirmed) return;

    try {
      setResettingPatient(true);
      setError(null);

      console.log('[RESET] Starting patient records reset for:', selectedPatient.id);

      const response = await fetch(`${API_URL}/api/patients/${selectedPatient.id}/reset-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to reset patient records: ${response.status}`);
      }

      const data = await response.json();
      console.log('[RESET] Reset response:', data);

      // Refresh patient details to show reset data
      console.log('[RESET] Fetching reset patient details...');
      await fetchPatientDetail(selectedPatient.id);
      console.log('[RESET] Patient details refreshed successfully');

      // Refresh health state comments (should be empty after reset)
      console.log('[RESET] Refreshing comments...');
      await fetchHealthStateComments(selectedPatient.id);

      // Refresh patient list
      console.log('[RESET] Refreshing patient list...');
      if (activeFilters.patientType !== 'all' || activeFilters.ckdSeverity || activeFilters.nonCkdRisk) {
        await fetchFilteredPatients();
      } else {
        await fetchPatients();
      }
      console.log('[RESET] Patient list refreshed successfully');

      // Show success message
      alert(`Successfully reset patient records. Deleted ${data.deleted_observations} generated observations and ${data.deleted_comments} health state comments.`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset patient records');
      console.error('[RESET] Error resetting patient records:', err);
      alert('Failed to reset patient records. Please try again.');
    } finally {
      setResettingPatient(false);
      console.log('[RESET] Reset process completed');
    }
  };

  const populateDatabase = async () => {
    try {
      setPopulating(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/init/populate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to populate database: ${response.status}`);
      }

      const data = await response.json();
      console.log('Database populated:', data);

      // Refresh patient list
      await fetchPatients();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to populate database');
      console.error('Error populating database:', err);
    } finally {
      setPopulating(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !selectedPatient) return;

    const userMessage = {
      role: 'user' as const,
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    let response: Response | null = null;

    try {
      response = await fetch(`${API_URL}/api/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          patientId: selectedPatient.id,
          includeRecentLabs: true,
          includeRiskAssessment: true,
        }),
      });

      if (!response.ok) {
        // Try to get error details from response
        const errorData = await response.json().catch(() => null);

        // Throw error with response data
        const error: any = new Error(`API error: ${response.status}`);
        error.response = response;
        error.data = errorData;
        throw error;
      }

      const data = await response.json();

      const assistantMessage = {
        role: 'assistant' as const,
        content: data.response,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error sending chat message:', error);

      // Provide user-friendly error messages
      let errorContent = 'Sorry, I encountered an error processing your request.';

      // Check if backend provided a suggested action
      if (error.data?.suggestedAction) {
        errorContent = `⚠️ ${error.data.suggestedAction}`;
      } else if (error.data?.retryable) {
        errorContent = '⚠️ The AI service is temporarily overloaded. Our system tried multiple times but couldn\'t get through. Please try again in a minute.';
      } else if (error.response?.status === 500) {
        errorContent = '⚠️ The AI service is temporarily overloaded. Please try again in a moment.';
      } else if (error.response?.status === 429) {
        errorContent = '⏳ Rate limit reached. Please wait a moment before trying again.';
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        errorContent = '🔒 Authentication error. Please contact support.';
      }

      const errorMessage = {
        role: 'assistant' as const,
        content: errorContent,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const calculateAge = (dateOfBirth?: string): number => {
    if (!dateOfBirth) return 0;
    const birthDate = new Date(dateOfBirth);

    // Check if date is valid
    if (isNaN(birthDate.getTime())) return 0;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const calculateBMI = (weight?: number, height?: number): number | null => {
    if (!weight || !height) return null;
    const heightInMeters = height / 100;
    return weight / (heightInMeters * heightInMeters);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getObservationValue = (observations: Observation[], type: string): Observation | undefined => {
    return observations.find(obs => obs.observation_type === type);
  };

  const getSeverityColor = (severity?: string): string => {
    switch (severity?.toLowerCase()) {
      case 'severe': return 'text-red-700 bg-red-100 border-red-300';
      case 'moderate': return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      case 'mild': return 'text-green-700 bg-green-100 border-green-300';
      default: return 'text-gray-700 bg-gray-100 border-gray-300';
    }
  };

  const getRiskColor = (risk_level?: string): string => {
    switch (risk_level?.toLowerCase()) {
      case 'high': return 'text-red-700 bg-red-100 border-red-300';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-300';
      case 'low': return 'text-green-700 bg-green-100 border-green-300';
      default: return 'text-gray-700 bg-gray-100 border-gray-300';
    }
  };

  // Helper function to get color coding for lab values based on clinical ranges
  const getLabValueColor = (type: string, value: number): string => {
    switch (type) {
      case 'eGFR':
        if (value < 30) return 'text-red-600'; // Stage 4-5 CKD
        if (value < 60) return 'text-orange-600'; // Stage 3 CKD
        if (value < 90) return 'text-yellow-600'; // Stage 2 CKD or mildly decreased
        return 'text-green-600'; // Normal
      case 'serum_creatinine':
        if (value > 2.0) return 'text-red-600'; // Severely elevated
        if (value > 1.3) return 'text-orange-600'; // Elevated
        if (value > 1.0) return 'text-yellow-600'; // Mildly elevated
        return 'text-green-600'; // Normal
      case 'uACR':
        if (value >= 300) return 'text-red-600'; // A3 - Severely increased
        if (value >= 30) return 'text-orange-600'; // A2 - Moderately increased
        return 'text-green-600'; // A1 - Normal
      case 'BUN':
        if (value > 40) return 'text-red-600'; // Elevated
        if (value > 20) return 'text-yellow-600'; // High normal
        return 'text-green-600'; // Normal
      case 'potassium':
        if (value > 5.5 || value < 3.5) return 'text-red-600'; // Dangerous
        if (value > 5.0 || value < 3.8) return 'text-yellow-600'; // Borderline
        return 'text-green-600'; // Normal
      case 'HbA1c':
        if (value >= 9.0) return 'text-red-600'; // Poor control
        if (value >= 7.0) return 'text-orange-600'; // Suboptimal
        if (value >= 6.5) return 'text-yellow-600'; // Target for most diabetics
        return 'text-green-600'; // Normal/Good control
      case 'hemoglobin':
        if (value < 10) return 'text-red-600'; // Anemia
        if (value < 12) return 'text-yellow-600'; // Low
        return 'text-green-600'; // Normal
      case 'blood_pressure_systolic':
        if (value >= 140) return 'text-red-600'; // Stage 2 HTN
        if (value >= 130) return 'text-orange-600'; // Stage 1 HTN
        if (value >= 120) return 'text-yellow-600'; // Elevated
        return 'text-green-600'; // Normal
      default:
        return 'text-gray-900'; // Default
    }
  };

  // Helper function to get trend icon
  const getTrendIcon = (trend?: string) => {
    if (!trend) return null;

    switch (trend.toLowerCase()) {
      case 'up':
      case 'increasing':
        return (
          <svg className="h-4 w-4 text-red-600 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        );
      case 'down':
      case 'decreasing':
      case 'declining':
        return (
          <svg className="h-4 w-4 text-red-600 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        );
      case 'stable':
        return (
          <svg className="h-4 w-4 text-green-600 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getKDIGORiskColorClass = (riskColor: string): string => {
    switch (riskColor) {
      case 'red': return 'bg-red-100 text-red-800 border-red-300';
      case 'orange': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'green': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRiskCategoryBadgeColor = (category?: string): string => {
    if (!category) return 'bg-gray-100 text-gray-700';

    // NEW NOMENCLATURE: CKD Patients - Severity-based classification
    if (category.includes('CKD') || category.includes('Kidney Failure')) {
      if (category === 'Kidney Failure') return 'bg-red-600 text-white border-2 border-red-700';
      if (category === 'Severe CKD') return 'bg-orange-600 text-white border-2 border-orange-700';
      if (category === 'Moderate CKD') return 'bg-yellow-600 text-white border-2 border-yellow-700';
      if (category === 'Mild CKD') return 'bg-green-600 text-white border-2 border-green-700';

      // Legacy support for old nomenclature
      if (category.includes('Very High')) return 'bg-red-600 text-white';
      if (category.includes('High')) return 'bg-orange-500 text-white';
      if (category.includes('Moderate')) return 'bg-yellow-500 text-white';
      return 'bg-green-500 text-white';
    }

    // Non-CKD Patients - Blue/Purple/Pink color scheme for distinction
    if (category === 'Low Risk') return 'bg-blue-500 text-white border-2 border-blue-600';
    if (category === 'Moderate Risk') return 'bg-purple-500 text-white border-2 border-purple-600';
    if (category === 'High Risk') return 'bg-pink-600 text-white border-2 border-pink-700';

    return 'bg-gray-100 text-gray-700';
  };

  // Helper function to check if any filters are active
  const hasActiveFilters = () => {
    return (
      activeFilters.patientType !== 'all' ||
      activeFilters.ckdSeverity !== null ||
      activeFilters.ckdTreatment !== null ||
      activeFilters.nonCkdRisk !== null ||
      activeFilters.nonCkdMonitoring !== null
    );
  };

  // Function to clear all filters and return to main view
  const clearAllFilters = () => {
    const defaultFilters = {
      patientType: 'all' as const,
      ckdSeverity: null,
      ckdTreatment: null,
      nonCkdRisk: null,
      nonCkdMonitoring: null,
      healthStateChangeDays: 30,
      healthStateChangeType: 'any' as const
    };
    setActiveFilters(defaultFilters);
    fetchPatients();
  };

  // Filter patients based on search query
  const filteredPatients = patients.filter((patient) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    const mrn = patient.medical_record_number.toLowerCase();
    const email = patient.email?.toLowerCase() || '';
    const id = patient.id.toLowerCase();

    return (
      fullName.includes(query) ||
      mrn.includes(query) ||
      email.includes(query) ||
      id.includes(query)
    );
  });

  // If a patient is selected, show the detail view
  if (selectedPatient) {
    const bmi = calculateBMI(selectedPatient.weight, selectedPatient.height);
    const age = calculateAge(selectedPatient.date_of_birth);

    // Check if required data is loaded with comprehensive validation
    const hasValidKdigoClassification = selectedPatient.kdigo_classification &&
      typeof selectedPatient.kdigo_classification === 'object' &&
      'has_ckd' in selectedPatient.kdigo_classification &&
      'gfr_category' in selectedPatient.kdigo_classification &&
      'albuminuria_category' in selectedPatient.kdigo_classification;

    const hasRequiredData = hasValidKdigoClassification && selectedPatient.risk_category;

    // Debug logging
    console.log('[RENDER] Patient detail view rendering');
    console.log('[RENDER] loadingDetail:', loadingDetail);
    console.log('[RENDER] error:', error);
    console.log('[RENDER] hasRequiredData:', hasRequiredData);
    console.log('[RENDER] hasValidKdigoClassification:', hasValidKdigoClassification);
    console.log('[RENDER] kdigo_classification:', selectedPatient.kdigo_classification);
    console.log('[RENDER] risk_category:', selectedPatient.risk_category);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header with Back Button and Update Button */}
          <div className="max-w-6xl mx-auto mb-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setShowLandingPage(true);
                }}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors shadow-md flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Home</span>
              </button>
              <button
                onClick={() => setSelectedPatient(null)}
                className="flex items-center text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Patient List
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={updatePatientRecords}
                disabled={updatingPatient || resettingPatient}
                className={`flex items-center px-6 py-3 rounded-lg font-semibold text-white shadow-lg transition-all transform hover:scale-105 ${
                  updatingPatient || resettingPatient
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                }`}
              >
                {updatingPatient ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Update...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Update Patient Records
                  </>
                )}
              </button>

              <button
                onClick={resetPatientRecords}
                disabled={updatingPatient || resettingPatient}
                className={`flex items-center px-6 py-3 rounded-lg font-semibold text-white shadow-lg transition-all transform hover:scale-105 ${
                  updatingPatient || resettingPatient
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                }`}
              >
                {resettingPatient ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resetting...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset to Original
                  </>
                )}
              </button>
            </div>
          </div>

          {error && !loadingDetail && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-red-50 border-l-4 border-red-400 p-4 max-w-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error Loading Patient</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          setError(null);
                          fetchPatientDetail(selectedPatient.id);
                        }}
                        className="text-sm font-medium text-red-600 hover:text-red-500"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loadingDetail ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
              <p className="text-gray-600 text-lg">Loading patient details...</p>
            </div>
          ) : !hasRequiredData && !error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 max-w-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Patient Data Incomplete</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>The patient data is missing required information (classification or risk category).</p>
                      <p className="mt-1">Please check the browser console for details.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : !error && hasRequiredData ? (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Patient Header Card */}
              <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
                  <h1 className="text-3xl font-bold text-white">
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </h1>
                  <p className="text-indigo-100 mt-1">MRN: {selectedPatient.medical_record_number}</p>
                </div>

                {/* Demographics & Contact */}
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div>
                    <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Age</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{age} years</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Gender</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1 capitalize">{selectedPatient.gender}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Date of Birth</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">{formatDate(selectedPatient.date_of_birth)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Patient ID</div>
                    <div className="text-xs font-mono text-gray-700 mt-2 break-all">{selectedPatient.id}</div>
                  </div>
                </div>

                <div className="px-8 pb-8 border-t border-gray-200 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedPatient.email && (
                    <div className="flex items-center text-gray-700">
                      <svg className="h-5 w-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {selectedPatient.email}
                    </div>
                  )}
                  {selectedPatient.phone && (
                    <div className="flex items-center text-gray-700">
                      <svg className="h-5 w-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {selectedPatient.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Health State & Risk Classification */}
              <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                <div className={`px-8 py-4 ${selectedPatient.kdigo_classification?.has_ckd
                  ? 'bg-gradient-to-r from-red-600 to-orange-600'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
                  <h2 className="text-2xl font-bold text-white flex items-center">
                    <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {selectedPatient.kdigo_classification?.has_ckd ? 'CKD Patient' : 'Non-CKD Patient'} - Health Classification
                  </h2>
                </div>

                <div className="p-8">
                  {/* Primary Classification Badge - Larger and More Prominent */}
                  <div className="flex flex-col items-center mb-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {selectedPatient.kdigo_classification?.has_ckd ? 'CKD Severity Classification' : 'Kidney Health Risk Level'}
                    </span>
                    {/* For non-CKD patients, use GCUA phenotype type if available */}
                    {!selectedPatient.kdigo_classification?.has_ckd && gcuaAssessment?.isEligible && gcuaAssessment?.phenotype?.type ? (
                      <span className={`px-8 py-4 rounded-2xl text-3xl font-bold shadow-lg ${
                        gcuaAssessment.phenotype.type === 'I' || gcuaAssessment.phenotype.type === 'II' ? 'bg-red-100 text-red-800 border-2 border-red-300' :
                        gcuaAssessment.phenotype.type === 'III' ? 'bg-orange-100 text-orange-800 border-2 border-orange-300' :
                        gcuaAssessment.phenotype.type === 'Moderate' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' :
                        gcuaAssessment.phenotype.type === 'IV' ? 'bg-gray-200 text-gray-700 border-2 border-gray-400' :
                        'bg-green-100 text-green-800 border-2 border-green-300'
                      }`}>
                        {gcuaAssessment.phenotype.type === 'I' || gcuaAssessment.phenotype.type === 'II' ? 'High Risk' :
                         gcuaAssessment.phenotype.type === 'III' ? 'High Risk' :
                         gcuaAssessment.phenotype.type === 'Moderate' ? 'Moderate Risk' :
                         gcuaAssessment.phenotype.type === 'IV' ? 'Senescent' :
                         'Low Risk'}
                      </span>
                    ) : (
                      <span className={`px-8 py-4 rounded-2xl text-3xl font-bold shadow-lg ${getRiskCategoryBadgeColor(selectedPatient.risk_category)}`}>
                        {selectedPatient.risk_category || 'Unknown'}
                      </span>
                    )}
                    {/* Show phenotype name for non-CKD patients */}
                    {!selectedPatient.kdigo_classification?.has_ckd && gcuaAssessment?.isEligible && gcuaAssessment?.phenotype?.name && (
                      <div className="mt-3">
                        <span className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${
                          gcuaAssessment.phenotype.color === 'red' ? 'bg-red-50 text-red-700 border border-red-200' :
                          gcuaAssessment.phenotype.color === 'orange' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                          gcuaAssessment.phenotype.color === 'yellow' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                          gcuaAssessment.phenotype.color === 'green' ? 'bg-green-50 text-green-700 border border-green-200' :
                          'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {gcuaAssessment.phenotype.name}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          {gcuaAssessment.dataCompleteness}% confidence
                        </span>
                      </div>
                    )}
                    {selectedPatient.kdigo_classification?.has_ckd && (
                      <div className="mt-4">
                        <span className="text-sm text-gray-600">Stage: </span>
                        <span className="text-lg font-bold text-gray-900">
                          {selectedPatient.kdigo_classification?.ckd_stage_name || 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* For CKD Patients: KDIGO Technical Details */}
                  {selectedPatient.kdigo_classification?.has_ckd && (
                    <>
                      <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                          <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          KDIGO Classification Details
                        </h3>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center">
                            <span className="text-xs font-medium text-gray-500 mr-2">Health State:</span>
                            <span className={`px-4 py-2 rounded-lg text-sm font-bold border-2 ${getKDIGORiskColorClass(selectedPatient.kdigo_classification?.risk_color)}`}>
                              {selectedPatient.kdigo_classification?.health_state}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-xs font-medium text-gray-500 mr-2">Risk Level:</span>
                            <span className={`px-4 py-2 rounded-lg text-sm font-bold capitalize ${getKDIGORiskColorClass(selectedPatient.kdigo_classification?.risk_color)}`}>
                              {selectedPatient.kdigo_classification?.risk_level}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CKD Classification Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">GFR Category</div>
                          <div className="text-lg font-bold text-gray-900">{selectedPatient.kdigo_classification?.gfr_category}</div>
                          <div className="text-sm text-gray-600 mt-1">{selectedPatient.kdigo_classification?.gfr_description}</div>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Albuminuria Category</div>
                          <div className="text-lg font-bold text-gray-900">{selectedPatient.kdigo_classification?.albuminuria_category}</div>
                          <div className="text-sm text-gray-600 mt-1">{selectedPatient.kdigo_classification?.albuminuria_description}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* For Non-CKD Patients: GCUA Assessment with AI Commentary */}
                  {!selectedPatient.kdigo_classification?.has_ckd && (
                    <div className="mb-6">
                      {/* GCUA Risk Assessment Card - for non-CKD patients 60+ */}
                      {(() => {
                        // Safely calculate age
                        if (!selectedPatient.date_of_birth) return null;

                        const birthDate = new Date(selectedPatient.date_of_birth);
                        if (isNaN(birthDate.getTime())) return null; // Invalid date

                        const today = new Date();
                        let age = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                          age--;
                        }

                        // Safely get eGFR from observations
                        let latestEgfr: number | undefined;
                        if (selectedPatient.observations && Array.isArray(selectedPatient.observations)) {
                          const egfrObs = selectedPatient.observations
                            .filter(o => o && o.observation_type === 'eGFR')
                            .sort((a, b) => new Date(b.observation_date).getTime() - new Date(a.observation_date).getTime())[0];
                          latestEgfr = egfrObs?.value_numeric;
                        }

                        const showGCUA = age >= 60;

                        if (!showGCUA) return null;

                        return (
                          <div className="mb-4">
                            <GCUARiskCard
                              assessment={gcuaAssessment}
                              loading={loadingGCUA}
                              onCalculate={calculateGCUA}
                              isEligible={gcuaEligible ?? undefined}
                              eligibilityReason={
                                gcuaEligibilityReason || (
                                  latestEgfr && latestEgfr <= 60
                                    ? `Patient eGFR (${latestEgfr}) is <= 60. GCUA is designed for pre-CKD patients. Use KDIGO staging for established CKD.`
                                    : undefined
                                )
                              }
                              error={gcuaError}
                            />
                          </div>
                        );
                      })()}

                      {/* AI-Generated Personalized Cardiorenal Commentary based on GCUA */}
                      {gcuaAssessment && gcuaAssessment.isEligible && gcuaAssessment.phenotype && gcuaAssessment.module1 && gcuaAssessment.module2 && gcuaAssessment.module3 && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 mb-4">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-blue-900 mb-2 flex items-center">
                                <span>AI Cardiorenal Assessment</span>
                                <span className="ml-2 text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  Personalized Analysis
                                </span>
                              </h4>
                              <div className="text-sm text-gray-700 space-y-3">
                                {/* Personalized commentary based on the three GCUA modules */}
                                <p>
                                  <span className="font-semibold text-gray-900">
                                    {selectedPatient.first_name} {selectedPatient.last_name}
                                  </span> presents with a <span className="font-semibold text-blue-700">Phenotype {gcuaAssessment.phenotype?.type || 'Unknown'}</span> ({gcuaAssessment.phenotype?.name || 'Unknown'}) cardiorenal profile based on integrated risk assessment:
                                </p>

                                {/* Nelson/CKD-PC Analysis */}
                                <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                  <div className="flex items-center mb-1">
                                    <span className="font-semibold text-purple-700">Renal Risk (Nelson/CKD-PC):</span>
                                    <span className={`ml-2 text-sm font-bold ${
                                      gcuaAssessment.module1?.riskCategory === 'very_high' || gcuaAssessment.module1?.riskCategory === 'high'
                                        ? 'text-red-600'
                                        : gcuaAssessment.module1?.riskCategory === 'moderate'
                                          ? 'text-yellow-600'
                                          : 'text-green-600'
                                    }`}>
                                      {gcuaAssessment.module1?.fiveYearRisk ?? 0}% 5-year risk
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600">
                                    {gcuaAssessment.module1?.riskCategory === 'very_high' || gcuaAssessment.module1?.riskCategory === 'high'
                                      ? 'Significant risk of kidney function decline. Nephroprotective strategies are essential - consider SGLT2 inhibitors and ACE/ARB optimization.'
                                      : gcuaAssessment.module1?.riskCategory === 'moderate'
                                        ? 'Moderate renal risk warrants proactive monitoring. Regular eGFR and uACR tracking recommended with lifestyle modifications.'
                                        : 'Current kidney function is stable. Continue preventive measures and annual screening to maintain renal health.'}
                                  </p>
                                </div>

                                {/* AHA PREVENT Analysis */}
                                <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                  <div className="flex items-center mb-1">
                                    <span className="font-semibold text-red-700">Cardiovascular Risk (AHA PREVENT):</span>
                                    <span className={`ml-2 text-sm font-bold ${
                                      gcuaAssessment.module2?.riskCategory === 'high'
                                        ? 'text-red-600'
                                        : gcuaAssessment.module2?.riskCategory === 'intermediate'
                                          ? 'text-yellow-600'
                                          : 'text-green-600'
                                    }`}>
                                      {gcuaAssessment.module2?.tenYearRisk ?? 0}% 10-year risk
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600">
                                    {gcuaAssessment.module2?.riskCategory === 'high'
                                      ? 'Elevated cardiovascular event risk. Aggressive lipid management, strict BP control (<130/80), and consideration of antiplatelet therapy recommended.'
                                      : gcuaAssessment.module2?.riskCategory === 'intermediate'
                                        ? 'Intermediate CV risk requires attention to modifiable factors. Optimize lipid profile, manage hypertension, and encourage lifestyle changes.'
                                        : 'Favorable cardiovascular profile. Maintain heart-healthy habits and continue periodic risk reassessment.'}
                                  </p>
                                </div>

                                {/* Bansal Mortality Analysis */}
                                <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                                  <div className="flex items-center mb-1">
                                    <span className="font-semibold text-gray-700">Competing Mortality Risk (Bansal):</span>
                                    <span className={`ml-2 text-sm font-bold ${
                                      gcuaAssessment.module3?.riskCategory === 'very_high' || gcuaAssessment.module3?.riskCategory === 'high'
                                        ? 'text-red-600'
                                        : gcuaAssessment.module3?.riskCategory === 'moderate'
                                          ? 'text-yellow-600'
                                          : 'text-green-600'
                                    }`}>
                                      {gcuaAssessment.module3?.fiveYearMortalityRisk ?? 0}% 5-year mortality
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600">
                                    {gcuaAssessment.module3?.riskCategory === 'very_high' || gcuaAssessment.module3?.riskCategory === 'high'
                                      ? 'High competing mortality risk influences treatment intensity decisions. Focus on quality of life, symptom management, and shared decision-making about aggressive interventions.'
                                      : gcuaAssessment.module3?.riskCategory === 'moderate'
                                        ? 'Moderate mortality considerations - balance preventive treatments with patient preferences and functional goals.'
                                        : 'Favorable longevity outlook supports investment in long-term preventive strategies and disease-modifying therapies.'}
                                  </p>
                                </div>

                                {/* Integrated Recommendation */}
                                <div className="mt-3 pt-3 border-t border-blue-200">
                                  <p className="text-sm">
                                    <span className="font-semibold text-blue-800">Integrated Recommendation:</span>{' '}
                                    {(() => {
                                      const phenotypeName = gcuaAssessment.phenotype?.name?.toLowerCase() || '';
                                      const phenotypeType = gcuaAssessment.phenotype?.type;

                                      // Type IV: The Senescent (mortality ≥50%)
                                      if (phenotypeType === 'IV' || phenotypeName.includes('senescent')) {
                                        return 'High competing mortality risk (≥50% 5-year). Focus on quality of life, symptom management, and shared decision-making about treatment intensity. Aggressive interventions may not provide meaningful benefit.';
                                      }
                                      // Type I: High renal risk (≥15%)
                                      if (phenotypeType === 'I') {
                                        if (phenotypeName.includes('accelerated')) {
                                          return 'HIGH RISK: Both renal (≥15%) and cardiovascular (≥20%) risk are elevated. This patient requires comprehensive cardiorenal protection with SGLT2 inhibitor, RAS inhibitor, and high-intensity statin. Quarterly monitoring recommended.';
                                        } else if (phenotypeName.includes('cardiorenal high')) {
                                          return 'HIGH RISK: High renal risk (≥15%) with intermediate CVD risk (7.5-19.9%). Aggressive cardiorenal protection indicated. SGLT2 inhibitor and RAS inhibitor recommended. Quarterly monitoring required.';
                                        }
                                        return 'High-risk cardiorenal profile requiring aggressive intervention with SGLT2 inhibitors and RAS inhibitors. Close multidisciplinary follow-up recommended.';
                                      }
                                      // Type II: Silent Renal (high renal, low CVD)
                                      if (phenotypeType === 'II' || phenotypeName.includes('silent renal')) {
                                        return 'HIGH RENAL RISK: Renal risk ≥15% with low CVD risk (<7.5%). These patients are often missed by traditional screening. Prioritize nephroprotection with SGLT2 inhibitor and RAS inhibitor. Monitor uACR every 6 months.';
                                      }
                                      // Type III: Vascular Dominant (low renal, high CVD)
                                      if (phenotypeType === 'III' || phenotypeName.includes('vascular dominant')) {
                                        return 'HIGH CVD RISK: Cardiovascular risk ≥20% with low renal risk (<5%). Aggressive CVD prevention with high-intensity statin and BP control. Consider SGLT2 inhibitor for heart failure prevention.';
                                      }
                                      // Moderate phenotypes
                                      if (phenotypeType === 'Moderate') {
                                        if (phenotypeName.includes('cardiorenal moderate')) {
                                          return 'MODERATE RISK: Renal risk 5-14.9% with elevated CVD risk (≥7.5%). Prioritize CV risk reduction with statin therapy and BP control (<130/80). Consider SGLT2 inhibitor. Monitor eGFR/uACR every 6 months.';
                                        } else if (phenotypeName.includes('renal watch')) {
                                          return 'MODERATE RENAL RISK: Renal risk 5-14.9% with low CVD risk (<7.5%). Proactive kidney monitoring essential. Address modifiable risk factors. Consider nephrology referral if worsening trend observed.';
                                        }
                                      }
                                      // Low phenotypes
                                      if (phenotypeType === 'Low') {
                                        if (phenotypeName.includes('cv intermediate')) {
                                          return 'LOW RENAL RISK with intermediate CVD (7.5-19.9%). Focus on cardiovascular risk factor modification with moderate-intensity statin. Routine kidney screening every 2-3 years.';
                                        } else if (phenotypeName.includes('low risk')) {
                                          return 'LOW RISK: Both renal (<5%) and CVD (<7.5%) risks are low. Continue routine preventive care, lifestyle optimization, and periodic screening every 2-3 years.';
                                        }
                                      }
                                      // Fallback
                                      return 'Continue current management with regular monitoring. Reassess risk factors periodically and adjust treatment as indicated by clinical status.';
                                    })()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Home Monitoring & Treatment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Home Monitoring */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <h3 className="text-sm font-bold text-gray-900">Home Monitoring</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Device:</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {selectedPatient.home_monitoring_device
                              ? selectedPatient.home_monitoring_device
                              : selectedPatient.kdigo_classification?.has_ckd
                                ? 'Minuteful Kidney Kit (Recommended)'
                                : gcuaAssessment?.phenotype?.treatmentRecommendations?.homeMonitoringRecommended
                                  ? 'Minuteful Kidney Kit (Recommended)'
                                  : 'Not Required'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Status:</span>
                          <span className={`text-sm font-semibold ${selectedPatient.home_monitoring_active ? 'text-green-600' : 'text-gray-600'}`}>
                            {selectedPatient.home_monitoring_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {/* Warning for CKD patients not on home monitoring */}
                        {selectedPatient.kdigo_classification?.has_ckd && !selectedPatient.home_monitoring_active && (
                          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            ⚠️ Home uACR monitoring recommended for CKD patients
                          </div>
                        )}
                        {/* Warning for high-risk non-CKD patients (Phenotype I/II) not on home monitoring */}
                        {!selectedPatient.kdigo_classification?.has_ckd &&
                         gcuaAssessment?.phenotype?.treatmentRecommendations?.homeMonitoringRecommended &&
                         !selectedPatient.home_monitoring_active && (
                          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                            🚨 <strong>High Renal Risk:</strong> Home uACR monitoring strongly recommended for early CKD detection
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CKD Treatment */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 className="text-sm font-bold text-gray-900">CKD Treatment</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Treatment Status:</span>
                          <span className={`text-sm font-semibold ${selectedPatient.ckd_treatment_active ? 'text-green-600' : 'text-gray-600'}`}>
                            {selectedPatient.kdigo_classification?.has_ckd
                              ? (selectedPatient.ckd_treatment_active ? 'Active' : 'Not Started')
                              : 'N/A - No CKD'}
                          </span>
                        </div>
                        {selectedPatient.ckd_treatment_active && selectedPatient.ckd_treatment_type && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Treatment Type:</span>
                            <span className="text-sm font-semibold text-gray-900">{selectedPatient.ckd_treatment_type}</span>
                          </div>
                        )}
                        {selectedPatient.kdigo_classification?.has_ckd && !selectedPatient.ckd_treatment_active && (
                          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                            ⚠️ CKD treatment protocol recommended
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Clinical Recommendations */}
                  {(selectedPatient.kdigo_classification?.recommend_ras_inhibitor ||
                    selectedPatient.kdigo_classification?.recommend_sglt2i ||
                    selectedPatient.kdigo_classification?.requires_nephrology_referral) && (
                    <div className="mt-6 border-t border-gray-200 pt-6">
                      <h3 className="text-sm font-bold text-gray-900 mb-3">Clinical Recommendations</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {selectedPatient.kdigo_classification?.recommend_ras_inhibitor && (
                          <div className="flex items-start space-x-2 text-sm">
                            <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-700">RAS Inhibitor (ACE-I/ARB)</span>
                          </div>
                        )}
                        {selectedPatient.kdigo_classification?.recommend_sglt2i && (
                          <div className="flex items-start space-x-2 text-sm">
                            <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-700">SGLT2 Inhibitor</span>
                          </div>
                        )}
                        {selectedPatient.kdigo_classification?.requires_nephrology_referral && (
                          <div className="flex items-start space-x-2 text-sm">
                            <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-gray-700 font-semibold">Nephrology Referral Required</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">Target BP:</span>
                          <span className="font-semibold text-gray-900">{selectedPatient.kdigo_classification?.target_bp}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">Monitoring Frequency:</span>
                          <span className="font-semibold text-gray-900">{selectedPatient.kdigo_classification?.monitoring_frequency}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Treatment Adherence Card */}
                  {selectedPatient.is_treated && (
                    <div className="mt-6">
                      <AdherenceCard adherenceData={adherenceData} loading={loadingAdherence} />
                    </div>
                  )}

                </div>
              </div>

              {/* Doctor Assistant Chat */}
              <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                <div className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600">
                  <h2 className="text-2xl font-bold text-white flex items-center">
                    <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Doctor Assistant
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    Ask me about this patient's data, lab results, clinical guidelines, or treatment recommendations
                  </p>
                </div>

                <div className="p-8">
                  {/* Chat Messages */}
                  <div className="mb-4 space-y-4 max-h-[400px] overflow-y-auto">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <svg className="h-12 w-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <p className="font-medium mb-1">Hi! I'm your AI Doctor Assistant.</p>
                        <p className="text-sm">
                          Ask me about {selectedPatient.first_name}'s lab results, clinical guidelines, or treatment recommendations.
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-3 ${
                              message.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p
                              className={`text-xs mt-1 ${
                                message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                              }`}
                            >
                              {message.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}

                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-3">
                          <div className="flex gap-2">
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <div className="flex gap-2 border-t border-gray-200 pt-4">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      placeholder="Ask a question..."
                      disabled={chatLoading}
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <button
                      onClick={handleSendChatMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send
                    </button>
                  </div>
                </div>
              </div>

              {/* Health State Change Comments */}
              <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                <div className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
                  <h2 className="text-2xl font-bold text-white flex items-center">
                    <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Health State Evolution
                  </h2>
                </div>

                <div className="p-8">
                  {loadingComments ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-3"></div>
                        <div className="text-gray-600 font-medium">🤖 AI is analyzing patient updates...</div>
                        <div className="text-gray-500 text-sm mt-1">This may take a few moments</div>
                      </div>
                    </div>
                  ) : healthStateComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="text-6xl mb-4">📋</div>
                      <div className="text-gray-600 font-medium mb-2">No updates yet</div>
                      <div className="text-gray-500 text-sm text-center max-w-md">
                        Press "Update Patient Records" to generate new lab values and receive AI-powered analysis of patient progression.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {healthStateComments.filter(comment => comment && comment.id).map((comment) => {
                          try {
                            // Special handling for AI update analysis comments
                            const isAIUpdateAnalysis = comment.comment_type === 'ai_update_analysis' || comment.comment_type === 'ai_generated';

                            const changeTypeColor = isAIUpdateAnalysis ? 'border-purple-300 bg-purple-50' :
                              comment.change_type === 'worsened' ? 'border-red-300 bg-red-50' :
                              comment.change_type === 'improved' ? 'border-green-300 bg-green-50' :
                              comment.change_type === 'initial' ? 'border-blue-300 bg-blue-50' :
                              'border-gray-300 bg-gray-50';

                            const changeTypeIcon = isAIUpdateAnalysis ? '🤖' :
                              comment.change_type === 'worsened' ? '⚠️' :
                              comment.change_type === 'improved' ? '✓' :
                              comment.change_type === 'initial' ? 'ℹ️' :
                              '•';

                            const severityColor =
                              comment.severity === 'critical' ? 'text-red-700' :
                              comment.severity === 'warning' ? 'text-orange-700' :
                              'text-blue-700';

                            const displayLabel = isAIUpdateAnalysis ? 'AI Analysis' :
                              comment.change_type || 'Update';

                            return (
                            <div
                              key={comment.id}
                              className={`border-l-4 ${changeTypeColor} rounded-r-lg p-4`}
                            >
                              {/* Header */}
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{changeTypeIcon}</span>
                                  <span className={`font-semibold text-sm uppercase tracking-wide ${severityColor}`}>
                                    {displayLabel}
                                  </span>
                                  {comment.health_state_from && comment.health_state_to && (
                                    <span className="text-sm text-gray-600">
                                      {comment.health_state_from} → {comment.health_state_to}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {formatDate(comment.created_at)}{comment.cycle_number ? ` - Cycle ${comment.cycle_number}` : ''}
                                </span>
                              </div>

                              {/* Comment Text */}
                              {comment.comment_text && (
                                <div className="text-gray-800 mb-3">
                                  {comment.comment_text}
                                </div>
                              )}

                              {/* Clinical Summary */}
                              {comment.clinical_summary && (
                                <div className="bg-white border border-gray-200 rounded p-3 mb-3">
                                  <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Clinical Summary</div>
                                  <div className="text-sm text-gray-700">{comment.clinical_summary}</div>
                                </div>
                              )}

                              {/* Lab Value Changes */}
                              {(comment.egfr_change !== null && comment.egfr_change !== undefined ||
                                comment.uacr_change !== null && comment.uacr_change !== undefined) && (
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                  {comment.egfr_change !== null && comment.egfr_change !== undefined &&
                                   typeof comment.egfr_change === 'number' && (
                                    <div className="bg-white border border-gray-200 rounded p-2">
                                      <div className="text-xs text-gray-600">eGFR Change</div>
                                      <div className={`text-sm font-semibold ${comment.egfr_change < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {typeof comment.egfr_from === 'number' ? comment.egfr_from.toFixed(1) : 'N/A'} → {typeof comment.egfr_to === 'number' ? comment.egfr_to.toFixed(1) : 'N/A'} ({comment.egfr_change > 0 ? '+' : ''}{comment.egfr_change.toFixed(1)})
                                      </div>
                                    </div>
                                  )}
                                  {comment.uacr_change !== null && comment.uacr_change !== undefined &&
                                   typeof comment.uacr_change === 'number' && (
                                    <div className="bg-white border border-gray-200 rounded p-2">
                                      <div className="text-xs text-gray-600">uACR Change</div>
                                      <div className={`text-sm font-semibold ${comment.uacr_change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {typeof comment.uacr_from === 'number' ? comment.uacr_from.toFixed(1) : 'N/A'} → {typeof comment.uacr_to === 'number' ? comment.uacr_to.toFixed(1) : 'N/A'} ({comment.uacr_change > 0 ? '+' : ''}{comment.uacr_change.toFixed(1)})
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Acknowledgment Text (for improvements) */}
                              {comment.acknowledgment_text && (
                                <div className="bg-green-100 border border-green-300 rounded p-3 mb-3">
                                  <div className="flex items-start">
                                    <svg className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-sm text-green-800">{comment.acknowledgment_text}</div>
                                  </div>
                                </div>
                              )}

                              {/* Mitigation Measures (for worsening) */}
                              {Array.isArray(comment.mitigation_measures) && comment.mitigation_measures.length > 0 && (
                                <div className="bg-orange-50 border border-orange-300 rounded p-3 mb-3">
                                  <div className="text-xs font-semibold text-orange-800 uppercase mb-2 flex items-center">
                                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Mitigation Measures
                                  </div>
                                  <ul className="list-disc list-inside space-y-1">
                                    {comment.mitigation_measures.filter(m => m && typeof m === 'string').map((measure, idx) => (
                                      <li key={idx} className="text-sm text-orange-900">{measure}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Recommended Actions */}
                              {Array.isArray(comment.recommended_actions) && comment.recommended_actions.length > 0 && (
                                <div className="bg-blue-50 border border-blue-300 rounded p-3">
                                  <div className="text-xs font-semibold text-blue-800 uppercase mb-2 flex items-center">
                                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                    Recommended Actions
                                  </div>
                                  <ul className="list-disc list-inside space-y-1">
                                    {comment.recommended_actions.filter(a => a && typeof a === 'string').map((action, idx) => (
                                      <li key={idx} className="text-sm text-blue-900">{action}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                          } catch (err) {
                            console.error('[RENDER_COMMENT] Error rendering comment:', comment?.id, err);
                            console.error('[RENDER_COMMENT] Comment data:', JSON.stringify(comment, null, 2));
                            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                            return (
                              <div key={comment?.id || Math.random()} className="border-l-4 border-red-300 bg-red-50 rounded-r-lg p-4">
                                <div className="text-sm text-red-700 font-semibold mb-2">Error displaying comment</div>
                                <div className="text-xs text-red-600 mb-2">Error: {errorMessage}</div>
                                <div className="text-xs text-gray-600">Comment ID: {comment?.id}</div>
                                <div className="text-xs text-gray-500 mt-2">Check browser console for details</div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    )}
                  </div>
                </div>

              {/* Patient Trend Graphs */}
              {selectedPatient.observations && selectedPatient.observations.length > 0 && (
                <PatientTrendGraphs
                  observations={selectedPatient.observations}
                  isTreated={selectedPatient.ckd_treatment_active || false}
                />
              )}

              {/* Clinical Overview - 3 Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Anthropometrics */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Anthropometrics
                  </h3>
                  <div className="space-y-0 divide-y divide-gray-200">
                    <div className="py-3">
                      <div className="text-sm text-gray-600">Weight</div>
                      <div className="text-xl font-semibold text-gray-900">{selectedPatient.weight ? `${selectedPatient.weight} kg` : 'N/A'}</div>
                    </div>
                    <div className="py-3">
                      <div className="text-sm text-gray-600">Height</div>
                      <div className="text-xl font-semibold text-gray-900">{selectedPatient.height ? `${selectedPatient.height} cm` : 'N/A'}</div>
                    </div>
                    <div className="py-3">
                      <div className="text-sm text-gray-600">BMI</div>
                      <div className="text-xl font-semibold text-gray-900">
                        {bmi ? `${bmi.toFixed(1)} kg/m²` : 'N/A'}
                      </div>
                      {bmi && (
                        <div className="text-xs mt-1 text-gray-600">
                          {bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Clinical History */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Clinical History
                  </h3>
                  <div className="space-y-0 divide-y divide-gray-200">
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-gray-600">Smoking Status</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedPatient.smoking_status || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-gray-600">CVD History</span>
                      <span className={`text-sm font-semibold ${selectedPatient.cvd_history ? 'text-red-600' : 'text-green-600'}`}>
                        {selectedPatient.cvd_history ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-gray-600">Family History ESRD</span>
                      <span className={`text-sm font-semibold ${selectedPatient.family_history_esrd ? 'text-red-600' : 'text-green-600'}`}>
                        {selectedPatient.family_history_esrd ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-gray-600">Nephrologist Referral</span>
                      <span className={`text-sm font-semibold ${selectedPatient.nephrologist_referral ? 'text-green-600' : 'text-gray-600'}`}>
                        {selectedPatient.nephrologist_referral ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Medications */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Medications
                  </h3>
                  <div className="space-y-0 divide-y divide-gray-200">
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-gray-600">RAS Inhibitor</span>
                      <span className={`text-sm font-semibold ${selectedPatient.on_ras_inhibitor ? 'text-blue-600' : 'text-gray-400'}`}>
                        {selectedPatient.on_ras_inhibitor ? 'Active' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-gray-600">SGLT2 Inhibitor</span>
                      <span className={`text-sm font-semibold ${selectedPatient.on_sglt2i ? 'text-blue-600' : 'text-gray-400'}`}>
                        {selectedPatient.on_sglt2i ? 'Active' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-gray-600">Nephrotoxic Meds</span>
                      <span className={`text-sm font-semibold ${selectedPatient.nephrotoxic_meds ? 'text-red-600' : 'text-green-600'}`}>
                        {selectedPatient.nephrotoxic_meds ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vital Signs Card */}
              {(selectedPatient.systolic_bp || selectedPatient.heart_rate || selectedPatient.oxygen_saturation) && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Vital Signs
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(selectedPatient.systolic_bp || selectedPatient.diastolic_bp) && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-xs text-gray-600 uppercase">Blood Pressure</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {selectedPatient.systolic_bp || '--'}/{selectedPatient.diastolic_bp || '--'} <span className="text-sm font-normal text-gray-600">mmHg</span>
                        </div>
                        {selectedPatient.bp_control_status && (
                          <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${
                            selectedPatient.bp_control_status === 'Controlled' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedPatient.bp_control_status}
                          </span>
                        )}
                      </div>
                    )}
                    {selectedPatient.heart_rate && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-xs text-gray-600 uppercase">Heart Rate</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {selectedPatient.heart_rate} <span className="text-sm font-normal text-gray-600">bpm</span>
                        </div>
                      </div>
                    )}
                    {selectedPatient.oxygen_saturation && typeof selectedPatient.oxygen_saturation === 'number' && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-xs text-gray-600 uppercase">O₂ Saturation</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {selectedPatient.oxygen_saturation.toFixed(1)} <span className="text-sm font-normal text-gray-600">%</span>
                        </div>
                      </div>
                    )}
                    {selectedPatient.bmi && typeof selectedPatient.bmi === 'number' && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-xs text-gray-600 uppercase">BMI</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {selectedPatient.bmi.toFixed(1)} <span className="text-sm font-normal text-gray-600">kg/m²</span>
                        </div>
                        <div className="text-xs mt-1 text-gray-600">
                          {selectedPatient.bmi < 18.5 ? 'Underweight' : selectedPatient.bmi < 25 ? 'Normal' : selectedPatient.bmi < 30 ? 'Overweight' : 'Obese'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comorbidities Card */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Comorbidities
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {/* Cardiovascular */}
                  {selectedPatient.has_hypertension && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-red-50 rounded border border-red-200">
                      <svg className="h-4 w-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Hypertension</span>
                    </div>
                  )}
                  {selectedPatient.has_diabetes && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-orange-50 rounded border border-orange-200">
                      <svg className="h-4 w-4 text-orange-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Diabetes{selectedPatient.has_type2_diabetes ? ' (Type 2)' : selectedPatient.has_type1_diabetes ? ' (Type 1)' : ''}</span>
                    </div>
                  )}
                  {selectedPatient.has_heart_failure && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-red-50 rounded border border-red-200">
                      <svg className="h-4 w-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Heart Failure</span>
                    </div>
                  )}
                  {selectedPatient.has_cad && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-red-50 rounded border border-red-200">
                      <svg className="h-4 w-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">CAD</span>
                    </div>
                  )}
                  {selectedPatient.has_mi && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-red-50 rounded border border-red-200">
                      <svg className="h-4 w-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">MI History</span>
                    </div>
                  )}
                  {selectedPatient.has_atrial_fibrillation && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-orange-50 rounded border border-orange-200">
                      <svg className="h-4 w-4 text-orange-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Atrial Fib</span>
                    </div>
                  )}
                  {selectedPatient.has_stroke && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-red-50 rounded border border-red-200">
                      <svg className="h-4 w-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Stroke</span>
                    </div>
                  )}
                  {selectedPatient.has_peripheral_vascular_disease && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-orange-50 rounded border border-orange-200">
                      <svg className="h-4 w-4 text-orange-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">PVD</span>
                    </div>
                  )}
                  {/* Metabolic */}
                  {selectedPatient.has_obesity && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-yellow-50 rounded border border-yellow-200">
                      <svg className="h-4 w-4 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Obesity</span>
                    </div>
                  )}
                  {selectedPatient.has_metabolic_syndrome && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-yellow-50 rounded border border-yellow-200">
                      <svg className="h-4 w-4 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Metabolic Syndrome</span>
                    </div>
                  )}
                  {selectedPatient.has_hyperlipidemia && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-yellow-50 rounded border border-yellow-200">
                      <svg className="h-4 w-4 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Hyperlipidemia</span>
                    </div>
                  )}
                  {/* Renal/Urological */}
                  {selectedPatient.has_aki_history && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-purple-50 rounded border border-purple-200">
                      <svg className="h-4 w-4 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">AKI History</span>
                    </div>
                  )}
                  {selectedPatient.has_kidney_stones && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-purple-50 rounded border border-purple-200">
                      <svg className="h-4 w-4 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Kidney Stones</span>
                    </div>
                  )}
                  {selectedPatient.has_polycystic_kidney_disease && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-purple-50 rounded border border-purple-200">
                      <svg className="h-4 w-4 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">PKD</span>
                    </div>
                  )}
                  {selectedPatient.has_uti && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-purple-50 rounded border border-purple-200">
                      <svg className="h-4 w-4 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">UTI</span>
                    </div>
                  )}
                  {selectedPatient.has_gout && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-yellow-50 rounded border border-yellow-200">
                      <svg className="h-4 w-4 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Gout</span>
                    </div>
                  )}
                  {/* Autoimmune */}
                  {selectedPatient.has_lupus && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-pink-50 rounded border border-pink-200">
                      <svg className="h-4 w-4 text-pink-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Lupus</span>
                    </div>
                  )}
                  {selectedPatient.has_ra && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-pink-50 rounded border border-pink-200">
                      <svg className="h-4 w-4 text-pink-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Rheumatoid Arthritis</span>
                    </div>
                  )}
                  {selectedPatient.resistant_hypertension && (
                    <div className="flex items-center space-x-2 text-sm p-2 bg-red-50 rounded border border-red-200">
                      <svg className="h-4 w-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="font-medium text-gray-800">Resistant HTN</span>
                    </div>
                  )}
                </div>
                {selectedPatient.antihypertensive_count && selectedPatient.antihypertensive_count > 0 && (
                  <div className="mt-4 text-sm text-gray-700">
                    <span className="font-semibold">Antihypertensive Medications:</span> {selectedPatient.antihypertensive_count}
                  </div>
                )}
              </div>

              {/* Clinical Symptoms Card */}
              {(selectedPatient.appetite || selectedPatient.pedal_edema || selectedPatient.anemia ||
                (selectedPatient.chronic_nsaid_use_months && selectedPatient.chronic_nsaid_use_months > 0) ||
                (selectedPatient.chronic_ppi_use_months && selectedPatient.chronic_ppi_use_months > 0) ||
                (selectedPatient.diabetes_duration_years && selectedPatient.diabetes_duration_years > 0) ||
                (selectedPatient.previous_aki_episodes && selectedPatient.previous_aki_episodes > 0)) && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Clinical Symptoms & History
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedPatient.appetite && (
                      <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-600">Appetite</span>
                        <span className={`text-sm font-semibold ${selectedPatient.appetite === 'Good' ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedPatient.appetite}
                        </span>
                      </div>
                    )}
                    {selectedPatient.pedal_edema !== undefined && (
                      <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-600">Pedal Edema</span>
                        <span className={`text-sm font-semibold ${selectedPatient.pedal_edema ? 'text-red-600' : 'text-green-600'}`}>
                          {selectedPatient.pedal_edema ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                    {selectedPatient.anemia !== undefined && (
                      <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-600">Anemia</span>
                        <span className={`text-sm font-semibold ${selectedPatient.anemia ? 'text-red-600' : 'text-green-600'}`}>
                          {selectedPatient.anemia ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                    {selectedPatient.chronic_nsaid_use_months && selectedPatient.chronic_nsaid_use_months > 0 && (
                      <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-600">Chronic NSAID Use</span>
                        <span className="text-sm font-semibold text-orange-600">
                          {selectedPatient.chronic_nsaid_use_months} months
                        </span>
                      </div>
                    )}
                    {selectedPatient.chronic_ppi_use_months && selectedPatient.chronic_ppi_use_months > 0 && (
                      <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-600">Chronic PPI Use</span>
                        <span className="text-sm font-semibold text-orange-600">
                          {selectedPatient.chronic_ppi_use_months} months
                        </span>
                      </div>
                    )}
                    {selectedPatient.diabetes_duration_years && selectedPatient.diabetes_duration_years > 0 && (
                      <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-600">Diabetes Duration</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {selectedPatient.diabetes_duration_years} years
                        </span>
                      </div>
                    )}
                    {selectedPatient.previous_aki_episodes && selectedPatient.previous_aki_episodes > 0 && (
                      <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                        <span className="text-sm text-gray-600">Previous AKI Episodes</span>
                        <span className="text-sm font-semibold text-red-600">
                          {selectedPatient.previous_aki_episodes}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Visit Information */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Visit Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Diagnosis Date</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">{formatDate(selectedPatient.diagnosis_date)}</div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Last Visit</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">{formatDate(selectedPatient.last_visit_date)}</div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Next Visit</div>
                    <div className="text-lg font-semibold text-gray-900 mt-1">{formatDate(selectedPatient.next_visit_date)}</div>
                  </div>
                </div>
              </div>

              {/* Laboratory Results */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 4 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                    Laboratory Results
                  </h3>
                </div>

                {/* Kidney Function */}
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Kidney Function</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      const egfr = getObservationValue(selectedPatient.observations, 'eGFR');
                      const egfrTrend = getObservationValue(selectedPatient.observations, 'eGFR_trend');
                      const egfrChange = getObservationValue(selectedPatient.observations, 'eGFR_change_percent');

                      return egfr && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase flex items-center">
                            eGFR
                            {egfrTrend && getTrendIcon(egfrTrend.value_text)}
                          </div>
                          <div className={`text-2xl font-bold mt-1 ${getLabValueColor('eGFR', egfr.value_numeric || 0)}`}>
                            {egfr.value_numeric} <span className="text-sm font-normal text-gray-600">{egfr.unit}</span>
                          </div>
                          {egfrChange && (
                            <div className="text-xs text-red-600 mt-1 font-semibold">
                              {egfrChange.value_numeric && egfrChange.value_numeric > 0 ? '+' : ''}{egfrChange.value_numeric}% change
                            </div>
                          )}
                          {egfr.notes && <div className="text-xs text-gray-600 mt-1">{egfr.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const creatinine = getObservationValue(selectedPatient.observations, 'serum_creatinine');
                      return creatinine && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Creatinine</div>
                          <div className={`text-2xl font-bold mt-1 ${getLabValueColor('serum_creatinine', creatinine.value_numeric || 0)}`}>
                            {creatinine.value_numeric} <span className="text-sm font-normal text-gray-600">{creatinine.unit}</span>
                          </div>
                          {creatinine.notes && <div className="text-xs text-gray-600 mt-1">{creatinine.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const bun = getObservationValue(selectedPatient.observations, 'BUN');
                      return bun && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">BUN</div>
                          <div className={`text-2xl font-bold mt-1 ${getLabValueColor('BUN', bun.value_numeric || 0)}`}>
                            {bun.value_numeric} <span className="text-sm font-normal text-gray-600">{bun.unit}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const uacr = getObservationValue(selectedPatient.observations, 'uACR');
                      const proteinuriaCategory = getObservationValue(selectedPatient.observations, 'proteinuria_category');

                      return uacr && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">uACR</div>
                          <div className={`text-2xl font-bold mt-1 ${getLabValueColor('uACR', uacr.value_numeric || 0)}`}>
                            {uacr.value_numeric} <span className="text-sm font-normal text-gray-600">{uacr.unit}</span>
                          </div>
                          {proteinuriaCategory && (
                            <div className="text-xs font-semibold text-indigo-600 mt-1">
                              KDIGO {proteinuriaCategory.value_text}
                            </div>
                          )}
                          {uacr.notes && <div className="text-xs text-gray-600 mt-1">{uacr.notes}</div>}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Lipid Panel & Cardiovascular Risk */}
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Lipid Panel & Cardiovascular Risk</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      const ldl = getObservationValue(selectedPatient.observations, 'LDL_cholesterol');
                      return ldl && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">LDL Cholesterol</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {ldl.value_numeric} <span className="text-sm font-normal text-gray-600">{ldl.unit}</span>
                          </div>
                          {ldl.value_numeric && ldl.value_numeric >= 130 && (
                            <div className="text-xs text-orange-600 mt-1 font-semibold">Above target</div>
                          )}
                          {ldl.notes && <div className="text-xs text-gray-600 mt-1">{ldl.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const hdl = getObservationValue(selectedPatient.observations, 'HDL_cholesterol');
                      return hdl && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">HDL Cholesterol</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {hdl.value_numeric} <span className="text-sm font-normal text-gray-600">{hdl.unit}</span>
                          </div>
                          {hdl.value_numeric && hdl.value_numeric < 40 && (
                            <div className="text-xs text-red-600 mt-1 font-semibold">Low (increased risk)</div>
                          )}
                          {hdl.notes && <div className="text-xs text-gray-600 mt-1">{hdl.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const totalChol = getObservationValue(selectedPatient.observations, 'total_cholesterol');
                      return totalChol && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Total Cholesterol</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {totalChol.value_numeric} <span className="text-sm font-normal text-gray-600">{totalChol.unit}</span>
                          </div>
                          {totalChol.value_numeric && totalChol.value_numeric >= 200 && (
                            <div className="text-xs text-orange-600 mt-1 font-semibold">Elevated</div>
                          )}
                        </div>
                      );
                    })()}
                    {(() => {
                      const triglycerides = getObservationValue(selectedPatient.observations, 'triglycerides');
                      return triglycerides && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Triglycerides</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {triglycerides.value_numeric} <span className="text-sm font-normal text-gray-600">{triglycerides.unit}</span>
                          </div>
                          {triglycerides.value_numeric && triglycerides.value_numeric >= 150 && (
                            <div className="text-xs text-orange-600 mt-1 font-semibold">Elevated</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Metabolic */}
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Metabolic</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      const hba1c = getObservationValue(selectedPatient.observations, 'HbA1c');
                      return hba1c && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">HbA1c</div>
                          <div className={`text-2xl font-bold mt-1 ${getLabValueColor('HbA1c', hba1c.value_numeric || 0)}`}>
                            {hba1c.value_numeric} <span className="text-sm font-normal text-gray-600">{hba1c.unit}</span>
                          </div>
                          {hba1c.notes && <div className="text-xs text-gray-600 mt-1">{hba1c.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const glucose = getObservationValue(selectedPatient.observations, 'glucose');
                      return glucose && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Glucose</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {glucose.value_numeric} <span className="text-sm font-normal text-gray-600">{glucose.unit}</span>
                          </div>
                          {glucose.notes && <div className="text-xs text-gray-600 mt-1">{glucose.notes}</div>}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Hematology & Electrolytes */}
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Hematology & Electrolytes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      const hemoglobin = getObservationValue(selectedPatient.observations, 'hemoglobin');
                      return hemoglobin && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Hemoglobin</div>
                          <div className={`text-2xl font-bold mt-1 ${getLabValueColor('hemoglobin', hemoglobin.value_numeric || 0)}`}>
                            {hemoglobin.value_numeric} <span className="text-sm font-normal text-gray-600">{hemoglobin.unit}</span>
                          </div>
                          {hemoglobin.notes && <div className="text-xs text-gray-600 mt-1">{hemoglobin.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const wbc = getObservationValue(selectedPatient.observations, 'WBC');
                      return wbc && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">WBC</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {wbc.value_numeric} <span className="text-sm font-normal text-gray-600">{wbc.unit}</span>
                          </div>
                          {wbc.notes && <div className="text-xs text-gray-600 mt-1">{wbc.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const platelets = getObservationValue(selectedPatient.observations, 'platelets');
                      return platelets && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Platelets</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {platelets.value_numeric} <span className="text-sm font-normal text-gray-600">{platelets.unit}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const sodium = getObservationValue(selectedPatient.observations, 'sodium');
                      return sodium && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Sodium</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {sodium.value_numeric} <span className="text-sm font-normal text-gray-600">{sodium.unit}</span>
                          </div>
                          {sodium.notes && <div className="text-xs text-gray-600 mt-1">{sodium.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const potassium = getObservationValue(selectedPatient.observations, 'potassium');
                      return potassium && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Potassium</div>
                          <div className={`text-2xl font-bold mt-1 ${getLabValueColor('potassium', potassium.value_numeric || 0)}`}>
                            {potassium.value_numeric} <span className="text-sm font-normal text-gray-600">{potassium.unit}</span>
                          </div>
                          {potassium.notes && <div className="text-xs text-gray-600 mt-1">{potassium.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const chloride = getObservationValue(selectedPatient.observations, 'chloride');
                      return chloride && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Chloride</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {chloride.value_numeric} <span className="text-sm font-normal text-gray-600">{chloride.unit}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const bicarbonate = getObservationValue(selectedPatient.observations, 'bicarbonate');
                      return bicarbonate && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Bicarbonate</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {bicarbonate.value_numeric} <span className="text-sm font-normal text-gray-600">{bicarbonate.unit}</span>
                          </div>
                          {bicarbonate.notes && <div className="text-xs text-gray-600 mt-1">{bicarbonate.notes}</div>}
                        </div>
                      );
                    })()}
                    {(() => {
                      const magnesium = getObservationValue(selectedPatient.observations, 'magnesium');
                      return magnesium && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Magnesium</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {magnesium.value_numeric} <span className="text-sm font-normal text-gray-600">{magnesium.unit}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const calcium = getObservationValue(selectedPatient.observations, 'calcium');
                      return calcium && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Calcium</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {calcium.value_numeric} <span className="text-sm font-normal text-gray-600">{calcium.unit}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const phosphorus = getObservationValue(selectedPatient.observations, 'phosphorus');
                      return phosphorus && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Phosphorus</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {phosphorus.value_numeric} <span className="text-sm font-normal text-gray-600">{phosphorus.unit}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {(() => {
                      const albumin = getObservationValue(selectedPatient.observations, 'albumin');
                      return albumin && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-xs text-gray-600 uppercase">Albumin</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">
                            {albumin.value_numeric} <span className="text-sm font-normal text-gray-600">{albumin.unit}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Active Conditions */}
              {selectedPatient.conditions && selectedPatient.conditions.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Diagnoses & Conditions
                  </h3>
                  <div className="space-y-3">
                    {selectedPatient.conditions.map((condition, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{condition.condition_name}</div>
                            <div className="text-sm text-gray-600 mt-1">ICD-10: {condition.condition_code}</div>
                            {condition.onset_date && (
                              <div className="text-sm text-gray-600 mt-1">Onset: {formatDate(condition.onset_date)}</div>
                            )}
                            {condition.notes && (
                              <div className="text-sm text-gray-600 mt-2 italic">{condition.notes}</div>
                            )}
                          </div>
                          <div className="ml-4 flex flex-col items-end gap-2">
                            {condition.severity && (
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(condition.severity)}`}>
                                {condition.severity}
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                              condition.clinical_status === 'active' ? 'bg-green-100 text-green-700 border border-green-300' :
                              condition.clinical_status === 'resolved' ? 'bg-gray-100 text-gray-700 border border-gray-300' :
                              'bg-yellow-100 text-yellow-700 border border-yellow-300'
                            }`}>
                              {condition.clinical_status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Assessment */}
              {selectedPatient.risk_assessment && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Risk Assessment
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600">Risk Score</div>
                      <div className="text-3xl font-bold text-gray-900 mt-1">
                        {typeof selectedPatient.risk_assessment.risk_score === 'number'
                          ? selectedPatient.risk_assessment.risk_score.toFixed(2)
                          : 'N/A'}
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600">Risk Level</div>
                      <span className={`inline-block px-4 py-2 rounded-full text-lg font-bold mt-1 border ${getRiskColor(selectedPatient.risk_assessment?.risk_level)}`}>
                        {selectedPatient.risk_assessment?.risk_level?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600">Assessed</div>
                      <div className="text-lg font-semibold text-gray-900 mt-1">{formatDate(selectedPatient.risk_assessment?.assessed_at)}</div>
                    </div>
                  </div>
                  {selectedPatient.risk_assessment?.reasoning && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Reasoning</div>
                      <div className="text-sm text-gray-700">{selectedPatient.risk_assessment.reasoning}</div>
                    </div>
                  )}
                  {selectedPatient.risk_assessment?.recommendations && selectedPatient.risk_assessment.recommendations.length > 0 && (
                    <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Recommendations</div>
                      <ul className="list-disc list-inside space-y-1">
                        {selectedPatient.risk_assessment.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-gray-700">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Show landing page if enabled
  if (showLandingPage) {
    return <LandingPage onEnterApp={() => setShowLandingPage(false)} />;
  }

  // Main patient list view
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setShowLandingPage(true);
                }}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors shadow-md flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Home</span>
              </button>
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-5xl font-bold text-gray-900 mb-2">
                RenalGuard AI
              </h1>
              <p className="text-xl text-gray-600">
                Patient Database
              </p>
            </div>
            <div className="flex-1 flex justify-end gap-3">
              <button
                onClick={() => setShowDoctorAssignment(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-lg flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Manage Doctors</span>
              </button>
            </div>
          </div>
        </header>

        {/* Doctor Assignment Interface */}
        {showDoctorAssignment && (
          <DoctorAssignmentInterface
            apiUrl={API_URL}
            onClose={() => setShowDoctorAssignment(false)}
          />
        )}

        {/* Filter Component */}
        {!loading && !error && patients.length > 0 && statistics && (
          <div className="max-w-6xl mx-auto">
            <PatientFilters
              statistics={statistics}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
              onResetAll={handleResetAll}
            />
          </div>
        )}

        {/* Search Bar */}
        {!loading && !error && patients.length > 0 && (
          <div className="max-w-6xl mx-auto mb-6">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patients by name, MRN, email, or ID..."
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <div className="mt-2 text-sm text-gray-600">
                  Found <strong>{filteredPatients.length}</strong> {filteredPatients.length === 1 ? 'patient' : 'patients'}
                  {filteredPatients.length < patients.length && (
                    <span> out of {patients.length} total</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-6xl mx-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
              <p className="text-gray-600 text-lg">Loading patients...</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 shadow-lg">
              <div className="flex items-center">
                <svg className="h-8 w-8 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-red-800 font-semibold text-lg">Error Loading Patients</h3>
                  <p className="text-red-700 mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={fetchPatients}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && patients.length === 0 && (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">No Patients Found</h3>

              {hasActiveFilters() ? (
                <>
                  <p className="text-gray-600 mb-6">No patients match the current filter criteria. Try adjusting your filters or return to the main view.</p>
                  <button
                    onClick={clearAllFilters}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold flex items-center gap-2 mx-auto"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to All Patients
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-6">The database is empty. Click below to populate it with sample patients.</p>
                  <button
                    onClick={populateDatabase}
                    disabled={populating}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {populating ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Populating Database...
                      </span>
                    ) : (
                      'Populate Database with Sample Patients'
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {!loading && !error && patients.length > 0 && (
            <div className="bg-white rounded-lg shadow-xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <h2 className="text-2xl font-bold text-white">
                  Patients ({filteredPatients.length}{searchQuery && patients.length !== filteredPatients.length ? ` of ${patients.length}` : ''})
                </h2>
              </div>

              {/* Patient List
                  Changes Summary:
                  - Removed batch size selector menu (now processes all 1000 patients by default)
                  - Removed Settings modal and email configuration UI
                  - Advance Cycle button now processes all patients automatically
                  - Backend generates additional clinical variables per patient (see advance-cycle endpoint)
                  - Patient evolution summaries are displayed as badges showing cycle-to-cycle changes
              */}
              <div className="divide-y divide-gray-200">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => handlePatientClick(patient.id)}
                    className="px-6 py-5 hover:bg-indigo-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {patient.first_name} {patient.last_name}
                          </h3>
                          {patient.kdigo_classification && (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              patient.kdigo_classification?.has_ckd
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}>
                              {patient.kdigo_classification?.has_ckd ? 'CKD' : 'No CKD'}
                            </span>
                          )}
                          {/* Risk Category Badge - Use non_ckd_risk_level for non-CKD patients to match filter */}
                          {patient.kdigo_classification && !patient.kdigo_classification?.has_ckd && patient.non_ckd_risk_level ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRiskCategoryBadgeColor(
                              patient.non_ckd_risk_level === 'low' ? 'Low Risk' :
                              patient.non_ckd_risk_level === 'moderate' ? 'Moderate Risk' : 'High Risk'
                            )}`}>
                              {patient.non_ckd_risk_level === 'low' ? 'Low Risk' :
                               patient.non_ckd_risk_level === 'moderate' ? 'Moderate Risk' : 'High Risk'}
                            </span>
                          ) : patient.risk_category ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRiskCategoryBadgeColor(patient.risk_category)}`}>
                              {patient.risk_category}
                            </span>
                          ) : null}
                          {/* Monitoring/Treatment Status Badge */}
                          {patient.kdigo_classification && !patient.kdigo_classification?.has_ckd && (
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              (patient.is_monitored !== undefined ? patient.is_monitored : patient.home_monitoring_active)
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-gray-100 text-gray-600 border border-gray-300'
                            }`}>
                              {(patient.is_monitored !== undefined ? patient.is_monitored : patient.home_monitoring_active) ? '✓ Monitored' : 'Not Monitored'}
                            </span>
                          )}
                          {patient.kdigo_classification && patient.kdigo_classification?.has_ckd && (
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              (patient.is_treated !== undefined ? patient.is_treated : patient.ckd_treatment_active)
                                ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                : 'bg-gray-100 text-gray-600 border border-gray-300'
                            }`}>
                              {(patient.is_treated !== undefined ? patient.is_treated : patient.ckd_treatment_active) ? '✓ Under Treatment' : 'Not Treated'}
                            </span>
                          )}
                          {/* Evolution Summary from AI */}
                          {patient.evolution_summary && (
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              patient.evolution_summary.includes('critical') || patient.evolution_summary.includes('worsening') || patient.evolution_summary.includes('worsened') || patient.evolution_summary.includes('increasing')
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : patient.evolution_summary.includes('improving')
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : patient.evolution_summary === 'stable'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-gray-100 text-gray-800 border border-gray-300'
                            }`}>
                              {patient.evolution_summary}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                          <span className="flex items-center">
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                            </svg>
                            MRN: <strong className="ml-1">{patient.medical_record_number}</strong>
                          </span>
                          <span className="flex items-center">
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Age: <strong className="ml-1">{calculateAge(patient.date_of_birth)}</strong>
                          </span>
                          <span className="flex items-center capitalize">
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {patient.gender}
                          </span>
                          {patient.email && (
                            <span className="flex items-center">
                              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {patient.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex items-center">
                        <div className="mr-4">
                          <div className="text-xs text-gray-500">Patient ID</div>
                          <div className="text-xs font-mono text-gray-700 mt-1">{patient.id.substring(0, 8)}...</div>
                        </div>
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>

                    {/* Clinical Summary and Recommended Actions - Show for all patients with comments */}
                    {patient.latest_comment && (patient.latest_comment.clinical_summary || (patient.latest_comment.recommended_actions && patient.latest_comment.recommended_actions.length > 0)) && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        {patient.latest_comment.clinical_summary && (
                          <div className="mb-3">
                            <div className="flex items-start">
                              <svg className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${
                                patient.latest_comment.change_type === 'worsened' || patient.latest_comment.severity === 'critical'
                                  ? 'text-amber-500'
                                  : patient.latest_comment.change_type === 'improved'
                                  ? 'text-green-500'
                                  : 'text-blue-500'
                              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="flex-1">
                                <span className={`text-xs font-semibold uppercase ${
                                  patient.latest_comment.change_type === 'worsened' || patient.latest_comment.severity === 'critical'
                                    ? 'text-amber-700'
                                    : patient.latest_comment.change_type === 'improved'
                                    ? 'text-green-700'
                                    : 'text-blue-700'
                                }`}>
                                  {patient.latest_comment.change_type === 'worsened' || patient.latest_comment.severity === 'critical'
                                    ? 'Reason for Concern:'
                                    : patient.latest_comment.change_type === 'improved'
                                    ? 'Clinical Update:'
                                    : 'Clinical Summary:'}
                                </span>
                                <p className="text-sm text-gray-700 mt-1">{patient.latest_comment.clinical_summary}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {patient.latest_comment.recommended_actions && patient.latest_comment.recommended_actions.length > 0 && (
                          <div>
                            <div className="flex items-start">
                              <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                              </svg>
                              <div className="flex-1">
                                <span className="text-xs font-semibold text-blue-700 uppercase">Imminent Actions:</span>
                                <ul className="mt-1 space-y-1">
                                  {patient.latest_comment.recommended_actions.slice(0, 3).map((action, idx) => (
                                    <li key={idx} className="text-sm text-gray-700 flex items-start">
                                      <span className="text-blue-500 mr-2">•</span>
                                      <span>{action}</span>
                                    </li>
                                  ))}
                                </ul>
                                {patient.latest_comment.recommended_actions.length > 3 && (
                                  <p className="text-xs text-gray-500 mt-1 italic">Click to view {patient.latest_comment.recommended_actions.length - 3} more action{patient.latest_comment.recommended_actions.length - 3 > 1 ? 's' : ''}...</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  ))
                ) : (
                  <div className="px-6 py-12 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No patients found</h3>
                    <p className="text-gray-600">Try adjusting your search terms</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-600 text-sm">
          <p>RenalGuard AI Clinical Data Analyzer</p>
        </footer>
      </div>

      {/* Doctor Assistant Chat Bar */}
      <DoctorChatBar
        currentPatientId={(selectedPatient as PatientDetail | null)?.id}
        apiBaseUrl={import.meta.env.VITE_API_URL || 'http://localhost:3000'}
      />
    </div>
  );
}

export default App;
