#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Requires DATABASE_URL environment variable
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Example: DATABASE_URL=postgresql://user:pass@host:5432/dbname node run-init.js');
  process.exit(1);
}

async function initializeDatabase() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('📄 Reading init.sql file...');
    const initSQL = fs.readFileSync(
      path.join(__dirname, '../infrastructure/postgres/init.sql'),
      'utf8'
    );

    console.log('🚀 Executing init.sql (this may take 2-5 minutes)...');
    console.log('   Creating tables and generating 1000 patients...');

    await client.query(initSQL);

    console.log('✅ Database initialized successfully!');

    // Verify
    console.log('\n📊 Verifying data...');
    const patientCount = await client.query('SELECT COUNT(*) FROM patients');
    const ckdCount = await client.query('SELECT COUNT(*) FROM ckd_patient_data');
    const nonCkdCount = await client.query('SELECT COUNT(*) FROM non_ckd_patient_data');

    console.log(`   Total patients: ${patientCount.rows[0].count}`);
    console.log(`   CKD patients: ${ckdCount.rows[0].count}`);
    console.log(`   Non-CKD patients: ${nonCkdCount.rows[0].count}`);

    console.log('\n🎉 Database ready!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

initializeDatabase();
