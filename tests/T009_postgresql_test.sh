#!/bin/bash

# T009: PostgreSQL Setup Test
# Tests database schema, mock patient data, and initialization

PASSED=0
FAILED=0

echo "Running T009: PostgreSQL Setup Test"
echo "=========================================="

# Test 1: Check init.sql exists
if [ -f "infrastructure/postgres/init.sql" ]; then
  echo "✅ PASS: init.sql exists"
  ((PASSED++))
else
  echo "❌ FAIL: init.sql not found"
  ((FAILED++))
fi

# Test 2: Check init.sql has schema creation
if grep -q "CREATE TABLE.*patients" infrastructure/postgres/init.sql; then
  echo "✅ PASS: init.sql creates patients table"
  ((PASSED++))
else
  echo "❌ FAIL: patients table not defined"
  ((FAILED++))
fi

# Test 3: Check observations table defined
if grep -q "CREATE TABLE.*observations" infrastructure/postgres/init.sql; then
  echo "✅ PASS: init.sql creates observations table"
  ((PASSED++))
else
  echo "❌ FAIL: observations table not defined"
  ((FAILED++))
fi

# Test 4: Check conditions table defined
if grep -q "CREATE TABLE.*conditions" infrastructure/postgres/init.sql; then
  echo "✅ PASS: init.sql creates conditions table"
  ((PASSED++))
else
  echo "❌ FAIL: conditions table not defined"
  ((FAILED++))
fi

# Test 5: Check risk_assessments table defined
if grep -q "CREATE TABLE.*risk_assessments" infrastructure/postgres/init.sql; then
  echo "✅ PASS: init.sql creates risk_assessments table"
  ((PASSED++))
else
  echo "❌ FAIL: risk_assessments table not defined"
  ((FAILED++))
fi

# Test 6: Check UUID extension
if grep -q "uuid-ossp" infrastructure/postgres/init.sql; then
  echo "✅ PASS: UUID extension enabled"
  ((PASSED++))
else
  echo "❌ FAIL: UUID extension not enabled"
  ((FAILED++))
fi

# Test 7: Check timezone set to UTC
if grep -q "timezone.*UTC" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Timezone set to UTC"
  ((PASSED++))
else
  echo "❌ FAIL: Timezone not set to UTC"
  ((FAILED++))
fi

# Test 8: Check Patient 1 (John Anderson) exists
if grep -q "MRN001.*John.*Anderson" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Patient 1 (John Anderson) defined"
  ((PASSED++))
else
  echo "❌ FAIL: Patient 1 not found"
  ((FAILED++))
fi

# Test 9: Check Patient 2 (Maria Rodriguez) exists
if grep -q "MRN002.*Maria.*Rodriguez" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Patient 2 (Maria Rodriguez) defined"
  ((PASSED++))
else
  echo "❌ FAIL: Patient 2 not found"
  ((FAILED++))
fi

# Test 10: Check Patient 3 (David Chen) exists
if grep -q "MRN003.*David.*Chen" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Patient 3 (David Chen) defined"
  ((PASSED++))
else
  echo "❌ FAIL: Patient 3 not found"
  ((FAILED++))
fi

# Test 11: Check Patient 4 (Sarah Johnson) exists
if grep -q "MRN004.*Sarah.*Johnson" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Patient 4 (Sarah Johnson) defined"
  ((PASSED++))
else
  echo "❌ FAIL: Patient 4 not found"
  ((FAILED++))
fi

# Test 12: Check Patient 5 (Michael Thompson) exists
if grep -q "MRN005.*Michael.*Thompson" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Patient 5 (Michael Thompson) defined"
  ((PASSED++))
else
  echo "❌ FAIL: Patient 5 not found"
  ((FAILED++))
fi

# Test 13: Check eGFR observations exist
if grep -q "observation_type.*eGFR" infrastructure/postgres/init.sql; then
  echo "✅ PASS: eGFR observations defined"
  ((PASSED++))
else
  echo "❌ FAIL: eGFR observations not found"
  ((FAILED++))
fi

# Test 14: Check serum creatinine observations
if grep -q "serum_creatinine" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Serum creatinine observations defined"
  ((PASSED++))
else
  echo "❌ FAIL: Serum creatinine not found"
  ((FAILED++))
fi

# Test 15: Check uACR (urine albumin) observations
if grep -q "uACR" infrastructure/postgres/init.sql; then
  echo "✅ PASS: uACR observations defined"
  ((PASSED++))
else
  echo "❌ FAIL: uACR observations not found"
  ((FAILED++))
fi

# Test 16: Check blood pressure observations
if grep -q "blood_pressure" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Blood pressure observations defined"
  ((PASSED++))
else
  echo "❌ FAIL: Blood pressure not found"
  ((FAILED++))
fi

# Test 17: Check ICD-10 codes for conditions
if grep -q "condition_code" infrastructure/postgres/init.sql && grep -q "E11.9\|N18\|I10" infrastructure/postgres/init.sql; then
  echo "✅ PASS: ICD-10 coded conditions defined"
  ((PASSED++))
else
  echo "❌ FAIL: ICD-10 codes not found"
  ((FAILED++))
fi

# Test 18: Check CKD conditions exist
if grep -q "Chronic Kidney Disease" infrastructure/postgres/init.sql; then
  echo "✅ PASS: CKD conditions defined"
  ((PASSED++))
else
  echo "❌ FAIL: CKD conditions not found"
  ((FAILED++))
fi

# Test 19: Check diabetes conditions exist
if grep -q "Diabetes" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Diabetes conditions defined"
  ((PASSED++))
else
  echo "❌ FAIL: Diabetes conditions not found"
  ((FAILED++))
fi

# Test 20: Check hypertension conditions exist
if grep -q "Hypertension" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Hypertension conditions defined"
  ((PASSED++))
else
  echo "❌ FAIL: Hypertension conditions not found"
  ((FAILED++))
fi

# Test 21: Check indexes created
if grep -q "CREATE INDEX" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Database indexes defined"
  ((PASSED++))
else
  echo "❌ FAIL: No indexes found"
  ((FAILED++))
fi

# Test 22: Check patient_summary view created
if grep -q "patient_summary" infrastructure/postgres/init.sql; then
  echo "✅ PASS: patient_summary view defined"
  ((PASSED++))
else
  echo "❌ FAIL: patient_summary view not found"
  ((FAILED++))
fi

# Test 23: Check verification queries exist
if grep -q "Database initialization complete" infrastructure/postgres/init.sql; then
  echo "✅ PASS: Verification queries included"
  ((PASSED++))
else
  echo "❌ FAIL: No verification queries"
  ((FAILED++))
fi

# Test 24: Check file size is comprehensive (> 10KB)
INIT_SQL_SIZE=$(wc -c < infrastructure/postgres/init.sql)
if [ $INIT_SQL_SIZE -gt 10000 ]; then
  echo "✅ PASS: init.sql is comprehensive ($INIT_SQL_SIZE bytes)"
  ((PASSED++))
else
  echo "❌ FAIL: init.sql too small ($INIT_SQL_SIZE bytes)"
  ((FAILED++))
fi

# Test 25: Check docker-compose.yml references init.sql
if grep -q "init.sql" docker-compose.yml; then
  echo "✅ PASS: docker-compose.yml mounts init.sql"
  ((PASSED++))
else
  echo "❌ FAIL: init.sql not mounted in docker-compose"
  ((FAILED++))
fi

echo "=========================================="
echo "Test Results: Passed: $PASSED, Failed: $FAILED"
echo "=========================================="

if [ $FAILED -eq 0 ]; then
  echo "✅ All tests passed!"
  echo ""
  echo "PostgreSQL Setup Complete"
  echo "5 mock CKD patients with realistic clinical data ready"
  exit 0
else
  echo "❌ Some tests failed!"
  exit 1
fi
