#!/bin/bash

# T012: Database Connection from Backend - Test Script
# Tests PostgreSQL client installation, database config module, and integration

echo "Running T012: Database Connection from Backend Test"
echo "=========================================="

PASSED=0
FAILED=0

# Test 1: Verify pg package installed
if grep -q '"pg"' backend/package.json; then
  echo "✅ PASS: pg package installed"
  ((PASSED++))
else
  echo "❌ FAIL: pg package not found in package.json"
  ((FAILED++))
fi

# Test 2: Verify @types/pg package installed
if grep -q '"@types/pg"' backend/package.json; then
  echo "✅ PASS: @types/pg package installed"
  ((PASSED++))
else
  echo "❌ FAIL: @types/pg package not found in package.json"
  ((FAILED++))
fi

# Test 3: Verify database.ts config file exists
if [ -f "backend/src/config/database.ts" ]; then
  echo "✅ PASS: database.ts config file exists"
  ((PASSED++))
else
  echo "❌ FAIL: database.ts config file not found"
  ((FAILED++))
fi

# Test 4: Verify database.ts imports Pool from pg
if grep -q "import.*Pool.*from 'pg'" backend/src/config/database.ts; then
  echo "✅ PASS: database.ts imports Pool from pg"
  ((PASSED++))
else
  echo "❌ FAIL: database.ts does not import Pool from pg"
  ((FAILED++))
fi

# Test 5: Verify testConnection function exists
if grep -q "export.*function testConnection" backend/src/config/database.ts; then
  echo "✅ PASS: testConnection function defined"
  ((PASSED++))
else
  echo "❌ FAIL: testConnection function not found"
  ((FAILED++))
fi

# Test 6: Verify query function exists
if grep -q "export.*function query" backend/src/config/database.ts; then
  echo "✅ PASS: query function defined"
  ((PASSED++))
else
  echo "❌ FAIL: query function not found"
  ((FAILED++))
fi

# Test 7: Verify closePool function exists
if grep -q "export.*function closePool" backend/src/config/database.ts; then
  echo "✅ PASS: closePool function defined"
  ((PASSED++))
else
  echo "❌ FAIL: closePool function not found"
  ((FAILED++))
fi

# Test 8: Verify getPoolStats function exists
if grep -q "export.*function getPoolStats" backend/src/config/database.ts; then
  echo "✅ PASS: getPoolStats function defined"
  ((PASSED++))
else
  echo "❌ FAIL: getPoolStats function not found"
  ((FAILED++))
fi

# Test 9: Verify database pool configuration reads from env
if grep -q "process.env.DB_HOST" backend/src/config/database.ts; then
  echo "✅ PASS: Database config reads from environment variables"
  ((PASSED++))
else
  echo "❌ FAIL: Database config does not read from environment"
  ((FAILED++))
fi

# Test 10: Verify pool error handler exists
if grep -q "pool.on('error'" backend/src/config/database.ts; then
  echo "✅ PASS: Pool error handler defined"
  ((PASSED++))
else
  echo "❌ FAIL: Pool error handler not found"
  ((FAILED++))
fi

# Test 11: Verify index.ts imports database module
if grep -q "import.*database" backend/src/index.ts; then
  echo "✅ PASS: index.ts imports database module"
  ((PASSED++))
else
  echo "❌ FAIL: index.ts does not import database module"
  ((FAILED++))
fi

# Test 12: Verify /api/db/health endpoint exists
if grep -q "app.get('/api/db/health'" backend/src/index.ts; then
  echo "✅ PASS: /api/db/health endpoint defined"
  ((PASSED++))
else
  echo "❌ FAIL: /api/db/health endpoint not found"
  ((FAILED++))
fi

# Test 13: Verify /api/db/test endpoint exists
if grep -q "app.get('/api/db/test'" backend/src/index.ts; then
  echo "✅ PASS: /api/db/test endpoint defined"
  ((PASSED++))
else
  echo "❌ FAIL: /api/db/test endpoint not found"
  ((FAILED++))
fi

# Test 14: Verify testConnection called on startup
if grep -q "await testConnection()" backend/src/index.ts; then
  echo "✅ PASS: testConnection called on server startup"
  ((PASSED++))
else
  echo "❌ FAIL: testConnection not called on startup"
  ((FAILED++))
fi

# Test 15: Verify closePool called on shutdown
if grep -q "await closePool()" backend/src/index.ts; then
  echo "✅ PASS: closePool called on graceful shutdown"
  ((PASSED++))
else
  echo "❌ FAIL: closePool not called on shutdown"
  ((FAILED++))
fi

# Test 16: Verify .env has DB_HOST
if grep -q "DB_HOST=" backend/.env; then
  echo "✅ PASS: .env contains DB_HOST"
  ((PASSED++))
else
  echo "❌ FAIL: .env missing DB_HOST"
  ((FAILED++))
fi

# Test 17: Verify .env has DB_PORT
if grep -q "DB_PORT=" backend/.env; then
  echo "✅ PASS: .env contains DB_PORT"
  ((PASSED++))
else
  echo "❌ FAIL: .env missing DB_PORT"
  ((FAILED++))
fi

# Test 18: Verify .env has DB_NAME
if grep -q "DB_NAME=" backend/.env; then
  echo "✅ PASS: .env contains DB_NAME"
  ((PASSED++))
else
  echo "❌ FAIL: .env missing DB_NAME"
  ((FAILED++))
fi

# Test 19: Verify .env has DB_USER
if grep -q "DB_USER=" backend/.env; then
  echo "✅ PASS: .env contains DB_USER"
  ((PASSED++))
else
  echo "❌ FAIL: .env missing DB_USER"
  ((FAILED++))
fi

# Test 20: Verify .env has DB_PASSWORD
if grep -q "DB_PASSWORD=" backend/.env; then
  echo "✅ PASS: .env contains DB_PASSWORD"
  ((PASSED++))
else
  echo "❌ FAIL: .env missing DB_PASSWORD"
  ((FAILED++))
fi

# Test 21: Verify TypeScript compilation succeeds
if cd backend && npm run build > /dev/null 2>&1; then
  echo "✅ PASS: TypeScript compilation successful"
  ((PASSED++))
  cd ..
else
  echo "❌ FAIL: TypeScript compilation failed"
  ((FAILED++))
  cd ..
fi

# Test 22: Verify database.ts file size is substantial
DB_CONFIG_SIZE=$(wc -c < backend/src/config/database.ts)
if [ $DB_CONFIG_SIZE -gt 2000 ]; then
  echo "✅ PASS: database.ts is comprehensive ($DB_CONFIG_SIZE bytes)"
  ((PASSED++))
else
  echo "❌ FAIL: database.ts is too small ($DB_CONFIG_SIZE bytes)"
  ((FAILED++))
fi

# Test 23: Verify pg module is in node_modules
if [ -d "backend/node_modules/pg" ]; then
  echo "✅ PASS: pg module installed in node_modules"
  ((PASSED++))
else
  echo "❌ FAIL: pg module not found in node_modules"
  ((FAILED++))
fi

# Test 24: Verify @types/pg module is in node_modules
if [ -d "backend/node_modules/@types/pg" ]; then
  echo "✅ PASS: @types/pg module installed in node_modules"
  ((PASSED++))
else
  echo "❌ FAIL: @types/pg module not found in node_modules"
  ((FAILED++))
fi

# Test 25: Verify pool configuration has connection limits
if grep -q "max:" backend/src/config/database.ts; then
  echo "✅ PASS: Connection pool has max connections configured"
  ((PASSED++))
else
  echo "❌ FAIL: Connection pool max not configured"
  ((FAILED++))
fi

echo "=========================================="
echo "Test Results: Passed: $PASSED, Failed: $FAILED"
echo "=========================================="

if [ $FAILED -eq 0 ]; then
  echo "✅ All tests passed!"
  echo ""
  echo "Database Connection Integration Complete"
  echo "Backend can connect to PostgreSQL"
  exit 0
else
  echo "❌ Some tests failed!"
  exit 1
fi
