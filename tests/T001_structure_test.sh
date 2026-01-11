#!/bin/bash
# Test T001: Monorepo Structure Verification
# This test verifies that all required directories exist

echo "Running T001: Monorepo Structure Test"
echo "======================================"

FAILED=0
PASSED=0

# Test function
test_dir() {
    if [ -d "$1" ]; then
        echo "✅ PASS: $1 exists"
        ((PASSED++))
    else
        echo "❌ FAIL: $1 does not exist"
        ((FAILED++))
    fi
}

# Backend directories
test_dir "backend"
test_dir "backend/src"
test_dir "backend/src/api"
test_dir "backend/src/services"
test_dir "backend/src/models"
test_dir "backend/src/config"
test_dir "backend/src/ai"
test_dir "backend/src/types"
test_dir "backend/src/middleware"
test_dir "backend/tests"

# Frontend directories
test_dir "frontend"
test_dir "frontend/src"
test_dir "frontend/src/components"
test_dir "frontend/src/pages"
test_dir "frontend/src/api"
test_dir "frontend/src/types"
test_dir "frontend/src/hooks"
test_dir "frontend/src/services"
test_dir "frontend/public"

# Infrastructure directories
test_dir "infrastructure"
test_dir "infrastructure/postgres"
test_dir "infrastructure/docker"

# Log directories (already exist from previous setup)
test_dir "log_files"
test_dir "log_tests"
test_dir "log_learn"

echo ""
echo "======================================"
echo "Test Results:"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "======================================"

if [ $FAILED -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed!"
    exit 1
fi
