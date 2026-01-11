#!/usr/bin/env node

/**
 * Simple migration runner for PostgreSQL migrations
 * Usage: node runMigration.js <migration-number>
 * Example: node runMigration.js 023
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get migration number from command line
const migrationNumber = process.argv[2];

if (!migrationNumber) {
  console.error('❌ Please provide a migration number');
  console.log('Usage: node runMigration.js <migration-number>');
  console.log('Example: node runMigration.js 023');
  process.exit(1);
}

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('🔍 Looking for migration files...');

    // Find migration file
    const migrationsDir = path.join(__dirname, '..', 'infrastructure', 'postgres', 'migrations');
    const files = fs.readdirSync(migrationsDir);

    const migrationFile = files.find(file =>
      file.startsWith(migrationNumber) && file.endsWith('.sql')
    );

    if (!migrationFile) {
      console.error(`❌ Migration file starting with ${migrationNumber} not found in ${migrationsDir}`);
      console.log('\nAvailable migrations:');
      files.filter(f => f.endsWith('.sql')).forEach(f => console.log(`  - ${f}`));
      process.exit(1);
    }

    const migrationPath = path.join(migrationsDir, migrationFile);
    console.log(`📄 Found migration: ${migrationFile}`);

    // Read migration SQL
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`📖 Read ${sql.length} characters from migration file`);

    // Connect to database
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✓ Connected to database');

    try {
      // Execute migration
      console.log('🚀 Executing migration...');
      await client.query('BEGIN');

      await client.query(sql);

      // Record migration
      const migrationName = migrationFile.replace('.sql', '');
      await client.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
        [migrationName]
      );

      await client.query('COMMIT');
      console.log('✅ Migration completed successfully!');

      // Verify what was created
      console.log('\n📊 Verifying migration results...');

      // Check if email_templates table was created
      if (migrationNumber === '023') {
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'email_templates'
          );
        `);

        if (tableCheck.rows[0].exists) {
          console.log('✓ email_templates table created');

          // Count default templates
          const countResult = await client.query(
            `SELECT COUNT(*) as count FROM email_templates WHERE doctor_email = 'doctor@example.com'`
          );
          console.log(`✓ ${countResult.rows[0].count} default templates inserted`);

          // Check template_variables_reference view
          const viewCheck = await client.query(`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.views
              WHERE table_name = 'template_variables_reference'
            );
          `);

          if (viewCheck.rows[0].exists) {
            console.log('✓ template_variables_reference view created');

            const varsCount = await client.query(
              `SELECT COUNT(*) as count FROM template_variables_reference`
            );
            console.log(`✓ ${varsCount.rows[0].count} template variables available`);
          }
        } else {
          console.log('⚠️  email_templates table not found - migration may have failed');
        }
      }

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();
