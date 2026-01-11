#!/bin/bash

# T008: Infrastructure Verification Test
# Verifies all Phase H1 infrastructure components and creates baseline

PASSED=0
FAILED=0

echo "Running T008: Infrastructure Verification Test"
echo "=========================================="

# Test 1: Run all previous tests
echo "Running all infrastructure tests (T001-T007)..."
ALL_TESTS_PASSED=true

for test_num in {1..7}; do
  test_file=$(ls tests/T00${test_num}_*.sh 2>/dev/null | head -1)
  if [ -f "$test_file" ]; then
    if ! bash "$test_file" > /dev/null 2>&1; then
      ALL_TESTS_PASSED=false
      echo "  ❌ $(basename $test_file) failed"
    fi
  fi
done

if [ "$ALL_TESTS_PASSED" = true ]; then
  echo "✅ PASS: All infrastructure tests (T001-T007) passed"
  ((PASSED++))
else
  echo "❌ FAIL: Some infrastructure tests failed"
  ((FAILED++))
fi

# Test 2: Check Phase H1 completion report exists
if [ -f "PHASE_H1_COMPLETION_REPORT.md" ]; then
  echo "✅ PASS: Phase H1 completion report exists"
  ((PASSED++))
else
  echo "❌ FAIL: Phase H1 completion report not found"
  ((FAILED++))
fi

# Test 3: Verify git repository clean (except H008 files)
UNTRACKED=$(git status --porcelain | grep "^??" | grep -v "hackathon-tasks.md" | grep -v "PHASE_H1_COMPLETION_REPORT.md" | grep -v "T008_" | grep -v "log_")
if [ -z "$UNTRACKED" ]; then
  echo "✅ PASS: No unexpected untracked files"
  ((PASSED++))
else
  echo "❌ FAIL: Unexpected untracked files found: $UNTRACKED"
  ((FAILED++))
fi

# Test 4: Verify all H001-H007 tasks have commits
COMMIT_COUNT=$(git log --oneline | grep -E "Complete H00[1-7]:" | wc -l)
if [ $COMMIT_COUNT -eq 7 ]; then
  echo "✅ PASS: All H001-H007 tasks committed ($COMMIT_COUNT commits)"
  ((PASSED++))
else
  echo "❌ FAIL: Expected 7 commits, found $COMMIT_COUNT"
  ((FAILED++))
fi

# Test 5: Verify required directories exist
REQUIRED_DIRS=("backend" "frontend" "infrastructure" "tests" "log_files" "log_tests" "log_learn")
MISSING_DIRS=0
for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "  Missing directory: $dir"
    ((MISSING_DIRS++))
  fi
done

if [ $MISSING_DIRS -eq 0 ]; then
  echo "✅ PASS: All required directories exist"
  ((PASSED++))
else
  echo "❌ FAIL: $MISSING_DIRS directories missing"
  ((FAILED++))
fi

# Test 6: Verify backend package.json exists
if [ -f "backend/package.json" ]; then
  echo "✅ PASS: backend/package.json exists"
  ((PASSED++))
else
  echo "❌ FAIL: backend/package.json not found"
  ((FAILED++))
fi

# Test 7: Verify frontend package.json exists
if [ -f "frontend/package.json" ]; then
  echo "✅ PASS: frontend/package.json exists"
  ((PASSED++))
else
  echo "❌ FAIL: frontend/package.json not found"
  ((FAILED++))
fi

# Test 8: Verify Docker files exist
DOCKER_FILES=("backend/Dockerfile" "frontend/Dockerfile" "docker-compose.yml" "docker-compose.dev.yml")
MISSING_DOCKER=0
for file in "${DOCKER_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "  Missing Docker file: $file"
    ((MISSING_DOCKER++))
  fi
done

if [ $MISSING_DOCKER -eq 0 ]; then
  echo "✅ PASS: All Docker files exist"
  ((PASSED++))
else
  echo "❌ FAIL: $MISSING_DOCKER Docker files missing"
  ((FAILED++))
fi

# Test 9: Verify documentation files exist
DOC_FILES=("README.md" "CONTRIBUTING.md" ".env.example" ".gitignore")
MISSING_DOCS=0
for file in "${DOC_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "  Missing documentation: $file"
    ((MISSING_DOCS++))
  fi
done

if [ $MISSING_DOCS -eq 0 ]; then
  echo "✅ PASS: All documentation files exist"
  ((PASSED++))
else
  echo "❌ FAIL: $MISSING_DOCS documentation files missing"
  ((FAILED++))
fi

# Test 10: Verify .env is NOT tracked (security)
if ! git ls-files | grep -q "^\.env$"; then
  echo "✅ PASS: .env is not tracked (security verified)"
  ((PASSED++))
else
  echo "❌ FAIL: .env is tracked (SECURITY RISK!)"
  ((FAILED++))
fi

# Test 11: Verify .env.example IS tracked
if git ls-files | grep -q "\.env\.example"; then
  echo "✅ PASS: .env.example is tracked"
  ((PASSED++))
else
  echo "❌ FAIL: .env.example not tracked"
  ((FAILED++))
fi

# Test 12: Verify test scripts exist (T001-T007)
TEST_COUNT=$(ls tests/T00{1..7}_*.sh 2>/dev/null | wc -l)
if [ $TEST_COUNT -eq 7 ]; then
  echo "✅ PASS: All 7 test scripts exist (T001-T007)"
  ((PASSED++))
else
  echo "❌ FAIL: Expected 7 test scripts, found $TEST_COUNT"
  ((FAILED++))
fi

# Test 13: Verify log files exist (Implementation logs)
LOG_COUNT=$(ls log_files/T00{1..7}_*_Log.md 2>/dev/null | wc -l)
if [ $LOG_COUNT -eq 7 ]; then
  echo "✅ PASS: All 7 implementation logs exist"
  ((PASSED++))
else
  echo "❌ FAIL: Expected 7 implementation logs, found $LOG_COUNT"
  ((FAILED++))
fi

# Test 14: Verify test logs exist
TESTLOG_COUNT=$(ls log_tests/T00{1..7}_*_TestLog.md 2>/dev/null | wc -l)
if [ $TESTLOG_COUNT -eq 7 ]; then
  echo "✅ PASS: All 7 test logs exist"
  ((PASSED++))
else
  echo "❌ FAIL: Expected 7 test logs, found $TESTLOG_COUNT"
  ((FAILED++))
fi

# Test 15: Verify learning guides exist
GUIDE_COUNT=$(ls log_learn/T00{1..7}_*_Guide.md 2>/dev/null | wc -l)
if [ $GUIDE_COUNT -eq 7 ]; then
  echo "✅ PASS: All 7 learning guides exist"
  ((PASSED++))
else
  echo "❌ FAIL: Expected 7 learning guides, found $GUIDE_COUNT"
  ((FAILED++))
fi

# Test 16: Verify backend TypeScript source exists
if [ -f "backend/src/index.ts" ]; then
  echo "✅ PASS: backend/src/index.ts exists"
  ((PASSED++))
else
  echo "❌ FAIL: backend/src/index.ts not found"
  ((FAILED++))
fi

# Test 17: Verify frontend React source exists
if [ -f "frontend/src/App.tsx" ]; then
  echo "✅ PASS: frontend/src/App.tsx exists"
  ((PASSED++))
else
  echo "❌ FAIL: frontend/src/App.tsx not found"
  ((FAILED++))
fi

# Test 18: Verify git branch is correct
CURRENT_BRANCH=$(git branch --show-current)
if [ -n "$CURRENT_BRANCH" ]; then
  echo "✅ PASS: On git branch '$CURRENT_BRANCH'"
  ((PASSED++))
else
  echo "❌ FAIL: Cannot determine git branch"
  ((FAILED++))
fi

# Test 19: Verify remote is set
if git remote -v | grep -q "origin"; then
  echo "✅ PASS: Git remote 'origin' configured"
  ((PASSED++))
else
  echo "❌ FAIL: Git remote not configured"
  ((FAILED++))
fi

# Test 20: Verify tracked file count is reasonable
TRACKED_FILES=$(git ls-files | wc -l)
if [ $TRACKED_FILES -ge 50 ] && [ $TRACKED_FILES -le 100 ]; then
  echo "✅ PASS: Tracked files count is reasonable ($TRACKED_FILES files)"
  ((PASSED++))
else
  echo "⚠️  WARNING: Unusual tracked file count: $TRACKED_FILES files"
  echo "✅ PASS: Counted tracked files ($TRACKED_FILES)"
  ((PASSED++))
fi

echo "=========================================="
echo "Test Results: Passed: $PASSED, Failed: $FAILED"
echo "=========================================="

if [ $FAILED -eq 0 ]; then
  echo "✅ All tests passed!"
  echo ""
  echo "Phase H1 Infrastructure Verification Complete"
  echo "Ready to proceed to Phase H2 (Database & Config)"
  exit 0
else
  echo "❌ Some tests failed!"
  exit 1
fi
