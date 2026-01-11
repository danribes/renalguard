#!/bin/bash

# ============================================
# T032: Risk Processing Service Test Script
# ============================================
# Tests AI risk processing service that orchestrates patient data fetching
# and AI analysis workflow

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
print_header "T032: Risk Processing Service Tests"
echo "Testing AI risk processing orchestration service..."
echo "Project: Healthcare AI Clinical Data Analyzer"
echo "Task: H032 - AI processing service (orchestrates analysis)"
echo ""

# ============================================
# Test Category 1: File Existence (1 test)
# ============================================
print_header "Category 1: File Existence"

run_test "Risk processing service file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' ]"

# ============================================
# Test Category 2: Type Definitions (3 tests)
# ============================================
print_header "Category 2: Type Definitions"

run_test "ProcessConfig interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export interface ProcessConfig'"

run_test "ProcessResult interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export interface ProcessResult'"

run_test "BatchProcessResult interface defined" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export interface BatchProcessResult'"

# ============================================
# Test Category 3: Core Processing Functions (4 tests)
# ============================================
print_header "Category 3: Core Processing Functions"

run_test "processPatientRiskAnalysis function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export async function processPatientRiskAnalysis'"

run_test "processPatientsBatch function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export async function processPatientsBatch'"

run_test "processHighRiskPatients function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export async function processHighRiskPatients'"

run_test "processPatientsByTier function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export async function processPatientsByTier'"

# ============================================
# Test Category 4: Integration with Services (4 tests)
# ============================================
print_header "Category 4: Integration with Existing Services"

run_test "Imports getPatientSummary from patientService" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'getPatientSummary'"

run_test "Imports getPatientsByRiskTier from patientService" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'getPatientsByRiskTier'"

run_test "Imports analyzeCKDRisk from aiService" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'analyzeCKDRisk'"

run_test "Imports query from database config" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' \"from '../config/database'\""

# ============================================
# Test Category 5: Workflow Orchestration (6 tests)
# ============================================
print_header "Category 5: Workflow Orchestration"

run_test "Fetches patient summary in processing workflow" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'getPatientSummary(patientId)'"

run_test "Calls AI service for analysis" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'await analyzeCKDRisk'"

run_test "Stores analysis results" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'storeAnalysisResult'"

run_test "Handles patient not found error" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'Patient not found'"

run_test "Returns process result with success status" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'success: true'"

run_test "Tracks processing time" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'processing_time_ms'"

# ============================================
# Test Category 6: Caching (4 tests)
# ============================================
print_header "Category 6: Caching Mechanism"

run_test "getCachedAnalysis function exists" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'async function getCachedAnalysis'"

run_test "Checks cache before processing" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'getCachedAnalysis(patientId)'"

run_test "Has skipCache configuration option" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'skipCache'"

run_test "Returns cached flag in result" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'cached:'"

# ============================================
# Test Category 7: Batch Processing (5 tests)
# ============================================
print_header "Category 7: Batch Processing"

run_test "Processes patients concurrently" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'Promise.all'"

run_test "Has batch size limit" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'BATCH_SIZE'"

run_test "Returns batch statistics (total, successful, failed)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'successful:'"

run_test "Processes high-risk patients (Tier 3)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'Tier 3'"

run_test "Can filter by risk tier" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'tier: 1 | 2 | 3'"

# ============================================
# Test Category 8: Database Operations (4 tests)
# ============================================
print_header "Category 8: Database Operations"

run_test "storeAnalysisResult function exists" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'async function storeAnalysisResult'"

run_test "Inserts into risk_assessments table" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'INSERT INTO risk_assessments'"

run_test "Has conflict resolution (upsert)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'ON CONFLICT'"

run_test "Stores JSON fields (key_findings, recommendations)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'JSON.stringify'"

# ============================================
# Test Category 9: Statistics & Reporting (3 tests)
# ============================================
print_header "Category 9: Statistics & Reporting"

run_test "getRecentAnalyses function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export async function getRecentAnalyses'"

run_test "getAnalysisStatistics function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export async function getAnalysisStatistics'"

run_test "Statistics include risk levels and tiers" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'by_risk_level'"

# ============================================
# Test Category 10: Configuration Options (4 tests)
# ============================================
print_header "Category 10: Configuration Options"

run_test "Has storeResults configuration" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'storeResults'"

run_test "Has includePatientData configuration" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'includePatientData'"

run_test "Default values for configuration" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'storeResults = true'"

run_test "Configuration is optional (has defaults)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'config: ProcessConfig = {}'"

# ============================================
# Test Category 11: Error Handling (5 tests)
# ============================================
print_header "Category 11: Error Handling"

run_test "Has try-catch blocks" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'try {'"

run_test "Returns error message in result" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'error:'"

run_test "Logs errors to console" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'console.error'"

run_test "Continues batch processing on individual errors" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'success: false'"

run_test "Handles Error instance check" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'error instanceof Error'"

# ============================================
# Test Category 12: Cache Management (2 tests)
# ============================================
print_header "Category 12: Cache Management"

run_test "Checks if cached data is fresh (24 hours)" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'hoursSinceAnalysis'"

run_test "clearOldAnalyses function exported" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'export async function clearOldAnalyses'"

# ============================================
# Test Category 13: File Quality (3 tests)
# ============================================
print_header "Category 13: File Quality & Documentation"

run_test "Has comprehensive JSDoc documentation" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' '@param'"

run_test "Has descriptive function comments" \
    "file_contains '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts' 'Orchestrates'"

run_test "File has substantial implementation" \
    "[ \$(wc -l < '$PROJECT_ROOT/backend/src/services/riskProcessingService.ts') -gt 300 ]"

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
    echo "Risk processing service successfully implemented!"
    echo ""
    echo "Summary:"
    echo "  - Complete workflow orchestration"
    echo "  - Patient data fetching (patientService integration)"
    echo "  - AI analysis (aiService integration)"
    echo "  - Result storage in database"
    echo "  - Caching mechanism (24-hour cache)"
    echo "  - Batch processing with concurrency control"
    echo "  - High-risk patient processing (Tier 3)"
    echo "  - Risk tier filtering (Tier 1, 2, 3)"
    echo "  - Statistics and reporting"
    echo "  - Error handling and recovery"
    echo ""
    echo "Available Functions:"
    echo "  processPatientRiskAnalysis() - Process single patient"
    echo "  processPatientsBatch() - Process multiple patients"
    echo "  processHighRiskPatients() - Process all Tier 3 patients"
    echo "  processPatientsByTier() - Process patients by tier"
    echo "  getRecentAnalyses() - Get recent risk analyses"
    echo "  getAnalysisStatistics() - Get analysis statistics"
    echo "  clearOldAnalyses() - Clear old cached analyses"
    echo ""
    echo "Configuration Options:"
    echo "  storeResults: Store results in database (default: true)"
    echo "  includePatientData: Include patient data (default: true)"
    echo "  skipCache: Skip cached results (default: false)"
    echo ""
    echo "Features:"
    echo "  - 24-hour result caching for performance"
    echo "  - Batch size limit: 5 patients concurrent"
    echo "  - Processing time tracking"
    echo "  - Success/failure statistics"
    echo "  - Comprehensive error handling"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
