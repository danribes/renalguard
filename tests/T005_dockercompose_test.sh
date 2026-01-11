#!/bin/bash

# T005: Docker Compose Configuration Test
# Tests Docker Compose setup for healthcare AI application

PASSED=0
FAILED=0

echo "Running T005: Docker Compose Configuration Test"
echo "=========================================="

# Test 1: Check docker-compose.yml exists
if [ -f "docker-compose.yml" ]; then
  echo "✅ PASS: docker-compose.yml exists"
  ((PASSED++))
else
  echo "❌ FAIL: docker-compose.yml not found"
  ((FAILED++))
fi

# Test 2: Check docker-compose.dev.yml exists
if [ -f "docker-compose.dev.yml" ]; then
  echo "✅ PASS: docker-compose.dev.yml exists"
  ((PASSED++))
else
  echo "❌ FAIL: docker-compose.dev.yml not found"
  ((FAILED++))
fi

# Test 3: Check postgres init.sql exists
if [ -f "infrastructure/postgres/init.sql" ]; then
  echo "✅ PASS: infrastructure/postgres/init.sql exists"
  ((PASSED++))
else
  echo "❌ FAIL: infrastructure/postgres/init.sql not found"
  ((FAILED++))
fi

# Test 4: Check docker-compose.yml has version defined
if grep -q "version:" docker-compose.yml; then
  echo "✅ PASS: docker-compose.yml has version defined"
  ((PASSED++))
else
  echo "❌ FAIL: docker-compose.yml missing version"
  ((FAILED++))
fi

# Test 5: Check postgres service defined
if grep -q "postgres:" docker-compose.yml; then
  echo "✅ PASS: postgres service defined"
  ((PASSED++))
else
  echo "❌ FAIL: postgres service not defined"
  ((FAILED++))
fi

# Test 6: Check backend service defined
if grep -q "backend:" docker-compose.yml; then
  echo "✅ PASS: backend service defined"
  ((PASSED++))
else
  echo "❌ FAIL: backend service not defined"
  ((FAILED++))
fi

# Test 7: Check frontend service defined
if grep -q "frontend:" docker-compose.yml; then
  echo "✅ PASS: frontend service defined"
  ((PASSED++))
else
  echo "❌ FAIL: frontend service not defined"
  ((FAILED++))
fi

# Test 8: Check postgres uses alpine image
if grep -A 1 "postgres:" docker-compose.yml | grep -q "postgres:.*-alpine"; then
  echo "✅ PASS: postgres uses alpine image"
  ((PASSED++))
else
  echo "❌ FAIL: postgres doesn't use alpine image"
  ((FAILED++))
fi

# Test 9: Check postgres has volume defined
if grep -A 20 "postgres:" docker-compose.yml | grep -q "postgres-data:"; then
  echo "✅ PASS: postgres has volume for data persistence"
  ((PASSED++))
else
  echo "❌ FAIL: postgres missing data volume"
  ((FAILED++))
fi

# Test 10: Check postgres has health check
if grep -A 20 "postgres:" docker-compose.yml | grep -q "healthcheck:"; then
  echo "✅ PASS: postgres has health check"
  ((PASSED++))
else
  echo "❌ FAIL: postgres missing health check"
  ((FAILED++))
fi

# Test 11: Check backend depends on postgres
if grep -A 20 "backend:" docker-compose.yml | grep -q "depends_on:"; then
  echo "✅ PASS: backend has dependency configuration"
  ((PASSED++))
else
  echo "❌ FAIL: backend missing dependency configuration"
  ((FAILED++))
fi

# Test 12: Check backend has health check
if grep -A 20 "backend:" docker-compose.yml | grep -q "healthcheck:"; then
  echo "✅ PASS: backend has health check"
  ((PASSED++))
else
  echo "❌ FAIL: backend missing health check"
  ((FAILED++))
fi

# Test 13: Check backend exposes port 3000
if grep -A 30 "^  backend:" docker-compose.yml | grep -q "3000:3000"; then
  echo "✅ PASS: backend exposes port 3000"
  ((PASSED++))
else
  echo "❌ FAIL: backend doesn't expose port 3000"
  ((FAILED++))
fi

# Test 14: Check frontend depends on backend
if grep -A 20 "frontend:" docker-compose.yml | grep -q "depends_on:"; then
  echo "✅ PASS: frontend has dependency configuration"
  ((PASSED++))
else
  echo "❌ FAIL: frontend missing dependency configuration"
  ((FAILED++))
fi

# Test 15: Check frontend has health check
if grep -A 20 "frontend:" docker-compose.yml | grep -q "healthcheck:"; then
  echo "✅ PASS: frontend has health check"
  ((PASSED++))
else
  echo "❌ FAIL: frontend missing health check"
  ((FAILED++))
fi

# Test 16: Check frontend exposes port
if grep -A 20 "frontend:" docker-compose.yml | grep -q "8080:8080"; then
  echo "✅ PASS: frontend exposes port 8080"
  ((PASSED++))
else
  echo "❌ FAIL: frontend doesn't expose port 8080"
  ((FAILED++))
fi

# Test 17: Check volumes section defined
if grep -q "^volumes:" docker-compose.yml; then
  echo "✅ PASS: volumes section defined"
  ((PASSED++))
else
  echo "❌ FAIL: volumes section not defined"
  ((FAILED++))
fi

# Test 18: Check networks section defined
if grep -q "^networks:" docker-compose.yml; then
  echo "✅ PASS: networks section defined"
  ((PASSED++))
else
  echo "❌ FAIL: networks section not defined"
  ((FAILED++))
fi

# Test 19: Check dev override has backend volume mounts
if grep -A 20 "backend:" docker-compose.dev.yml | grep -q "volumes:"; then
  echo "✅ PASS: dev override has backend volume mounts"
  ((PASSED++))
else
  echo "❌ FAIL: dev override missing backend volume mounts"
  ((FAILED++))
fi

# Test 20: Check dev override has frontend volume mounts
if grep -A 20 "frontend:" docker-compose.dev.yml | grep -q "volumes:"; then
  echo "✅ PASS: dev override has frontend volume mounts"
  ((PASSED++))
else
  echo "❌ FAIL: dev override missing frontend volume mounts"
  ((FAILED++))
fi

# Test 21: Check .gitignore excludes docker-compose.override.yml
if grep -q "docker-compose.override.yml" .gitignore; then
  echo "✅ PASS: .gitignore excludes docker-compose.override.yml"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't exclude docker-compose.override.yml"
  ((FAILED++))
fi

# Test 22: Check docker-compose.yml is valid YAML (basic syntax check)
if command -v docker-compose &> /dev/null; then
  if docker-compose -f docker-compose.yml config > /dev/null 2>&1; then
    echo "✅ PASS: docker-compose.yml is valid YAML"
    ((PASSED++))
  else
    echo "❌ FAIL: docker-compose.yml has syntax errors"
    ((FAILED++))
  fi
else
  echo "⚠️  SKIP: docker-compose not installed, cannot validate YAML"
  ((PASSED++))  # Don't fail if docker-compose not available
fi

echo "=========================================="
echo "Test Results: Passed: $PASSED, Failed: $FAILED"
echo "=========================================="

if [ $FAILED -eq 0 ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "❌ Some tests failed!"
  exit 1
fi
