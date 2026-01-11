#!/usr/bin/env node

/**
 * Auto-run pending migrations on startup
 * This script is called by the backend on startup to ensure all migrations are applied
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log('⚠️  DATABASE_URL not set, skipping migrations');
  process.exit(0);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function getAppliedMigrations(client) {
  // Create migrations tracking table if it doesn't exist (matching existing structure)
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const result = await client.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(result.rows.map(row => row.version));
}

async function runPendingMigrations() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking for pending migrations...');

    // Get already applied migrations
    const appliedMigrations = await getAppliedMigrations(client);
    console.log(`✓ Found ${appliedMigrations.size} applied migrations`);

    // Read all migration files
    const migrationsDir = path.join(__dirname, '..', 'infrastructure', 'postgres', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  Migrations directory not found, skipping');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('README'))
      .sort();

    console.log(`📁 Found ${files.length} migration files total`);

    let pendingCount = 0;

    for (const file of files) {
      // Check both with and without .sql extension (for backwards compatibility)
      const migrationNameNoExt = file.replace('.sql', '');

      if (appliedMigrations.has(file) || appliedMigrations.has(migrationNameNoExt)) {
        continue; // Skip already applied
      }

      pendingCount++;
      console.log(`\n🚀 Running migration: ${file}`);

      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]  // Use full filename with .sql extension
        );
        await client.query('COMMIT');
        console.log(`✅ Migration ${file} completed successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${file} failed:`, error.message);
        throw error;
      }
    }

    if (pendingCount === 0) {
      console.log('\n✓ All migrations are up to date');
    } else {
      console.log(`\n✅ Successfully applied ${pendingCount} pending migration(s)`);
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runPendingMigrations();
