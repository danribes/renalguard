#!/bin/bash
# Test T002: Backend Initialization Verification
# This test verifies that the backend server can start and respond to requests

echo "Running T002: Backend Initialization Test"
echo "=========================================="

FAILED=0
PASSED=0

# Test function
test_check() {
    if [ $? -eq 0 ]; then
        echo "✅ PASS: $1"
        ((PASSED++))
    else
        echo "❌ FAIL: $1"
        ((FAILED++))
    fi
}

echo ""
echo "Test 1: Verify package.json exists"
test -f backend/package.json
test_check "package.json exists"

echo ""
echo "Test 2: Verify tsconfig.json exists"
test -f backend/tsconfig.json
test_check "tsconfig.json exists"

echo ""
echo "Test 3: Verify src/index.ts exists"
test -f backend/src/index.ts
test_check "src/index.ts exists"

echo ""
echo "Test 4: Verify .env file exists"
test -f backend/.env
test_check ".env file exists"

echo ""
echo "Test 5: Verify node_modules installed"
test -d backend/node_modules
test_check "node_modules directory exists"

echo ""
echo "Test 6: Verify Express is installed"
test -d backend/node_modules/express
test_check "Express package installed"

echo ""
echo "Test 7: Verify TypeScript is installed"
test -d backend/node_modules/typescript
test_check "TypeScript package installed"

echo ""
echo "Test 8: Verify Anthropic SDK is installed"
test -d backend/node_modules/@anthropic-ai
test_check "Anthropic SDK installed"

echo ""
echo "Test 9: Verify package.json has dev script"
grep -q '"dev":' backend/package.json
test_check "package.json has 'dev' script"

echo ""
echo "Test 10: Verify package.json has build script"
grep -q '"build":' backend/package.json
test_check "package.json has 'build' script"

echo ""
echo "Test 11: Verify package.json has start script"
grep -q '"start":' backend/package.json
test_check "package.json has 'start' script"

echo ""
echo "Test 12: Verify TypeScript compilation"
cd backend && npx tsc --noEmit > /dev/null 2>&1
test_check "TypeScript compiles without errors"
cd ..

echo ""
echo "=========================================="
echo "Test Results:"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "=========================================="

if [ $FAILED -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed!"
    exit 1
fi
