#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://healthcare_user:2IDoqcoj1ERr9SAJgfEk6GQyDBUXhCpJ@dpg-d4c4tuadbo4c73d1s0p0-a.oregon-postgres.render.com:5432/healthcare_ai_db_fo2v';

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
