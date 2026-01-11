-- Populate CKD Diagnosis Demo Data
-- This script creates sample AI-detected CKD cases for demonstration

-- First, let's create diagnosis events for patients with elevated creatinine
INSERT INTO ckd_diagnosis_events (
  id,
  patient_id,
  detection_trigger,
  egfr_at_diagnosis,
  ckd_stage_at_diagnosis,
  egfr_below_60,
  persistent_proteinuria,
  duration_months,
  diagnosis_date,
  diagnosis_confirmed,
  doctor_notified,
  created_at
)
VALUES
-- Patient 1: Donald Rivera (Creatinine 3.88, Stage 4 CKD)
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00244'),
  'sustained_egfr_decline',
  18.5,
  '4',
  true,
  false,
  6,
  CURRENT_DATE - INTERVAL '2 days',
  false,
  true,
  NOW() - INTERVAL '2 days'
),

-- Patient 2: Mark Thompson (Creatinine 3.85, Stage 3b/4 CKD)
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00114'),
  'rapid_egfr_decline',
  19.2,
  '4',
  true,
  false,
  4,
  CURRENT_DATE - INTERVAL '1 day',
  false,
  true,
  NOW() - INTERVAL '1 day'
),

-- Patient 3: Anna Hall (Creatinine 3.67, Stage 3b CKD)
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00203'),
  'sustained_egfr_decline',
  22.8,
  '3b',
  true,
  false,
  5,
  CURRENT_DATE - INTERVAL '3 days',
  false,
  true,
  NOW() - INTERVAL '3 days'
),

-- Patient 4: Jason Wilson (Creatinine 3.54, Stage 3b CKD)
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00172'),
  'multiple_risk_factors',
  24.1,
  '3b',
  true,
  false,
  6,
  CURRENT_DATE - INTERVAL '4 days',
  false,
  true,
  NOW() - INTERVAL '4 days'
),

-- Patient 5: Benjamin Baker (Creatinine 3.50, Stage 3b CKD)
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00171'),
  'sustained_egfr_decline',
  24.5,
  '3b',
  true,
  false,
  4,
  CURRENT_DATE - INTERVAL '5 days',
  false,
  true,
  NOW() - INTERVAL '5 days'
);

-- Now create treatment protocols for the detected cases
INSERT INTO ckd_treatment_protocols (
  id,
  patient_id,
  diagnosis_event_id,
  protocol_name,
  protocol_type,
  ckd_stage,
  medication_orders,
  lab_monitoring_schedule,
  referrals,
  lifestyle_modifications,
  status,
  baseline_egfr,
  treatment_recommended_at,
  treatment_approved,
  created_at
)
VALUES
-- Treatment for Donald Rivera (Stage 4 - Critical)
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00244'),
  (SELECT id FROM ckd_diagnosis_events WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00244')),
  'Stage 4 CKD Comprehensive Management',
  'comprehensive',
  '4',
  jsonb_build_object(
    'ras_inhibitor', jsonb_build_object(
      'recommended', true,
      'options', ARRAY['Lisinopril 10mg daily', 'Losartan 50mg daily'],
      'rationale', 'Blood pressure control and renoprotection'
    ),
    'sglt2_inhibitor', jsonb_build_object(
      'recommended', true,
      'options', ARRAY['Dapagliflozin 10mg daily'],
      'rationale', 'Proven to slow CKD progression'
    ),
    'phosphate_binder', jsonb_build_object(
      'recommended', true,
      'options', ARRAY['Sevelamer 800mg TID with meals'],
      'rationale', 'Manage hyperphosphatemia in advanced CKD'
    )
  ),
  jsonb_build_object(
    'frequency', 'monthly',
    'tests', ARRAY['Creatinine', 'eGFR', 'Potassium', 'Phosphorus', 'Calcium', 'PTH', 'Hemoglobin']
  ),
  jsonb_build_object(
    'nephrology', jsonb_build_object(
      'urgency', 'urgent',
      'reason', 'Stage 4 CKD requires specialist management and possible dialysis planning'
    )
  ),
  jsonb_build_object(
    'diet', 'Low protein (0.6-0.8 g/kg), low phosphorus, potassium restriction',
    'fluid', 'Monitor fluid intake',
    'exercise', 'Light activity as tolerated'
  ),
  'pending_approval',
  18.5,
  NOW() - INTERVAL '2 days',
  false,
  NOW() - INTERVAL '2 days'
),

-- Treatment for Mark Thompson (Stage 4 - High Priority)
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00114'),
  (SELECT id FROM ckd_diagnosis_events WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00114')),
  'Stage 4 CKD Rapid Progression Protocol',
  'rapid_progression',
  '4',
  jsonb_build_object(
    'ras_inhibitor', jsonb_build_object(
      'recommended', true,
      'options', ARRAY['Enalapril 10mg daily'],
      'rationale', 'Essential for slowing progression'
    ),
    'sglt2_inhibitor', jsonb_build_object(
      'recommended', true,
      'options', ARRAY['Empagliflozin 10mg daily'],
      'rationale', 'Cardio-renal protection'
    )
  ),
  jsonb_build_object(
    'frequency', 'bi-weekly initially',
    'tests', ARRAY['Creatinine', 'eGFR', 'Potassium', 'Bicarbonate']
  ),
  jsonb_build_object(
    'nephrology', jsonb_build_object(
      'urgency', 'immediate',
      'reason', 'Rapid progression requires urgent specialist evaluation'
    )
  ),
  jsonb_build_object(
    'diet', 'Renal diet consultation',
    'education', 'Dialysis education and planning'
  ),
  'pending_approval',
  19.2,
  NOW() - INTERVAL '1 day',
  false,
  NOW() - INTERVAL '1 day'
),

-- Treatment for Anna Hall (Stage 3b - Moderate)
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00203'),
  (SELECT id FROM ckd_diagnosis_events WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00203')),
  'Stage 3b CKD Nephroprotective Protocol',
  'nephroprotective',
  '3b',
  jsonb_build_object(
    'ras_inhibitor', jsonb_build_object(
      'recommended', true,
      'options', ARRAY['Ramipril 5mg daily', 'Irbesartan 150mg daily'],
      'rationale', 'First-line nephroprotection'
    ),
    'sglt2_inhibitor', jsonb_build_object(
      'recommended', true,
      'options', ARRAY['Canagliflozin 100mg daily'],
      'rationale', 'Slow CKD progression'
    )
  ),
  jsonb_build_object(
    'frequency', 'every 3 months',
    'tests', ARRAY['Creatinine', 'eGFR', 'UACR', 'Potassium', 'HbA1c']
  ),
  jsonb_build_object(
    'nephrology', jsonb_build_object(
      'urgency', 'routine',
      'reason', 'Stage 3b CKD warrants nephrology consultation'
    )
  ),
  jsonb_build_object(
    'diet', 'Moderate protein restriction',
    'bp_target', '<130/80 mmHg'
  ),
  'pending_approval',
  22.8,
  NOW() - INTERVAL '3 days',
  false,
  NOW() - INTERVAL '3 days'
);

-- Create doctor action queue entries for diagnosis confirmation
INSERT INTO doctor_action_queue (
  id,
  patient_id,
  diagnosis_event_id,
  action_type,
  priority,
  action_title,
  action_description,
  recommended_action,
  clinical_summary,
  status,
  due_date,
  created_at
)
VALUES
-- Action for Donald Rivera
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00244'),
  (SELECT id FROM ckd_diagnosis_events WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00244')),
  'confirm_ckd_diagnosis',
  'CRITICAL',
  '⚠️ Critical: Confirm Stage 4 CKD Diagnosis',
  E'AI-Detected Stage 4 CKD in 77-year-old male patient with severely elevated creatinine (3.88 mg/dL) and eGFR of 18.5 mL/min/1.73m².\n\nKey Findings:\n• Creatinine: 3.88 mg/dL (critically elevated)\n• Estimated eGFR: 18.5 mL/min/1.73m² (Stage 4 CKD)\n• Sustained decline in renal function over past 6 months\n• Multiple risk factors: Age >65, hypertension, diabetes\n\nDetection Criteria Met:\n✓ eGFR below 30 mL/min/1.73m²\n✓ Elevated creatinine >3.0 mg/dL\n✓ Declining renal function trend\n\nRecommended Actions:\n1. Confirm Stage 4 CKD diagnosis\n2. Urgent nephrology referral for dialysis planning\n3. Initiate comprehensive CKD management\n4. Patient education on renal replacement therapy options\n\nThis case requires IMMEDIATE attention - patient may need dialysis within 6-12 months.',
  'Urgent nephrology referral and comprehensive Stage 4 CKD management',
  jsonb_build_object(
    'detection_confidence', 0.94,
    'ckd_stage', '4',
    'egfr', 18.5,
    'creatinine', 3.88,
    'risk_factors', ARRAY['age_77', 'hypertension', 'diabetes'],
    'urgency', 'critical'
  ),
  'pending',
  CURRENT_DATE + INTERVAL '1 day',
  NOW() - INTERVAL '2 days'
),

-- Action for Mark Thompson
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00114'),
  (SELECT id FROM ckd_diagnosis_events WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00114')),
  'confirm_ckd_diagnosis',
  'HIGH',
  '🔴 High Priority: Rapidly Progressing Stage 4 CKD',
  E'AI-Detected rapidly progressing Stage 4 CKD in 55-year-old male with concerning rate of eGFR decline.\n\nCritical Findings:\n• Creatinine: 3.85 mg/dL (severely elevated)\n• Estimated eGFR: 19.2 mL/min/1.73m² (Stage 4 CKD)\n• Rapid eGFR decline: -12 mL/min/1.73m² in past 6 months\n• Younger age increases urgency for intervention\n\nDetection Triggers:\n✓ eGFR below 30 mL/min/1.73m²\n✓ Rapid progression (>5 mL/min decline in 6 months)\n✓ Critically elevated creatinine\n\nImmediate Actions Required:\n1. Confirm CKD Stage 4 diagnosis\n2. STAT nephrology referral - rapid progression\n3. Rule out acute kidney injury component\n4. Consider early vascular access planning\n\nRationale: Rapid progression in younger patient warrants aggressive intervention and early dialysis planning.',
  'Immediate nephrology referral for rapidly progressive CKD',
  jsonb_build_object(
    'detection_confidence', 0.91,
    'ckd_stage', '4',
    'egfr', 19.2,
    'creatinine', 3.85,
    'progression_rate', 'rapid',
    'age', 55,
    'urgency', 'high'
  ),
  'pending',
  CURRENT_DATE + INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),

-- Action for Anna Hall
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00203'),
  (SELECT id FROM ckd_diagnosis_events WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00203')),
  'confirm_ckd_diagnosis',
  'MODERATE',
  '🟡 Confirm Stage 3b CKD and Initiate Treatment',
  E'AI-Detected Stage 3b CKD in 60-year-old female patient with sustained eGFR decline.\n\nClinical Findings:\n• Creatinine: 3.67 mg/dL (elevated)\n• Estimated eGFR: 22.8 mL/min/1.73m² (Stage 3b CKD)\n• Sustained decline over 3-6 month period\n• Good candidate for early nephroprotective therapy\n\nDetection Criteria:\n✓ eGFR 30-44 mL/min/1.73m² (Stage 3b)\n✓ Elevated creatinine\n✓ Sustained decline in renal function\n\nRecommended Management:\n1. Confirm Stage 3b CKD diagnosis\n2. Initiate nephroprotective medications (ACE-I/ARB + SGLT2i)\n3. Routine nephrology referral (non-urgent)\n4. Quarterly monitoring of renal function\n\nRationale: Early intervention can slow progression and preserve renal function.',
  'Confirm diagnosis and start nephroprotective therapy',
  jsonb_build_object(
    'detection_confidence', 0.89,
    'ckd_stage', '3b',
    'egfr', 22.8,
    'creatinine', 3.67,
    'treatment_candidate', true,
    'urgency', 'moderate'
  ),
  'pending',
  CURRENT_DATE + INTERVAL '2 days',
  NOW() - INTERVAL '3 days'
);

-- Create treatment approval actions for the Stage 4 patients
INSERT INTO doctor_action_queue (
  id,
  patient_id,
  diagnosis_event_id,
  treatment_protocol_id,
  action_type,
  priority,
  action_title,
  action_description,
  recommended_action,
  clinical_summary,
  status,
  due_date,
  created_at
)
VALUES
-- Treatment approval for Donald Rivera
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00244'),
  (SELECT id FROM ckd_diagnosis_events WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00244')),
  (SELECT id FROM ckd_treatment_protocols WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00244')),
  'approve_treatment',
  'CRITICAL',
  '💊 Approve Stage 4 CKD Treatment Protocol',
  E'AI-Generated comprehensive treatment protocol for Stage 4 CKD requires physician approval.\n\nProposed Medication Orders:\n\n1. RAS Inhibitor (Nephroprotection):\n   • Lisinopril 10mg PO daily OR Losartan 50mg PO daily\n   • Monitor BP and K+ closely\n   • Rationale: Essential for slowing CKD progression\n\n2. SGLT2 Inhibitor (Renal Protection):\n   • Dapagliflozin 10mg PO daily\n   • Proven benefit in slowing CKD progression\n   • Continue even if eGFR drops to 20\n\n3. Phosphate Binder (Mineral Management):\n   • Sevelamer 800mg PO TID with meals\n   • Manage hyperphosphatemia in Stage 4 CKD\n\nMonitoring Plan:\n• Monthly labs: Creatinine, eGFR, K+, PO4, Ca, PTH, Hgb\n• Blood pressure monitoring\n• Watch for hyperkalemia\n\nReferrals:\n• URGENT Nephrology - dialysis planning\n• Renal dietitian\n• Vascular surgery for access evaluation\n\nApproving this protocol will automatically:\n✓ Send orders to pharmacy\n✓ Schedule nephrology appointment\n✓ Initiate patient education\n✓ Set up monitoring schedule',
  'Comprehensive Stage 4 CKD management with nephrology coordination',
  jsonb_build_object(
    'ckd_stage', '4',
    'egfr', 18.5,
    'medications', ARRAY['ACE-I/ARB', 'SGLT2i', 'Phosphate binder'],
    'urgency', 'critical',
    'requires_specialist', true
  ),
  'pending',
  CURRENT_DATE + INTERVAL '1 day',
  NOW() - INTERVAL '2 days'
),

-- Treatment approval for Anna Hall
(
  gen_random_uuid(),
  (SELECT id FROM patients WHERE medical_record_number = 'MRN00203'),
  (SELECT id FROM ckd_diagnosis_events WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00203')),
  (SELECT id FROM ckd_treatment_protocols WHERE patient_id = (SELECT id FROM patients WHERE medical_record_number = 'MRN00203')),
  'approve_treatment',
  'MODERATE',
  '💊 Initiate Early Nephroprotective Therapy - Stage 3b',
  E'AI-Recommended nephroprotective treatment protocol for newly detected Stage 3b CKD.\n\nProposed Medication Orders:\n\n1. RAS Inhibitor (First-line Therapy):\n   • Ramipril 5mg PO daily OR Irbesartan 150mg PO daily\n   • Target BP <130/80 mmHg\n   • Rationale: Proven to slow CKD progression\n\n2. SGLT2 Inhibitor (Nephroprotection):\n   • Canagliflozin 100mg PO daily\n   • Safe at eGFR >20, adjust if needed\n   • Strong evidence for slowing CKD progression\n\nMonitoring Schedule:\n• Labs every 3 months: Creatinine, eGFR, UACR, K+, HbA1c\n• Blood pressure checks at each visit\n• Monitor for side effects (hyperkalemia, hypotension)\n\nReferrals:\n• Routine Nephrology consult (within 1-2 months)\n• Dietary consultation for renal diet\n\nLifestyle Modifications:\n• Moderate protein restriction (0.8-1.0 g/kg/day)\n• Blood pressure control\n• Avoid nephrotoxic medications (NSAIDs)\n\nEvidence Base:\n• DAPA-CKD trial: 39% reduction in CKD progression\n• CREDENCE trial: 30% reduction in renal outcomes\n\nApproving initiates early intervention to preserve renal function.',
  'Early nephroprotective therapy with proven CKD progression benefits',
  jsonb_build_object(
    'ckd_stage', '3b',
    'egfr', 22.8,
    'medications', ARRAY['ACE-I/ARB', 'SGLT2i'],
    'evidence_based', true,
    'urgency', 'moderate'
  ),
  'pending',
  CURRENT_DATE + INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
);
