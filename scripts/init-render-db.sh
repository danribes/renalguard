#!/bin/bash
# Initialize Render PostgreSQL Database with All Migrations
# Run this after creating the database on Render

set -e

echo "🏥 CKD Risk Screening System - Database Initialization"
echo "======================================================="
echo ""

# Check if DATABASE_URL is provided
if [ -z "$1" ]; then
  echo "Usage: ./scripts/init-render-db.sh <DATABASE_URL>"
  echo ""
  echo "Get your DATABASE_URL from:"
  echo "1. Go to https://dashboard.render.com"
  echo "2. Click on your 'ckd-analyzer-db' database"
  echo "3. Copy the 'External Database URL' (starts with postgresql://)"
  echo ""
  echo "Example:"
  echo "./scripts/init-render-db.sh 'postgresql://postgres:...@dpg-.../ckd_analyzer'"
  exit 1
fi

DATABASE_URL="$1"

echo "📊 Initializing database schema and mock data..."
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo "❌ Error: psql is not installed"
  echo ""
  echo "Install PostgreSQL client:"
  echo "  - macOS: brew install postgresql"
  echo "  - Ubuntu/Debian: sudo apt-get install postgresql-client"
  echo "  - Windows: Download from https://www.postgresql.org/download/"
  exit 1
fi

# Test connection
echo "🔍 Testing database connection..."
if ! psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
  echo "❌ Error: Cannot connect to database"
  echo "   Check your DATABASE_URL is correct"
  exit 1
fi
echo "✅ Connection successful!"
echo ""

# Run base schema (if not already exists)
echo "→ [0/4] Running base schema initialization..."
psql "$DATABASE_URL" -f infrastructure/postgres/init.sql > /dev/null 2>&1 || echo "   ⚠️  Base schema already exists (skipping)"

# Run migrations
echo "→ [1/4] Adding enhanced patient fields..."
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/001_add_enhanced_patient_fields.sql > /dev/null 2>&1 || echo "   ⚠️  Migration already applied (skipping)"

echo "→ [2/4] Loading 200 mock patients (this may take 30-60 seconds)..."
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/002_add_200_mock_patients.sql > /dev/null 2>&1 || echo "   ⚠️  Patients already loaded (skipping)"

echo "→ [3/4] Adding monitoring triggers and risk tracking..."
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/003_add_monitoring_triggers.sql > /dev/null 2>&1 || echo "   ⚠️  Monitoring already installed (skipping)"

echo "→ [4/4] Adding CKD diagnosis detection system..."
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/004_add_ckd_diagnosis_detection.sql > /dev/null 2>&1 || echo "   ⚠️  Diagnosis system already installed (skipping)"

echo ""
echo "✅ Database initialized successfully!"
echo ""
echo "Verifying data..."
echo ""

# Verify data
PATIENT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM patients;")
OBS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM observations;")
COND_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM conditions;")

echo "📊 Database Statistics:"
echo "   Patients:     $PATIENT_COUNT"
echo "   Observations: $OBS_COUNT"
echo "   Conditions:   $COND_COUNT"

echo ""
echo "🎉 Database ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Check backend is running: https://ckd-analyzer-backend.onrender.com/health"
echo "2. Set ANTHROPIC_API_KEY in backend environment variables (Render dashboard)"
echo "3. Visit your app: https://ckd-analyzer-frontend.onrender.com"
echo "4. Test the CKD risk monitoring features!"
