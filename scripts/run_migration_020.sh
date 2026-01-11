#!/bin/bash
# Script to run migration 020: Remove unclassified patients
# This script can be run in multiple ways depending on your environment

set -e

MIGRATION_FILE="infrastructure/postgres/migrations/020_remove_unclassified_patients.sql"

echo "=================================================="
echo "Migration 020: Remove Unclassified Patients"
echo "=================================================="
echo ""

# Check if we're in the project root
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "ERROR: Migration file not found at $MIGRATION_FILE"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "Migration file found: $MIGRATION_FILE"
echo ""

# Method 1: Try Docker (if available)
if command -v docker &> /dev/null; then
    echo "Attempting to run migration using Docker..."
    if docker ps --filter "name=healthcare-postgres" --format "{{.Names}}" | grep -q "healthcare-postgres"; then
        echo "Running migration in Docker container..."
        docker exec -i healthcare-postgres psql \
            -U healthcare_user \
            -d healthcare_ai_db \
            < "$MIGRATION_FILE"
        echo ""
        echo "✓ Migration completed successfully via Docker!"
        exit 0
    else
        echo "Docker is available but postgres container is not running."
        echo "Start it with: docker-compose up -d postgres"
        echo ""
    fi
fi

# Method 2: Try local psql (if DATABASE_URL is set)
if [ -n "$DATABASE_URL" ]; then
    echo "Attempting to run migration using DATABASE_URL..."
    psql "$DATABASE_URL" < "$MIGRATION_FILE"
    echo ""
    echo "✓ Migration completed successfully via DATABASE_URL!"
    exit 0
fi

# Method 3: Try local psql with individual variables
if [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] && [ -n "$DB_USER" ]; then
    echo "Attempting to run migration using DB_* environment variables..."
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "${DB_PORT:-5432}" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        < "$MIGRATION_FILE"
    echo ""
    echo "✓ Migration completed successfully via DB_* variables!"
    exit 0
fi

# Method 4: Manual instructions
echo "=================================================="
echo "Database connection not available automatically."
echo "=================================================="
echo ""
echo "Please run this migration manually using one of these methods:"
echo ""
echo "1. Using Docker:"
echo "   docker exec -i healthcare-postgres psql -U healthcare_user -d healthcare_ai_db < $MIGRATION_FILE"
echo ""
echo "2. Using psql directly (update with your credentials):"
echo "   psql -h localhost -p 5433 -U healthcare_user -d healthcare_ai_db < $MIGRATION_FILE"
echo ""
echo "3. Using DATABASE_URL:"
echo "   psql \$DATABASE_URL < $MIGRATION_FILE"
echo ""
echo "Default credentials from docker-compose.yml:"
echo "   Host: localhost"
echo "   Port: 5433"
echo "   Database: healthcare_ai_db"
echo "   User: healthcare_user"
echo "   Password: healthcare_pass"
echo ""
