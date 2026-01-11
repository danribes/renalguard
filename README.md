# RENALGUARD AI - Intelligent Chronic Kidney Disease Management Platform

![RENALGUARD AI](https://img.shields.io/badge/AI-Powered-blue) ![Status](https://img.shields.io/badge/Status-Production-green) ![KDIGO](https://img.shields.io/badge/KDIGO-2024-orange)

## What is RENALGUARD AI?

**RENALGUARD AI** is an advanced artificial intelligence-powered clinical decision support system designed specifically for primary care physicians to manage chronic kidney disease (CKD) patients. The platform combines real-time patient monitoring, evidence-based risk assessment, and AI-driven treatment recommendations to help doctors identify kidney disease early, track progression accurately, and optimize treatment strategies.

### The Problem We Solve

Chronic kidney disease affects **1 in 7 adults** globally, yet it often goes undiagnosed until advanced stages. Primary care physicians face multiple challenges:

- **Early Detection Gaps**: CKD is often asymptomatic until significant kidney damage occurs
- **Complex Risk Stratification**: Manual KDIGO classification is time-consuming and error-prone
- **Treatment Decision Burden**: Determining when to initiate RAS inhibitors, SGLT2 inhibitors, or refer to nephrology requires constant guideline consultation
- **Lab Result Overload**: Distinguishing clinically significant changes from normal variation is challenging
- **Transition Monitoring**: Tracking patients moving between non-CKD and CKD status requires special attention

### Our Solution

RENALGUARD AI acts as an **intelligent co-pilot** for primary care physicians, enabling **early detection, proactive monitoring, and timely treatment** of CKD. By identifying kidney disease before symptoms appear and guiding evidence-based interventions, we help:

- **Increase patient quality of life** through early treatment before irreversible damage occurs
- **Reduce hospitalization costs** by preventing progression to kidney failure and dialysis
- **Empower doctors** with AI-powered decision support to determine the best next steps for each patient

---

## Deployment

This application is designed to be deployed on **Cloudflare** infrastructure:

| Service | Platform | Description |
|---------|----------|-------------|
| **Frontend** | Cloudflare Pages | React SPA with global CDN |
| **Backend** | Cloudflare Containers | Express API server |
| **MCP Server** | Cloudflare Containers | Clinical decision support tools |
| **Database** | Neon/Supabase + Hyperdrive | PostgreSQL with connection pooling |

See [CLOUDFLARE_MIGRATION_PLAN.md](./CLOUDFLARE_MIGRATION_PLAN.md) for deployment instructions.

---

## Clinical Value: Why Early CKD Detection Matters

### The Cost of Late Detection

- **Dialysis costs $90,000+/year per patient** in the United States
- **50% of patients** reaching Stage 5 CKD were not aware they had kidney disease
- **Early treatment** can slow progression by 30-50% and delay dialysis by years

### How RENALGUARD AI Changes Outcomes

| Without RENALGUARD AI | With RENALGUARD AI |
|----------------------|-------------------|
| CKD often detected at Stage 3-4 | Early detection at Stage 1-2 through risk screening |
| Manual risk calculation is time-consuming | Automated GCUA cardiorenal risk assessment (Nelson, AHA PREVENT, Bansal) |
| Treatment decisions require guideline lookup | AI provides instant KDIGO 2024 recommendations |
| Lab changes may go unnoticed | Smart alerts flag clinically significant changes only |
| Patient monitoring is reactive | Proactive monitoring with trend detection |

---

## System Integration: How RENALGUARD AI Works in Primary Care

### Data Acquisition from EHR Systems

When deployed in a primary care setting, RENALGUARD AI integrates with existing Electronic Health Record (EHR) systems to automatically acquire patient data:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRIMARY CARE IT INFRASTRUCTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐         ┌─────────────────┐         ┌─────────────┐  │
│   │   EHR SYSTEM    │         │  LABORATORY     │         │   PHARMACY  │  │
│   │   (Epic, Cerner │         │  INFORMATION    │         │   SYSTEM    │  │
│   │    Meditech)    │         │  SYSTEM (LIS)   │         │   (PBM)     │  │
│   └────────┬────────┘         └────────┬────────┘         └──────┬──────┘  │
│            │                           │                         │         │
│            │  HL7 FHIR API             │  HL7v2/FHIR             │ NCPDP   │
│            │  (Patient Data)           │  (Lab Results)          │ (Rx)    │
│            │                           │                         │         │
│            └───────────────────────────┼─────────────────────────┘         │
│                                        │                                    │
│                                        ▼                                    │
│                    ┌───────────────────────────────────────┐               │
│                    │       RENALGUARD AI PLATFORM          │               │
│                    │                                       │               │
│                    │  ┌─────────────────────────────────┐  │               │
│                    │  │     INTEGRATION LAYER           │  │               │
│                    │  │  • FHIR R4 Client               │  │               │
│                    │  │  • HL7v2 Message Parser         │  │               │
│                    │  │  • ADT Feed Processor           │  │               │
│                    │  │  • Batch Import Engine          │  │               │
│                    │  └─────────────────────────────────┘  │               │
│                    │                  │                    │               │
│                    │                  ▼                    │               │
│                    │  ┌─────────────────────────────────┐  │               │
│                    │  │     POSTGRESQL DATABASE         │  │               │
│                    │  │  Patients, Observations,        │  │               │
│                    │  │  Conditions, Medications        │  │               │
│                    │  └─────────────────────────────────┘  │               │
│                    └───────────────────────────────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Supported Integration Methods:**

| Method | Use Case | Data Types | Frequency |
|--------|----------|------------|-----------|
| **HL7 FHIR R4 API** | Real-time patient data | Patient demographics, conditions, medications | Real-time |
| **HL7v2 Messages** | Lab result feeds | ORU (lab results), ADT (admissions) | Real-time/Batch |
| **ADT Feeds** | Patient registration | New patients, updates, transfers | Real-time |
| **Batch File Import** | Historical data migration | All patient data types | Overnight |
| **Direct Database Link** | High-volume clinics | All data | Configurable |

---

### Overnight Batch Processing Workflow

RENALGUARD AI performs comprehensive batch processing during off-peak hours (typically 2:00 AM - 5:00 AM) to ensure all patient risk assessments are current without impacting daytime system performance:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OVERNIGHT BATCH PROCESSING TIMELINE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  2:00 AM ─────────────────────────────────────────────────────────► 5:00 AM │
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  PHASE 1 │  │  PHASE 2 │  │  PHASE 3 │  │  PHASE 4 │  │  PHASE 5 │      │
│  │  DATA    │  │  RISK    │  │  CHANGE  │  │  ALERT   │  │  REPORT  │      │
│  │  SYNC    │  │  CALC    │  │  DETECT  │  │  GENERATE│  │  PREPARE │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                             │
│  2:00-2:30     2:30-3:30     3:30-4:00     4:00-4:30     4:30-5:00         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Phase 1: Data Synchronization (2:00 AM - 2:30 AM)**
```
┌─────────────────────────────────────────────────────────────┐
│ BATCH JOB: sync_ehr_data                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Pull new patients registered in last 24 hours            │
│ 2. Import lab results from Laboratory Information System    │
│ 3. Update medication lists from pharmacy feeds              │
│ 4. Sync condition/diagnosis codes from EHR                  │
│ 5. Validate data integrity and flag discrepancies           │
└─────────────────────────────────────────────────────────────┘
```

**Phase 2: Risk Calculation (2:30 AM - 3:30 AM)**
```
┌─────────────────────────────────────────────────────────────┐
│ BATCH JOB: calculate_all_risks                              │
├─────────────────────────────────────────────────────────────┤
│ FOR EACH patient in database:                               │
│                                                             │
│   IF patient.age >= 60 AND patient.eGFR >= 60:             │
│      → Run GCUA Assessment (algorithmic)                    │
│        • Nelson/CKD-PC renal risk calculation               │
│        • AHA PREVENT CVD risk calculation                   │
│        • Bansal mortality risk calculation                  │
│        • Assign phenotype (I, II, III, IV, Moderate, Low)   │
│                                                             │
│   IF patient has CKD diagnosis OR eGFR < 60:               │
│      → Run KDIGO Classification (algorithmic)               │
│        • Calculate GFR category (G1-G5)                     │
│        • Calculate albuminuria category (A1-A3)             │
│        • Assign combined risk level                         │
│        • Determine monitoring frequency                     │
│                                                             │
│   → Store results in risk_assessments table                 │
└─────────────────────────────────────────────────────────────┘
```

**Phase 3: Change Detection (3:30 AM - 4:00 AM)**
```
┌─────────────────────────────────────────────────────────────┐
│ BATCH JOB: detect_significant_changes                       │
├─────────────────────────────────────────────────────────────┤
│ Compare current vs previous values:                         │
│                                                             │
│ • eGFR change > 5 ml/min in 3 months         → FLAG        │
│ • uACR increase > 30%                         → FLAG        │
│ • New CKD diagnosis (transition from non-CKD) → FLAG        │
│ • GCUA phenotype change                       → FLAG        │
│ • KDIGO stage progression                     → FLAG        │
│ • Treatment gap detected                      → FLAG        │
│                                                             │
│ Flagged patients → clinical_alerts queue                    │
└─────────────────────────────────────────────────────────────┘
```

**Phase 4: Alert Generation (4:00 AM - 4:30 AM)**
```
┌─────────────────────────────────────────────────────────────┐
│ BATCH JOB: generate_clinical_alerts                         │
├─────────────────────────────────────────────────────────────┤
│ FOR EACH flagged patient:                                   │
│                                                             │
│   1. Determine alert priority (CRITICAL/HIGH/MODERATE)      │
│   2. Assign to appropriate doctor                           │
│   3. Generate alert notification                            │
│   4. Queue email if configured                              │
│                                                             │
│ Alert prioritization rules:                                 │
│ • CRITICAL: eGFR < 15, rapid decline >10 ml/min/year       │
│ • HIGH: New CKD diagnosis, phenotype I/II                   │
│ • MODERATE: Stage progression, treatment gaps               │
└─────────────────────────────────────────────────────────────┘
```

**Phase 5: Report Preparation (4:30 AM - 5:00 AM)**
```
┌─────────────────────────────────────────────────────────────┐
│ BATCH JOB: prepare_daily_reports                            │
├─────────────────────────────────────────────────────────────┤
│ Generate for each doctor:                                   │
│                                                             │
│ • Daily patient alert summary                               │
│ • High-risk patient list requiring attention                │
│ • Treatment gap report                                      │
│ • Screening compliance report                               │
│ • Population risk distribution update                       │
│                                                             │
│ All reports ready when clinic opens at 8:00 AM              │
└─────────────────────────────────────────────────────────────┘
```

---

### Patient Classification: Algorithm vs AI

**IMPORTANT DISTINCTION**: Patient risk classification in RENALGUARD AI uses **validated clinical algorithms**, NOT artificial intelligence. AI is used only for interpretation and communication.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLASSIFICATION: ALGORITHM VS AI                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ALGORITHMIC (Deterministic)                       │   │
│  │                    ✓ Reproducible, Auditable, Evidence-Based         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  GCUA RISK CALCULATION                                               │   │
│  │  ├── Nelson/CKD-PC Equation (validated on 5M+ patients)             │   │
│  │  │   Formula: logit = β₀ + β₁(age) + β₂(eGFR) + β₃(uACR) + ...     │   │
│  │  │   Output: 5-year renal risk percentage                           │   │
│  │  │                                                                   │   │
│  │  ├── AHA PREVENT Equation (2024 guidelines)                         │   │
│  │  │   Formula: PCE with eGFR/uACR integration                        │   │
│  │  │   Output: 10-year CVD risk percentage                            │   │
│  │  │                                                                   │   │
│  │  └── Bansal Mortality Score                                         │   │
│  │      Formula: Points-based geriatric assessment                     │   │
│  │      Output: 5-year mortality risk percentage                       │   │
│  │                                                                      │   │
│  │  KDIGO CLASSIFICATION                                                │   │
│  │  ├── GFR Category: Direct threshold lookup                          │   │
│  │  │   G1: ≥90, G2: 60-89, G3a: 45-59, G3b: 30-44, G4: 15-29, G5: <15│   │
│  │  │                                                                   │   │
│  │  └── Albuminuria Category: Direct threshold lookup                  │   │
│  │      A1: <30, A2: 30-300, A3: >300 mg/g                             │   │
│  │                                                                      │   │
│  │  PHENOTYPE ASSIGNMENT                                                │   │
│  │  └── Rule-based decision tree (if renal≥15% AND cvd≥20% → Type I)  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    AI-POWERED (Claude Sonnet 4.5)                    │   │
│  │                    Used for Interpretation & Communication Only      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  WHAT AI DOES:                                                       │   │
│  │  ├── Explains classification results in natural language            │   │
│  │  │   "This patient is Phenotype I because both renal and CVD        │   │
│  │  │    risks exceed thresholds, indicating accelerated aging..."     │   │
│  │  │                                                                   │   │
│  │  ├── Answers doctor questions about patient care                    │   │
│  │  │   "Should I start this patient on an SGLT2 inhibitor?"          │   │
│  │  │                                                                   │   │
│  │  ├── Generates clinical narratives for significant changes          │   │
│  │  │   "eGFR declined from 58 to 52 over 3 months, suggesting..."    │   │
│  │  │                                                                   │   │
│  │  └── Provides treatment recommendations in conversational format    │   │
│  │      "Based on KDIGO 2024 guidelines, I recommend..."               │   │
│  │                                                                      │   │
│  │  WHAT AI DOES NOT DO:                                                │   │
│  │  ✗ Calculate risk scores (uses algorithms)                          │   │
│  │  ✗ Assign KDIGO stages (uses thresholds)                            │   │
│  │  ✗ Determine phenotypes (uses decision rules)                       │   │
│  │  ✗ Make final treatment decisions (doctor decides)                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### New Patient Workflow: From Registration to Classification

When a new patient enters the system, here's the complete workflow:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEW PATIENT CLASSIFICATION WORKFLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: PATIENT REGISTRATION                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Source: ADT feed from EHR or manual entry                           │   │
│  │ Data captured: Name, DOB, Sex, MRN, Insurance, Contact              │   │
│  │ Trigger: ADT^A04 (Register) or ADT^A01 (Admit) message              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               │                                             │
│                               ▼                                             │
│  STEP 2: INITIAL DATA COLLECTION                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ System queries EHR for:                                              │   │
│  │ • Latest lab results (eGFR, uACR, creatinine, HbA1c)                │   │
│  │ • Active conditions (diabetes, hypertension, CVD, heart failure)    │   │
│  │ • Current medications (SGLT2i, RASi, statins)                       │   │
│  │ • Vital signs (blood pressure, weight, height)                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               │                                             │
│                               ▼                                             │
│  STEP 3: ELIGIBILITY CHECK (Algorithmic)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Patient Age ≥ 60?  ───YES───►  Has eGFR data?  ───YES───►         │   │
│  │        │                              │                              │   │
│  │        NO                             NO                             │   │
│  │        │                              │                              │   │
│  │        ▼                              ▼                              │   │
│  │   Standard risk              Flag for lab order                      │   │
│  │   screening only             (eGFR + uACR needed)                    │   │
│  │                                                                      │   │
│  │   IF eGFR ≥ 60: Eligible for GCUA assessment                        │   │
│  │   IF eGFR < 60: Direct to KDIGO classification (has CKD)            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               │                                             │
│                               ▼                                             │
│  STEP 4: RISK CLASSIFICATION (Algorithmic - No AI)                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   PATH A: Non-CKD Patient (eGFR ≥ 60, Age 60+)                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ GCUA ASSESSMENT (Pure Algorithm)                            │   │   │
│  │   │                                                             │   │   │
│  │   │ Input variables:                                            │   │   │
│  │   │ • Age, Sex, Race                                            │   │   │
│  │   │ • eGFR, uACR (if available)                                 │   │   │
│  │   │ • Diabetes (yes/no), Hypertension (yes/no)                  │   │   │
│  │   │ • CVD history, Heart failure                                │   │   │
│  │   │ • Current medications (SGLT2i, RASi)                        │   │   │
│  │   │                                                             │   │   │
│  │   │ Calculations performed:                                     │   │   │
│  │   │ 1. Nelson renal_risk = sigmoid(Σ βᵢxᵢ) × 100%              │   │   │
│  │   │ 2. PREVENT cvd_risk = PCE_formula(inputs) × 100%           │   │   │
│  │   │ 3. Bansal mortality = points_lookup(inputs) × 100%         │   │   │
│  │   │                                                             │   │   │
│  │   │ Phenotype assignment (rule-based):                          │   │   │
│  │   │ IF mortality ≥ 50%           → Phenotype IV (Senescent)    │   │   │
│  │   │ ELSE IF renal ≥15% AND cvd ≥20% → Phenotype I (Accelerated)│   │   │
│  │   │ ELSE IF renal ≥15% AND cvd <7.5% → Phenotype II (Silent)   │   │   │
│  │   │ ELSE IF renal <5% AND cvd ≥20%  → Phenotype III (Vascular) │   │   │
│  │   │ ELSE IF renal 5-14.9%           → Moderate Risk            │   │   │
│  │   │ ELSE                            → Low Risk                  │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   PATH B: CKD Patient (eGFR < 60 OR uACR ≥ 30 persistent)           │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │ KDIGO CLASSIFICATION (Pure Algorithm)                       │   │   │
│  │   │                                                             │   │   │
│  │   │ GFR Category (direct threshold):                            │   │   │
│  │   │ • G1: eGFR ≥ 90    → Normal or high                        │   │   │
│  │   │ • G2: eGFR 60-89   → Mildly decreased                      │   │   │
│  │   │ • G3a: eGFR 45-59  → Mild-moderate decrease                │   │   │
│  │   │ • G3b: eGFR 30-44  → Moderate-severe decrease              │   │   │
│  │   │ • G4: eGFR 15-29   → Severely decreased                    │   │   │
│  │   │ • G5: eGFR < 15    → Kidney failure                        │   │   │
│  │   │                                                             │   │   │
│  │   │ Albuminuria Category (direct threshold):                    │   │   │
│  │   │ • A1: uACR < 30     → Normal                               │   │   │
│  │   │ • A2: uACR 30-300   → Moderately increased                 │   │   │
│  │   │ • A3: uACR > 300    → Severely increased                   │   │   │
│  │   │                                                             │   │   │
│  │   │ Combined Risk (lookup table):                               │   │   │
│  │   │ • Green: Low risk                                          │   │   │
│  │   │ • Yellow: Moderate risk                                    │   │   │
│  │   │ • Orange: High risk                                        │   │   │
│  │   │ • Red: Very high risk                                      │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               │                                             │
│                               ▼                                             │
│  STEP 5: STORE RESULTS                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Database tables updated:                                             │   │
│  │ • patient_risk_factors: Risk scores, phenotype                      │   │
│  │ • patient_gcua_assessments: Full GCUA results (non-CKD)             │   │
│  │ • ckd_patient_data: KDIGO stage, severity (CKD patients)            │   │
│  │ • non_ckd_patient_data: Screening status (non-CKD patients)         │   │
│  │                                                                      │   │
│  │ Classification timestamp recorded for audit trail                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               │                                             │
│                               ▼                                             │
│  STEP 6: ALERT IF HIGH RISK                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ IF Phenotype I or II → Generate HIGH priority alert                 │   │
│  │ IF KDIGO Very High   → Generate HIGH priority alert                 │   │
│  │ IF eGFR < 30         → Generate CRITICAL alert + nephrology flag    │   │
│  │                                                                      │   │
│  │ Alert sent to assigned doctor for review                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               │                                             │
│                               ▼                                             │
│  STEP 7: AI INTERPRETATION (Optional, On-Demand)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ When doctor opens patient record or asks a question:                │   │
│  │                                                                      │   │
│  │ AI (Claude) generates natural language summary:                     │   │
│  │                                                                      │   │
│  │ "Mrs. Johnson is a 72-year-old female classified as GCUA            │   │
│  │  Phenotype I (Accelerated Ager) based on:                           │   │
│  │  • 5-year renal risk: 18.3% (High)                                  │   │
│  │  • 10-year CVD risk: 24.7% (High)                                   │   │
│  │  • 5-year mortality: 12.4% (Low)                                    │   │
│  │                                                                      │   │
│  │  Recommendation: Consider initiating SGLT2 inhibitor and RAS        │   │
│  │  inhibitor therapy. Home monitoring with Minuteful Kidney           │   │
│  │  recommended for early CKD detection."                              │   │
│  │                                                                      │   │
│  │ ⚠️ AI explanation uses pre-calculated algorithmic results           │   │
│  │    AI does NOT recalculate or modify the classification             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Principles:**

| Aspect | Approach | Why |
|--------|----------|-----|
| **Risk Calculation** | Pure algorithm | Reproducible, auditable, based on validated clinical studies |
| **Classification** | Rule-based thresholds | Consistent with KDIGO 2024 guidelines, no ambiguity |
| **Phenotype Assignment** | Decision tree | Deterministic, same inputs always produce same output |
| **Interpretation** | AI (Claude) | Natural language explanations help doctors understand results |
| **Recommendations** | AI with MCP tools | AI consults real data before making suggestions |
| **Final Decisions** | Doctor | AI assists, doctor decides |

**Audit Trail:**
- Every classification includes timestamp and algorithm version
- Risk score inputs are stored for reproducibility
- Any manual overrides are logged with reason
- AI interactions are recorded for compliance

---

## Where AI Is Used in RENALGUARD

RENALGUARD AI leverages artificial intelligence at multiple levels to provide comprehensive clinical decision support:

### 1. AI-Powered Clinical Analysis (Anthropic Claude)

**Core AI Engine**: Claude Sonnet 4.5 by Anthropic powers the intelligent analysis system.

- **Patient Update Analysis**: Every lab result triggers AI analysis to detect clinically significant changes
- **Treatment Recommendations**: AI validates recommendations against current treatment status and contraindications
- **Doctor Assistant Chat**: Natural language conversations about patient care, treatment options, and clinical guidelines
- **Transition Detection**: AI explains when patients move from non-CKD to CKD status and its clinical implications

### 2. Risk Prediction Models

**GCUA - Geriatric Cardiorenal Unified Assessment (For Patients 60+)**

GCUA is a comprehensive risk stratification system integrating three validated prediction models:

**Module 1: Nelson/CKD-PC Incident CKD Equation (2019)**
- Predicts 5-year probability of developing CKD (eGFR < 60)
- Derived from 34 multinational cohorts with >5 million individuals
- C-statistic: 0.845 (non-diabetic), 0.801 (diabetic)
- Risk categories: Low (<5%), Moderate (5-14.9%), High (≥15%)

**Module 2: AHA PREVENT CVD Risk Equation (2024)**
- 10-year risk of total cardiovascular disease events
- Integrates the Cardiovascular-Kidney-Metabolic (CKM) syndrome
- Key advancement over PCE: Includes eGFR/uACR as core variables
- Risk categories: Low (<5%), Borderline (5-7.4%), Intermediate (7.5-19.9%), High (≥20%)

**Module 3: Bansal Geriatric Mortality Score (2015)**
- Predicts 5-year all-cause mortality in older adults
- Addresses the "competing risk" problem in geriatric patients
- Risk categories: Low (<15%), Moderate (15-29.9%), High (30-49.9%), Very High (≥50%)

**GCUA Phenotype Classification:**
| Phenotype | Name | Criteria | Clinical Strategy |
|-----------|------|----------|-------------------|
| I | Accelerated Ager | High renal (≥15%) AND High CVD (≥20%) | Aggressive dual intervention |
| II | Silent Renal | High renal (≥15%) AND Low CVD (<7.5%) | Nephroprotection priority |
| III | Vascular Dominant | Low renal (<5%) AND High CVD (≥20%) | CVD prevention protocols |
| IV | The Senescent | Mortality risk ≥50% | Quality of life focus, deprescribing |
| Moderate | Cardiorenal Moderate | Moderate renal (5-14.9%) | Preventive strategies |
| Low | Low Risk | Low across all domains | Routine care |

**KDIGO 2024 Risk Stratification**
- Automatic classification based on eGFR and uACR
- Heat map visualization: Green (low risk) to Red (very high risk)
- Determines monitoring frequency and treatment urgency

---

## Risk Stratification Maps

### Non-CKD Patients: GCUA Phenotype Risk Map (Patients 60+)

For patients **without diagnosed CKD** (eGFR ≥ 60), the GCUA system classifies risk across three dimensions:

```
                           RENAL RISK (Nelson/CKD-PC 5-Year)
                    Low (<5%)      Moderate (5-14.9%)    High (≥15%)
                 ┌──────────────┬──────────────────────┬──────────────────┐
    High (≥20%)  │ PHENOTYPE III│    MODERATE RISK     │   PHENOTYPE I    │
   C             │   Vascular   │                      │  Accelerated     │
   V             │   Dominant   │  ● Elevated CVD      │     Ager         │
   D             │              │  ● Moderate renal    │                  │
                 │ ● Low renal  │  ● Preventive care   │ ● Highest risk   │
   R             │ ● High CVD   │                      │ ● Dual therapy   │
   I             │ ● Statin +   │                      │ ● SGLT2i + RASi  │
   S             │   BP control │                      │ ● Home monitor   │
   K             ├──────────────┼──────────────────────┼──────────────────┤
                 │              │                      │   PHENOTYPE II   │
   (AHA          │   LOW RISK   │    MODERATE RISK     │  Silent Renal    │
   PREVENT       │              │                      │                  │
   10-Year)      │ ● Routine    │  ● Moderate renal    │ ● High renal     │
                 │   care       │  ● Borderline CVD    │ ● Low CVD        │
    Low (<7.5%)  │ ● Annual     │  ● Lifestyle mods    │ ● Nephroprotect  │
                 │   checkup    │                      │ ● Home monitor   │
                 └──────────────┴──────────────────────┴──────────────────┘

    ⚠️ PHENOTYPE IV (The Senescent): Overrides above if Bansal mortality ≥50%
       → Quality of life focus, deprescribing consideration, palliative approach
```

**Non-CKD Risk Actions by Phenotype:**

| Phenotype | Risk Level | Renal Risk | CVD Risk | Mortality | Recommended Actions |
|-----------|------------|------------|----------|-----------|---------------------|
| **I - Accelerated Ager** | 🔴 CRITICAL | ≥15% | ≥20% | Any | SGLT2i + RASi + Statin, Home monitoring, Nephrology consult |
| **II - Silent Renal** | 🟠 HIGH | ≥15% | <7.5% | Any | SGLT2i + RASi, Home monitoring, Quarterly labs |
| **III - Vascular Dominant** | 🟠 HIGH | <5% | ≥20% | Any | Statin + BP control, Cardiology focus, Biannual labs |
| **IV - The Senescent** | ⚫ SPECIAL | Any | Any | ≥50% | Quality of life, Deprescribing, Avoid aggressive Tx |
| **Moderate** | 🟡 MODERATE | 5-14.9% | 7.5-19.9% | <50% | Preventive strategies, Lifestyle mods, Biannual labs |
| **Low** | 🟢 LOW | <5% | <7.5% | <15% | Routine care, Annual checkup, Standard screening |

---

### CKD Patients: KDIGO Heat Map Risk Matrix

For patients **with diagnosed CKD**, the KDIGO 2024 guidelines classify risk using eGFR and albuminuria:

```
                              ALBUMINURIA CATEGORIES (uACR mg/g)
                     A1                    A2                    A3
                  Normal           Moderately Increased    Severely Increased
                   <30                  30-300                  >300
              ┌─────────────────┬─────────────────────┬─────────────────────┐
    G1        │                 │                     │                     │
    ≥90       │  🟢 LOW RISK    │   🟡 MODERATE       │   🟠 HIGH           │
    Normal    │                 │                     │                     │
              │  Monitor: 1/yr  │  Monitor: 1/yr      │  Monitor: 2/yr      │
              ├─────────────────┼─────────────────────┼─────────────────────┤
    G2        │                 │                     │                     │
    60-89     │  🟢 LOW RISK    │   🟡 MODERATE       │   🟠 HIGH           │
    Mild ↓    │                 │                     │                     │
              │  Monitor: 1/yr  │  Monitor: 1/yr      │  Monitor: 2/yr      │
  e ├─────────────────┼─────────────────────┼─────────────────────┤
  G G3a       │                 │                     │                     │
  F 45-59     │  🟡 MODERATE    │   🟠 HIGH           │   🔴 VERY HIGH      │
  R Mild-Mod  │                 │                     │                     │
              │  Monitor: 1/yr  │  Monitor: 2/yr      │  Monitor: 3/yr      │
              ├─────────────────┼─────────────────────┼─────────────────────┤
    G3b       │                 │                     │                     │
    30-44     │  🟠 HIGH        │   🔴 VERY HIGH      │   🔴 VERY HIGH      │
    Mod-Sev   │                 │                     │                     │
              │  Monitor: 2/yr  │  Monitor: 3/yr      │  Monitor: 4/yr      │
              ├─────────────────┼─────────────────────┼─────────────────────┤
    G4        │                 │                     │                     │
    15-29     │  🔴 VERY HIGH   │   🔴 VERY HIGH      │   🔴 VERY HIGH      │
    Severe    │                 │   Nephrology        │   Nephrology        │
              │  Monitor: 3/yr  │  Monitor: 4/yr      │  Monitor: 4+/yr     │
              ├─────────────────┼─────────────────────┼─────────────────────┤
    G5        │                 │                     │                     │
    <15       │  🔴 VERY HIGH   │   🔴 VERY HIGH      │   🔴 VERY HIGH      │
    Failure   │   Nephrology    │   Nephrology        │   Nephrology        │
              │  RRT Planning   │  RRT Planning       │  RRT Planning       │
              └─────────────────┴─────────────────────┴─────────────────────┘

    Legend: Monitor = recommended lab frequency per year
            RRT = Renal Replacement Therapy (dialysis/transplant)
```

**CKD Stage Risk Actions:**

| Stage | eGFR Range | Risk Level | Treatment Priority | Key Actions |
|-------|------------|------------|-------------------|-------------|
| **G1** | ≥90 | 🟢-🟠 Varies by uACR | Address cause | Treat underlying condition, BP control, Annual monitoring |
| **G2** | 60-89 | 🟢-🟠 Varies by uACR | Early intervention | Lifestyle mods, RASi if proteinuria, Annual monitoring |
| **G3a** | 45-59 | 🟡-🔴 Moderate-Very High | Active nephroprotection | RASi + SGLT2i, Avoid nephrotoxins, 1-3x/year monitoring |
| **G3b** | 30-44 | 🟠-🔴 High-Very High | Aggressive treatment | RASi + SGLT2i, Dose adjust meds, Consider MRA, 2-4x/year |
| **G4** | 15-29 | 🔴 Very High | Pre-dialysis care | Nephrology co-management, RRT education, 3-4x/year |
| **G5** | <15 | 🔴 Critical | RRT planning | Dialysis/transplant planning, Vascular access, Monthly |

**Albuminuria Impact on Treatment:**

| Category | uACR (mg/g) | Risk Modifier | Treatment Implications |
|----------|-------------|---------------|----------------------|
| **A1** | <30 | Baseline | Standard care, focus on eGFR trends |
| **A2** | 30-300 | +1 Risk Level | RASi strongly indicated, Target BP <130/80 |
| **A3** | >300 | +2 Risk Levels | Aggressive RASi + SGLT2i, Consider MRA, Monthly uACR |

---

### Combined Risk: Transition from Non-CKD to CKD

When a non-CKD patient develops CKD, their risk classification transitions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PATIENT JOURNEY: RISK EVOLUTION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   NON-CKD PHASE                         CKD PHASE                           │
│   (GCUA Classification)                 (KDIGO Classification)              │
│                                                                             │
│   ┌───────────────┐                     ┌───────────────┐                   │
│   │ PHENOTYPE I   │ ──── Develops ────► │ Stage 3a+     │                   │
│   │ Accelerated   │      CKD            │ High/Very High│                   │
│   │ Ager          │                     │ Risk          │                   │
│   └───────────────┘                     └───────────────┘                   │
│   Action: Prevented                     Action: Nephrology                  │
│   with early Tx                         co-management                       │
│                                                                             │
│   ┌───────────────┐                     ┌───────────────┐                   │
│   │ PHENOTYPE II  │ ──── Develops ────► │ Stage 2-3a    │                   │
│   │ Silent Renal  │      CKD            │ Moderate/High │                   │
│   │               │                     │ Risk          │                   │
│   └───────────────┘                     └───────────────┘                   │
│   Action: Early                         Action: Continue                    │
│   nephroprotection                      nephroprotection                    │
│                                                                             │
│   ┌───────────────┐                     ┌───────────────┐                   │
│   │ MODERATE      │ ──── Develops ────► │ Stage 1-2     │                   │
│   │ RISK          │      CKD            │ Low/Moderate  │                   │
│   │               │                     │ Risk          │                   │
│   └───────────────┘                     └───────────────┘                   │
│   Action: Preventive                    Action: Initiate                    │
│   strategies                            treatment                           │
│                                                                             │
│   ┌───────────────┐                                                         │
│   │ LOW RISK      │ ──── Rarely develops CKD with proper monitoring ────►   │
│   └───────────────┘                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight**: RENALGUARD AI preserves the patient's GCUA phenotype history even after CKD diagnosis, allowing clinicians to understand the patient's complete cardiorenal risk trajectory.

### 3. Model Context Protocol (MCP) Clinical Tools

A comprehensive suite of 16+ specialized clinical decision support tools:

**Phase-Based Assessment:**
- `phase1_pre_diagnosis_risk`: 3-tier risk stratification for non-CKD patients
- `phase2_kdigo_classification`: KDIGO staging with trajectory analysis (RAPID/MODERATE/SLOW/STABLE)
- `phase3_treatment_decision`: Treatment eligibility and contraindication checking
- `phase4_adherence_monitoring`: MPR/PDC metrics and barrier identification

**Risk Prediction:**
- `comprehensive_ckd_analysis`: Master orchestrator for complete patient assessment
- `assess_gcua_risk`: GCUA cardiorenal assessment (Nelson, AHA PREVENT, Bansal)
- `predict_kidney_failure_risk`: KFRE 2-year and 5-year kidney failure predictions
- `calculate_egfr`: CKD-EPI equation with cystatin C alternative

**Medication & Safety:**
- `assess_treatment_options`: Jardiance, RAS inhibitor, statin eligibility
- `assess_medication_safety`: Dose adjustments, drug interactions, contraindications
- `composite_adherence_monitoring`: Multi-medication adherence tracking

**Monitoring & Compliance:**
- `analyze_adherence`: Medication and screening adherence patterns
- `check_screening_protocol`: Screening guideline compliance and gap detection

**Data & Reference:**
- `lab_results`: Historical lab value retrieval with trend analysis
- `patient_data`: Demographics, medications, comorbidity aggregation
- `population_stats`: Cohort analytics and outcome tracking
- `guidelines`: KDIGO guideline lookup and best practice protocols

### 4. How MCP Architecture Prevents AI Hallucination

**The Problem with General AI in Healthcare:**
Large Language Models (LLMs) can "hallucinate" - generating plausible-sounding but factually incorrect information. In healthcare, this could mean:
- Recommending medications the patient is already taking
- Missing critical lab abnormalities
- Suggesting treatments contraindicated by patient conditions
- Inventing patient history that doesn't exist

**Our Solution: Grounding AI in Real Patient Data**

RENALGUARD AI uses the **Model Context Protocol (MCP)** to eliminate hallucination by ensuring every AI response is grounded in actual patient data from the PostgreSQL database:

```
┌─────────────────────────────────────────────────────────────────┐
│                      DOCTOR'S QUESTION                          │
│        "Should I start this patient on an SGLT2 inhibitor?"     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE AI (Anthropic)                        │
│   Receives question + system prompt with clinical guidelines     │
│   DOES NOT GUESS - calls MCP tools to get real data             │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  MCP TOOL:    │   │  MCP TOOL:    │   │  MCP TOOL:    │
│ patient_data  │   │ lab_results   │   │ assess_       │
│               │   │               │   │ treatment_    │
│ Gets: age,    │   │ Gets: eGFR,   │   │ options       │
│ conditions,   │   │ uACR, trends, │   │               │
│ medications   │   │ recent labs   │   │ Checks:       │
│ from database │   │ from database │   │ eligibility,  │
│               │   │               │   │ contraindica- │
│               │   │               │   │ tions         │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                           │
│   Real patient data: observations, conditions, medications       │
│   Verified lab values with timestamps and units                  │
│   Treatment history and adherence records                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI RESPONSE (GROUNDED)                        │
│   "Based on the patient's eGFR of 45 (from lab on Nov 15),      │
│    I recommend starting empagliflozin. Patient is NOT currently  │
│    on SGLT2i and eGFR > 20 meets eligibility criteria."         │
└─────────────────────────────────────────────────────────────────┘
```

**Why This Architecture Eliminates Hallucination:**

| Without MCP | With MCP (RENALGUARD) |
|-------------|----------------------|
| AI might guess "patient probably has diabetes" | MCP tool queries database: patient HAS diabetes (ICD-10: E11.9) |
| AI might say "consider checking eGFR" | MCP returns actual eGFR: 45 ml/min from 2025-11-15 lab |
| AI might miss that patient is already on medication | MCP checks active medications: already on lisinopril 10mg |
| AI might recommend wrong dosage | MCP returns renal dose adjustment based on actual eGFR |
| AI might miss contraindications | MCP checks conditions table for allergies, interactions |

**Technical Implementation:**

1. **Structured Tool Calls**: Every MCP tool has a defined JSON schema for inputs and outputs, ensuring data consistency
2. **Database-First**: All patient information comes directly from PostgreSQL queries, not AI memory or training data
3. **Audit Trail**: Every tool call is logged, providing traceability for clinical decisions
4. **Fail-Safe Design**: If database is unavailable, AI explicitly states "unable to retrieve patient data" rather than guessing

**Example: How a Treatment Decision Works**

When a doctor asks "Should I start treatment?", the AI:

1. **Calls `patient_data`** → Gets patient ID, age, current medications, conditions
2. **Calls `lab_results`** → Gets latest eGFR, uACR, creatinine, potassium with dates
3. **Calls `phase3_treatment_decision`** → Evaluates eligibility against KDIGO criteria
4. **Calls `assess_medication_safety`** → Checks for drug interactions, contraindications
5. **Synthesizes response** → All recommendations cite actual values from database

**Clinical Safety Guarantee:**
- Every lab value in the AI response exists in the database
- Every medication mentioned is in the patient's record
- Every recommendation is validated against real clinical data
- No invented patient history or fabricated test results

---

## Early Diagnosis of CKD: The Screening Workflow

RENALGUARD AI implements a systematic approach to early CKD detection:

### Step 1: Risk Identification in Non-CKD Patients (60+ years)

For patients 60+ without diagnosed CKD, the system automatically performs **GCUA Assessment**:

1. **Nelson/CKD-PC Renal Risk**: Identifies patients at risk of developing CKD
   - Age, sex, eGFR, uACR, diabetes, hypertension, CVD, heart failure
   - Protective factors: SGLT2 inhibitors (-35%), RAS inhibitors (-20%)
   - High risk (≥15%): Immediate intervention recommended

2. **AHA PREVENT CVD Risk**: Predicts cardiovascular events
   - Integrates kidney function (eGFR, uACR) as core variables
   - Considers CKM syndrome (Cardiovascular-Kidney-Metabolic)
   - High risk (≥20%): Aggressive risk factor modification

3. **Bansal Mortality Risk**: Assesses competing mortality risk
   - Critical for treatment intensity decisions in elderly
   - High risk (≥50%): Quality of life focus over aggressive intervention

### Step 2: Phenotype-Based Recommendations

Based on GCUA phenotype, the system recommends:

| Phenotype | Home Monitoring | Treatment Priority |
|-----------|-----------------|-------------------|
| I (Accelerated Ager) | Recommended | SGLT2i + RAS inhibitor + Statin |
| II (Silent Renal) | Recommended | SGLT2i + RAS inhibitor (nephroprotection) |
| III (Vascular Dominant) | If high renal risk | Statin + BP control |
| IV (Senescent) | If renal ≥15% or CVD ≥20% | Quality of life focus, deprescribing |
| Moderate | If high CVD risk | Preventive strategies |
| Low | Not required | Routine care |

### Step 3: CKD Diagnosis and Classification

When lab results indicate CKD (eGFR < 60 OR uACR >= 30 for 3+ months):

1. **Automatic KDIGO Classification**:
   - GFR Category: G1-G5 based on eGFR thresholds
   - Albuminuria Category: A1-A3 based on uACR levels
   - Combined Risk Level: Low, Moderate, High, Very High

2. **CKD Stage Assignment**:
   - Stage 1: Normal/High GFR with kidney damage
   - Stage 2: Mildly decreased (eGFR 60-89)
   - Stage 3a: Mild-moderate decrease (eGFR 45-59)
   - Stage 3b: Moderate-severe decrease (eGFR 30-44)
   - Stage 4: Severely decreased (eGFR 15-29)
   - Stage 5: Kidney failure (eGFR < 15)

3. **Transition Detection**:
   - System automatically identifies when patients move from non-CKD to CKD
   - Preserves GCUA phenotype and risk data for comprehensive analysis
   - AI generates transition-focused analysis explaining clinical significance

---

## Monitoring Process: Dual-Track Surveillance

RENALGUARD AI uses two complementary monitoring approaches:

### Minuteful Kidney: Home-Based Monitoring

**What It Is**: FDA-cleared smartphone-based home urine ACR test

**How It Works**:
1. Patient performs urine test at home using Minuteful Kidney device
2. Results are uploaded to the system automatically
3. AI analyzes trends and detects concerning changes
4. Alerts generated if uACR increases > 30%

**Risk-Based Monitoring Recommendations**:
Home monitoring is recommended based on actual risk levels, not just phenotype:

| Patient Profile | Monitoring Recommendation |
|-----------------|--------------------------|
| Phenotype I/II (High renal risk ≥15%) | Recommended - essential for early detection |
| Phenotype IV with renal ≥15% or CVD ≥20% | Recommended - low-burden, valuable for trends |
| Moderate with CVD ≥20% | Recommended - cardiorenal syndrome risk |
| Low risk patients | Not required - standard clinic monitoring |

**Monitoring Frequencies**:
- Weekly: For high-risk or newly treated patients
- Biweekly: For moderate-risk patients
- Monthly: For stable patients on treatment
- Quarterly: For low-risk monitored patients

**Benefits**:
- No lab visits required
- More frequent monitoring catches changes earlier
- Patient engagement in their own care
- Real-time trend detection
- Low-burden even for elderly/senescent patients

### Blood Tests: Laboratory Monitoring

**10 Key Biomarkers Tracked**:

| Biomarker | Clinical Significance | Alert Threshold |
|-----------|----------------------|-----------------|
| eGFR | Kidney filtration capacity | >= 1.5 ml/min change OR > 2% variation |
| uACR | Protein leakage (kidney damage) | > 10% change |
| Serum Creatinine | Kidney function marker | > 10% change |
| BUN | Nitrogen waste levels | > 15% change |
| Blood Pressure | Cardiovascular risk | > 10 mmHg change OR abnormal (< 90 or > 160) |
| HbA1c | Glycemic control | >= 0.3% change or > 8% (poor control) |
| Glucose | Blood sugar | > 20% change or out of range |
| Hemoglobin | Anemia detection | < 10 g/dL or > 5% change |
| Heart Rate | Cardiovascular status | > 15% change |
| Oxygen Saturation | Respiratory function | < 95% |

**Smart Alert System**:
- Only clinically significant changes generate alerts
- Evidence-based thresholds prevent alert fatigue
- Priority levels: Critical, High, Moderate
- Recommended interventions included with each alert

---

## Treatment Monitoring: Adherence and Outcomes

### Medication Adherence Tracking

**Medication Possession Ratio (MPR)** calculation:

```
MPR = (Total Days Supply) / (Days in Observation Period) x 100%
```

**Adherence Categories**:
| Category | MPR Range | Action |
|----------|-----------|--------|
| Good | > 80% | Continue current approach |
| Suboptimal | 50-80% | Medication counseling, simplify regimen |
| Poor | < 50% | Investigate barriers, consider alternatives |

**Tracked Medications**:
- **SGLT2 Inhibitors**: empagliflozin (Jardiance), dapagliflozin (Farxiga)
- **RAS Inhibitors**: ACE inhibitors (lisinopril, enalapril), ARBs (losartan, valsartan)
- **Mineralocorticoid Receptor Antagonists (MRAs)**: spironolactone, finerenone

### Jardiance Prescription Management

Complete tracking of SGLT2 inhibitor therapy:
- Prescription dates and dosages (10mg or 25mg)
- Prescriber information (name, NPI)
- Treatment indication (diabetes, CKD, heart failure)
- Currently taking status
- Discontinuation dates and reasons

### Assessment of Treatment Response

#### For Treated Patients: Improvement Detection

The system tracks response to therapy:

| Metric | Improvement Indicator | Clinical Implication |
|--------|----------------------|---------------------|
| eGFR | Increase >= 1.5 ml/min | Treatment is stabilizing kidney function |
| uACR | Decrease > 10% | Albuminuria improving, kidney protection working |
| Health State | Move to better KDIGO stage | Disease progression halted |
| Blood Pressure | Achieving < 130/80 mmHg | Cardiovascular risk reduced |
| HbA1c | Decrease toward target | Glycemic control improving |

**Positive Response Actions**:
- Continue current regimen
- Consider dose optimization
- Extend monitoring intervals
- Document treatment success

#### For Treated Patients: Worsening Detection

| Metric | Worsening Indicator | Recommended Action |
|--------|---------------------|-------------------|
| eGFR | Decline > 10% from baseline | Evaluate for acute causes, consider nephrology referral |
| uACR | Increase > 25% | Intensify therapy, check adherence |
| Health State | Deterioration to worse stage | Urgent review, add therapies |
| Blood Pressure | Persistent > 140/90 mmHg | Add antihypertensive agents |

**Worsening Response Actions**:
- Check medication adherence
- Review for drug interactions
- Consider therapy intensification
- Schedule urgent follow-up
- Refer to nephrology if G4-G5 or rapid decline

### Assessment for Non-Treated Patients

#### Improvement in Non-Treated Patients

Possible causes for spontaneous improvement:
- Resolution of acute kidney injury
- Lifestyle modifications (diet, exercise, hydration)
- Improved control of underlying conditions (diabetes, hypertension)
- Discontinuation of nephrotoxic medications

**Actions for Improving Non-Treated Patients**:
- Document positive trends
- Encourage continued lifestyle modifications
- Consider preventive therapy if still at risk
- Continue monitoring to confirm sustained improvement

#### Worsening in Non-Treated Patients

This is a **critical indicator** requiring immediate attention:

| Scenario | Priority | Recommended Action |
|----------|----------|-------------------|
| eGFR decline > 10% | HIGH | Initiate RAS inhibitor, consider SGLT2i |
| New or worsening proteinuria | HIGH | Start ACE/ARB therapy |
| Transition to CKD diagnosis | CRITICAL | Full KDIGO staging, treatment plan |
| Rapid progression (> 5 ml/min/year) | CRITICAL | Urgent nephrology referral |

**Worsening Non-Treated Patient Actions**:
- Immediate treatment initiation per KDIGO guidelines
- RAS inhibitor for albuminuria (uACR >= 30)
- SGLT2 inhibitor for CKD Stage 2-4 (eGFR > 20)
- Nephrology referral for Stage 4-5
- Monthly monitoring until stable

---

## Clinical Decision Support: Next Steps for Each Patient

### AI-Powered Recommendations

For every patient, the system provides actionable next steps:

#### For High-Risk Non-CKD Patients
```
Patient: 65-year-old with diabetes, hypertension, SCORED = 5

AI Recommendation:
1. ORDER: eGFR and uACR laboratory tests (URGENT)
2. REASON: High SCORED indicates 20%+ chance of undetected CKD
3. IF CKD confirmed: Initiate RAS inhibitor + SGLT2 inhibitor
4. FOLLOW-UP: 2-4 weeks for lab results review
5. MONITOR: Consider Minuteful Kidney home monitoring
```

#### For Newly Diagnosed CKD
```
Patient: Stage 3a CKD, eGFR 52, uACR 85 mg/g, not on treatment

AI Recommendation:
1. INITIATE: ACE inhibitor or ARB (first-line for albuminuria)
2. ADD: SGLT2 inhibitor (cardio-renal protection)
3. TARGET: Blood pressure < 130/80 mmHg
4. MONITOR: eGFR/uACR every 3 months initially
5. CONSIDER: Minuteful Kidney for frequent home monitoring
6. REFER: Nephrology if eGFR < 30 or rapid decline
```

#### For Treated Patients with Worsening
```
Patient: Stage 3b CKD, on lisinopril, eGFR declined 55→48 in 3 months

AI Recommendation:
1. CHECK: Medication adherence (current MPR: 72% - suboptimal)
2. VERIFY: No nephrotoxic medications (NSAIDs, contrast)
3. ADD: SGLT2 inhibitor if not already on one
4. CONSIDER: Dose optimization of current RAS inhibitor
5. SCHEDULE: Follow-up in 4 weeks
6. REFER: Nephrology for evaluation of rapid progression
```

#### For Stable Treated Patients
```
Patient: Stage 2 CKD, on empagliflozin + losartan, eGFR stable at 68

AI Recommendation:
1. CONTINUE: Current regimen (good response)
2. MONITOR: eGFR/uACR every 6 months
3. MAINTAIN: Blood pressure at target
4. REINFORCE: Lifestyle modifications
5. NEXT REVIEW: 6 months
```

### Treatment Eligibility Assessment

The system automatically evaluates treatment options:

**Jardiance (Empagliflozin) Eligibility**:
- STRONG Indication: CKD Stage 2-4 (eGFR > 20), diabetes, heart failure
- MODERATE Indication: CKD without diabetes, eGFR > 20
- CONTRAINDICATED: eGFR < 20, recurrent genital infections
- MONITORING: Potassium levels, volume status

**RAS Inhibitor Eligibility**:
- STRONG Indication: Albuminuria (uACR >= 30), diabetes, hypertension
- CONTRAINDICATED: Pregnancy, bilateral renal artery stenosis
- MONITORING: Potassium, creatinine (watch for > 30% rise)

---

## Enabling Early Treatment: The Impact

### How RENALGUARD AI Enables Early Intervention

1. **Automated Screening**: Every patient assessed for CKD risk automatically
2. **Proactive Alerts**: System identifies at-risk patients before symptoms
3. **Evidence-Based Guidance**: KDIGO 2024 recommendations at your fingertips
4. **Treatment Gap Detection**: Flags eligible patients not on recommended therapy
5. **Trend Monitoring**: Catches progression early through continuous surveillance

### Clinical Benefits

| Benefit | Mechanism |
|---------|-----------|
| Earlier CKD Detection | SCORED screening identifies hidden disease |
| Faster Treatment Initiation | AI recommendations ready immediately |
| Better Adherence | MPR tracking identifies intervention opportunities |
| Reduced Progression | Proactive monitoring catches worsening early |
| Fewer Missed Patients | Automated alerts ensure no patient falls through cracks |

### Economic Benefits

| Outcome | Cost Impact |
|---------|-------------|
| Delay dialysis by 1 year | Save $90,000+ per patient |
| Prevent hospitalization | Save $15,000-50,000 per admission |
| Reduce nephrology referrals | Save $300-500 per unnecessary referral |
| Outpatient CKD management | 90% lower cost than inpatient care |

### Quality of Life Benefits

- **Preserved kidney function**: Patients maintain independence longer
- **Fewer symptoms**: Early treatment prevents uremia, anemia, bone disease
- **Better cardiovascular health**: RAS and SGLT2 inhibitors protect heart
- **Delayed dialysis**: Patients avoid life-altering treatment for years
- **Empowered patients**: Home monitoring engages patients in their care

---

## Core Features

### AI Doctor Assistant - Your Intelligent Clinical Partner

The AI Doctor Assistant is embedded directly in each patient's detail card, providing instant access to evidence-based recommendations.

**Key Capabilities:**
- **Patient-Context-Aware Conversations**: Automatically knows the patient's complete medical history, lab trends, current medications, GCUA phenotype, and risk classification
- **GCUA Phenotype Understanding**: Explains cardiorenal risk phenotypes including Senescent classification and treatment implications
- **Treatment Guidance**: Answers questions like "Should I start an SGLT2 inhibitor?" or "Should I monitor this patient at home?"
- **Clinical Guideline Integration**: Provides KDIGO 2024 recommendations tailored to each patient's specific situation
- **Automatic Retry Logic**: Handles API overload gracefully with exponential backoff (2s, 4s, 8s delays)
- **Plain-Text Optimized Responses**: Formats responses for optimal readability without markdown syntax

**Response Formatting:**
The AI uses a clean, readable format optimized for the chat interface:
- SECTION TITLES IN UPPERCASE
- Numbered lists (1. 2. 3.) for recommendations
- Arrow symbols (→) for sub-points and actions
- Line breaks for visual separation

**Sample Interactions:**
```
Doctor: "Should I start treating this patient?"

AI: PATIENT SUMMARY:
    Roger Campbell - 68-year-old with Type 2 diabetes and hypertension.

    CURRENT STATUS:
    1. CKD Stage: 3a (Moderate)
    2. eGFR: 52.3 ml/min/1.73m²
    3. uACR: 45 mg/g (A2 - Moderately increased albuminuria)
    4. Treatment Status: NOT ON TREATMENT

    RECOMMENDATIONS:
    1. INITIATE RAS Inhibitor (ACE-I or ARB)
       → Rationale: uACR >30 mg/g + diabetes/hypertension

    2. CONSIDER SGLT2 Inhibitor
       → Rationale: eGFR >20, proven cardio-renal protection

    3. INITIATE Home Monitoring
       → Recommend: Minuteful Kidney every 3 months

    FOLLOW-UP:
    Schedule review in 3 months to monitor for acute eGFR decline.
```

### Advanced Patient Management System

**Comprehensive Patient Dashboard:**
- **1000 Mock Patients**: Realistic CKD population with diverse clinical scenarios
- **Real-Time KDIGO Classification**: Automatic calculation based on eGFR and uACR
- **CKD Stage Tracking**: Monitors patients from Stage 1 (mild) to Stage 5 (kidney failure)
- **Smart Filtering**: Filter by CKD status, severity, treatment status, monitoring status, and recent updates

**Patient Detail View Includes:**
- Demographics and medical history
- Latest lab results with trend visualization
- KDIGO risk classification breakdown
- GCUA phenotype and cardiorenal risk assessment (for 60+ patients)
- Current medications and treatment status
- Home monitoring device status and recommendations
- AI-generated health state evolution timeline
- Embedded Doctor Assistant chat
- Recommended actions and clinical summaries

### Intelligent Lab Monitoring & Analysis

**Real-Time Continuous Monitoring:**
- Monitors **10 key biomarkers**: eGFR, uACR, serum creatinine, BUN, blood pressure, HbA1c, glucose, hemoglobin, heart rate, oxygen saturation
- **Background Processing**: Automatically analyzes every patient update without manual intervention
- **Clinical Significance Detection**: Only alerts on changes that matter clinically

### Proactive Monitoring & Smart Notifications

**Real-Time Patient Surveillance:**
- Continuous background monitoring of all patients
- Automatic analysis triggered by patient data updates
- No manual intervention required from doctors

**Priority-Based Alert System:**
- **CRITICAL**: Rapid eGFR decline, severe lab abnormalities, acute kidney injury
- **HIGH**: CKD progression, treatment gaps in high-risk patients, significant lab changes
- **MODERATE**: Routine monitoring reminders, follow-up scheduling

**Smart Alert Suppression:**
- No alerts for stable patients without significant changes
- Prevents alert fatigue
- Uses evidence-based clinical thresholds

### Doctor Management & Assignment

**7-Category Patient Segmentation:**
| Category | Description |
|----------|-------------|
| Non-CKD Low Risk | GCUA Low phenotype, minimal intervention needed |
| Non-CKD Moderate Risk | GCUA Moderate phenotype, preventive strategies |
| Non-CKD High Risk | GCUA Phenotype I/II/III, active intervention required |
| CKD Mild | Stage 1-2, early CKD management |
| CKD Moderate | Stage 3a-3b, active nephroprotection |
| CKD Severe | Stage 4, pre-dialysis care |
| Kidney Failure | Stage 5, dialysis/transplant planning |

**Doctor Assignment Features:**
- Bulk assignment of doctors to patient categories
- Primary and secondary doctor relationships
- External notification email lists for care coordination
- Per-doctor SMTP configuration for notifications
- Quiet hours enforcement for non-urgent alerts

### Analytics & Performance Tracking

**Doctor Performance Metrics:**
- Alert acknowledgment rate and response times
- Resolution rate and escalation tracking
- Percentile-based response time distribution (P50, P75, P95)

**Population Analytics:**
- Alert trends over configurable time periods (1-365 days)
- Most common alert types and frequencies
- Risk distribution across patient population
- Treatment pattern analysis

**Alert Lifecycle Tracking:**
- Creation → Viewed → Acknowledged → Resolved
- Time-to-acknowledge and time-to-resolve metrics
- Escalation rate monitoring for SLA compliance

### Email & Notification System

**Configurable Email Templates:**
- Per-doctor customizable notification templates
- Variable substitution: `{patient_name}`, `{mrn}`, `{value}`, `{unit}`, `{time_period}`
- HTML and plain-text formats
- Test email functionality with preview URLs

**Notification Types:**
- CKD transition alerts (non-CKD → CKD)
- Significant lab value changes
- Treatment adherence concerns
- Clinical alerts requiring action

**SMTP Configuration:**
- Per-doctor SMTP settings (host, port, credentials)
- Fallback to system default for unconfigured doctors
- Ethereal test accounts for development

### Silent Hunter Feature

**Identifying Data Gaps:**
- Detects patients eligible for GCUA but missing uACR data
- uACR is critical for accurate renal risk calculation
- Prompts for uACR testing to unlock full risk profile

**Clinical Value:**
- Many patients have eGFR but no albuminuria testing
- uACR can reveal "silent" kidney damage before eGFR decline
- Completing GCUA enables phenotype classification and treatment recommendations

---

## Technical Architecture

### Frontend Stack
- **React 19.0.0** - Latest UI framework with concurrent features
- **Vite 6.0.7** - Next-generation frontend tooling
- **TypeScript 5.9.3** - Strict type safety
- **Tailwind CSS 3.4.17** - Utility-first CSS framework

### Backend Stack
- **Node.js 20 LTS** - Long-term support runtime
- **Express 5.1.0** - Fast, minimalist web framework
- **TypeScript 5.9.3** - End-to-end type safety
- **PostgreSQL 16** - Robust relational database

### AI & Clinical Intelligence
- **Claude Sonnet 4.5** - State-of-the-art language model by Anthropic
- **Model Context Protocol (MCP)** - Standardized clinical decision support tool integration
- **KDIGO 2024 Guidelines** - Latest evidence-based CKD management protocols

### Database Schema (31 Migrations)

**Core Patient Data:**
- **patients**: Demographics, insurance, contact info, vitals
- **patient_risk_factors**: Clinical risk metrics, GCUA phenotype cache
- **observations**: Lab values with temporal tracking and triggers
- **conditions**: Active conditions with clinical status

**CKD Classification:**
- **ckd_patient_data**: KDIGO stage, severity, health state, treatment flags
- **non_ckd_patient_data**: Pre-CKD risk stratification, monitoring status
- **patient_gcua_assessments**: 3-module scores, phenotype, treatment recommendations

**Medication Tracking:**
- **jardiance_prescriptions**: Dosage (10mg/25mg), prescriber, start/end dates
- **jardiance_refills**: Refill history with gap analysis (expected vs actual)
- **jardiance_adherence**: MPR/PDC metrics by period
- **adherence_barriers**: Identified barriers with severity and resolution

**Doctor Management:**
- **doctors**: Profiles with specialty, contact, SMTP settings
- **doctor_patient_assignments**: Primary/secondary relationships
- **doctor_notifications**: Notification queue with priority levels

**Analytics & Communication:**
- **alert_analytics**: Alert lifecycle (create/view/acknowledge/resolve)
- **patient_health_state_comments**: Clinical notes with visibility control
- **email_templates**: Customizable per-doctor notification templates

**Database Views:**
- `gcua_population_statistics`: Phenotype distribution analytics
- `gcua_high_risk_patients`: Phenotype I and II patients
- `gcua_missing_uacr_patients`: Silent Hunter candidates

**Database Functions:**
- `get_latest_gcua_assessment()`: Retrieves most recent assessment
- Auto-update triggers for cascading risk factor updates

---

## Project Structure

```
/home/user/hack_BI/
├── backend/                           # Express + TypeScript API
│   ├── src/
│   │   ├── api/routes/
│   │   │   ├── patients.ts            # Patient management & filtering
│   │   │   ├── agent.ts               # AI Doctor Assistant chat
│   │   │   ├── gcua.ts                # GCUA risk assessment
│   │   │   ├── jardiance.ts           # Prescription, refill, adherence
│   │   │   ├── risk.ts                # Risk calculation & statistics
│   │   │   ├── doctors.ts             # Doctor profiles & assignments
│   │   │   ├── notifications.ts       # Alert notifications
│   │   │   ├── analytics.ts           # Performance metrics
│   │   │   ├── settings.ts            # Email & system configuration
│   │   │   └── init.ts                # Data seeding
│   │   ├── services/
│   │   │   ├── doctorAgent.ts         # Claude AI integration
│   │   │   ├── aiUpdateAnalysisService.ts  # AI lab analysis
│   │   │   ├── clinicalAlertsService.ts    # Alert generation
│   │   │   ├── patientMonitor.ts      # Real-time monitoring
│   │   │   ├── emailService.ts        # SMTP & notifications
│   │   │   ├── analyticsService.ts    # Alert lifecycle tracking
│   │   │   ├── healthStateCommentService.ts # Clinical notes
│   │   │   └── mcpClient.ts           # MCP tool integration
│   │   └── utils/
│   │       ├── kdigo.ts               # KDIGO 2024 classification
│   │       └── gcua.ts                # Nelson, AHA PREVENT, Bansal
│
├── frontend/                          # React + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx                    # Main application
│   │   ├── components/
│   │   │   ├── DoctorChatBar.tsx      # AI chat interface
│   │   │   ├── GCUARiskCard.tsx       # GCUA phenotype display
│   │   │   ├── GCUADashboard.tsx      # Population GCUA analytics
│   │   │   ├── PatientFilters.tsx     # Advanced filtering UI
│   │   │   ├── PatientTrendGraphs.tsx # eGFR/uACR visualization
│   │   │   ├── AdherenceCard.tsx      # MPR/PDC metrics display
│   │   │   ├── DoctorAssignmentInterface.tsx  # Bulk assignment UI
│   │   │   ├── Settings.tsx           # Email configuration
│   │   │   ├── EmailTemplateEditor.tsx # Template management
│   │   │   └── LandingPage.tsx        # System overview
│
├── mcp-server/                        # Clinical Decision Support
│   └── src/tools/
│       ├── comprehensiveCKDAnalysis.ts    # Master orchestrator
│       ├── phase1PreDiagnosisRisk.ts      # Pre-CKD screening
│       ├── phase2KDIGOClassification.ts   # KDIGO staging
│       ├── phase3TreatmentDecision.ts     # Treatment eligibility
│       ├── phase4AdherenceMonitoring.ts   # Adherence tracking
│       ├── gcuaAssessment.ts              # GCUA 3-module assessment
│       ├── predictKidneyFailureRisk.ts    # KFRE prediction
│       ├── assessMedicationSafety.ts      # Drug safety checking
│       ├── calculateEGFR.ts               # eGFR calculation
│       ├── compositeAdherenceMonitoring.ts # Multi-drug adherence
│       ├── checkScreeningProtocol.ts      # Protocol compliance
│       ├── labResults.ts                  # Lab data queries
│       ├── patientData.ts                 # Patient data aggregation
│       ├── populationStats.ts             # Cohort analytics
│       └── guidelines.ts                  # Clinical guidelines
│
├── infrastructure/
│   └── postgres/
│       └── migrations/                # 32 ordered migrations
│           ├── 001-009                # Core patient data
│           ├── 014-020                # Communication & tracking
│           ├── 021-029                # Doctor management
│           └── 030-032                # GCUA assessment
│
├── data/                              # Mock data & seed files
├── docs/                              # 40+ documentation files
├── docker-compose.yml                 # Production deployment
├── docker-compose.dev.yml             # Development setup
└── Dockerfile                         # Multi-stage container build
```

---

## Quick Start Guide

### Prerequisites

- **Docker 24+** and **Docker Compose 2.20+**
- **Git**
- **Anthropic API Key** (sign up at https://console.anthropic.com)

### 1. Clone Repository

```bash
git clone <repository-url>
cd hack_BI
```

### 2. Set Environment Variables

Create a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://healthcare_user:healthcare_pass@postgres:5432/healthcare_ai_db
NODE_ENV=production
PORT=3000
```

### 3. Start All Services

```bash
docker-compose up -d
docker-compose logs -f backend
curl http://localhost:3000/health
```

### 4. Access the Application

- **Frontend**: http://localhost:5173 (development) or http://localhost:8080 (production)
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### 5. Populate with Mock Data

```bash
curl -X POST http://localhost:3000/api/init/populate
```

---

## API Documentation

### Patient Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/patients` | GET | List all patients with KDIGO classification |
| `/api/patients/filter` | GET | Filter by CKD status, severity, treatment, monitoring |
| `/api/patients/:id` | GET | Full patient detail with risk assessment |
| `/api/patients/:id/update-records` | POST | Simulate new lab results |
| `/api/patients/:id/comments` | GET | Health state evolution timeline |
| `/api/patients/:id/assign-doctor` | POST | Assign doctor (primary/secondary) |
| `/api/patients/:id/doctors` | GET | Get assigned doctors |
| `/api/patients/:id/primary-doctor` | GET | Get primary doctor |

### Risk Assessment Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/risk/assessment/:patientId` | GET | Get risk evaluation |
| `/api/risk/calculate/:patientId` | POST | Recalculate risk |
| `/api/risk/bulk-calculate` | POST | Bulk risk calculation |
| `/api/risk/patients/high-risk` | GET | High-risk population |
| `/api/risk/statistics` | GET | Population statistics |

### GCUA Assessment Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gcua/assessment/:patientId` | GET | Get latest GCUA assessment |
| `/api/gcua/calculate/:patientId` | POST | Calculate new GCUA assessment |
| `/api/gcua/bulk-calculate` | POST | Recalculate all eligible patients |
| `/api/gcua/eligible-patients` | GET | List patients eligible for GCUA (60+, eGFR >60) |
| `/api/gcua/high-risk` | GET | Get Phenotype I and II patients |
| `/api/gcua/missing-uacr` | GET | Silent Hunter - patients needing uACR |
| `/api/gcua/statistics` | GET | Population statistics by phenotype |
| `/api/gcua/history/:patientId` | GET | Assessment history for patient |

### Jardiance & Adherence Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jardiance/prescriptions/:patientId` | GET | Get prescriptions |
| `/api/jardiance/prescriptions` | POST | Create prescription (10mg/25mg) |
| `/api/jardiance/prescriptions/:id/discontinue` | PUT | Stop treatment |
| `/api/jardiance/refills/:prescriptionId` | GET | Get refill history |
| `/api/jardiance/refills` | POST | Record refill with gap analysis |
| `/api/jardiance/adherence/:prescriptionId` | GET | Get adherence history |
| `/api/jardiance/adherence/calculate` | POST | Calculate MPR/PDC |
| `/api/jardiance/barriers/:prescriptionId` | GET | Get adherence barriers |
| `/api/jardiance/barriers` | POST | Record new barrier |
| `/api/jardiance/barriers/:id/resolve` | PUT | Resolve barrier |
| `/api/jardiance/summary/:patientId` | GET | Complete prescription summary |

### Doctor Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/doctors` | GET | List all doctors |
| `/api/doctors` | POST | Create doctor profile |
| `/api/doctors/:email` | GET | Get doctor details |
| `/api/doctors/:email` | PUT | Update doctor profile |
| `/api/doctors/:email` | DELETE | Delete doctor |
| `/api/doctors/assign-by-category` | POST | Bulk assign by category |
| `/api/doctors/category-assignments` | GET | Get category assignments |
| `/api/doctors/category-stats` | GET | Patient counts by category |
| `/api/doctors/external-notifications` | GET/POST | External email management |

### Notification Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | Get notifications (paginated) |
| `/api/notifications/unread` | GET | Get unread notifications |
| `/api/notifications/:id/read` | POST | Mark as read |
| `/api/notifications/:id/acknowledge` | POST | Acknowledge notification |
| `/api/notifications/stats` | GET | Notification statistics |
| `/api/notifications/monitor/status` | GET | Monitoring service status |

### Analytics Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/summary` | GET | System-wide summary |
| `/api/analytics/doctor/:email` | GET | Doctor performance metrics |
| `/api/analytics/doctors/all` | GET | All doctors performance |
| `/api/analytics/trends` | GET | Alert trends over time |
| `/api/analytics/common-alerts` | GET | Most common alert types |
| `/api/analytics/patient/:id` | GET | Patient alert history |
| `/api/analytics/response-times` | GET | Response time distribution |
| `/api/analytics/track/viewed/:id` | POST | Track alert view |
| `/api/analytics/track/acknowledged/:id` | POST | Track acknowledgment |
| `/api/analytics/track/resolved/:id` | POST | Track resolution |

### Settings & Email Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings/email` | GET | Get email configuration |
| `/api/settings/email` | POST | Update email settings |
| `/api/settings/email/test` | POST | Send test email |
| `/api/settings/email/messages` | GET | Email message history |
| `/api/email-templates` | CRUD | Template management |

### AI Assistant Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/chat` | POST | Doctor assistant chat |
| `/api/agent/analyze-patient/:id` | POST | Patient analysis |
| `/api/agent/quick-question` | POST | General questions |
| `/api/agent/health` | GET | Service health |

### System Initialization

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/init/seed-data` | POST | Generate test patients |
| `/api/init/load-mock-patients` | POST | Load from seed files |
| `/api/init/clear-all` | POST | Clear all data (dev only) |

---

## Security & Compliance

### Data Security
- Non-root Docker containers
- Environment variable injection for API keys
- CORS configuration
- PostgreSQL authentication
- Network isolation

### Clinical Safety
- Threshold-based alerts using evidence-based clinical thresholds
- Treatment status verification before AI recommendations
- KDIGO 2024 compliance
- Audit trail for all updates

### HIPAA Considerations

**Current Status:** Demonstration system with mock data.

**For Production Deployment:**
- End-to-end encryption (TLS/SSL)
- User authentication and authorization
- Audit logging of patient data access
- Data retention policies
- Business Associate Agreements
- HIPAA security risk assessment

---

## The Vision

RENALGUARD AI aims to **democratize access to nephrology expertise** by bringing advanced CKD management tools to every primary care practice. By combining artificial intelligence with evidence-based clinical guidelines, we empower doctors to:

1. **Detect CKD earlier** through automated risk screening
2. **Initiate treatment sooner** with AI-powered recommendations
3. **Monitor more effectively** with dual-track home and lab surveillance
4. **Optimize outcomes** through adherence tracking and trend analysis

**The result**: Patients live longer with better quality of life, and healthcare systems save billions in dialysis and hospitalization costs.

---

## Why RENALGUARD AI?

### For Doctors
- Reduce time on manual risk calculations by 80%
- Identify high-risk patients earlier
- Access evidence-based recommendations instantly
- Minimize alert fatigue with smart detection

### For Patients
- Earlier CKD detection and intervention
- Personalized treatment plans
- Better monitoring of kidney function
- Reduced risk of progression to kidney failure

### For Healthcare Systems
- Standardize CKD care across practices
- Reduce unnecessary nephrology referrals
- Lower costs through earlier intervention
- Improve population health outcomes

---

**RENALGUARD AI** - *Guarding Kidney Health with Artificial Intelligence*

Built with Claude AI, React, TypeScript, and PostgreSQL

*Version 2.0.0 | Last Updated: November 2025*

---

## Changelog

### Version 2.0.0 (November 2025)
- **GCUA Integration**: Replaced SCORED/Framingham with GCUA (Geriatric Cardiorenal Unified Assessment) for patients 60+
  - Nelson/CKD-PC (5-year renal risk)
  - AHA PREVENT 2024 (10-year CVD risk)
  - Bansal Geriatric Mortality (5-year competing risk)
- **Phenotype Classification**: Six actionable phenotypes (I-IV, Moderate, Low) with treatment recommendations
- **Risk-Based Home Monitoring**: Monitoring recommendations now based on actual risk levels, not just phenotype
- **AI Doctor Assistant**: Enhanced with GCUA phenotype awareness and plain-text optimized responses
- **Improved Filtering**: Non-CKD patient filter now correctly excludes patients who developed CKD
