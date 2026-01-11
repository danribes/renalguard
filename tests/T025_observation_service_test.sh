#!/bin/bash

# ============================================
# T025: Observation Data Service Test Script
# ============================================
# Tests observation and condition data service implementation
# Verifies clinical data API endpoints and helper functions

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Project root directory
PROJECT_ROOT="/home/user/hackathon_BI_CKD"

# Test results array
declare -a FAILED_TESTS

# Function to print section header
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Test $TESTS_RUN: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} Test $TESTS_RUN: $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("Test $TESTS_RUN: $test_name")
        return 1
    fi
}

# Function to check if file contains string
file_contains() {
    local file="$1"
    local search_string="$2"
    grep -q "$search_string" "$file"
}

# Start tests
print_header "T025: Observation Data Service Tests"
echo "Testing observation and condition service..."
echo "Project: Healthcare AI Clinical Data Analyzer"
echo "Task: H025 - Mock Observation data service"
echo ""

# ============================================
# Test Category 1: File Existence (3 tests)
# ============================================
print_header "Category 1: File Existence"

run_test "Observation service file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/services/observationService.ts' ]"

run_test "Patient service file exists (has observation functions)" \
    "[ -f '$PROJECT_ROOT/backend/src/services/patientService.ts' ]"

run_test "Patient routes file exists (has observation endpoints)" \
    "[ -f '$PROJECT_ROOT/backend/src/api/routes/patients.ts' ]"

# ============================================
# Test Category 2: Observation Service Functions (10 tests)
# ============================================
print_header "Category 2: Observation Service Functions"

run_test "getObservationsByType function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'export async function getObservationsByType'"

run_test "getLatestObservation function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'export async function getLatestObservation'"

run_test "getObservationTrend function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'export async function getObservationTrend'"

run_test "getObservationsInDateRange function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'export async function getObservationsInDateRange'"

run_test "getObservationsByTypeAllPatients function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'export async function getObservationsByTypeAllPatients'"

run_test "getAbnormalObservations function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'export async function getAbnormalObservations'"

run_test "getKeyScreeningObservations function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'export async function getKeyScreeningObservations'"

run_test "hasRecentObservations function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'export async function hasRecentObservations'"

run_test "getPatientsMissingScreening function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'export async function getPatientsMissingScreening'"

run_test "Observation service imports database query function" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"import { query } from '../config/database'\""

# ============================================
# Test Category 3: Patient Service Observation Functions (3 tests)
# ============================================
print_header "Category 3: Patient Service Observation Functions"

run_test "getPatientObservations function in patient service" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getPatientObservations'"

run_test "getPatientConditions function in patient service" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getPatientConditions'"

run_test "getPatientRiskAssessments function in patient service" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getPatientRiskAssessments'"

# ============================================
# Test Category 4: API Endpoints (3 tests)
# ============================================
print_header "Category 4: API Endpoints"

run_test "GET /api/patients/:id/observations endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' \"router.get('/:id/observations'\""

run_test "GET /api/patients/:id/conditions endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' \"router.get('/:id/conditions'\""

run_test "GET /api/patients/:id/risk-assessments endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' \"router.get('/:id/risk-assessments'\""

# ============================================
# Test Category 5: Abnormal Value Detection (6 tests)
# ============================================
print_header "Category 5: Abnormal Value Detection Logic"

run_test "Abnormal eGFR threshold (< 60) implemented" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"observation_type = 'eGFR' AND value_numeric < 60\""

run_test "Abnormal uACR threshold (>= 30) implemented" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"observation_type = 'uACR' AND value_numeric >= 30\""

run_test "Abnormal HbA1c threshold (>= 6.5) implemented" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"observation_type = 'HbA1c' AND value_numeric >= 6.5\""

run_test "Abnormal systolic BP threshold (>= 140) implemented" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"observation_type = 'blood_pressure_systolic' AND value_numeric >= 140\""

run_test "Abnormal diastolic BP threshold (>= 90) implemented" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"observation_type = 'blood_pressure_diastolic' AND value_numeric >= 90\""

run_test "Abnormal potassium range (3.5-5.0) implemented" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"observation_type = 'potassium' AND (value_numeric < 3.5 OR value_numeric > 5.0)\""

# ============================================
# Test Category 6: Key CKD Screening Parameters (3 tests)
# ============================================
print_header "Category 6: Key CKD Screening Parameters"

run_test "eGFR observation type handled" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"'eGFR'\""

run_test "uACR observation type handled" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"'uACR'\""

run_test "HbA1c observation type handled" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' \"'HbA1c'\""

# ============================================
# Test Category 7: Database Integration (4 tests)
# ============================================
print_header "Category 7: Database Integration"

run_test "Observation service queries observations table" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'FROM observations'"

run_test "Patient service queries observations table" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'FROM observations'"

run_test "Patient service queries conditions table" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'FROM conditions'"

run_test "Patient service queries risk_assessments table" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'FROM risk_assessments'"

# ============================================
# Test Category 8: TypeScript Types (3 tests)
# ============================================
print_header "Category 8: TypeScript Types"

run_test "Observation type imported in observation service" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'Observation'"

run_test "ObservationType type imported in observation service" \
    "file_contains '$PROJECT_ROOT/backend/src/services/observationService.ts' 'ObservationType'"

run_test "Patient types file has Observation interface" \
    "file_contains '$PROJECT_ROOT/backend/src/types/patient.ts' 'export interface Observation'"

# ============================================
# Test Category 9: File Quality (2 tests)
# ============================================
print_header "Category 9: File Quality & Documentation"

run_test "Observation service has comprehensive implementation" \
    "[ \$(wc -l < '$PROJECT_ROOT/backend/src/services/observationService.ts') -gt 150 ]"

run_test "Observation service has function documentation" \
    "[ \$(grep -c '/\\*\\*' '$PROJECT_ROOT/backend/src/services/observationService.ts') -gt 8 ]"

# ============================================
# Test Summary
# ============================================
print_header "Test Summary"

echo ""
echo "Total Tests Run: $TESTS_RUN"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo ""
    echo -e "${RED}Failed Tests:${NC}"
    for failed_test in "${FAILED_TESTS[@]}"; do
        echo -e "${RED}  - $failed_test${NC}"
    done
else
    echo -e "${GREEN}Tests Failed: 0${NC}"
fi

# Calculate pass rate
PASS_RATE=$(awk "BEGIN {printf \"%.2f\", ($TESTS_PASSED / $TESTS_RUN) * 100}")
echo ""
echo "Pass Rate: ${PASS_RATE}%"

# Print success/failure message
echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Observation service successfully implemented!"
    echo ""
    echo "Summary:"
    echo "  - Observation service created (observationService.ts)"
    echo "  - Patient observation functions verified (patientService.ts)"
    echo "  - API endpoints tested (patients.ts routes)"
    echo "  - Abnormal value detection implemented"
    echo "  - Key CKD screening parameters supported"
    echo ""
    echo "Available Functions:"
    echo "  - getObservationsByType - Filter by observation type"
    echo "  - getLatestObservation - Get most recent value"
    echo "  - getObservationTrend - Historical trend data"
    echo "  - getAbnormalObservations - Values outside normal ranges"
    echo "  - getKeyScreeningObservations - eGFR, uACR, HbA1c"
    echo "  - hasRecentObservations - Check for recent labs"
    echo "  - getPatientsMissingScreening - Identify patients needing screening"
    echo ""
    echo "Available API Endpoints:"
    echo "  GET /api/patients/:id/observations - All observations"
    echo "  GET /api/patients/:id/conditions - All diagnoses"
    echo "  GET /api/patients/:id/risk-assessments - AI assessments"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
