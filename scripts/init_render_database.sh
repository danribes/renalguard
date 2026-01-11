#!/bin/bash
# ============================================
# Render Database Initialization Script
# ============================================
# This script initializes the database using the backend's connection
# Run this from the Render backend Shell instead of database Shell
#
# Usage: In Render backend service → Shell tab → bash scripts/init_render_database.sh

echo "=========================================="
echo "Initializing CKD Database via Backend"
echo "=========================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set"
    exit 1
fi

echo "✓ DATABASE_URL found"
echo "✓ Connecting to database..."

# Run the initialization SQL using psql
psql "$DATABASE_URL" < infrastructure/postgres/init.sql

echo ""
echo "✓ Base schema loaded"
echo "✓ Running migrations..."

# Run migrations
psql "$DATABASE_URL" < infrastructure/postgres/migrations/001_add_enhanced_patient_fields.sql
psql "$DATABASE_URL" < infrastructure/postgres/migrations/002_add_200_mock_patients.sql
psql "$DATABASE_URL" < infrastructure/postgres/migrations/003_add_monitoring_triggers.sql
psql "$DATABASE_URL" < infrastructure/postgres/migrations/004_add_ckd_diagnosis_detection.sql

echo ""
echo "=========================================="
echo "DATABASE INITIALIZATION COMPLETE!"
echo "=========================================="
echo ""
echo "Verifying data..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_patients FROM patients;"

echo ""
echo "✅ Initialization successful!"
echo ""
