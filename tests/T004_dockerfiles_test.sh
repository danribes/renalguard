#!/bin/bash

# T004: Dockerfile Creation Test
# Tests Dockerfiles for backend and frontend

PASSED=0
FAILED=0

echo "Running T004: Dockerfile Creation Test"
echo "=========================================="

# Test 1: Check backend Dockerfile exists
if [ -f "backend/Dockerfile" ]; then
  echo "✅ PASS: backend/Dockerfile exists"
  ((PASSED++))
else
  echo "❌ FAIL: backend/Dockerfile not found"
  ((FAILED++))
fi

# Test 2: Check backend .dockerignore exists
if [ -f "backend/.dockerignore" ]; then
  echo "✅ PASS: backend/.dockerignore exists"
  ((PASSED++))
else
  echo "❌ FAIL: backend/.dockerignore not found"
  ((FAILED++))
fi

# Test 3: Check frontend Dockerfile exists
if [ -f "frontend/Dockerfile" ]; then
  echo "✅ PASS: frontend/Dockerfile exists"
  ((PASSED++))
else
  echo "❌ FAIL: frontend/Dockerfile not found"
  ((FAILED++))
fi

# Test 4: Check frontend .dockerignore exists
if [ -f "frontend/.dockerignore" ]; then
  echo "✅ PASS: frontend/.dockerignore exists"
  ((PASSED++))
else
  echo "❌ FAIL: frontend/.dockerignore not found"
  ((FAILED++))
fi

# Test 5: Check frontend nginx.conf exists
if [ -f "frontend/nginx.conf" ]; then
  echo "✅ PASS: frontend/nginx.conf exists"
  ((PASSED++))
else
  echo "❌ FAIL: frontend/nginx.conf not found"
  ((FAILED++))
fi

# Test 6: Check backend Dockerfile uses Node.js
if grep -q "FROM node:" backend/Dockerfile; then
  echo "✅ PASS: backend Dockerfile uses Node.js base image"
  ((PASSED++))
else
  echo "❌ FAIL: backend Dockerfile missing Node.js base image"
  ((FAILED++))
fi

# Test 7: Check backend Dockerfile has multi-stage build
if grep -q "AS builder" backend/Dockerfile; then
  echo "✅ PASS: backend Dockerfile uses multi-stage build"
  ((PASSED++))
else
  echo "❌ FAIL: backend Dockerfile missing multi-stage build"
  ((FAILED++))
fi

# Test 8: Check backend Dockerfile exposes port 3000
if grep -q "EXPOSE 3000" backend/Dockerfile; then
  echo "✅ PASS: backend Dockerfile exposes port 3000"
  ((PASSED++))
else
  echo "❌ FAIL: backend Dockerfile doesn't expose port 3000"
  ((FAILED++))
fi

# Test 9: Check backend Dockerfile has health check
if grep -q "HEALTHCHECK" backend/Dockerfile; then
  echo "✅ PASS: backend Dockerfile has health check"
  ((PASSED++))
else
  echo "❌ FAIL: backend Dockerfile missing health check"
  ((FAILED++))
fi

# Test 10: Check backend Dockerfile runs as non-root
if grep -q "USER nodejs" backend/Dockerfile; then
  echo "✅ PASS: backend Dockerfile runs as non-root user"
  ((PASSED++))
else
  echo "❌ FAIL: backend Dockerfile doesn't run as non-root user"
  ((FAILED++))
fi

# Test 11: Check frontend Dockerfile uses multi-stage build
if grep -q "AS builder" frontend/Dockerfile; then
  echo "✅ PASS: frontend Dockerfile uses multi-stage build"
  ((PASSED++))
else
  echo "❌ FAIL: frontend Dockerfile missing multi-stage build"
  ((FAILED++))
fi

# Test 12: Check frontend Dockerfile uses nginx
if grep -q "FROM nginx:" frontend/Dockerfile; then
  echo "✅ PASS: frontend Dockerfile uses nginx for serving"
  ((PASSED++))
else
  echo "❌ FAIL: frontend Dockerfile doesn't use nginx"
  ((FAILED++))
fi

# Test 13: Check frontend Dockerfile exposes port
if grep -q "EXPOSE" frontend/Dockerfile; then
  echo "✅ PASS: frontend Dockerfile exposes port"
  ((PASSED++))
else
  echo "❌ FAIL: frontend Dockerfile doesn't expose port"
  ((FAILED++))
fi

# Test 14: Check frontend Dockerfile has health check
if grep -q "HEALTHCHECK" frontend/Dockerfile; then
  echo "✅ PASS: frontend Dockerfile has health check"
  ((PASSED++))
else
  echo "❌ FAIL: frontend Dockerfile missing health check"
  ((FAILED++))
fi

# Test 15: Check frontend Dockerfile runs as non-root
if grep -q "USER nginx-app" frontend/Dockerfile; then
  echo "✅ PASS: frontend Dockerfile runs as non-root user"
  ((PASSED++))
else
  echo "❌ FAIL: frontend Dockerfile doesn't run as non-root user"
  ((FAILED++))
fi

# Test 16: Check backend .dockerignore excludes node_modules
if grep -q "node_modules" backend/.dockerignore; then
  echo "✅ PASS: backend .dockerignore excludes node_modules"
  ((PASSED++))
else
  echo "❌ FAIL: backend .dockerignore doesn't exclude node_modules"
  ((FAILED++))
fi

# Test 17: Check backend .dockerignore excludes .env files
if grep -q ".env" backend/.dockerignore; then
  echo "✅ PASS: backend .dockerignore excludes .env files"
  ((PASSED++))
else
  echo "❌ FAIL: backend .dockerignore doesn't exclude .env files"
  ((FAILED++))
fi

# Test 18: Check frontend .dockerignore excludes node_modules
if grep -q "node_modules" frontend/.dockerignore; then
  echo "✅ PASS: frontend .dockerignore excludes node_modules"
  ((PASSED++))
else
  echo "❌ FAIL: frontend .dockerignore doesn't exclude node_modules"
  ((FAILED++))
fi

# Test 19: Check nginx.conf has SPA fallback
if grep -q "try_files.*index.html" frontend/nginx.conf; then
  echo "✅ PASS: nginx.conf has SPA fallback configuration"
  ((PASSED++))
else
  echo "❌ FAIL: nginx.conf missing SPA fallback"
  ((FAILED++))
fi

# Test 20: Check nginx.conf has gzip compression
if grep -q "gzip on" frontend/nginx.conf; then
  echo "✅ PASS: nginx.conf has gzip compression"
  ((PASSED++))
else
  echo "❌ FAIL: nginx.conf missing gzip compression"
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
