#!/usr/bin/env python3
"""
Generate SQL import file from JSON patient data
"""

import json
from datetime import datetime, timedelta
import uuid

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
        return "NULL"

    try:
        years = float(duration_str.replace(' years', '').replace(' year', ''))
        today = datetime.now()
        diagnosis_date = today - timedelta(days=int(years * 365.25))
        return f"'{diagnosis_date.strftime('%Y-%m-%d')}'"
    except:
        return "NULL"

def sql_value(value):
    """Format value for SQL"""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'::text"

# Read JSON
with open('/home/dan/hackathon_BI_CKD/ckd_patients_dataset_1.json', 'r') as f:
    data = json.load(f)

patients = data['patients']

# Generate SQL
sql = ["-- Import patient data from JSON"]
sql.append("-- Clear existing data")
sql.append("TRUNCATE TABLE observations, conditions, risk_assessments, patients CASCADE;")
sql.append("")

for patient in patients:
    patient_id = str(uuid.uuid4())

    # Patient data
    dob = calculate_dob(patient['age'])
    diagnosis_date = parse_diagnosis_duration(patient.get('diagnosisDuration', 'N/A'))
    last_visit = sql_value(patient.get('lastVisit'))
    next_visit = sql_value(patient.get('nextVisit'))

    name_parts = patient['name'].split()
    first_name = name_parts[0]
    last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''

    has_diabetes = 'Diabetes' in patient.get('comorbidities', [])
    has_hypertension = 'Hypertension' in patient.get('comorbidities', [])

    # Insert patient
    sql.append(f"-- Patient: {patient['name']}")
    sql.append(f"""INSERT INTO patients (
    id, medical_record_number, first_name, last_name, date_of_birth, gender, email, phone,
    weight, height, smoking_status, cvd_history, family_history_esrd,
    on_ras_inhibitor, on_sglt2i, nephrotoxic_meds, nephrologist_referral,
    diagnosis_date, last_visit_date, next_visit_date
) VALUES (
    '{patient_id}', {sql_value(patient['mrn'])}, {sql_value(first_name)}, {sql_value(last_name)},
    '{dob}', {sql_value(map_gender(patient['gender']))}, {sql_value(f"{first_name.lower()}.{last_name.lower()}@email.com")}, '+1-555-0001',
    {sql_value(patient.get('weight'))}, {sql_value(patient.get('height'))}, {sql_value(patient.get('smokingStatus'))},
    {sql_value(patient.get('cvdHistory', False))}, {sql_value(patient.get('familyHistoryESRD', False))},
    {sql_value(patient.get('onRASInhibitor', False))}, {sql_value(patient.get('onSGLT2i', False))},
    {sql_value(patient.get('nephrotoxicMeds', False))}, {sql_value(patient.get('nephrologistReferral', False))},
    {diagnosis_date}, {last_visit}, {next_visit}
);""")

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
            sql.append(f"""INSERT INTO observations (patient_id, observation_type, value_numeric, value_text, unit, observation_date, status)
VALUES ('{patient_id}', '{obs_type}', {sql_value(value_num)}, {sql_value(value_text)}, {sql_value(unit)}, CURRENT_TIMESTAMP, 'final');""")

    # Insert conditions
    if has_diabetes:
        sql.append(f"""INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
VALUES ('{patient_id}', 'E11.9', 'Type 2 Diabetes Mellitus', 'active', {diagnosis_date}, CURRENT_TIMESTAMP, 'moderate');""")

    if has_hypertension:
        sql.append(f"""INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
VALUES ('{patient_id}', 'I10', 'Essential Hypertension', 'active', {diagnosis_date}, CURRENT_TIMESTAMP, 'moderate');""")

    if patient.get('ckdStage', 0) > 0:
        stage = patient['ckdStage']
        severity = 'severe' if stage >= 4 else ('moderate' if stage == 3 else 'mild')
        sql.append(f"""INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
VALUES ('{patient_id}', 'N18.{stage}', 'Chronic Kidney Disease, Stage {stage}', 'active', {diagnosis_date}, CURRENT_TIMESTAMP, '{severity}');""")

    if patient.get('cvdHistory'):
        sql.append(f"""INSERT INTO conditions (patient_id, condition_code, condition_name, clinical_status, onset_date, recorded_date, severity)
VALUES ('{patient_id}', 'I25.10', 'Coronary Artery Disease', 'active', {diagnosis_date}, CURRENT_TIMESTAMP, 'moderate');""")

    sql.append("")

# Write SQL file
with open('/home/dan/hackathon_BI_CKD/import_patients.sql', 'w') as f:
    f.write('\n'.join(sql))

print(f"Generated import_patients.sql with {len(patients)} patients")
