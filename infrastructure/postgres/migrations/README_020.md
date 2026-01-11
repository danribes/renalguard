# Migration 020: Remove Unclassified Patients

## Overview
This migration removes patients from the database who lack proper classification (neither CKD nor non-CKD data).

## Problem
The database contained **1200 total patients**, but only:
- **587 CKD patients** (with records in `ckd_patient_data`)
- **413 non-CKD patients** (with records in `non_ckd_patient_data`)
- **Total classified: 1000 patients**

This left **200 unclassified patients** who had no classification data, causing a discrepancy in the patient count display.

## Solution
This migration:
1. Identifies patients without classification data (no entry in either `ckd_patient_data` or `non_ckd_patient_data`)
2. Deletes these unclassified patients from the `patients` table
3. All related records are automatically deleted via CASCADE constraints
4. Verifies that after deletion, the total patient count equals CKD + non-CKD counts

## Impact
- **Deletes:** ~200 unclassified patients and all their related records
- **Result:** Total patient count will be 1000 (587 CKD + 413 non-CKD)
- **Safety:** All CASCADE constraints ensure related data is cleaned up properly

## How to Run

### For Render Deployment (Recommended)

**Step 1:** Get your DATABASE_URL from Render
1. Go to https://dashboard.render.com
2. Click on your database (e.g., `ckd-analyzer-db`)
3. Copy the **External Database URL** (starts with `postgresql://`)

**Step 2:** Run the migration script
```bash
cd /home/user/hack_BI
./scripts/run_migration_020_render.sh 'postgresql://your-database-url'
```

The script will:
- Test your connection
- Show current database state
- Ask for confirmation before deleting
- Run the migration
- Verify the result

### For Local Docker Development

```bash
cd /home/user/hack_BI
./scripts/run_migration_020.sh
```

Or manually:
```bash
docker exec -i healthcare-postgres psql \
  -U healthcare_user \
  -d healthcare_ai_db \
  < infrastructure/postgres/migrations/020_remove_unclassified_patients.sql
```

### For Local psql Connection

```bash
psql -h localhost -p 5433 \
  -U healthcare_user \
  -d healthcare_ai_db \
  < infrastructure/postgres/migrations/020_remove_unclassified_patients.sql
```
(Password: `healthcare_pass` as per docker-compose.yml)

## Verification
The migration includes built-in verification that will:
- Display the number of unclassified patients found
- Show counts before and after deletion
- Raise an error if the final state is incorrect
- Confirm that all patients are properly classified

## Rollback
This migration is **irreversible** as it permanently deletes patient data. If you need to restore data:
1. Restore from a database backup taken before running this migration
2. OR re-run your initial database seeding/population scripts

## Related Files
- Migration script: `infrastructure/postgres/migrations/020_remove_unclassified_patients.sql`
- Helper script: `scripts/run_migration_020.sh`
- Backend fix: `backend/src/api/routes/patients.ts` (lines 838-840) - updated to calculate total as sum of classified patients
