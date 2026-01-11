#!/bin/bash
# Run Migration 020: Remove Unclassified Patients
# For Render PostgreSQL Database
#
# This migration removes ~200 patients who lack classification data
# (neither CKD nor non-CKD), ensuring total count matches CKD + non-CKD breakdown.

set -e

echo "=================================================="
echo "Migration 020: Remove Unclassified Patients"
echo "=================================================="
echo ""

# Check if DATABASE_URL is provided
if [ -z "$1" ]; then
  echo "Usage: ./scripts/run_migration_020_render.sh <DATABASE_URL>"
  echo ""
  echo "Get your DATABASE_URL from Render:"
  echo "1. Go to https://dashboard.render.com"
  echo "2. Click on your database (e.g., 'ckd-analyzer-db')"
  echo "3. Copy the 'External Database URL'"
  echo "   (starts with postgresql://)"
  echo ""
  echo "Example:"
  echo "  ./scripts/run_migration_020_render.sh 'postgresql://user:pass@host/db'"
  echo ""
  echo "Or set it as an environment variable:"
  echo "  export DATABASE_URL='postgresql://...'"
  echo "  ./scripts/run_migration_020_render.sh \$DATABASE_URL"
  exit 1
fi

DATABASE_URL="$1"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo "❌ Error: psql is not installed"
  echo ""
  echo "Install PostgreSQL client:"
  echo "  - macOS:          brew install postgresql"
  echo "  - Ubuntu/Debian:  sudo apt-get install postgresql-client"
  echo "  - Windows:        Download from https://www.postgresql.org/download/"
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

# Check current state before migration
echo "📊 Current Database State:"
TOTAL=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM patients;" | xargs)
CKD=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ckd_patient_data;" | xargs)
NON_CKD=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM non_ckd_patient_data;" | xargs)
UNCLASSIFIED=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM patients p
  LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
  LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
  WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL;
" | xargs)

echo "   Total patients:        $TOTAL"
echo "   CKD patients:          $CKD"
echo "   Non-CKD patients:      $NON_CKD"
echo "   Unclassified patients: $UNCLASSIFIED"
echo ""

if [ "$UNCLASSIFIED" -eq "0" ]; then
  echo "✅ No unclassified patients found. Migration not needed!"
  echo "   All patients are properly classified."
  exit 0
fi

# Confirm before proceeding
echo "⚠️  WARNING: This will permanently delete $UNCLASSIFIED unclassified patients!"
echo "   This action cannot be undone."
echo ""
read -p "Do you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo ""
  echo "❌ Migration cancelled by user."
  exit 0
fi

echo ""
echo "🚀 Running migration..."
echo ""

# Run the migration
psql "$DATABASE_URL" -f infrastructure/postgres/migrations/020_remove_unclassified_patients.sql

# Verify final state
echo ""
echo "📊 Final Database State:"
TOTAL_AFTER=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM patients;" | xargs)
CKD_AFTER=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ckd_patient_data;" | xargs)
NON_CKD_AFTER=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM non_ckd_patient_data;" | xargs)
UNCLASSIFIED_AFTER=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) FROM patients p
  LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
  LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
  WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL;
" | xargs)

echo "   Total patients:        $TOTAL_AFTER (was $TOTAL)"
echo "   CKD patients:          $CKD_AFTER"
echo "   Non-CKD patients:      $NON_CKD_AFTER"
echo "   Unclassified patients: $UNCLASSIFIED_AFTER (was $UNCLASSIFIED)"
echo "   Sum (CKD + Non-CKD):   $((CKD_AFTER + NON_CKD_AFTER))"
echo ""

if [ "$UNCLASSIFIED_AFTER" -eq "0" ] && [ "$TOTAL_AFTER" -eq "$((CKD_AFTER + NON_CKD_AFTER))" ]; then
  echo "✅ Migration completed successfully!"
  echo "   All patients are now properly classified."
  echo "   Total count matches CKD + Non-CKD breakdown."
else
  echo "⚠️  Migration completed but verification failed."
  echo "   Please check the database state manually."
  exit 1
fi

echo ""
echo "🎉 Done! Your Render database is now consistent."
