#!/usr/bin/env python3
import json
import psycopg2
from datetime import datetime, timedelta
import uuid
import os

# Database connection - requires DATABASE_URL environment variable
DB_URL = os.environ.get('DATABASE_URL')

if not DB_URL:
    print("ERROR: DATABASE_URL environment variable is required")
    print("Example: DATABASE_URL=postgresql://user:pass@host:5432/dbname python batch_import.py")
    exit(1)

BATCH_SIZE = 10

def map_gender(gender):
    return gender.lower() if gender else 'unknown'

def calculate_dob(age):
    today = datetime.now()
    return today.replace(year=today.year - age).strftime('%Y-%m-%d')

def parse_diagnosis_duration(duration_str):
    if duration_str == "N/A" or not duration_str:
        return None
    try:
        years = float(duration_str.replace(' years', '').replace(' year', ''))
        today = datetime.now()
        diagnosis_date = today - timedelta(days=int(years * 365.25))
        return diagnosis_date.strftime('%Y-%m-%d')
    except:
        return None

# Read JSON
with open('/home/dan/hackathon_BI_CKD/ckd_patients_dataset_1.json', 'r') as f:
    data = json.load(f)
patients = data['patients']

print(f"Importing {len(patients)} patients in batches of {BATCH_SIZE}...")

# Connect
conn = psycopg2.connect(DB_URL)
conn.autocommit = False
cur = conn.cursor()

try:
    # Clear data
    print("Clearing existing data...")
    cur.execute("TRUNCATE TABLE observations, conditions, risk_assessments, patients CASCADE;")
    conn.commit()

    # Import in batches
    for batch_start in range(0, len(patients), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(patients))
        batch = patients[batch_start:batch_end]

        print(f"Importing patients {batch_start+1}-{batch_end}...")

        for patient in batch:
            patient_id = str(uuid.uuid4())

            # Patient data
            dob = calculate_dob(patient['age'])
            diagnosis_date = parse_diagnosis_duration(patient.get('diagnosisDuration', 'N/A'))
            name_parts = patient['name'].split()
            first_name = name_parts[0]
            last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
            has_diabetes = 'Diabetes' in patient.get('comorbidities', [])
            has_hypertension = 'Hypertension' in patient.get('comorbidities', [])

            # Insert patient
            cur.execute("""
                INSERT INTO patients (
                    id, medical_record_number, first_name, last_name, date_of_birth, gender, email, phone,
                    weight, height, smoking_status, cvd_history, family_history_esrd,
                    on_ras_inhibitor, on_sglt2i, nephrotoxic_meds, nephrologist_referral,
                    diagnosis_date, last_visit_date, next_visit_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                patient_id, patient['mrn'], first_name, last_name, dob, map_gender(patient['gender']),
                f"{first_name.lower()}.{last_name.lower()}@email.com", '+1-555-0001',
                patient.get('weight'), patient.get('height'), patient.get('smokingStatus'),
                patient.get('cvdHistory', False), patient.get('familyHistoryESRD', False),
                patient.get('onRASInhibitor', False), patient.get('onSGLT2i', False),
                patient.get('nephrotoxicMeds', False), patient.get('nephrologistReferral', False),
                diagnosis_date, patient.get('lastVisit'), patient.get('nextVisit')
            ))

            # Insert observations
            obs_list = [
                ('eGFR', patient.get('eGFR'), None, 'mL/min/1.73m²'),
                ('eGFR_trend', None, patient.get('eGFRTrend'), None),
                ('eGFR_change_percent', patient.get('eGFRChange'), None, '%'),
                ('serum_creatinine', patient.get('serumCreatinine'), None, 'mg/dL'),
                ('BUN', patient.get('bun'), None, 'mg/dL'),
                ('uACR', patient.get('uACR'), None, 'mg/g'),
                ('proteinuria_category', None, patient.get('proteinuriaCategory'), None),
                ('blood_pressure_systolic', patient.get('systolicBP'), None, 'mmHg'),
                ('blood_pressure_diastolic', patient.get('diastolicBP'), None, 'mmHg'),
                ('HbA1c', patient.get('hba1c'), None, '%'),
                ('LDL_cholesterol', patient.get('ldl'), None, 'mg/dL'),
                ('HDL_cholesterol', patient.get('hdl'), None, 'mg/dL'),
                ('BMI', patient.get('bmi'), None, 'kg/m²'),
                ('hemoglobin', patient.get('hemoglobin'), None, 'g/dL'),
                ('potassium', patient.get('potassium'), None, 'mEq/L'),
                ('calcium', patient.get('calcium'), None, 'mg/dL'),
                ('phosphorus', patient.get('phosphorus'), None, 'mg/dL'),
                ('albumin', patient.get('albumin'), None, 'g/dL'),
            ]

            for obs_type, value_num, value_text, unit in obs_list:
                if value_num is not None or value_text is not None:
                    cur.execute("""
                        INSERT INTO observations (patient_id, observation_type, value_numeric, value_text, unit, observation_date, status)
                        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP, 'final')
                    """, (patient_id, obs_type, value_num, value_text, unit))

            # Insert conditions
            if has_diabetes:
                cur.execute("""
                    INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
                    VALUES (%s, 'E11.9', 'Type 2 Diabetes Mellitus', 'active', %s, CURRENT_TIMESTAMP, 'moderate')
                """, (patient_id, diagnosis_date))

            if has_hypertension:
                cur.execute("""
                    INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
                    VALUES (%s, 'I10', 'Essential Hypertension', 'active', %s, CURRENT_TIMESTAMP, 'moderate')
                """, (patient_id, diagnosis_date))

            if patient.get('ckdStage', 0) > 0:
                stage = patient['ckdStage']
                severity = 'severe' if stage >= 4 else ('moderate' if stage == 3 else 'mild')
                cur.execute("""
                    INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
                    VALUES (%s, %s, %s, 'active', %s, CURRENT_TIMESTAMP, %s)
                """, (patient_id, f'N18.{stage}', f'Chronic Kidney Disease, Stage {stage}', diagnosis_date, severity))

            if patient.get('cvdHistory'):
                cur.execute("""
                    INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
                    VALUES (%s, 'I25.10', 'Coronary Artery Disease', 'active', %s, CURRENT_TIMESTAMP, 'moderate')
                """, (patient_id, diagnosis_date))

        # Commit batch
        conn.commit()
        print(f"  ✓ Batch {batch_start//BATCH_SIZE + 1} completed")

    print(f"\n✅ Successfully imported all {len(patients)} patients!")

except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
    raise
finally:
    cur.close()
    conn.close()
