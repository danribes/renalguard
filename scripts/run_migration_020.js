#!/usr/bin/env node
/**
 * Migration 020: Remove Unclassified Patients
 * Node.js runner for environments without psql
 *
 * Usage: node scripts/run_migration_020.js <DATABASE_URL>
 */

import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  log(title, 'cyan');
  console.log('='.repeat(50) + '\n');
}

async function main() {
  // Get DATABASE_URL from command line or environment
  const databaseUrl = process.argv[2] || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Usage: node scripts/run_migration_020.js <DATABASE_URL>');
    console.error('');
    console.error('Set DATABASE_URL environment variable or pass as argument:');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/run_migration_020.js "postgresql://user:pass@host/db"');
    console.error('  DATABASE_URL="postgresql://user:pass@host/db" node scripts/run_migration_020.js');
    process.exit(1);
  }

  logSection('Migration 020: Remove Unclassified Patients');

  // Create database connection pool
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false // Required for cloud PostgreSQL providers
    }
  });

  try {
    // Test connection
    log('🔍 Testing database connection...', 'blue');
    await pool.query('SELECT version()');
    log('✅ Connection successful!\n', 'green');

    // Check current state
    logSection('📊 Current Database State');

    const totalResult = await pool.query('SELECT COUNT(*) FROM patients');
    const total = parseInt(totalResult.rows[0].count);

    const ckdResult = await pool.query('SELECT COUNT(*) FROM ckd_patient_data');
    const ckd = parseInt(ckdResult.rows[0].count);

    const nonCkdResult = await pool.query('SELECT COUNT(*) FROM non_ckd_patient_data');
    const nonCkd = parseInt(nonCkdResult.rows[0].count);

    const unclassifiedResult = await pool.query(`
      SELECT COUNT(*) FROM patients p
      LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
      LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
      WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL
    `);
    const unclassified = parseInt(unclassifiedResult.rows[0].count);

    console.log(`   Total patients:        ${total}`);
    console.log(`   CKD patients:          ${ckd}`);
    console.log(`   Non-CKD patients:      ${nonCkd}`);
    console.log(`   Unclassified patients: ${unclassified}`);

    if (unclassified === 0) {
      log('\n✅ No unclassified patients found. Migration not needed!', 'green');
      log('   All patients are properly classified.', 'green');
      await pool.end();
      process.exit(0);
    }

    // Confirm before proceeding
    log(`\n⚠️  WARNING: This will permanently delete ${unclassified} unclassified patients!`, 'yellow');
    log('   This action cannot be undone.\n', 'yellow');

    // Read user input
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question('Do you want to proceed? (yes/no): ', (ans) => {
        rl.close();
        resolve(ans.toLowerCase().trim());
      });
    });

    if (answer !== 'yes') {
      log('\n❌ Migration cancelled by user.', 'red');
      await pool.end();
      process.exit(0);
    }

    // Run the migration
    log('\n🚀 Running migration...\n', 'blue');

    // Read migration SQL file
    const migrationPath = path.join(
      path.dirname(__dirname),
      'infrastructure',
      'postgres',
      'migrations',
      '020_remove_unclassified_patients.sql'
    );

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

    log('✅ Migration executed successfully!\n', 'green');

    // Verify final state
    logSection('📊 Final Database State');

    const totalAfterResult = await pool.query('SELECT COUNT(*) FROM patients');
    const totalAfter = parseInt(totalAfterResult.rows[0].count);

    const ckdAfterResult = await pool.query('SELECT COUNT(*) FROM ckd_patient_data');
    const ckdAfter = parseInt(ckdAfterResult.rows[0].count);

    const nonCkdAfterResult = await pool.query('SELECT COUNT(*) FROM non_ckd_patient_data');
    const nonCkdAfter = parseInt(nonCkdAfterResult.rows[0].count);

    const unclassifiedAfterResult = await pool.query(`
      SELECT COUNT(*) FROM patients p
      LEFT JOIN ckd_patient_data cpd ON p.id = cpd.patient_id
      LEFT JOIN non_ckd_patient_data npd ON p.id = npd.patient_id
      WHERE cpd.patient_id IS NULL AND npd.patient_id IS NULL
    `);
    const unclassifiedAfter = parseInt(unclassifiedAfterResult.rows[0].count);

    console.log(`   Total patients:        ${totalAfter} (was ${total})`);
    console.log(`   CKD patients:          ${ckdAfter}`);
    console.log(`   Non-CKD patients:      ${nonCkdAfter}`);
    console.log(`   Unclassified patients: ${unclassifiedAfter} (was ${unclassified})`);
    console.log(`   Sum (CKD + Non-CKD):   ${ckdAfter + nonCkdAfter}`);

    // Verify success
    if (unclassifiedAfter === 0 && totalAfter === (ckdAfter + nonCkdAfter)) {
      log('\n✅ Migration completed successfully!', 'green');
      log('   All patients are now properly classified.', 'green');
      log('   Total count matches CKD + Non-CKD breakdown.', 'green');
    } else {
      log('\n⚠️  Migration completed but verification failed.', 'yellow');
      log('   Please check the database state manually.', 'yellow');
    }

    log('\n🎉 Done! Your database is now consistent.\n', 'green');

  } catch (error) {
    log('\n❌ Error running migration:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
