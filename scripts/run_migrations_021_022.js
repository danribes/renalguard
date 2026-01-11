#!/usr/bin/env node
/**
 * Run Migrations 021-022: Doctor-Patient Assignment System
 * Node.js runner for environments without psql
 *
 * Usage: node scripts/run_migrations_021_022.js <DATABASE_URL>
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
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  // Get DATABASE_URL from command line or environment
  const databaseUrl = process.argv[2] || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Usage: node scripts/run_migrations_021_022.js <DATABASE_URL>');
    console.error('');
    console.error('Set DATABASE_URL environment variable or pass as argument:');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/run_migrations_021_022.js "postgresql://user:pass@host/db"');
    console.error('  DATABASE_URL="postgresql://user:pass@host/db" node scripts/run_migrations_021_022.js');
    process.exit(1);
  }

  logSection('Migrations 021-022: Doctor-Patient Assignment System');

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

    const patientsResult = await pool.query('SELECT COUNT(*) FROM patients');
    const totalPatients = parseInt(patientsResult.rows[0].count);

    // Check if tables already exist
    const tablesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'doctor_patient_assignments'
      ) as assignments_exists,
      EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'doctors'
      ) as doctors_exists
    `);

    const { assignments_exists, doctors_exists } = tablesCheck.rows[0];

    console.log(`   Total patients: ${totalPatients}`);
    console.log(`   doctor_patient_assignments table exists: ${assignments_exists ? 'Yes' : 'No'}`);
    console.log(`   doctors table exists: ${doctors_exists ? 'Yes' : 'No'}`);

    if (assignments_exists && doctors_exists) {
      log('\n⚠️  Tables already exist!', 'yellow');
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question('Do you want to re-run the migrations anyway? This is safe but may reset some data. (yes/no): ', (ans) => {
          rl.close();
          resolve(ans.toLowerCase().trim());
        });
      });

      if (answer !== 'yes') {
        log('\n❌ Migration cancelled.', 'red');
        await pool.end();
        process.exit(0);
      }
    }

    log('\n🚀 Running migrations...\n', 'blue');

    // Migration 021: Doctor-Patient Assignments
    logSection('Migration 021: Doctor-Patient Assignments');

    const migration021Path = path.join(
      path.dirname(__dirname),
      'infrastructure',
      'postgres',
      'migrations',
      '021_add_doctor_patient_assignments.sql'
    );

    if (!fs.existsSync(migration021Path)) {
      throw new Error(`Migration file not found: ${migration021Path}`);
    }

    const migration021SQL = fs.readFileSync(migration021Path, 'utf8');

    log('Running migration 021...', 'blue');
    await pool.query(migration021SQL);
    log('✅ Migration 021 completed successfully!\n', 'green');

    // Migration 022: Doctors Table
    logSection('Migration 022: Doctors Table');

    const migration022Path = path.join(
      path.dirname(__dirname),
      'infrastructure',
      'postgres',
      'migrations',
      '022_add_doctors_table.sql'
    );

    if (!fs.existsSync(migration022Path)) {
      throw new Error(`Migration file not found: ${migration022Path}`);
    }

    const migration022SQL = fs.readFileSync(migration022Path, 'utf8');

    log('Running migration 022...', 'blue');
    await pool.query(migration022SQL);
    log('✅ Migration 022 completed successfully!\n', 'green');

    // Verify final state
    logSection('📊 Final Database State');

    const assignmentsCount = await pool.query('SELECT COUNT(*) FROM doctor_patient_assignments');
    const doctorsCount = await pool.query('SELECT COUNT(*) FROM doctors');

    console.log(`   Total patients: ${totalPatients}`);
    console.log(`   Doctor-patient assignments: ${assignmentsCount.rows[0].count}`);
    console.log(`   Doctors in system: ${doctorsCount.rows[0].count}`);

    // Show default assignments
    const defaultAssignments = await pool.query(`
      SELECT doctor_email, COUNT(*) as patient_count
      FROM doctor_patient_assignments
      GROUP BY doctor_email
    `);

    console.log('\n   Assignment Summary:');
    defaultAssignments.rows.forEach(row => {
      console.log(`   - ${row.doctor_email}: ${row.patient_count} patients`);
    });

    log('\n✅ All migrations completed successfully!', 'green');

    logSection('📋 Next Steps');

    console.log('1. Update doctor assignments for your patients:');
    console.log('   POST /api/patients/:id/assign-doctor');
    console.log('   {');
    console.log('     "doctor_email": "dr.smith@hospital.com",');
    console.log('     "doctor_name": "Dr. Sarah Smith",');
    console.log('     "is_primary": true');
    console.log('   }');
    console.log('');
    console.log('2. Create doctor profiles:');
    console.log('   POST /api/doctors');
    console.log('   {');
    console.log('     "email": "dr.smith@hospital.com",');
    console.log('     "name": "Dr. Sarah Smith",');
    console.log('     "specialty": "Nephrology"');
    console.log('   }');
    console.log('');
    console.log('3. Configure email notifications:');
    console.log('   POST /api/settings/email');
    console.log('');
    console.log('4. Restart your backend service to activate:');
    console.log('   - Alert reminder service (runs every 30 minutes)');
    console.log('   - Doctor lookup for all notifications');
    console.log('');
    log('🎉 Doctor-patient assignment system is now ready!', 'green');

  } catch (error) {
    log('\n❌ Error running migrations:', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
