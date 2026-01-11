#!/bin/bash

# T006: Documentation Test
# Tests README, CONTRIBUTING, and .env.example files

PASSED=0
FAILED=0

echo "Running T006: Documentation Test"
echo "=========================================="

# Test 1: Check README.md exists
if [ -f "README.md" ]; then
  echo "✅ PASS: README.md exists"
  ((PASSED++))
else
  echo "❌ FAIL: README.md not found"
  ((FAILED++))
fi

# Test 2: Check CONTRIBUTING.md exists
if [ -f "CONTRIBUTING.md" ]; then
  echo "✅ PASS: CONTRIBUTING.md exists"
  ((PASSED++))
else
  echo "❌ FAIL: CONTRIBUTING.md not found"
  ((FAILED++))
fi

# Test 3: Check .env.example exists
if [ -f ".env.example" ]; then
  echo "✅ PASS: .env.example exists"
  ((PASSED++))
else
  echo "❌ FAIL: .env.example not found"
  ((FAILED++))
fi

# Test 4: README has hackathon title
if grep -q "Hackathon Demo" README.md; then
  echo "✅ PASS: README has hackathon title"
  ((PASSED++))
else
  echo "❌ FAIL: README missing hackathon title"
  ((FAILED++))
fi

# Test 5: README mentions current progress
if grep -q "5/18 tasks completed" README.md; then
  echo "✅ PASS: README shows current progress"
  ((PASSED++))
else
  echo "❌ FAIL: README missing progress tracking"
  ((FAILED++))
fi

# Test 6: README has Quick Start section
if grep -q "## Quick Start" README.md; then
  echo "✅ PASS: README has Quick Start section"
  ((PASSED++))
else
  echo "❌ FAIL: README missing Quick Start"
  ((FAILED++))
fi

# Test 7: README mentions docker-compose
if grep -q "docker-compose up" README.md; then
  echo "✅ PASS: README includes docker-compose instructions"
  ((PASSED++))
else
  echo "❌ FAIL: README missing docker-compose instructions"
  ((FAILED++))
fi

# Test 8: README has Tech Stack section
if grep -q "## Tech Stack" README.md; then
  echo "✅ PASS: README has Tech Stack section"
  ((PASSED++))
else
  echo "❌ FAIL: README missing Tech Stack section"
  ((FAILED++))
fi

# Test 9: README mentions completed tasks (H001-H005)
if grep -q "H001" README.md && grep -q "H005" README.md; then
  echo "✅ PASS: README lists completed tasks"
  ((PASSED++))
else
  echo "❌ FAIL: README missing task details"
  ((FAILED++))
fi

# Test 10: README has Project Structure section
if grep -q "## Project Structure" README.md; then
  echo "✅ PASS: README has Project Structure section"
  ((PASSED++))
else
  echo "❌ FAIL: README missing Project Structure"
  ((FAILED++))
fi

# Test 11: README has Troubleshooting section
if grep -q "## Troubleshooting" README.md; then
  echo "✅ PASS: README has Troubleshooting section"
  ((PASSED++))
else
  echo "❌ FAIL: README missing Troubleshooting"
  ((FAILED++))
fi

# Test 12: CONTRIBUTING has Development Process section
if grep -q "## Development Process" CONTRIBUTING.md; then
  echo "✅ PASS: CONTRIBUTING has Development Process"
  ((PASSED++))
else
  echo "❌ FAIL: CONTRIBUTING missing Development Process"
  ((FAILED++))
fi

# Test 13: CONTRIBUTING mentions 3 required log files
if grep -q "Three Required Logs Per Task" CONTRIBUTING.md; then
  echo "✅ PASS: CONTRIBUTING mentions 3 log files requirement"
  ((PASSED++))
else
  echo "❌ FAIL: CONTRIBUTING missing log file requirements"
  ((FAILED++))
fi

# Test 14: CONTRIBUTING has Git Workflow section
if grep -q "## Git Workflow" CONTRIBUTING.md; then
  echo "✅ PASS: CONTRIBUTING has Git Workflow section"
  ((PASSED++))
else
  echo "❌ FAIL: CONTRIBUTING missing Git Workflow"
  ((FAILED++))
fi

# Test 15: CONTRIBUTING has Code Style Guidelines
if grep -q "## Code Style Guidelines" CONTRIBUTING.md; then
  echo "✅ PASS: CONTRIBUTING has Code Style Guidelines"
  ((PASSED++))
else
  echo "❌ FAIL: CONTRIBUTING missing Code Style Guidelines"
  ((FAILED++))
fi

# Test 16: CONTRIBUTING mentions test requirements
if grep -q "Test Requirements" CONTRIBUTING.md; then
  echo "✅ PASS: CONTRIBUTING has Test Requirements"
  ((PASSED++))
else
  echo "❌ FAIL: CONTRIBUTING missing Test Requirements"
  ((FAILED++))
fi

# Test 17: CONTRIBUTING has Review Checklist
if grep -q "## Review Checklist" CONTRIBUTING.md; then
  echo "✅ PASS: CONTRIBUTING has Review Checklist"
  ((PASSED++))
else
  echo "❌ FAIL: CONTRIBUTING missing Review Checklist"
  ((FAILED++))
fi

# Test 18: .env.example has ANTHROPIC_API_KEY
if grep -q "ANTHROPIC_API_KEY" .env.example; then
  echo "✅ PASS: .env.example has ANTHROPIC_API_KEY"
  ((PASSED++))
else
  echo "❌ FAIL: .env.example missing ANTHROPIC_API_KEY"
  ((FAILED++))
fi

# Test 19: .env.example has DATABASE_URL
if grep -q "DATABASE_URL" .env.example; then
  echo "✅ PASS: .env.example has DATABASE_URL"
  ((PASSED++))
else
  echo "❌ FAIL: .env.example missing DATABASE_URL"
  ((FAILED++))
fi

# Test 20: .env.example has CORS_ORIGIN
if grep -q "CORS_ORIGIN" .env.example; then
  echo "✅ PASS: .env.example has CORS_ORIGIN"
  ((PASSED++))
else
  echo "❌ FAIL: .env.example missing CORS_ORIGIN"
  ((FAILED++))
fi

# Test 21: .env.example has VITE_API_URL
if grep -q "VITE_API_URL" .env.example; then
  echo "✅ PASS: .env.example has VITE_API_URL"
  ((PASSED++))
else
  echo "❌ FAIL: .env.example missing VITE_API_URL"
  ((FAILED++))
fi

# Test 22: .env.example has instructions
if grep -q "Instructions" .env.example; then
  echo "✅ PASS: .env.example has setup instructions"
  ((PASSED++))
else
  echo "❌ FAIL: .env.example missing instructions"
  ((FAILED++))
fi

# Test 23: .env.example has security notes
if grep -q "Security Notes" .env.example; then
  echo "✅ PASS: .env.example has security notes"
  ((PASSED++))
else
  echo "❌ FAIL: .env.example missing security notes"
  ((FAILED++))
fi

# Test 24: README file size is reasonable (> 10KB indicates comprehensive documentation)
README_SIZE=$(wc -c < README.md)
if [ $README_SIZE -gt 10000 ]; then
  echo "✅ PASS: README is comprehensive ($README_SIZE bytes)"
  ((PASSED++))
else
  echo "❌ FAIL: README too short ($README_SIZE bytes)"
  ((FAILED++))
fi

# Test 25: CONTRIBUTING file size is reasonable (> 5KB)
CONTRIBUTING_SIZE=$(wc -c < CONTRIBUTING.md)
if [ $CONTRIBUTING_SIZE -gt 5000 ]; then
  echo "✅ PASS: CONTRIBUTING is comprehensive ($CONTRIBUTING_SIZE bytes)"
  ((PASSED++))
else
  echo "❌ FAIL: CONTRIBUTING too short ($CONTRIBUTING_SIZE bytes)"
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
