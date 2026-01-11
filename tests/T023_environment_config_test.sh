#!/bin/bash

# ============================================
# T023: Environment Configuration Test Script
# ============================================
# Tests environment variable configuration for all services
# Verifies .env.example files and docker-compose integration

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
print_header "T023: Environment Configuration Tests"
echo "Testing environment variable configuration..."
echo "Project: Healthcare AI Clinical Data Analyzer"
echo "Task: H023 - Environment configuration (.env files)"
echo ""

# ============================================
# Test Category 1: .env.example File Existence (3 tests)
# ============================================
print_header "Category 1: .env.example File Existence"

run_test "Root .env.example exists" \
    "[ -f '$PROJECT_ROOT/.env.example' ]"

run_test "Backend .env.example exists" \
    "[ -f '$PROJECT_ROOT/backend/.env.example' ]"

run_test "Frontend .env.example exists" \
    "[ -f '$PROJECT_ROOT/frontend/.env.example' ]"

# ============================================
# Test Category 2: Root .env.example Content (8 tests)
# ============================================
print_header "Category 2: Root .env.example Content"

run_test "Root .env.example contains ANTHROPIC_API_KEY" \
    "file_contains '$PROJECT_ROOT/.env.example' 'ANTHROPIC_API_KEY'"

run_test "Root .env.example contains NODE_ENV" \
    "file_contains '$PROJECT_ROOT/.env.example' 'NODE_ENV'"

run_test "Root .env.example contains PORT" \
    "file_contains '$PROJECT_ROOT/.env.example' 'PORT'"

run_test "Root .env.example contains DATABASE_URL" \
    "file_contains '$PROJECT_ROOT/.env.example' 'DATABASE_URL'"

run_test "Root .env.example contains DB_HOST" \
    "file_contains '$PROJECT_ROOT/.env.example' 'DB_HOST'"

run_test "Root .env.example contains CORS_ORIGIN" \
    "file_contains '$PROJECT_ROOT/.env.example' 'CORS_ORIGIN'"

run_test "Root .env.example contains VITE_API_URL" \
    "file_contains '$PROJECT_ROOT/.env.example' 'VITE_API_URL'"

run_test "Root .env.example contains security notes" \
    "file_contains '$PROJECT_ROOT/.env.example' 'Security Notes'"

# ============================================
# Test Category 3: Backend .env.example Content (8 tests)
# ============================================
print_header "Category 3: Backend .env.example Content"

run_test "Backend .env.example contains ANTHROPIC_API_KEY" \
    "file_contains '$PROJECT_ROOT/backend/.env.example' 'ANTHROPIC_API_KEY'"

run_test "Backend .env.example contains NODE_ENV" \
    "file_contains '$PROJECT_ROOT/backend/.env.example' 'NODE_ENV'"

run_test "Backend .env.example contains PORT" \
    "file_contains '$PROJECT_ROOT/backend/.env.example' 'PORT'"

run_test "Backend .env.example contains DATABASE_URL" \
    "file_contains '$PROJECT_ROOT/backend/.env.example' 'DATABASE_URL'"

run_test "Backend .env.example contains DB_HOST" \
    "file_contains '$PROJECT_ROOT/backend/.env.example' 'DB_HOST'"

run_test "Backend .env.example contains DB_POOL_MAX" \
    "file_contains '$PROJECT_ROOT/backend/.env.example' 'DB_POOL_MAX'"

run_test "Backend .env.example contains CORS_ORIGIN" \
    "file_contains '$PROJECT_ROOT/backend/.env.example' 'CORS_ORIGIN'"

run_test "Backend .env.example contains instructions" \
    "file_contains '$PROJECT_ROOT/backend/.env.example' 'Instructions'"

# ============================================
# Test Category 4: Frontend .env.example Content (6 tests)
# ============================================
print_header "Category 4: Frontend .env.example Content"

run_test "Frontend .env.example contains VITE_API_URL" \
    "file_contains '$PROJECT_ROOT/frontend/.env.example' 'VITE_API_URL'"

run_test "Frontend .env.example contains NODE_ENV" \
    "file_contains '$PROJECT_ROOT/frontend/.env.example' 'NODE_ENV'"

run_test "Frontend .env.example mentions VITE_ prefix importance" \
    "file_contains '$PROJECT_ROOT/frontend/.env.example' 'VITE_'"

run_test "Frontend .env.example contains security notes" \
    "file_contains '$PROJECT_ROOT/frontend/.env.example' 'Security Notes'"

run_test "Frontend .env.example warns about public variables" \
    "file_contains '$PROJECT_ROOT/frontend/.env.example' 'PUBLIC'"

run_test "Frontend .env.example contains instructions" \
    "file_contains '$PROJECT_ROOT/frontend/.env.example' 'Instructions'"

# ============================================
# Test Category 5: Git Configuration (3 tests)
# ============================================
print_header "Category 5: Git Configuration"

run_test ".gitignore exists" \
    "[ -f '$PROJECT_ROOT/.gitignore' ]"

run_test ".gitignore ignores .env files" \
    "file_contains '$PROJECT_ROOT/.gitignore' '.env'"

run_test ".env file does not exist in root (security check)" \
    "[ ! -f '$PROJECT_ROOT/.env' ]"

# ============================================
# Test Category 6: Docker Compose Integration (7 tests)
# ============================================
print_header "Category 6: Docker Compose Integration"

run_test "docker-compose.yml exists" \
    "[ -f '$PROJECT_ROOT/docker-compose.yml' ]"

run_test "docker-compose.yml backend uses ANTHROPIC_API_KEY from env" \
    "file_contains '$PROJECT_ROOT/docker-compose.yml' '\${ANTHROPIC_API_KEY}'"

run_test "docker-compose.yml backend sets NODE_ENV" \
    "grep -A 20 'backend:' '$PROJECT_ROOT/docker-compose.yml' | grep -q 'NODE_ENV'"

run_test "docker-compose.yml backend sets DATABASE_URL" \
    "grep -A 20 'backend:' '$PROJECT_ROOT/docker-compose.yml' | grep -q 'DATABASE_URL'"

run_test "docker-compose.yml postgres sets POSTGRES_DB" \
    "grep -A 20 'postgres:' '$PROJECT_ROOT/docker-compose.yml' | grep -q 'POSTGRES_DB'"

run_test "docker-compose.yml frontend sets VITE_API_URL" \
    "grep -A 20 'frontend:' '$PROJECT_ROOT/docker-compose.yml' | grep -q 'VITE_API_URL'"

run_test "docker-compose.yml backend sets CORS_ORIGIN" \
    "grep -A 20 'backend:' '$PROJECT_ROOT/docker-compose.yml' | grep -q 'CORS_ORIGIN'"

# ============================================
# Test Category 7: File Quality & Documentation (5 tests)
# ============================================
print_header "Category 7: File Quality & Documentation"

run_test "Root .env.example is not empty (>1KB)" \
    "[ \$(stat -c%s '$PROJECT_ROOT/.env.example') -gt 1000 ]"

run_test "Backend .env.example is not empty (>1KB)" \
    "[ \$(stat -c%s '$PROJECT_ROOT/backend/.env.example') -gt 1000 ]"

run_test "Frontend .env.example is not empty (>500 bytes)" \
    "[ \$(stat -c%s '$PROJECT_ROOT/frontend/.env.example') -gt 500 ]"

run_test "Root .env.example has comprehensive comments" \
    "[ \$(grep -c '^#' '$PROJECT_ROOT/.env.example') -gt 40 ]"

run_test "Backend .env.example has comprehensive comments" \
    "[ \$(grep -c '^#' '$PROJECT_ROOT/backend/.env.example') -gt 40 ]"

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
    echo "Environment configuration is properly set up!"
    echo ""
    echo "Summary:"
    echo "  - All .env.example files exist and are comprehensive"
    echo "  - Backend .env.example: $(stat -c%s "$PROJECT_ROOT/backend/.env.example") bytes"
    echo "  - Frontend .env.example: $(stat -c%s "$PROJECT_ROOT/frontend/.env.example") bytes"
    echo "  - Root .env.example: $(stat -c%s "$PROJECT_ROOT/.env.example") bytes"
    echo "  - Docker Compose properly configured with environment variables"
    echo "  - Security: .env files properly gitignored"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
