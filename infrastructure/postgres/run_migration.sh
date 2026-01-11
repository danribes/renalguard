#!/bin/bash

# Script to run database migrations
# Usage: ./run_migration.sh <migration_number>
# Example: ./run_migration.sh 013

set -e

MIGRATION_NUM=${1:-013}
MIGRATION_FILE="migrations/${MIGRATION_NUM}_*.sql"

echo "======================================"
echo "Running Migration: ${MIGRATION_FILE}"
echo "======================================"

# Check if running in Docker environment
if command -v docker-compose &> /dev/null; then
    echo "Running migration via Docker Compose..."
    docker-compose exec -T postgres psql -U healthcare_user -d healthcare_ai_db < "${MIGRATION_FILE}"
else
    echo "Docker Compose not found. Please run migration manually:"
    echo ""
    echo "Option 1: Using Docker Compose"
    echo "  docker-compose exec postgres psql -U healthcare_user -d healthcare_ai_db < ${MIGRATION_FILE}"
    echo ""
    echo "Option 2: Direct PostgreSQL connection"
    echo "  psql -h localhost -p 5433 -U healthcare_user -d healthcare_ai_db < ${MIGRATION_FILE}"
    echo ""
    echo "Option 3: Copy SQL file to container and execute"
    echo "  docker cp ${MIGRATION_FILE} healthcare-postgres:/tmp/migration.sql"
    echo "  docker exec healthcare-postgres psql -U healthcare_user -d healthcare_ai_db -f /tmp/migration.sql"
    exit 1
fi

echo "======================================"
echo "Migration completed successfully!"
echo "======================================"
