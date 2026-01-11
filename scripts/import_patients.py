#!/usr/bin/env python3
"""
Import patient data from JSON file to PostgreSQL database
"""

import json
import psycopg2
from datetime import datetime, timedelta
import uuid

# Database connection
DB_URL = "postgresql://ckd_analyzer_db_td6o_user:icbyXt0nalV0ui8N5d6kjoxK1Xy1mSL3@dpg-d48cnrqli9vc739811v0-a.oregon-postgres.render.com/ckd_analyzer_db_td6o"

def map_risk_level(risk_level):
    """Map risk level to risk tier"""
    mapping = {
        'Low': 1,
        'Moderate': 2,
        'High': 3,
        'Critical': 3
    }
    return mapping.get(risk_level, 2)

def map_gender(gender):
    """Map gender to lowercase"""
    return gender.lower() if gender else 'unknown'

def calculate_dob(age):
    """Calculate date of birth from age"""
    today = datetime.now()
    return today.replace(year=today.year - age).strftime('%Y-%m-%d')

def parse_diagnosis_duration(duration_str):
    """Parse diagnosis duration and calculate diagnosis date"""
    if duration_str == "N/A" or not duration_str:
        return None

    # Extract years from string like "3.5 years"
    try:
        years = float(duration_str.replace(' years', '').replace(' year', ''))
        today = datetime.now()
        diagnosis_date = today - timedelta(days=int(years * 365.25))
        return diagnosis_date.strftime('%Y-%m-%d')
    except:
        return None

def import_patients(json_file_path):
    """Import patients from JSON file to PostgreSQL"""

    # Read JSON file
    print(f"Reading {json_file_path}...")
    with open(json_file_path, 'r') as f:
        data = json.load(f)

    patients = data['patients']
    print(f"Found {len(patients)} patients to import")

    # Connect to database
    print("Connecting to database...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    try:
        # Clear existing data
        print("Clearing existing data...")
        cur.execute("TRUNCATE TABLE observations, conditions, risk_assessments, patients CASCADE;")

        # Import each patient
        for idx, patient in enumerate(patients, 1):
            patient_id = str(uuid.uuid4())

            print(f"Importing patient {idx}/{len(patients)}: {patient['name']}...")

            # Calculate dates
            dob = calculate_dob(patient['age'])
            diagnosis_date = parse_diagnosis_duration(patient.get('diagnosisDuration', 'N/A'))
            last_visit = patient.get('lastVisit')
            next_visit = patient.get('nextVisit')

            # Determine conditions
            has_diabetes = 'Diabetes' in patient.get('comorbidities', [])
            has_hypertension = 'Hypertension' in patient.get('comorbidities', [])

            # Insert patient
            cur.execute("""
                INSERT INTO patients (
                    id, medical_record_number, first_name, last_name,
                    date_of_birth, gender, email, phone,
                    weight, height, smoking_status, cvd_history, family_history_esrd,
                    on_ras_inhibitor, on_sglt2i, nephrotoxic_meds, nephrologist_referral,
                    diagnosis_date, last_visit_date, next_visit_date
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s
                )
            """, (
                patient_id,
                patient['mrn'],
                patient['name'].split()[0],  # First name
                ' '.join(patient['name'].split()[1:]),  # Last name
                dob,
                map_gender(patient['gender']),
                f"{patient['name'].lower().replace(' ', '.')}@email.com",
                '+1-555-' + str(idx).zfill(4),
                patient.get('weight'),
                patient.get('height'),
                patient.get('smokingStatus'),
                patient.get('cvdHistory', False),
                patient.get('familyHistoryESRD', False),
                patient.get('onRASInhibitor', False),
                patient.get('onSGLT2i', False),
                patient.get('nephrotoxicMeds', False),
                patient.get('nephrologistReferral', False),
                diagnosis_date,
                last_visit,
                next_visit
            ))

            # Insert observations
            obs_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            observations = [
                ('eGFR', patient.get('eGFR'), None, 'mL/min/1.73m²', 'Kidney function'),
                ('eGFR_trend', None, patient.get('eGFRTrend'), None, 'eGFR trend'),
                ('eGFR_change_percent', patient.get('eGFRChange'), None, '%', 'eGFR change'),
                ('serum_creatinine', patient.get('serumCreatinine'), None, 'mg/dL', 'Creatinine'),
                ('BUN', patient.get('bun'), None, 'mg/dL', 'Blood urea nitrogen'),
                ('uACR', patient.get('uACR'), None, 'mg/g', 'Urine albumin'),
                ('proteinuria_category', None, patient.get('proteinuriaCategory'), None, 'Proteinuria'),
                ('blood_pressure_systolic', patient.get('systolicBP'), None, 'mmHg', 'Systolic BP'),
                ('blood_pressure_diastolic', patient.get('diastolicBP'), None, 'mmHg', 'Diastolic BP'),
                ('HbA1c', patient.get('hba1c'), None, '%', 'Hemoglobin A1c'),
                ('LDL_cholesterol', patient.get('ldl'), None, 'mg/dL', 'LDL cholesterol'),
                ('HDL_cholesterol', patient.get('hdl'), None, 'mg/dL', 'HDL cholesterol'),
                ('BMI', patient.get('bmi'), None, 'kg/m²', 'Body mass index'),
                ('hemoglobin', patient.get('hemoglobin'), None, 'g/dL', 'Hemoglobin'),
                ('potassium', patient.get('potassium'), None, 'mEq/L', 'Potassium'),
                ('calcium', patient.get('calcium'), None, 'mg/dL', 'Calcium'),
                ('phosphorus', patient.get('phosphorus'), None, 'mg/dL', 'Phosphorus'),
                ('albumin', patient.get('albumin'), None, 'g/dL', 'Albumin'),
            ]

            for obs_type, value_num, value_text, unit, notes in observations:
                if value_num is not None or value_text is not None:
                    cur.execute("""
                        INSERT INTO observations (
                            patient_id, observation_type, value_numeric, value_text,
                            unit, observation_date, status, notes
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        patient_id, obs_type, value_num, value_text,
                        unit, obs_date, 'final', notes
                    ))

            # Insert conditions
            if has_diabetes:
                cur.execute("""
                    INSERT INTO conditions (
                        patient_id, condition_code, condition_name,
                        clinical_status, onset_date, recorded_date, severity
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    patient_id, 'E11.9', 'Type 2 Diabetes Mellitus',
                    'active', diagnosis_date, obs_date, 'moderate'
                ))

            if has_hypertension:
                cur.execute("""
                    INSERT INTO conditions (
                        patient_id, condition_code, condition_name,
                        clinical_status, onset_date, recorded_date, severity
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    patient_id, 'I10', 'Essential Hypertension',
                    'active', diagnosis_date, obs_date, 'moderate'
                ))

            # Add CKD condition if stage > 0
            if patient.get('ckdStage', 0) > 0:
                stage = patient['ckdStage']
                cur.execute("""
                    INSERT INTO conditions (
                        patient_id, condition_code, condition_name,
                        clinical_status, onset_date, recorded_date, severity
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    patient_id, f'N18.{stage}', f'Chronic Kidney Disease, Stage {stage}',
                    'active', diagnosis_date, obs_date,
                    'severe' if stage >= 4 else 'moderate' if stage == 3 else 'mild'
                ))

            if patient.get('cvdHistory'):
                cur.execute("""
                    INSERT INTO conditions (
                        patient_id, condition_code, condition_name,
                        clinical_status, onset_date, recorded_date, severity
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    patient_id, 'I25.10', 'Coronary Artery Disease',
                    'active', diagnosis_date, obs_date, 'moderate'
                ))

        # Commit transaction
        print("Committing changes...")
        conn.commit()
        print(f"✅ Successfully imported {len(patients)} patients!")

    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        raise

    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    import_patients('/home/dan/hackathon_BI_CKD/ckd_patients_dataset_1.json')
