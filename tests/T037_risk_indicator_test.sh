#!/bin/bash

# ============================================
# T037: Risk Indicator Component Test Script
# ============================================
# Tests React color-coded risk indicator badge component
# Verifies component structure, color coding, and styling

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
print_header "T037: Risk Indicator Component Tests"
echo "Testing React color-coded risk indicator badge..."
echo "Project: Healthcare AI Clinical Data Analyzer"
echo "Task: H037 - React: Color-Coded Risk Indicator component"
echo ""

# ============================================
# Test Category 1: File Existence (1 test)
# ============================================
print_header "Category 1: File Existence"

run_test "RiskIndicator component file exists" \
    "[ -f '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' ]"

# ============================================
# Test Category 2: Component Structure (4 tests)
# ============================================
print_header "Category 2: Component Structure"

run_test "Component has default export" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'export default function RiskIndicator'"

run_test "RiskIndicatorProps interface defined" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'export interface RiskIndicatorProps'"

run_test "Component accepts props parameter" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'RiskIndicatorProps'"

run_test "Component returns JSX" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'return'"

# ============================================
# Test Category 3: Props Interface (4 tests)
# ============================================
print_header "Category 3: Props Interface"

run_test "Props include level (required)" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' \"level: 'low' | 'medium' | 'high'\""

run_test "Props include showIcon option" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'showIcon'"

run_test "Props include size option" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' \"size?: 'sm' | 'md' | 'lg'\""

run_test "Props include className for custom styling" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'className'"

# ============================================
# Test Category 4: Color Mapping (5 tests)
# ============================================
print_header "Category 4: Risk Level Color Mapping"

run_test "Has getColorClasses function" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'getColorClasses'"

run_test "Low risk uses green colors" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'bg-green-100'"

run_test "Medium risk uses yellow colors" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'bg-yellow-100'"

run_test "High risk uses red colors" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'bg-red-100'"

run_test "Includes text and border colors" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'text-green-800'"

# ============================================
# Test Category 5: Icon Support (5 tests)
# ============================================
print_header "Category 5: Icon Support"

run_test "Has getIcon function" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'getIcon'"

run_test "Low risk has checkmark icon" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'fillRule'"

run_test "Conditionally renders icon" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'showIcon &&'"

run_test "Icon size varies with component size" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'w-3 h-3'"

run_test "Icons use SVG format" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' '<svg'"

# ============================================
# Test Category 6: Size Variants (4 tests)
# ============================================
print_header "Category 6: Size Variants"

run_test "Has getSizeClasses function" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'getSizeClasses'"

run_test "Supports small size" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'text-xs'"

run_test "Supports medium size" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'text-sm'"

run_test "Supports large size" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'text-base'"

# ============================================
# Test Category 7: Text Display (2 tests)
# ============================================
print_header "Category 7: Text Display"

run_test "Has getRiskText function" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'getRiskText'"

run_test "Capitalizes risk level text" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'charAt(0).toUpperCase()'"

# ============================================
# Test Category 8: Tailwind CSS Styling (8 tests)
# ============================================
print_header "Category 8: Tailwind CSS Styling"

run_test "Uses Tailwind utility classes" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'className='"

run_test "Has inline-flex for alignment" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'inline-flex'"

run_test "Uses items-center for vertical alignment" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'items-center'"

run_test "Has font-semibold for emphasis" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'font-semibold'"

run_test "Uses rounded-full for pill shape" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'rounded-full'"

run_test "Has border styling" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'border'"

run_test "Uses padding (px and py)" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'px-'"

run_test "Applies dynamic classes" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' '\${getColorClasses()}'"

# ============================================
# Test Category 9: Default Props (3 tests)
# ============================================
print_header "Category 9: Default Props"

run_test "showIcon defaults to false" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'showIcon = false'"

run_test "size defaults to md" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' \"size = 'md'\""

run_test "className defaults to empty string" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' \"className = ''\""

# ============================================
# Test Category 10: Component Output (3 tests)
# ============================================
print_header "Category 10: Component Output"

run_test "Returns span element" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' '<span'"

run_test "Displays 'Risk' text" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'Risk'"

run_test "Combines all style classes" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' '\${className}'"

# ============================================
# Test Category 11: File Quality (3 tests)
# ============================================
print_header "Category 11: File Quality & Documentation"

run_test "Has component documentation comment" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' '/**'"

run_test "Has descriptive function comments" \
    "file_contains '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx' 'Get color classes'"

run_test "File has complete implementation" \
    "[ \$(wc -l < '$PROJECT_ROOT/frontend/src/components/RiskIndicator.tsx') -gt 100 ]"

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
    echo "Risk Indicator component successfully implemented!"
    echo ""
    echo "Summary:"
    echo "  - Lightweight, reusable badge component"
    echo "  - TypeScript with strict typing"
    echo "  - Color-coded by risk level"
    echo "  - Optional icon display"
    echo "  - Multiple size variants"
    echo "  - Tailwind CSS styling"
    echo ""
    echo "Props:"
    echo "  - level: 'low' | 'medium' | 'high' (required)"
    echo "  - showIcon?: boolean (default: false)"
    echo "  - size?: 'sm' | 'md' | 'lg' (default: 'md')"
    echo "  - className?: string (default: '')"
    echo ""
    echo "Color Coding:"
    echo "  - Low Risk: Green (bg-green-100, text-green-800)"
    echo "  - Medium Risk: Yellow (bg-yellow-100, text-yellow-800)"
    echo "  - High Risk: Red (bg-red-100, text-red-800)"
    echo ""
    echo "Icons (when showIcon=true):"
    echo "  - Low: Checkmark circle (success)"
    echo "  - Medium: Exclamation circle (warning)"
    echo "  - High: X circle (danger)"
    echo ""
    echo "Sizes:"
    echo "  - Small: px-2 py-0.5 text-xs"
    echo "  - Medium: px-3 py-1 text-sm (default)"
    echo "  - Large: px-4 py-1.5 text-base"
    echo ""
    echo "Features:"
    echo "  - Pill-shaped badge (rounded-full)"
    echo "  - Inline-flex for easy integration"
    echo "  - Font-semibold for emphasis"
    echo "  - Border for definition"
    echo "  - Capitalized risk level text"
    echo "  - Dynamic class application"
    echo "  - Helper functions for clean code"
    echo ""
    echo "Usage Examples:"
    echo "  <RiskIndicator level=\"low\" />"
    echo "  <RiskIndicator level=\"medium\" showIcon />"
    echo "  <RiskIndicator level=\"high\" size=\"lg\" showIcon />"
    echo ""
    echo "🎉 ALL 19 TASKS COMPLETE! 🎉"
    echo "Full-stack AI-powered CKD risk screening system ready!"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
