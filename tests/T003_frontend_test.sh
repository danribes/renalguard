#!/bin/bash

# T003: Frontend Initialization Test
# Tests Vite + React + TypeScript + Tailwind CSS setup

PASSED=0
FAILED=0

echo "Running T003: Frontend Initialization Test"
echo "=========================================="

# Test 1: Check package.json exists
if [ -f "frontend/package.json" ]; then
  echo "✅ PASS: package.json exists"
  ((PASSED++))
else
  echo "❌ FAIL: package.json not found"
  ((FAILED++))
fi

# Test 2: Check vite.config.ts exists
if [ -f "frontend/vite.config.ts" ]; then
  echo "✅ PASS: vite.config.ts exists"
  ((PASSED++))
else
  echo "❌ FAIL: vite.config.ts not found"
  ((FAILED++))
fi

# Test 3: Check tsconfig.json exists
if [ -f "frontend/tsconfig.json" ]; then
  echo "✅ PASS: tsconfig.json exists"
  ((PASSED++))
else
  echo "❌ FAIL: tsconfig.json not found"
  ((FAILED++))
fi

# Test 4: Check index.html exists
if [ -f "frontend/index.html" ]; then
  echo "✅ PASS: index.html exists"
  ((PASSED++))
else
  echo "❌ FAIL: index.html not found"
  ((FAILED++))
fi

# Test 5: Check src/main.tsx exists
if [ -f "frontend/src/main.tsx" ]; then
  echo "✅ PASS: src/main.tsx exists"
  ((PASSED++))
else
  echo "❌ FAIL: src/main.tsx not found"
  ((FAILED++))
fi

# Test 6: Check src/App.tsx exists
if [ -f "frontend/src/App.tsx" ]; then
  echo "✅ PASS: src/App.tsx exists"
  ((PASSED++))
else
  echo "❌ FAIL: src/App.tsx not found"
  ((FAILED++))
fi

# Test 7: Check src/index.css exists
if [ -f "frontend/src/index.css" ]; then
  echo "✅ PASS: src/index.css exists"
  ((PASSED++))
else
  echo "❌ FAIL: src/index.css not found"
  ((FAILED++))
fi

# Test 8: Check node_modules directory exists
if [ -d "frontend/node_modules" ]; then
  echo "✅ PASS: node_modules directory exists"
  ((PASSED++))
else
  echo "❌ FAIL: node_modules directory not found"
  ((FAILED++))
fi

# Test 9: Check React package installed
if [ -d "frontend/node_modules/react" ]; then
  echo "✅ PASS: React package installed"
  ((PASSED++))
else
  echo "❌ FAIL: React package not installed"
  ((FAILED++))
fi

# Test 10: Check Vite package installed
if [ -d "frontend/node_modules/vite" ]; then
  echo "✅ PASS: Vite package installed"
  ((PASSED++))
else
  echo "❌ FAIL: Vite package not installed"
  ((FAILED++))
fi

# Test 11: Check TypeScript package installed
if [ -d "frontend/node_modules/typescript" ]; then
  echo "✅ PASS: TypeScript package installed"
  ((PASSED++))
else
  echo "❌ FAIL: TypeScript package not installed"
  ((FAILED++))
fi

# Test 12: Check Tailwind CSS package installed
if [ -d "frontend/node_modules/tailwindcss" ]; then
  echo "✅ PASS: Tailwind CSS package installed"
  ((PASSED++))
else
  echo "❌ FAIL: Tailwind CSS package not installed"
  ((FAILED++))
fi

# Test 13: Check tailwind.config.js exists
if [ -f "frontend/tailwind.config.js" ]; then
  echo "✅ PASS: tailwind.config.js exists"
  ((PASSED++))
else
  echo "❌ FAIL: tailwind.config.js not found"
  ((FAILED++))
fi

# Test 14: Check postcss.config.js exists
if [ -f "frontend/postcss.config.js" ]; then
  echo "✅ PASS: postcss.config.js exists"
  ((PASSED++))
else
  echo "❌ FAIL: postcss.config.js not found"
  ((FAILED++))
fi

# Test 15: Check package.json has 'dev' script
if grep -q '"dev"' frontend/package.json; then
  echo "✅ PASS: package.json has 'dev' script"
  ((PASSED++))
else
  echo "❌ FAIL: package.json missing 'dev' script"
  ((FAILED++))
fi

# Test 16: Check package.json has 'build' script
if grep -q '"build"' frontend/package.json; then
  echo "✅ PASS: package.json has 'build' script"
  ((PASSED++))
else
  echo "❌ FAIL: package.json missing 'build' script"
  ((FAILED++))
fi

# Test 17: Check index.css has Tailwind directives
if grep -q "@tailwind base" frontend/src/index.css; then
  echo "✅ PASS: index.css has Tailwind directives"
  ((PASSED++))
else
  echo "❌ FAIL: index.css missing Tailwind directives"
  ((FAILED++))
fi

# Test 18: Check TypeScript compiles without errors
cd frontend
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  echo "❌ FAIL: TypeScript compilation errors"
  ((FAILED++))
else
  echo "✅ PASS: TypeScript compiles without errors"
  ((PASSED++))
fi
cd ..

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
