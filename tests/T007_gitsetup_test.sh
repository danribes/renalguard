#!/bin/bash

# T007: Git Setup Test
# Tests .gitignore configuration and git repository setup

PASSED=0
FAILED=0

echo "Running T007: Git Setup Test"
echo "=========================================="

# Test 1: Check .gitignore exists
if [ -f ".gitignore" ]; then
  echo "✅ PASS: .gitignore exists"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore not found"
  ((FAILED++))
fi

# Test 2: Check .gitignore has dependencies section
if grep -q "# Dependencies" .gitignore; then
  echo "✅ PASS: .gitignore has dependencies section"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore missing dependencies section"
  ((FAILED++))
fi

# Test 3: Check node_modules is ignored
if grep -q "node_modules/" .gitignore; then
  echo "✅ PASS: .gitignore ignores node_modules"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore node_modules"
  ((FAILED++))
fi

# Test 4: Check .env is ignored
if grep -q "^\.env$" .gitignore; then
  echo "✅ PASS: .gitignore ignores .env"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore .env"
  ((FAILED++))
fi

# Test 5: Check dist/ build outputs are ignored
if grep -q "dist/" .gitignore; then
  echo "✅ PASS: .gitignore ignores dist/"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore dist/"
  ((FAILED++))
fi

# Test 6: Check *.log files are ignored
if grep -q "\.log" .gitignore; then
  echo "✅ PASS: .gitignore ignores log files"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore log files"
  ((FAILED++))
fi

# Test 7: Check Docker files are ignored
if grep -q "# Docker" .gitignore; then
  echo "✅ PASS: .gitignore has Docker section"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore missing Docker section"
  ((FAILED++))
fi

# Test 8: Check .gitignore ignores IDE files
if grep -q "\.vscode/" .gitignore && grep -q "\.idea/" .gitignore; then
  echo "✅ PASS: .gitignore ignores IDE files"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore IDE files"
  ((FAILED++))
fi

# Test 9: Check .gitignore ignores OS files
if grep -q "\.DS_Store" .gitignore && grep -q "Thumbs.db" .gitignore; then
  echo "✅ PASS: .gitignore ignores OS files"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore OS files"
  ((FAILED++))
fi

# Test 10: Check this is a git repository
if [ -d ".git" ]; then
  echo "✅ PASS: .git directory exists"
  ((PASSED++))
else
  echo "❌ FAIL: not a git repository"
  ((FAILED++))
fi

# Test 11: Check git can run
if git --version > /dev/null 2>&1; then
  echo "✅ PASS: git is installed and accessible"
  ((PASSED++))
else
  echo "❌ FAIL: git not available"
  ((FAILED++))
fi

# Test 12: Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
if [ -n "$CURRENT_BRANCH" ]; then
  echo "✅ PASS: on branch '$CURRENT_BRANCH'"
  ((PASSED++))
else
  echo "❌ FAIL: cannot determine current branch"
  ((FAILED++))
fi

# Test 13: Verify node_modules is NOT tracked (if it exists)
if [ -d "backend/node_modules" ] || [ -d "frontend/node_modules" ]; then
  if ! git ls-files | grep -q "node_modules"; then
    echo "✅ PASS: node_modules not tracked by git"
    ((PASSED++))
  else
    echo "❌ FAIL: node_modules is tracked by git"
    ((FAILED++))
  fi
else
  echo "✅ PASS: node_modules doesn't exist (nothing to track)"
  ((PASSED++))
fi

# Test 14: Verify .env is NOT tracked
if ! git ls-files | grep -q "^\.env$"; then
  echo "✅ PASS: .env is not tracked"
  ((PASSED++))
else
  echo "❌ FAIL: .env is tracked (SECURITY RISK!)"
  ((FAILED++))
fi

# Test 15: Verify .env.example IS tracked
if git ls-files | grep -q "\.env\.example"; then
  echo "✅ PASS: .env.example is tracked"
  ((PASSED++))
else
  echo "❌ FAIL: .env.example not tracked"
  ((FAILED++))
fi

# Test 16: Check source files ARE tracked
if git ls-files | grep -q "backend/src/index.ts"; then
  echo "✅ PASS: source files are tracked"
  ((PASSED++))
else
  echo "❌ FAIL: source files not tracked"
  ((FAILED++))
fi

# Test 17: Check .gitignore ignores coverage/
if grep -q "coverage/" .gitignore; then
  echo "✅ PASS: .gitignore ignores coverage/"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore coverage/"
  ((FAILED++))
fi

# Test 18: Check .gitignore ignores test artifacts
if grep -q "test-results/" .gitignore; then
  echo "✅ PASS: .gitignore ignores test-results/"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore test-results/"
  ((FAILED++))
fi

# Test 19: Check .gitignore has organized sections
SECTION_COUNT=$(grep -c "^# ====" .gitignore)
if [ $SECTION_COUNT -ge 8 ]; then
  echo "✅ PASS: .gitignore has $SECTION_COUNT organized sections"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore has only $SECTION_COUNT sections (expected >= 8)"
  ((FAILED++))
fi

# Test 20: Verify git status doesn't show ignored files
GIT_STATUS_OUTPUT=$(git status --short)
if ! echo "$GIT_STATUS_OUTPUT" | grep -q "node_modules"; then
  echo "✅ PASS: git status doesn't show ignored files"
  ((PASSED++))
else
  echo "❌ FAIL: git status shows ignored files"
  ((FAILED++))
fi

# Test 21: Check .gitignore ignores temporary files
if grep -q "\.tmp" .gitignore && grep -q "\.temp" .gitignore; then
  echo "✅ PASS: .gitignore ignores temporary files"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore temporary files"
  ((FAILED++))
fi

# Test 22: Check .gitignore ignores backup files
if grep -q "\.bak" .gitignore && grep -q "\.backup" .gitignore; then
  echo "✅ PASS: .gitignore ignores backup files"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore doesn't ignore backup files"
  ((FAILED++))
fi

# Test 23: Check .gitignore file size is reasonable (> 1KB indicates comprehensive)
GITIGNORE_SIZE=$(wc -c < .gitignore)
if [ $GITIGNORE_SIZE -gt 1000 ]; then
  echo "✅ PASS: .gitignore is comprehensive ($GITIGNORE_SIZE bytes)"
  ((PASSED++))
else
  echo "❌ FAIL: .gitignore too short ($GITIGNORE_SIZE bytes)"
  ((FAILED++))
fi

# Test 24: Verify README.md IS tracked
if git ls-files | grep -q "README.md"; then
  echo "✅ PASS: README.md is tracked"
  ((PASSED++))
else
  echo "❌ FAIL: README.md not tracked"
  ((FAILED++))
fi

# Test 25: Verify test scripts ARE tracked
if git ls-files | grep -q "tests/.*\.sh"; then
  echo "✅ PASS: test scripts are tracked"
  ((PASSED++))
else
  echo "❌ FAIL: test scripts not tracked"
  ((FAILED++))
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
