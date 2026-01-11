#!/usr/bin/env node

/**
 * Comprehensive migration runner for RENALGUARD
 * Runs all migrations in order, tracking which have been applied
 *
 * Usage: node scripts/run_all_migrations.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.log('Please set DATABASE_URL or source your .dev.vars file:');
  console.log('  source backend/.dev.vars && node scripts/run_all_migrations.js');
  process.exit(1);
}

console.log('🔌 Connecting to database...');
console.log(`   Host: ${DATABASE_URL.match(/@([^/]+)/)?.[1] || 'unknown'}`);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    'SELECT migration_name FROM schema_migrations ORDER BY migration_name'
  );
  return new Set(result.rows.map(row => row.migration_name));
}

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('✓ Connected to database\n');

    // Ensure migration tracking table exists
    await ensureMigrationTable(client);

    // Get already applied migrations
    const appliedMigrations = await getAppliedMigrations(client);
    console.log(`📋 Found ${appliedMigrations.size} previously applied migrations\n`);

    // Get all migration files
    const migrationsDir = path.join(__dirname, '..', 'infrastructure', 'postgres', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => {
        // Extract numeric prefix for proper ordering
        const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0');
        return numA - numB;
      });

    console.log(`📁 Found ${files.length} migration files\n`);

    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
      const migrationName = file.replace('.sql', '');

      // Skip if already applied
      if (appliedMigrations.has(migrationName)) {
        console.log(`⏭️  Skipping: ${file} (already applied)`);
        skipped++;
        continue;
      }

      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      console.log(`\n🚀 Running: ${file}`);

      try {
        await client.query('BEGIN');

        // Execute migration
        await client.query(sql);

        // Record migration
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
          [migrationName]
        );

        await client.query('COMMIT');
        console.log(`   ✅ Success`);
        applied++;

      } catch (error) {
        await client.query('ROLLBACK');
        console.log(`   ❌ Failed: ${error.message}`);

        // For non-critical errors like "already exists", continue
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate key')) {
          console.log(`   ⚠️  Object already exists, marking as applied`);
          await client.query(
            'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
            [migrationName]
          );
          applied++;
        } else {
          failed++;
          // Continue with other migrations instead of stopping
          console.log(`   ⚠️  Continuing with remaining migrations...`);
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Applied:  ${applied}`);
    console.log(`   ⏭️  Skipped:  ${skipped}`);
    console.log(`   ❌ Failed:   ${failed}`);
    console.log('='.repeat(50) + '\n');

    // Verify tables
    console.log('📋 Verifying key tables...\n');

    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('Tables created:');
    tableCheck.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    console.log('\n✅ Migration process complete!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
runMigrations();
