# Patient Generation Scripts

## Overview

This directory contains scripts to populate the CKD database with realistic patient data.

## Available Scripts

### 1. `populate_500_patients_fixed.sql`
**Purpose**: Quick population for testing and development
- Generates 500 patients with comprehensive CKD data
- Ensures unique name combinations
- Gender-appropriate name assignment
- Basic verification at the end

**Use when**: You need a smaller dataset for testing or development

**Runtime**: 5-10 minutes

### 2. `populate_1001_patients_verified.sql` ⭐ **RECOMMENDED**
**Purpose**: Production-ready population with comprehensive verification
- Generates 1001 patients with comprehensive CKD data
- Expanded name arrays (75 male names, 75 female names, 50 last names)
- Ensures unique name combinations with retry logic
- Automatic gender-appropriate name assignment
- **POST-GENERATION VERIFICATION**:
  - ✅ Duplicate name detection with detailed reporting
  - ✅ Gender-name concordance check
  - ✅ Detailed mismatch reporting if issues found

**Use when**: You need production-quality data with guaranteed integrity

**Runtime**: 10-15 minutes

## What Gets Generated

Both scripts create:

### Patient Demographics
- Unique medical record numbers (MRN000001 - MRN001001)
- Gender-appropriate first names
- Realistic ages (40-85)
- Contact information
- Vital signs (BP, heart rate, O2 saturation, BMI)

### Clinical Data
- **Lab Results** (4 measurements over 12 months):
  - eGFR (with realistic decline over time)
  - uACR (albumin-to-creatinine ratio)
  - Creatinine, Potassium
  - HbA1c (for diabetic patients)
  - Lipid panel (Total Cholesterol, LDL, HDL, Triglycerides)
  - Additional labs (Hemoglobin, Albumin, Calcium, Phosphorus, Uric Acid)

- **Comorbidities**:
  - Diabetes (45% prevalence)
  - Hypertension (60% prevalence)
  - Heart failure (10-15%)
  - Obesity (correlated with BMI)
  - Metabolic syndrome
  - CAD, AKI history

- **Conditions** (ICD-10 coded):
  - Type 2 Diabetes Mellitus with Diabetic CKD
  - Hypertensive Chronic Kidney Disease
  - Heart Failure
  - CKD Stage 2-5 (based on eGFR)

### Medications & Adherence
- **Prescriptions**:
  - RAS inhibitors (Lisinopril, Losartan, Valsartan) - for hypertension
  - SGLT2i (Jardiance) - for diabetic CKD patients
  - Statins (Atorvastatin) - for CKD patients >50
  - Diuretics (Furosemide, HCTZ) - for heart failure/severe HTN
  - Metformin - for diabetic patients with eGFR >30

- **Refill History** (12 months):
  - ~90% adherence for RAS inhibitors
  - ~85% adherence for SGLT2i (realistic suboptimal)
  - ~90% adherence for statins
  - Realistic gaps to simulate real-world adherence

## Verification Checks

### `populate_1001_patients_verified.sql` includes:

#### 1. Duplicate Name Detection
```sql
-- Automatically checks for duplicate (first_name, last_name) pairs
-- Reports: ✓ PASSED or ✗ FAILED with count
-- Shows detailed list of duplicates if any found
```

#### 2. Gender-Name Concordance Check
```sql
-- Verifies males have male names and females have female names
-- Checks against full name arrays (75 names per gender)
-- Reports:
--   ✓ PASSED: All names match patient gender!
--   ✗ FAILED: Shows count of mismatches
-- Lists specific patients with gender-name mismatches
```

#### 3. Standard Verification
- Total patient count
- Gender distribution (should be ~50/50)
- CKD prevalence
- Observation, prescription, and refill counts
- Condition summary
- Medication class distribution
- eGFR distribution (G1-G5 categories)

## Usage

### Step 1: Choose Your Script

**For Testing/Development:**
```bash
psql "$DATABASE_URL" -f populate_500_patients_fixed.sql
```

**For Production:**
```bash
psql "$DATABASE_URL" -f populate_1001_patients_verified.sql
```

### Step 2: Monitor Progress

You'll see progress notifications:
```
NOTICE:  ========================================
NOTICE:  Starting population of 1001 patients with unique names...
NOTICE:  ========================================
NOTICE:  Processed 100 patients...
NOTICE:  Processed 200 patients...
...
NOTICE:  Processed 1000 patients...
NOTICE:  Successfully populated 1001 patients!
```

### Step 3: Review Verification Results

#### Successful Run (No Issues):
```
--- DUPLICATE NAME CHECK ---
NOTICE:  ✓ PASSED: No duplicate names found!

--- GENDER-NAME CONCORDANCE CHECK ---
NOTICE:  ✓ PASSED: All names match patient gender!
```

#### Failed Run (Issues Detected):
```
--- DUPLICATE NAME CHECK ---
WARNING:  ✗ FAILED: Found 3 duplicate name combinations!

 first_name | last_name | gender | occurrences |           mrns
------------+-----------+--------+-------------+---------------------------
 John       | Smith     | male   |           2 | MRN000123, MRN000456
```

```
--- GENDER-NAME CONCORDANCE CHECK ---
WARNING:  ✗ FAILED: Found 2 gender-name mismatches!
WARNING:    - Males with female names: 1
WARNING:    - Females with male names: 1

        issue           | medical_record_number | first_name | last_name | gender
------------------------+-----------------------+------------+-----------+--------
 Male patient with...  | MRN000789            | Mary       | Johnson   | male
```

## Troubleshooting

### Issue: Duplicates Found
**Cause**: Name arrays too small for the number of patients being generated
**Solution**:
- Use `populate_1001_patients_verified.sql` (has expanded name arrays)
- Or reduce patient count in the script

### Issue: Gender-Name Mismatches
**Cause**: Bug in gender selection or name assignment logic
**Solution**:
- Review the script output to identify problematic patients
- Re-run the script (current version should not have this issue)
- Contact support if issue persists

### Issue: Script Timeout
**Cause**: Database connection timeout for long-running operations
**Solution**:
- Increase psql timeout: `psql "$DATABASE_URL" --set ON_ERROR_STOP=on -f script.sql`
- Run on a machine with better connectivity to Render

## Technical Details

### Name Array Sizes

**populate_500_patients_fixed.sql:**
- 50 male first names
- 50 female first names
- 50 last names
- **Maximum unique combinations**: 50 × 50 = 2,500

**populate_1001_patients_verified.sql:**
- 75 male first names
- 75 female first names
- 50 last names
- **Maximum unique combinations**: 75 × 50 = 3,750

### Retry Logic

Both scripts include retry logic to prevent duplicates:
1. Generates a random name combination
2. Checks if it already exists in the database
3. Retries up to 100 times if duplicate found
4. Falls back to adding a middle initial if still can't find unique name

### Middle Initial Fallback

If after 100 retries a unique combination isn't found:
```sql
-- Adds a random middle initial (A-Z)
v_first_name := v_first_name || ' ' || chr(65 + floor(random() * 26)::int) || '.';
-- Example: "John" becomes "John K."
```

This ensures **guaranteed uniqueness** even with limited name arrays.

## Best Practices

1. **Always use the verified script for production**: `populate_1001_patients_verified.sql`

2. **Check verification results**: Don't ignore warnings or failed checks

3. **Run fix script if duplicates found**: Use `scripts/fix_duplicate_names.sql`

4. **Don't run multiple times**: These scripts INSERT data, they don't UPSERT
   - If you run twice, you'll get ~2000 patients
   - Use `fix_duplicate_names.sql` to clean up

5. **Save verification output**: Redirect to file for auditing
   ```bash
   psql "$DATABASE_URL" -f populate_1001_patients_verified.sql > verification_output.log 2>&1
   ```

## Related Scripts

- `fix_duplicate_names.sql` - Detects and removes duplicate patient names
- `enhance_database_schema.sql` - Creates the database schema
- `add_comprehensive_variables.sql` - Adds additional patient variables
- `populate_comprehensive_variables.sql` - Populates urine analysis and hematology data

## Questions?

See `DATABASE_SETUP_RENDER_ONLY.md` for complete setup instructions.
