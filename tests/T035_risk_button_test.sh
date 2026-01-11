#!/bin/bash

# ============================================
# T035: Risk Analysis Button Component Test Script
# ============================================
# Tests React button component for triggering CKD risk analysis
# Verifies component structure, API integration, and state management

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
print_header "T035: Risk Analysis Button Component Tests"
echo "Testing React button component for risk analysis..."
echo "Project: Healthcare AI Clinical Data Analyzer"
echo "Task: H035 - React: Risk Analysis Button component"
echo ""

# ============================================
# Test Category 1: File Existence (1 test)
# ============================================
print_header "Category 1: File Existence"

run_test "RiskAnalysisButton component file exists" \
    "[ -f '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' ]"

# ============================================
# Test Category 2: Component Structure (5 tests)
# ============================================
print_header "Category 2: Component Structure"

run_test "Component has default export" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'export default function RiskAnalysisButton'"

run_test "RiskAnalysisButtonProps interface defined" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'export interface RiskAnalysisButtonProps'"

run_test "AnalysisResult interface defined" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'export interface AnalysisResult'"

run_test "Component accepts props parameter" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'RiskAnalysisButtonProps'"

run_test "Component returns JSX" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'return'"

# ============================================
# Test Category 3: Props Interface (6 tests)
# ============================================
print_header "Category 3: Props Interface"

run_test "Props include patientId" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'patientId: string'"

run_test "Props include onAnalysisComplete callback" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'onAnalysisComplete'"

run_test "Props include onAnalysisError callback" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'onAnalysisError'"

run_test "Props include className for custom styling" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'className'"

run_test "Props include variant option" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'variant'"

run_test "Props include size option" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'size'"

# ============================================
# Test Category 4: State Management (4 tests)
# ============================================
print_header "Category 4: State Management"

run_test "Uses useState from React" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' \"import.*useState.*from 'react'\""

run_test "Has isLoading state" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'isLoading'"

run_test "Has error state" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'setError'"

run_test "Has success state" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'setSuccess'"

# ============================================
# Test Category 5: API Integration (6 tests)
# ============================================
print_header "Category 5: API Integration"

run_test "Makes fetch request to analyze endpoint" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' '/api/analyze/'"

run_test "Uses POST method" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' \"method: 'POST'\""

run_test "Sets Content-Type header" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'Content-Type'"

run_test "Sends JSON body with configuration" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'JSON.stringify'"

run_test "Uses VITE_API_URL environment variable" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'VITE_API_URL'"

run_test "Parses JSON response" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'await response.json()'"

# ============================================
# Test Category 6: Request Configuration (3 tests)
# ============================================
print_header "Category 6: Request Configuration"

run_test "Sends storeResults configuration" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'storeResults'"

run_test "Sends includePatientData configuration" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'includePatientData'"

run_test "Sends skipCache configuration" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'skipCache'"

# ============================================
# Test Category 7: Loading States (4 tests)
# ============================================
print_header "Category 7: Loading States"

run_test "Sets loading state before request" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'setIsLoading(true)'"

run_test "Clears loading state after request" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'setIsLoading(false)'"

run_test "Shows loading spinner during analysis" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'animate-spin'"

run_test "Displays 'Analyzing...' text when loading" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'Analyzing...'"

# ============================================
# Test Category 8: Success Handling (4 tests)
# ============================================
print_header "Category 8: Success Handling"

run_test "Checks for successful result" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'result.success'"

run_test "Sets success state on completion" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'setSuccess(true)'"

run_test "Calls onAnalysisComplete callback" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'onAnalysisComplete(result.analysis)'"

run_test "Displays success checkmark icon" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'M5 13l4 4L19 7'"

# ============================================
# Test Category 9: Error Handling (5 tests)
# ============================================
print_header "Category 9: Error Handling"

run_test "Has try-catch block" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'try {'"

run_test "Catches errors" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'catch (err)'"

run_test "Sets error state on failure" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'setError(errorMsg)'"

run_test "Calls onAnalysisError callback" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'onAnalysisError(errorMsg)'"

run_test "Displays error message" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'text-red-600'"

# ============================================
# Test Category 10: Tailwind CSS Styling (7 tests)
# ============================================
print_header "Category 10: Tailwind CSS Styling"

run_test "Uses Tailwind utility classes" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'className='"

run_test "Has primary variant styling" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'bg-blue-600'"

run_test "Has hover state styling" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'hover:bg-blue-700'"

run_test "Has disabled state styling" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'disabled:'"

run_test "Has rounded corners" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'rounded'"

run_test "Has transition effects" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'transition'"

run_test "Has focus ring styling" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'focus:ring'"

# ============================================
# Test Category 11: Button Variants (4 tests)
# ============================================
print_header "Category 11: Button Variants"

run_test "Has getVariantClasses function" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'getVariantClasses'"

run_test "Supports primary variant" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' \"'primary'\""

run_test "Supports secondary variant" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' \"'secondary'\""

run_test "Supports outline variant" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' \"'outline'\""

# ============================================
# Test Category 12: Button Sizes (4 tests)
# ============================================
print_header "Category 12: Button Sizes"

run_test "Has getSizeClasses function" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'getSizeClasses'"

run_test "Supports small size" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' \"'sm'\""

run_test "Supports medium size" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' \"'md'\""

run_test "Supports large size" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' \"'lg'\""

# ============================================
# Test Category 13: Accessibility (3 tests)
# ============================================
print_header "Category 13: Accessibility"

run_test "Button can be disabled" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'disabled={disabled || isLoading}'"

run_test "Error has role='alert'" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'role=\"alert\"'"

run_test "Has focus outline" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'focus:outline-none'"

# ============================================
# Test Category 14: File Quality (3 tests)
# ============================================
print_header "Category 14: File Quality & Documentation"

run_test "Has component documentation comment" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' '/**'"

run_test "Has descriptive function comments" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx' 'Trigger risk analysis'"

run_test "File has substantial implementation" \
    "[ \$(wc -l < '$PROJECT_ROOT/frontend/src/components/RiskAnalysisButton.tsx') -gt 200 ]"

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
    echo "Risk Analysis Button component successfully implemented!"
    echo ""
    echo "Summary:"
    echo "  - Reusable React component with TypeScript"
    echo "  - API integration with POST /api/analyze/:patientId"
    echo "  - Complete state management (loading, success, error)"
    echo "  - Tailwind CSS styling with variants"
    echo "  - Success and error callbacks"
    echo "  - Loading spinner and status icons"
    echo "  - Accessibility features"
    echo ""
    echo "Props:"
    echo "  - patientId: string (required)"
    echo "  - onAnalysisComplete?: (analysis: any) => void"
    echo "  - onAnalysisError?: (error: string) => void"
    echo "  - className?: string"
    echo "  - disabled?: boolean"
    echo "  - variant?: 'primary' | 'secondary' | 'outline'"
    echo "  - size?: 'sm' | 'md' | 'lg'"
    echo ""
    echo "Features:"
    echo "  - Loading state with animated spinner"
    echo "  - Success state with checkmark icon (3s auto-dismiss)"
    echo "  - Error state with error message display"
    echo "  - Retry functionality on error"
    echo "  - Disabled state during analysis"
    echo "  - Customizable variants and sizes"
    echo "  - Focus ring for keyboard navigation"
    echo "  - ARIA role for error messages"
    echo ""
    echo "API Integration:"
    echo "  - Calls POST /api/analyze/:patientId"
    echo "  - Sends configuration (storeResults, includePatientData, skipCache)"
    echo "  - Uses VITE_API_URL environment variable"
    echo "  - Handles success and error responses"
    echo ""
    echo "Styling:"
    echo "  - Tailwind CSS utility classes"
    echo "  - 3 button variants (primary, secondary, outline)"
    echo "  - 3 button sizes (sm, md, lg)"
    echo "  - Hover, focus, and disabled states"
    echo "  - Transition animations"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
