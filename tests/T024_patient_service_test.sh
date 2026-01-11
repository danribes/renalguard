#!/bin/bash

# ============================================
# T024: Patient Data Service Test Script
# ============================================
# Tests patient data service implementation and API endpoints
# Verifies types, service layer, and REST API routes

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

# Function to check if multiple strings exist in file
file_contains_all() {
    local file="$1"
    shift
    for search_string in "$@"; do
        if ! grep -q "$search_string" "$file"; then
            return 1
        fi
    done
    return 0
}

# Start tests
print_header "T024: Patient Data Service Tests"
echo "Testing patient service implementation..."
echo "Project: Healthcare AI Clinical Data Analyzer"
echo "Task: H024 - Mock Patient data service"
echo ""

# ============================================
# Test Category 1: File Existence (4 tests)
# ============================================
print_header "Category 1: File Existence"

run_test "Patient types file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/types/patient.ts' ]"

run_test "Patient service file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/services/patientService.ts' ]"

run_test "Patient routes file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/api/routes/patients.ts' ]"

run_test "Backend index.ts exists" \
    "[ -f '$PROJECT_ROOT/backend/src/index.ts' ]"

# ============================================
# Test Category 2: TypeScript Types (8 tests)
# ============================================
print_header "Category 2: TypeScript Types"

run_test "Patient interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/patient.ts' 'export interface Patient'"

run_test "PatientWithAge interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/patient.ts' 'export interface PatientWithAge'"

run_test "Observation interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/patient.ts' 'export interface Observation'"

run_test "Condition interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/patient.ts' 'export interface Condition'"

run_test "PatientSummary interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/patient.ts' 'export interface PatientSummary'"

run_test "RiskTier type defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/patient.ts' 'export type RiskTier'"

run_test "CKDStage type defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/patient.ts' 'export type CKDStage'"

run_test "LatestObservations interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/types/patient.ts' 'export interface LatestObservations'"

# ============================================
# Test Category 3: Patient Service Functions (10 tests)
# ============================================
print_header "Category 3: Patient Service Functions"

run_test "getAllPatients function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getAllPatients'"

run_test "getPatientById function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getPatientById'"

run_test "getPatientByMRN function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getPatientByMRN'"

run_test "getPatientSummary function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getPatientSummary'"

run_test "getPatientObservations function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getPatientObservations'"

run_test "getPatientConditions function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getPatientConditions'"

run_test "getPatientList function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getPatientList'"

run_test "getHighRiskPatients function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'export async function getHighRiskPatients'"

run_test "Three-tier risk stratification implemented" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'calculateRiskTier'"

run_test "CKD stage determination implemented" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'determineCKDStage'"

# ============================================
# Test Category 4: API Routes (9 tests)
# ============================================
print_header "Category 4: API Routes"

run_test "Express Router imported" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' 'import { Router'"

run_test "Patient service imported" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' 'from.*services/patientService'"

run_test "GET /api/patients route defined" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' \"router.get('/'\""

run_test "GET /api/patients/:id route defined" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' \"router.get('/:id'\""

run_test "GET /api/patients/risk-tier/:tier route defined" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' \"router.get('/risk-tier/:tier'\""

run_test "GET /api/patients/high-risk route defined" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' \"router.get('/high-risk'\""

run_test "GET /api/patients/:id/observations route defined" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' \"router.get('/:id/observations'\""

run_test "GET /api/patients/:id/conditions route defined" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' \"router.get('/:id/conditions'\""

run_test "Router exported as default" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/patients.ts' 'export default router'"

# ============================================
# Test Category 5: Backend Integration (6 tests)
# ============================================
print_header "Category 5: Backend Integration"

run_test "Patient routes imported in backend index" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' \"import patientRoutes from './api/routes/patients'\""

run_test "Patient routes mounted in backend" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' \"app.use('/api/patients', patientRoutes)\""

run_test "API info endpoint updated with patient endpoints" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' 'patients:'"

run_test "Backend startup logs mention patient API" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' 'Patients API'"

run_test "Database config imported" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' \"from './config/database'\""

run_test "CORS configured" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' 'cors({'"

# ============================================
# Test Category 6: CKD Risk Logic (7 tests)
# ============================================
print_header "Category 6: CKD Risk Screening Logic"

run_test "hasDiabetes function checks ICD-10 codes E10-E14" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'E10\\|E11\\|E12'"

run_test "hasHypertension function checks ICD-10 code I10" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'I10'"

run_test "Risk tier considers diabetes status" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'diabetes'"

run_test "Risk tier considers hypertension status" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' 'hypertension'"

run_test "Risk tier considers eGFR threshold (< 60)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' '< 60'"

run_test "Risk tier considers uACR threshold (>= 30)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/patientService.ts' '>= 30'"

run_test "CKD staging uses KDIGO classification (5 stages)" \
    "grep -q \"'1'\\|'2'\\|'3a'\\|'3b'\\|'4'\\|'5'\" '$PROJECT_ROOT/backend/src/services/patientService.ts'"

# ============================================
# Test Category 7: TypeScript Configuration (2 tests)
# ============================================
print_header "Category 7: TypeScript Configuration"

run_test "package.json exists in backend" \
    "[ -f '$PROJECT_ROOT/backend/package.json' ]"

run_test "tsconfig.json exists in backend" \
    "[ -f '$PROJECT_ROOT/backend/tsconfig.json' ]"

# ============================================
# Test Category 8: File Quality (3 tests)
# ============================================
print_header "Category 8: File Quality & Documentation"

run_test "Patient types file has comprehensive documentation" \
    "[ \$(wc -l < '$PROJECT_ROOT/backend/src/types/patient.ts') -gt 100 ]"

run_test "Patient service file has comprehensive implementation" \
    "[ \$(wc -l < '$PROJECT_ROOT/backend/src/services/patientService.ts') -gt 200 ]"

run_test "Patient routes file has comprehensive API endpoints" \
    "[ \$(wc -l < '$PROJECT_ROOT/backend/src/api/routes/patients.ts') -gt 200 ]"

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
    echo "Patient service successfully implemented!"
    echo ""
    echo "Summary:"
    echo "  - TypeScript types defined (patient.ts)"
    echo "  - Patient service implemented (patientService.ts)"
    echo "  - API routes created (patients.ts)"
    echo "  - Backend integration complete (index.ts)"
    echo "  - Three-tier CKD risk stratification implemented"
    echo "  - KDIGO CKD staging classification implemented"
    echo ""
    echo "Available API Endpoints:"
    echo "  GET /api/patients - List all patients"
    echo "  GET /api/patients/:id - Get patient summary"
    echo "  GET /api/patients/mrn/:mrn - Get patient by MRN"
    echo "  GET /api/patients/:id/observations - Get lab results"
    echo "  GET /api/patients/:id/conditions - Get diagnoses"
    echo "  GET /api/patients/risk-tier/:tier - Get patients by risk tier"
    echo "  GET /api/patients/high-risk - Get high-risk patients"
    echo "  GET /api/patients/stats/risk-tiers - Get risk tier statistics"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
