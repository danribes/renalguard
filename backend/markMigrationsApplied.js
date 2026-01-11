#!/usr/bin/env node

/**
 * Mark all existing migrations as applied without running them
 * Use this to sync schema_migrations table with actual database state
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function markAllMigrationsApplied() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking migration status...\n');

    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Get all migration files
    const migrationsDir = path.join(__dirname, '..', 'infrastructure', 'postgres', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.error('❌ Migrations directory not found');
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.includes('README'))
      .sort();

    console.log(`📁 Found ${files.length} migration files\n`);

    // Get already recorded migrations
    const result = await client.query('SELECT migration_name FROM schema_migrations ORDER BY migration_name');
    const recorded = new Set(result.rows.map(row => row.migration_name));

    console.log(`✓ ${recorded.size} migrations already recorded\n`);

    // Mark all migrations as applied
    let newCount = 0;
    for (const file of files) {
      const migrationName = file.replace('.sql', '');

      if (!recorded.has(migrationName)) {
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
          [migrationName]
        );
        console.log(`  ✓ Marked as applied: ${migrationName}`);
        newCount++;
      } else {
        console.log(`  ⏭  Already recorded: ${migrationName}`);
      }
    }

    console.log(`\n✅ Done! Marked ${newCount} new migrations as applied`);
    console.log(`📊 Total migrations recorded: ${recorded.size + newCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

markAllMigrationsApplied();
