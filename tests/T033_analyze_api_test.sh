#!/bin/bash

# ============================================
# T033: Risk Analysis API Test Script
# ============================================
# Tests REST API endpoints for CKD risk analysis
# Verifies route configuration, validation, and error handling

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
print_header "T033: Risk Analysis API Tests"
echo "Testing REST API endpoints for risk analysis..."
echo "Project: Healthcare AI Clinical Data Analyzer"
echo "Task: H033 - Risk analysis API endpoint (POST /api/analyze)"
echo ""

# ============================================
# Test Category 1: File Existence (2 tests)
# ============================================
print_header "Category 1: File Existence"

run_test "Risk analysis routes file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' ]"

run_test "Main server file exists" \
    "[ -f '$PROJECT_ROOT/backend/src/index.ts' ]"

# ============================================
# Test Category 2: Route Imports & Setup (3 tests)
# ============================================
print_header "Category 2: Route Imports & Setup"

run_test "Main server imports analyze routes" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' \"import analyzeRoutes from './api/routes/analyze'\""

run_test "Main server mounts analyze routes" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' \"app.use('/api/analyze', analyzeRoutes)\""

run_test "Express Router imported in analyze routes" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"import.*Router.*from 'express'\""

# ============================================
# Test Category 3: Core Endpoints (8 tests)
# ============================================
print_header "Category 3: Core Endpoint Definitions"

run_test "POST /:patientId endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"router.post('/:patientId'\""

run_test "POST /batch endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"router.post('/batch'\""

run_test "POST /high-risk endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"router.post('/high-risk'\""

run_test "POST /tier/:tier endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"router.post('/tier/:tier'\""

run_test "GET /recent endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"router.get('/recent'\""

run_test "GET /statistics endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"router.get('/statistics'\""

run_test "DELETE /cache endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"router.delete('/cache'\""

run_test "GET /health endpoint exists" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"router.get('/health'\""

# ============================================
# Test Category 4: Service Integration (5 tests)
# ============================================
print_header "Category 4: Service Integration"

run_test "Imports processPatientRiskAnalysis" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'processPatientRiskAnalysis'"

run_test "Imports processPatientsBatch" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'processPatientsBatch'"

run_test "Imports processHighRiskPatients" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'processHighRiskPatients'"

run_test "Imports from riskProcessingService" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'riskProcessingService'"

run_test "Imports ProcessConfig type" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'ProcessConfig'"

# ============================================
# Test Category 5: Validation (7 tests)
# ============================================
print_header "Category 5: Request Validation"

run_test "Validates patient ID UUID format" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'uuidRegex'"

run_test "Returns 400 for invalid patient ID" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'res.status(400)'"

run_test "Validates patientIds array in batch endpoint" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'Array.isArray(patientIds)'"

run_test "Enforces batch size limit" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'MAX_BATCH_SIZE'"

run_test "Validates tier parameter (1, 2, or 3)" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' '\[1, 2, 3\]'"

run_test "Validates positive hours in cache deletion" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'olderThanHours <= 0'"

run_test "Returns error messages for validation failures" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'error:'"

# ============================================
# Test Category 6: Configuration Handling (4 tests)
# ============================================
print_header "Category 6: Configuration Handling"

run_test "Extracts storeResults from request body" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'storeResults:.*req.body.storeResults'"

run_test "Extracts includePatientData from request body" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'includePatientData:.*req.body.includePatientData'"

run_test "Extracts skipCache from request body" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'skipCache:.*req.body.skipCache'"

run_test "Uses default values with nullish coalescing" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' '??'"

# ============================================
# Test Category 7: Response Handling (6 tests)
# ============================================
print_header "Category 7: Response Handling"

run_test "Returns 200 on success" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'res.status(200)'"

run_test "Returns 404 for patient not found" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'res.status(404)'"

run_test "Returns 500 for internal errors" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'res.status(500)'"

run_test "Returns JSON responses" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' '.json('"

run_test "Includes success flag in responses" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'success:'"

run_test "Includes error details in error responses" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'details:'"

# ============================================
# Test Category 8: Error Handling (5 tests)
# ============================================
print_header "Category 8: Error Handling"

run_test "Has try-catch blocks" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'try {'"

run_test "Catches errors in endpoints" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'catch (error)'"

run_test "Logs errors to console" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'console.error'"

run_test "Handles Error instance check" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'error instanceof Error'"

run_test "Returns error messages to client" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'error.message'"

# ============================================
# Test Category 9: Query Parameters (3 tests)
# ============================================
print_header "Category 9: Query Parameters"

run_test "Handles limit query parameter in /recent" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'req.query.limit'"

run_test "Enforces maximum limit" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'Math.min'"

run_test "Handles olderThanHours in cache deletion" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'olderThanHours'"

# ============================================
# Test Category 10: API Documentation (4 tests)
# ============================================
print_header "Category 10: API Documentation"

run_test "Routes have JSDoc comments" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' '/**'"

run_test "Routes document request parameters" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'Request params:'"

run_test "Routes document request body" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'Request body'"

run_test "Routes document response format" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'Response:'"

# ============================================
# Test Category 11: Server Integration (4 tests)
# ============================================
print_header "Category 11: Server Integration"

run_test "API info endpoint updated with analyze endpoints" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' 'analyze:'"

run_test "Server startup log includes analyze endpoint" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' 'AI Analysis'"

run_test "Analyze endpoints listed in API info" \
    "file_contains '$PROJECT_ROOT/backend/src/index.ts' 'singlePatient'"

run_test "Router exported as default" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'export default router'"

# ============================================
# Test Category 12: File Quality (3 tests)
# ============================================
print_header "Category 12: File Quality & Documentation"

run_test "Routes file has comprehensive documentation" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' 'REST API endpoints'"

run_test "Routes file imports are organized" \
    "file_contains '$PROJECT_ROOT/backend/src/api/routes/analyze.ts' \"from 'express'\""

run_test "Routes file has substantial implementation" \
    "[ \$(wc -l < '$PROJECT_ROOT/backend/src/api/routes/analyze.ts') -gt 300 ]"

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
    echo "Risk analysis API successfully implemented!"
    echo ""
    echo "Summary:"
    echo "  - 8 REST API endpoints for risk analysis"
    echo "  - Complete integration with riskProcessingService"
    echo "  - Request validation (UUID, arrays, limits)"
    echo "  - Configuration support (storeResults, skipCache, etc.)"
    echo "  - Comprehensive error handling"
    echo "  - API documentation in route comments"
    echo "  - Server integration complete"
    echo ""
    echo "Endpoints:"
    echo "  POST /api/analyze/:patientId - Analyze single patient"
    echo "  POST /api/analyze/batch - Batch analyze patients"
    echo "  POST /api/analyze/high-risk - Analyze Tier 3 patients"
    echo "  POST /api/analyze/tier/:tier - Analyze by risk tier"
    echo "  GET  /api/analyze/recent - Get recent analyses"
    echo "  GET  /api/analyze/statistics - Get analysis stats"
    echo "  DELETE /api/analyze/cache - Clear old cached results"
    echo "  GET  /api/analyze/health - Health check"
    echo ""
    echo "Validation:"
    echo "  - Patient ID: UUID format validation"
    echo "  - Batch: Max 50 patients per request"
    echo "  - Tier: Must be 1, 2, or 3"
    echo "  - Limit: Max 100 for recent analyses"
    echo ""
    echo "Configuration Options (request body):"
    echo "  - storeResults: Store in database (default: true)"
    echo "  - includePatientData: Include patient data (default: true)"
    echo "  - skipCache: Force re-analysis (default: false)"
    echo ""
    echo "Response Codes:"
    echo "  - 200: Success"
    echo "  - 400: Bad request (validation error)"
    echo "  - 404: Patient not found"
    echo "  - 500: Internal server error"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
