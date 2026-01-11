import { FC } from 'react';

interface FilterProps {
  statistics: any;
  activeFilters: {
    patientType: 'all' | 'ckd' | 'non-ckd' | 'health-state-changed';
    ckdSeverity: string | null;
    ckdTreatment: string | null;
    nonCkdRisk: string | null;
    nonCkdMonitoring: string | null;
    healthStateChangeDays: number;
    healthStateChangeType: 'any' | 'improved' | 'worsened';
  };
  onFilterChange: (filters: any) => void;
  onResetAll?: () => void;
}

const PatientFilters: FC<FilterProps> = ({ statistics, activeFilters, onFilterChange, onResetAll }) => {
  if (!statistics) return null;

  const { ckd, non_ckd, total_patients, health_state_changes } = statistics;

  const handlePatientTypeChange = (type: 'all' | 'ckd' | 'non-ckd' | 'health-state-changed') => {
    onFilterChange({
      patientType: type,
      ckdSeverity: null,
      ckdTreatment: null,
      nonCkdRisk: null,
      nonCkdMonitoring: null,
      healthStateChangeDays: 30,
      healthStateChangeType: 'any'
    });
  };

  const handleCkdSeverityChange = (severity: string | null) => {
    onFilterChange({
      ...activeFilters,
      ckdSeverity: severity,
      ckdTreatment: null
    });
  };

  const handleCkdTreatmentChange = (treatment: string | null) => {
    onFilterChange({
      ...activeFilters,
      ckdTreatment: treatment
    });
  };

  const handleNonCkdRiskChange = (risk: string | null) => {
    onFilterChange({
      ...activeFilters,
      nonCkdRisk: risk,
      nonCkdMonitoring: null
    });
  };

  const handleNonCkdMonitoringChange = (monitoring: string | null) => {
    onFilterChange({
      ...activeFilters,
      nonCkdMonitoring: monitoring
    });
  };

  const handleHealthStateChangeDaysChange = (days: number) => {
    onFilterChange({
      ...activeFilters,
      healthStateChangeDays: days
    });
  };

  const handleHealthStateChangeTypeChange = (type: 'any' | 'improved' | 'worsened') => {
    onFilterChange({
      ...activeFilters,
      healthStateChangeType: type
    });
  };

  const isFilterActive = (filterName: string, value: string | null) => {
    switch (filterName) {
      case 'patientType':
        return activeFilters.patientType === value;
      case 'ckdSeverity':
        return activeFilters.ckdSeverity === value;
      case 'ckdTreatment':
        return activeFilters.ckdTreatment === value;
      case 'nonCkdRisk':
        return activeFilters.nonCkdRisk === value;
      case 'nonCkdMonitoring':
        return activeFilters.nonCkdMonitoring === value;
      default:
        return false;
    }
  };

  const FilterButton: FC<{ label: string; count: number; active: boolean; onClick: () => void; color: string }> =
    ({ label, count, active, onClick, color }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
        active
          ? `${color} text-white shadow-md`
          : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {label} <span className={`ml-1 ${active ? 'text-white' : 'text-gray-500'}`}>({count})</span>
    </button>
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Filter Patients</h3>
        <div className="text-sm text-gray-600">
          Total: <span className="font-semibold">{total_patients}</span> patients
        </div>
      </div>

      {/* Primary Filter: CKD vs Non-CKD */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Patient Type</label>
        <div className="flex gap-3 flex-wrap">
          <FilterButton
            label="All Patients"
            count={total_patients}
            active={isFilterActive('patientType', 'all')}
            onClick={() => handlePatientTypeChange('all')}
            color="bg-indigo-600"
          />
          <FilterButton
            label="CKD Patients"
            count={ckd.total}
            active={isFilterActive('patientType', 'ckd')}
            onClick={() => handlePatientTypeChange('ckd')}
            color="bg-red-600"
          />
          <FilterButton
            label="Non-CKD Patients"
            count={non_ckd.total}
            active={isFilterActive('patientType', 'non-ckd')}
            onClick={() => handlePatientTypeChange('non-ckd')}
            color="bg-blue-600"
          />
          <button
            onClick={() => handlePatientTypeChange('health-state-changed')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeFilters.patientType === 'health-state-changed'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Recent Health State Changes</span>
            </div>
          </button>
          {onResetAll && (
            <button
              onClick={onResetAll}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg"
              title="Reset all patients to original baseline state (removes all updates and comments)"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset All Patients</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* CKD Severity Filter */}
      {activeFilters.patientType === 'ckd' && (
        <div className="mb-6 pl-4 border-l-4 border-red-300">
          <label className="block text-sm font-semibold text-gray-700 mb-2">CKD Severity</label>
          <div className="flex gap-3 flex-wrap">
            <FilterButton
              label="All Severities"
              count={ckd.total}
              active={activeFilters.ckdSeverity === null}
              onClick={() => handleCkdSeverityChange(null)}
              color="bg-red-600"
            />
            {ckd.mild.total > 0 && (
              <FilterButton
                label="Mild CKD"
                count={ckd.mild.total}
                active={isFilterActive('ckdSeverity', 'mild')}
                onClick={() => handleCkdSeverityChange('mild')}
                color="bg-yellow-500"
              />
            )}
            {ckd.moderate.total > 0 && (
              <FilterButton
                label="Moderate CKD"
                count={ckd.moderate.total}
                active={isFilterActive('ckdSeverity', 'moderate')}
                onClick={() => handleCkdSeverityChange('moderate')}
                color="bg-orange-500"
              />
            )}
            {ckd.severe.total > 0 && (
              <FilterButton
                label="Severe CKD"
                count={ckd.severe.total}
                active={isFilterActive('ckdSeverity', 'severe')}
                onClick={() => handleCkdSeverityChange('severe')}
                color="bg-red-600"
              />
            )}
            {ckd.kidney_failure.total > 0 && (
              <FilterButton
                label="Kidney Failure"
                count={ckd.kidney_failure.total}
                active={isFilterActive('ckdSeverity', 'kidney_failure')}
                onClick={() => handleCkdSeverityChange('kidney_failure')}
                color="bg-purple-600"
              />
            )}
          </div>

          {/* CKD Treatment Status Filter */}
          {activeFilters.ckdSeverity && (
            <div className="mt-4 pl-4 border-l-4 border-gray-300">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Treatment Status</label>
              <div className="flex gap-3 flex-wrap">
                {(() => {
                  const severityData = ckd[activeFilters.ckdSeverity];
                  if (!severityData) return null;
                  return (
                    <>
                      <FilterButton
                        label="All"
                        count={severityData.total}
                        active={activeFilters.ckdTreatment === null}
                        onClick={() => handleCkdTreatmentChange(null)}
                        color="bg-gray-600"
                      />
                      {severityData.treated > 0 && (
                        <FilterButton
                          label="Treated"
                          count={severityData.treated}
                          active={isFilterActive('ckdTreatment', 'treated')}
                          onClick={() => handleCkdTreatmentChange('treated')}
                          color="bg-green-600"
                        />
                      )}
                      {severityData.not_treated > 0 && (
                        <FilterButton
                          label="Not Treated"
                          count={severityData.not_treated}
                          active={isFilterActive('ckdTreatment', 'not_treated')}
                          onClick={() => handleCkdTreatmentChange('not_treated')}
                          color="bg-gray-500"
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Non-CKD Risk Level Filter */}
      {activeFilters.patientType === 'non-ckd' && (
        <div className="mb-6 pl-4 border-l-4 border-blue-300">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Risk Level</label>
          <div className="flex gap-3 flex-wrap">
            <FilterButton
              label="All Risk Levels"
              count={non_ckd.total}
              active={activeFilters.nonCkdRisk === null}
              onClick={() => handleNonCkdRiskChange(null)}
              color="bg-blue-600"
            />
            {non_ckd.low.total > 0 && (
              <FilterButton
                label="Low Risk"
                count={non_ckd.low.total}
                active={isFilterActive('nonCkdRisk', 'low')}
                onClick={() => handleNonCkdRiskChange('low')}
                color="bg-green-500"
              />
            )}
            {non_ckd.moderate.total > 0 && (
              <FilterButton
                label="Moderate Risk"
                count={non_ckd.moderate.total}
                active={isFilterActive('nonCkdRisk', 'moderate')}
                onClick={() => handleNonCkdRiskChange('moderate')}
                color="bg-yellow-500"
              />
            )}
            {non_ckd.high.total > 0 && (
              <FilterButton
                label="High Risk"
                count={non_ckd.high.total}
                active={isFilterActive('nonCkdRisk', 'high')}
                onClick={() => handleNonCkdRiskChange('high')}
                color="bg-orange-600"
              />
            )}
          </div>

          {/* Non-CKD Monitoring Status Filter (only for high risk) */}
          {activeFilters.nonCkdRisk === 'high' && (
            <div className="mt-4 pl-4 border-l-4 border-gray-300">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Monitoring Status</label>
              <div className="flex gap-3 flex-wrap">
                {(() => {
                  const highRiskData = non_ckd.high;
                  if (!highRiskData) return null;
                  return (
                    <>
                      <FilterButton
                        label="All"
                        count={highRiskData.total}
                        active={activeFilters.nonCkdMonitoring === null}
                        onClick={() => handleNonCkdMonitoringChange(null)}
                        color="bg-gray-600"
                      />
                      {highRiskData.monitored > 0 && (
                        <FilterButton
                          label="Monitored"
                          count={highRiskData.monitored}
                          active={isFilterActive('nonCkdMonitoring', 'monitored')}
                          onClick={() => handleNonCkdMonitoringChange('monitored')}
                          color="bg-green-600"
                        />
                      )}
                      {highRiskData.not_monitored > 0 && (
                        <FilterButton
                          label="Not Monitored"
                          count={highRiskData.not_monitored}
                          active={isFilterActive('nonCkdMonitoring', 'not_monitored')}
                          onClick={() => handleNonCkdMonitoringChange('not_monitored')}
                          color="bg-gray-500"
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Health State Change Filters */}
      {activeFilters.patientType === 'health-state-changed' && (
        <div className="mb-6 pl-4 border-l-4 border-purple-300">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Health State Change Filters</label>

          {/* Time Period Filter */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Time Period</label>
            <div className="flex gap-3 flex-wrap">
              <FilterButton
                label="Last 7 days"
                count={health_state_changes?.days_7?.total || 0}
                active={activeFilters.healthStateChangeDays === 7}
                onClick={() => handleHealthStateChangeDaysChange(7)}
                color="bg-purple-500"
              />
              <FilterButton
                label="Last 30 days"
                count={health_state_changes?.days_30?.total || 0}
                active={activeFilters.healthStateChangeDays === 30}
                onClick={() => handleHealthStateChangeDaysChange(30)}
                color="bg-purple-600"
              />
              <FilterButton
                label="Last 90 days"
                count={health_state_changes?.days_90?.total || 0}
                active={activeFilters.healthStateChangeDays === 90}
                onClick={() => handleHealthStateChangeDaysChange(90)}
                color="bg-purple-700"
              />
            </div>
          </div>

          {/* Change Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Change Type</label>
            <div className="flex gap-3 flex-wrap">
              {(() => {
                const currentPeriodData = activeFilters.healthStateChangeDays === 7
                  ? health_state_changes?.days_7
                  : activeFilters.healthStateChangeDays === 30
                  ? health_state_changes?.days_30
                  : health_state_changes?.days_90;

                return (
                  <>
                    <FilterButton
                      label="All Changes"
                      count={currentPeriodData?.total || 0}
                      active={activeFilters.healthStateChangeType === 'any'}
                      onClick={() => handleHealthStateChangeTypeChange('any')}
                      color="bg-gray-600"
                    />
                    <FilterButton
                      label="Improved"
                      count={currentPeriodData?.improved || 0}
                      active={activeFilters.healthStateChangeType === 'improved'}
                      onClick={() => handleHealthStateChangeTypeChange('improved')}
                      color="bg-green-600"
                    />
                    <FilterButton
                      label="Worsened"
                      count={currentPeriodData?.worsened || 0}
                      active={activeFilters.healthStateChangeType === 'worsened'}
                      onClick={() => handleHealthStateChangeTypeChange('worsened')}
                      color="bg-red-600"
                    />
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {(activeFilters.patientType === 'ckd' || activeFilters.patientType === 'non-ckd' || activeFilters.ckdSeverity || activeFilters.nonCkdRisk) && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Active Filters:</span>
              {(activeFilters.patientType === 'ckd' || activeFilters.patientType === 'non-ckd') && (
                <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                  {activeFilters.patientType === 'ckd' ? 'CKD' : 'Non-CKD'}
                </span>
              )}
              {activeFilters.ckdSeverity && (
                <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                  {activeFilters.ckdSeverity}
                </span>
              )}
              {activeFilters.ckdTreatment && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  {activeFilters.ckdTreatment === 'treated' ? 'Treated' : 'Not Treated'}
                </span>
              )}
              {activeFilters.nonCkdRisk && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  {activeFilters.nonCkdRisk} risk
                </span>
              )}
              {activeFilters.nonCkdMonitoring && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  {activeFilters.nonCkdMonitoring === 'monitored' ? 'Monitored' : 'Not Monitored'}
                </span>
              )}
            </div>
            <button
              onClick={() => handlePatientTypeChange('all')}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientFilters;
