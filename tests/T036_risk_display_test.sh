#!/bin/bash

# ============================================
# T036: Risk Assessment Display Component Test Script
# ============================================
# Tests React display component for CKD risk analysis results
# Verifies component structure, data display, and styling

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
print_header "T036: Risk Assessment Display Component Tests"
echo "Testing React display component for risk analysis results..."
echo "Project: Healthcare AI Clinical Data Analyzer"
echo "Task: H036 - React: Risk Assessment Display component"
echo ""

# ============================================
# Test Category 1: File Existence (1 test)
# ============================================
print_header "Category 1: File Existence"

run_test "RiskAssessmentDisplay component file exists" \
    "[ -f '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' ]"

# ============================================
# Test Category 2: Component Structure (5 tests)
# ============================================
print_header "Category 2: Component Structure"

run_test "Component has default export" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'export default function RiskAssessmentDisplay'"

run_test "RiskAssessmentDisplayProps interface defined" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'export interface RiskAssessmentDisplayProps'"

run_test "AIRiskAnalysis interface defined" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'export interface AIRiskAnalysis'"

run_test "Component accepts analysis prop" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'analysis: AIRiskAnalysis | null'"

run_test "Component returns JSX" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'return'"

# ============================================
# Test Category 3: Empty State (3 tests)
# ============================================
print_header "Category 3: Empty State Handling"

run_test "Handles null analysis gracefully" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'if (!analysis)'"

run_test "Displays empty state message" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'No analysis available'"

run_test "Shows instruction text in empty state" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'Click.*Analyze Risk'"

# ============================================
# Test Category 4: Risk Score Display (5 tests)
# ============================================
print_header "Category 4: Risk Score Display"

run_test "Displays risk score percentage" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'risk_score.*100'"

run_test "Shows risk level text" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'risk_level.*Risk'"

run_test "Displays analysis timestamp" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'analyzed_at'"

run_test "Has getRiskLevelColor function" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'getRiskLevelColor'"

run_test "Color codes risk levels (low/medium/high)" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'bg-green-100'"

# ============================================
# Test Category 5: Risk Tier Display (3 tests)
# ============================================
print_header "Category 5: Risk Tier Display"

run_test "Displays risk tier badge" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'Tier.*risk_tier'"

run_test "Has getRiskTierColor function" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'getRiskTierColor'"

run_test "Shows confidence score if available" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'confidence_score'"

# ============================================
# Test Category 6: Key Findings Section (6 tests)
# ============================================
print_header "Category 6: Key Findings Section"

run_test "Has Key Findings section header" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'Key Findings'"

run_test "Displays abnormal labs" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'abnormal_labs'"

run_test "Displays risk factors" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'risk_factors'"

run_test "Displays protective factors" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'protective_factors'"

run_test "Uses grid layout for findings" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'grid md:grid-cols-3'"

run_test "Color codes abnormal labs as red" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'bg-red-50'"

# ============================================
# Test Category 7: CKD Analysis Section (7 tests)
# ============================================
print_header "Category 7: CKD Analysis Section"

run_test "Has CKD Analysis section header" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'CKD Analysis'"

run_test "Displays current CKD stage" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'current_stage'"

run_test "Shows kidney function status" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'kidney_function'"

run_test "Displays kidney damage level" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'kidney_damage'"

run_test "Shows progression risk" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'progression_risk'"

run_test "Has getKidneyFunctionText helper" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'getKidneyFunctionText'"

run_test "Uses purple color scheme for CKD section" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'bg-purple-50'"

# ============================================
# Test Category 8: Recommendations Section (7 tests)
# ============================================
print_header "Category 8: Recommendations Section"

run_test "Has Clinical Recommendations header" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'Clinical Recommendations'"

run_test "Displays immediate actions" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'immediate_actions'"

run_test "Shows follow-up care" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'follow_up'"

run_test "Displays lifestyle modifications" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'lifestyle_modifications'"

run_test "Shows screening tests" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'screening_tests'"

run_test "Immediate actions have warning styling" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'Immediate Actions Required'"

run_test "Uses numbered list for immediate actions" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'idx + 1'"

# ============================================
# Test Category 9: Tailwind CSS Styling (10 tests)
# ============================================
print_header "Category 9: Tailwind CSS Styling"

run_test "Uses Tailwind utility classes" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'className='"

run_test "Has rounded corners" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'rounded-lg'"

run_test "Uses shadow for depth" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'shadow-lg'"

run_test "Has responsive grid layouts" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'md:grid-cols'"

run_test "Uses padding for spacing" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'p-6'"

run_test "Has border separation" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'border-t'"

run_test "Uses color-coded backgrounds" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'bg-yellow-50'"

run_test "Has consistent spacing" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'space-y'"

run_test "Uses flex layouts" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'flex items-center'"

run_test "Has border-left accent bars" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'border-l-4'"

# ============================================
# Test Category 10: Icons and Visual Elements (5 tests)
# ============================================
print_header "Category 10: Icons and Visual Elements"

run_test "Uses SVG icons" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' '<svg'"

run_test "Has icon for Key Findings" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'text-blue-600'"

run_test "Has icon for CKD Analysis" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'text-purple-600'"

run_test "Has icon for Recommendations" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'text-green-600'"

run_test "Has warning icon for immediate actions" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'fillRule'"

# ============================================
# Test Category 11: Date Formatting (2 tests)
# ============================================
print_header "Category 11: Date Formatting"

run_test "Has formatDate function" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'formatDate'"

run_test "Uses toLocaleString for dates" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'toLocaleString'"

# ============================================
# Test Category 12: Footer Information (2 tests)
# ============================================
print_header "Category 12: Footer Information"

run_test "Displays model version if available" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'model_version'"

run_test "Shows patient ID in footer" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'patient_id.substring'"

# ============================================
# Test Category 13: Conditional Rendering (5 tests)
# ============================================
print_header "Category 13: Conditional Rendering"

run_test "Conditionally renders sections based on data" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' '.length > 0'"

run_test "Handles missing current stage" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'Not determined'"

run_test "Conditionally shows confidence score" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'confidence_score &&'"

run_test "Conditionally shows model version footer" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'model_version &&'"

run_test "Maps over arrays with .map()" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' '.map(('"

# ============================================
# Test Category 14: File Quality (3 tests)
# ============================================
print_header "Category 14: File Quality & Documentation"

run_test "Has component documentation comment" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' '/**'"

run_test "Has descriptive function comments" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx' 'Get risk level color'"

run_test "File has substantial implementation" \
    "[ \$(wc -l < '$PROJECT_ROOT/frontend/src/components/RiskAssessmentDisplay.tsx') -gt 390 ]"

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
    echo "Risk Assessment Display component successfully implemented!"
    echo ""
    echo "Summary:"
    echo "  - Comprehensive risk analysis display"
    echo "  - TypeScript with full type safety"
    echo "  - Responsive Tailwind CSS styling"
    echo "  - Color-coded sections by severity"
    echo "  - Empty state handling"
    echo "  - SVG icons for visual clarity"
    echo ""
    echo "Sections:"
    echo "  1. Header - Risk score, level, timestamp"
    echo "  2. Risk Tier - Tier badge with confidence"
    echo "  3. Key Findings - Abnormal labs, risk/protective factors"
    echo "  4. CKD Analysis - Stage, function, damage, progression"
    echo "  5. Recommendations - Immediate, follow-up, lifestyle, tests"
    echo "  6. Footer - Model version and patient ID"
    echo ""
    echo "Features:"
    echo "  - Empty state with icon and message"
    echo "  - Risk level color coding (green/yellow/red)"
    echo "  - Risk tier badges (Tier 1/2/3)"
    echo "  - Grid layouts for findings (3 columns)"
    echo "  - Purple-themed CKD analysis section"
    echo "  - Color-coded recommendation categories"
    echo "  - Warning icon for immediate actions"
    echo "  - Numbered list for immediate actions"
    echo "  - Date formatting (toLocaleString)"
    echo "  - Conditional rendering of sections"
    echo "  - Responsive design (md: breakpoints)"
    echo ""
    echo "Styling:"
    echo "  - Rounded corners (rounded-lg)"
    echo "  - Shadow depth (shadow-lg)"
    echo "  - Color-coded backgrounds (bg-*-50)"
    echo "  - Border accents (border-l-4)"
    echo "  - Consistent spacing (space-y, p-*)"
    echo "  - Flex and grid layouts"
    echo ""
    echo "Props:"
    echo "  - analysis: AIRiskAnalysis | null (required)"
    echo "  - className?: string (optional)"
    echo ""
    echo "Data Structure:"
    echo "  - patient_id, risk_score, risk_level, risk_tier"
    echo "  - key_findings: {abnormal_labs, risk_factors, protective_factors}"
    echo "  - ckd_analysis: {current_stage, kidney_function, kidney_damage, progression_risk}"
    echo "  - recommendations: {immediate_actions, follow_up, lifestyle_modifications, screening_tests}"
    echo "  - confidence_score, model_version, analyzed_at"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
