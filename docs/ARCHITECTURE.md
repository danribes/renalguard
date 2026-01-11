# RENALGUARD AI - Architecture Documentation

## Overview

RENALGUARD AI is a clinical decision support system for Chronic Kidney Disease (CKD) management. It serves as an intelligent co-pilot for primary care physicians, providing early CKD detection, evidence-based treatment guidance, and proactive patient monitoring.

This document explains the architecture and rationale behind the system design.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Project Structure](#project-structure)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Database Architecture](#database-architecture)
6. [MCP Server Architecture](#mcp-server-architecture)
7. [Clinical Workflows](#clinical-workflows)
8. [Deployment Architecture](#deployment-architecture)
9. [Design Decisions & Rationale](#design-decisions--rationale)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RENALGUARD AI                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │    Frontend     │    │     Backend     │    │   MCP Server    │ │
│  │  (React + Vite) │◄──►│  (Express.js)   │◄──►│ (Clinical Tools)│ │
│  │                 │    │                 │    │                 │ │
│  │  - Patient UI   │    │  - REST API     │    │  - KDIGO Tools  │ │
│  │  - Dashboards   │    │  - AI Agent     │    │  - GCUA Tools   │ │
│  │  - Chat Bar     │    │  - Monitoring   │    │  - Risk Calc    │ │
│  └─────────────────┘    └────────┬────────┘    └────────┬────────┘ │
│                                  │                      │          │
│                                  └──────────┬───────────┘          │
│                                             │                      │
│                                  ┌──────────▼──────────┐           │
│                                  │    PostgreSQL       │           │
│                                  │    (Neon Cloud)     │           │
│                                  │                     │           │
│                                  │  - Patient Data     │           │
│                                  │  - Lab Results      │           │
│                                  │  - Risk Assessments │           │
│                                  └─────────────────────┘           │
│                                                                     │
│                        ┌─────────────────┐                         │
│                        │   Claude API    │                         │
│                        │   (Anthropic)   │                         │
│                        └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 19 + Vite + Tailwind | Patient management UI, dashboards, doctor chat |
| **Backend** | Express.js 5 + TypeScript | REST API, AI agent integration, real-time monitoring |
| **MCP Server** | Model Context Protocol | 18+ clinical decision support tools for AI |
| **Database** | PostgreSQL (Neon) | Patient data, lab results, risk assessments |
| **AI Engine** | Claude API (Sonnet) | Clinical reasoning, patient analysis |

---

## Project Structure

```
renalguard/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── index.ts           # Express app entry point
│   │   ├── config/            # Database configuration
│   │   ├── api/routes/        # REST API routes (11 modules)
│   │   ├── services/          # Business logic (9 services)
│   │   └── utils/             # KDIGO, GCUA calculations
│   └── package.json
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── App.tsx            # Main application component
│   │   ├── components/        # React components (10 modules)
│   │   └── main.tsx           # Vite entry point
│   └── package.json
│
├── mcp-server/                 # Model Context Protocol server
│   ├── src/
│   │   ├── index.ts           # MCP server entry point
│   │   ├── database.ts        # Database connection
│   │   └── tools/             # Clinical decision tools
│   └── package.json
│
├── infrastructure/             # Deployment configuration
│   ├── postgres/
│   │   └── migrations/        # 33 SQL migration files
│   └── cloudflare/            # Container configurations
│
├── fly.toml                    # Fly.io backend deployment
├── Dockerfile                  # Multi-stage Docker build
└── docs/                       # Documentation
```

### Rationale for Structure

**Monorepo approach**: All components (frontend, backend, MCP server) live in one repository for:
- Simplified dependency management
- Coordinated deployments
- Shared TypeScript types
- Easier local development

**Separation of concerns**: Each component has a distinct responsibility:
- Frontend handles UI/UX only
- Backend manages data and business logic
- MCP server provides AI-accessible clinical tools

---

## Backend Architecture

### Technology Stack

- **Express.js 5.1**: Lightweight, battle-tested HTTP framework
- **TypeScript**: Type safety for clinical data handling
- **pg (node-postgres)**: Direct PostgreSQL client for performance
- **Anthropic SDK**: Claude API integration for AI features

### Route Structure

```
/api
├── /patients          # Patient CRUD and filtering
├── /init              # Patient initialization
├── /risk              # Risk assessment endpoints
├── /gcua              # GCUA risk assessment (60+ patients)
├── /agent             # AI doctor agent chat & analysis
├── /doctors           # Doctor management
├── /notifications     # Real-time patient alerts
├── /settings          # Application configuration
├── /analytics         # Population-level analytics
└── /health            # Health check endpoint
```

### Key Services

| Service | Purpose |
|---------|---------|
| `DoctorAgentService` | Claude AI integration for patient analysis |
| `PatientMonitorService` | Real-time monitoring via PostgreSQL LISTEN/NOTIFY |
| `AlertReminderService` | Scheduled checks for unacknowledged alerts |
| `ClinicalAlertsService` | Alert generation based on clinical rules |
| `EmailService` | Nodemailer SMTP integration for notifications |
| `HealthStateCommentService` | AI-generated comments on patient state changes |

### Real-Time Monitoring Architecture

```
┌─────────────┐     NOTIFY      ┌──────────────────┐
│  PostgreSQL │ ──────────────► │ PatientMonitor   │
│  Trigger    │                 │ Service          │
└─────────────┘                 └────────┬─────────┘
      ▲                                  │
      │ INSERT/UPDATE                    │ Triggers
      │                                  ▼
┌─────────────┐                 ┌──────────────────┐
│ Observations│                 │ - AI Analysis    │
│ Table       │                 │ - Email Alerts   │
└─────────────┘                 │ - UI Updates     │
                                └──────────────────┘
```

**Why PostgreSQL LISTEN/NOTIFY?**
- Built into PostgreSQL, no external message queue needed
- Eliminates polling overhead
- Guaranteed delivery within transaction
- Ideal for our real-time clinical alert requirements

---

## Frontend Architecture

### Technology Stack

- **React 19**: Latest features including concurrent rendering
- **Vite 6**: Fast build tool with hot module replacement
- **Tailwind CSS 3.4**: Utility-first styling for rapid UI development
- **Recharts**: Line charts for eGFR/uACR trend visualization
- **Lucide React**: Consistent icon library

### Component Architecture

```
App.tsx (Main Container)
├── PatientFilters.tsx       # Multi-criteria filtering
├── PatientList              # Patient cards with KDIGO badges
│   └── PatientCard          # Individual patient summary
├── PatientDetail            # Detailed patient view
│   ├── PatientTrendGraphs   # eGFR/uACR charts
│   ├── AdherenceCard        # Medication adherence
│   └── GCUARiskCard         # GCUA phenotype display
├── DoctorChatBar.tsx        # AI chat interface
├── GCUADashboard.tsx        # Population GCUA analytics
├── DoctorAssignmentInterface.tsx  # Doctor-patient mapping
├── Settings.tsx             # Configuration panel
└── LandingPage.tsx          # Welcome/onboarding
```

### State Management

**Local state with React hooks**: For this application complexity, React's built-in state management (useState, useReducer, useContext) is sufficient. We avoided Redux/Zustand because:

1. Most state is server-derived (fetched via API)
2. Component hierarchy is relatively shallow
3. Real-time updates come from backend polling
4. Simpler mental model for clinical users

### API Communication Pattern

```typescript
// Example: Fetch patients with filters
const fetchPatients = async (filters: PatientFilters) => {
  const params = new URLSearchParams();
  if (filters.has_ckd !== undefined) params.set('has_ckd', String(filters.has_ckd));
  if (filters.severity) params.set('severity', filters.severity);
  // ... more filters

  const response = await fetch(`${API_URL}/api/patients/filter?${params}`);
  return response.json();
};
```

---

## Database Architecture

### Schema Design Philosophy

1. **Normalized structure**: Patient data, observations, and conditions in separate tables
2. **Audit trails**: `created_at` and `updated_at` on all tables
3. **Soft deletes where appropriate**: `is_active` flags instead of hard deletes
4. **JSONB for flexible data**: Treatment recommendations, missing data arrays

### Core Tables

```sql
-- Core patient identity
patients (
  id UUID PRIMARY KEY,
  medical_record_number VARCHAR(20) UNIQUE,
  first_name, last_name, date_of_birth, gender,
  weight, height, smoking_status,
  -- Clinical flags
  has_diabetes, has_hypertension, has_cvd,
  -- Timestamps
  created_at, updated_at
)

-- Lab results (eGFR, uACR, HbA1c, etc.)
observations (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients,
  observation_type VARCHAR(50),  -- 'eGFR', 'uACR', 'Creatinine'
  value_numeric DECIMAL(10, 2),
  unit VARCHAR(20),
  observation_date TIMESTAMP,
  month_number INTEGER  -- Timeline tracking
)

-- CKD-specific patient data
ckd_patient_data (
  patient_id UUID UNIQUE,
  ckd_severity VARCHAR(20),     -- 'mild', 'moderate', 'severe'
  ckd_stage INTEGER,            -- 1-5
  kdigo_health_state VARCHAR(10), -- 'G3a-A2'
  is_monitored BOOLEAN,
  monitoring_device VARCHAR(100),
  is_treated BOOLEAN
)

-- GCUA assessments (60+ patients)
patient_gcua_assessments (
  patient_id UUID,
  -- Module 1: Nelson (5-year CKD risk)
  module1_five_year_risk DECIMAL(5, 2),
  -- Module 2: AHA PREVENT (10-year CVD risk)
  module2_ten_year_risk DECIMAL(5, 2),
  -- Module 3: Bansal (5-year mortality)
  module3_five_year_mortality DECIMAL(5, 2),
  -- Phenotype assignment
  phenotype_type VARCHAR(5),    -- 'I', 'II', 'III', 'IV'
  benefit_ratio DECIMAL(5, 2),
  assessed_at TIMESTAMP
)
```

### Migration Strategy

We use sequential numbered migrations (`000_init_base_schema.sql`, `001_add_enhanced_patient_fields.sql`, etc.) because:

1. **Predictable order**: Migrations run in lexicographic order
2. **Clear dependencies**: Each migration builds on previous
3. **Easy rollback tracking**: `schema_migrations` table tracks applied versions
4. **Team collaboration**: No merge conflicts on migration order

### Key Database Patterns

**Triggers for real-time updates:**
```sql
CREATE TRIGGER trg_notify_patient_updated
  AFTER INSERT OR UPDATE ON observations
  FOR EACH ROW
  EXECUTE FUNCTION notify_patient_data_updated();
```

**Materialized views for analytics:**
```sql
CREATE VIEW gcua_population_statistics AS
SELECT phenotype_type, COUNT(*) as patient_count,
       AVG(module1_five_year_risk) as avg_renal_risk
FROM patient_gcua_assessments
WHERE is_eligible = true
GROUP BY phenotype_type;
```

---

## MCP Server Architecture

### What is MCP?

The **Model Context Protocol** (MCP) is a standard for exposing tools to Large Language Models. Our MCP server provides Claude with structured access to clinical decision support tools.

### Why Use MCP?

1. **Structured tool access**: Claude sees tool definitions with typed parameters
2. **Separation of concerns**: Clinical logic lives in tools, not prompts
3. **Auditability**: Every tool call is logged with inputs/outputs
4. **Extensibility**: Add new clinical tools without changing AI prompts

### Tool Categories

```
MCP Tools (18+)
├── Master Orchestrator
│   └── comprehensive_ckd_analysis    # Single entry point
│
├── Phase-Based Tools (Clinical Workflow)
│   ├── assess_pre_diagnosis_risk     # Phase 1: SCORED model
│   ├── classify_kdigo                # Phase 2: GFR + albumin staging
│   ├── assess_treatment_options      # Phase 3: SGLT2i, RAS eligibility
│   └── monitor_adherence             # Phase 4: MPR calculation
│
├── Clinical Calculations
│   ├── calculate_egfr                # CKD-EPI 2021 equation
│   └── predict_kidney_failure_risk   # KFRE equation
│
├── GCUA Assessment
│   ├── assess_gcua                   # Nelson + AHA PREVENT + Bansal
│   └── check_screening_protocol      # KDIGO compliance
│
└── Data Access
    ├── get_patient_data              # Demographics, vitals
    ├── query_lab_results             # Lab queries
    └── get_population_stats          # Analytics
```

### Tool Definition Example

```typescript
{
  name: "classify_kdigo",
  description: "KDIGO 2024 classification from eGFR and uACR values",
  inputSchema: z.object({
    patient_id: z.string().uuid(),
    egfr: z.number().min(0).max(200).optional(),
    uacr: z.number().min(0).optional()
  }),
  execute: async (params) => {
    // Fetch patient data if not provided
    // Apply KDIGO classification logic
    // Return structured result
  }
}
```

---

## Clinical Workflows

### CKD Management Phases

```
Patient Entry
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Pre-Diagnosis Risk Assessment                      │
│ - For patients without recent labs                          │
│ - Uses SCORED model (demographics + comorbidities)          │
│ - Output: HIGH/MODERATE/LOW risk, testing urgency           │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: KDIGO Classification                               │
│ - Requires eGFR and uACR values                             │
│ - GFR categories: G1-G5                                     │
│ - Albuminuria categories: A1-A3                             │
│ - Output: Health state (e.g., G3a-A2), risk color           │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Treatment Eligibility                              │
│ - KDIGO 2024 guideline-based                                │
│ - SGLT2i (Jardiance) indication assessment                  │
│ - RAS inhibitor (ACE/ARB) recommendations                   │
│ - Contraindication screening                                │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: Adherence Monitoring                               │
│ - Medication Possession Ratio (MPR) calculation             │
│ - Refill gap analysis                                       │
│ - Lab response tracking (eGFR/uACR trends)                  │
│ - Barrier detection and smart alerts                        │
└─────────────────────────────────────────────────────────────┘
```

### GCUA Assessment (60+ Non-CKD Patients)

The **Geriatric Cardiorenal Unified Assessment** identifies high-risk older adults before they develop CKD:

| Module | Model | Risk Assessed | Timeframe |
|--------|-------|---------------|-----------|
| 1 | Nelson/CKD-PC | Incident CKD | 5 years |
| 2 | AHA PREVENT | Cardiovascular events | 10 years |
| 3 | Bansal | All-cause mortality | 5 years |

**Phenotype Assignment:**

| Phenotype | Renal Risk | CVD Risk | Strategy |
|-----------|------------|----------|----------|
| I (Accelerated Ager) | High | High | Aggressive dual protection |
| II (Silent Renal) | High | Low | Kidney-focused monitoring |
| III (Vascular Dominant) | Low | High | Cardiovascular focus |
| IV (Senescent) | High mortality | - | De-escalate, QoL focus |

---

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Frontend (Cloudflare Pages)                         │  │
│  │  https://renalguard-frontend.pages.dev               │  │
│  │  - Static React build                                │  │
│  │  - Global CDN distribution                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      FLY.IO                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Backend + MCP Server (Docker Container)             │  │
│  │  https://renalguard-ai.fly.dev                       │  │
│  │  - Express.js API                                    │  │
│  │  - MCP Server (same container)                       │  │
│  │  - Auto-scaling, auto-restart                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       NEON                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (Serverless)                             │  │
│  │  - Connection pooling                                │  │
│  │  - Auto-suspend on idle                              │  │
│  │  - Point-in-time recovery                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Why This Stack?

| Choice | Rationale |
|--------|-----------|
| **Cloudflare Pages** | Free tier, global CDN, automatic HTTPS |
| **Fly.io** | Docker support, auto-scaling, Frankfurt region for EU data |
| **Neon PostgreSQL** | Serverless, auto-suspend saves cost, free tier generous |
| **Hyperdrive** | Connection pooling, reduces database connection overhead |

### Environment Variables

```bash
# Backend (Fly.io secrets)
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://renalguard-frontend.pages.dev

# Frontend (build-time)
VITE_API_URL=https://renalguard-ai.fly.dev
```

---

## Design Decisions & Rationale

### 1. Why Express.js over alternatives?

**Considered**: Fastify, NestJS, Hono

**Chose Express because**:
- Mature ecosystem with extensive middleware
- Team familiarity and documentation quality
- Simple mental model for REST APIs
- TypeScript support is solid

### 2. Why PostgreSQL over NoSQL?

**Considered**: MongoDB, Firestore

**Chose PostgreSQL because**:
- Clinical data requires ACID compliance
- Relational integrity for patient-observation relationships
- LISTEN/NOTIFY for real-time monitoring
- Neon provides serverless PostgreSQL

### 3. Why MCP for AI tools?

**Considered**: Direct prompt engineering, LangChain

**Chose MCP because**:
- Standardized protocol for tool exposure
- Better auditability of AI decisions
- Cleaner separation between clinical logic and AI
- Future-proof for model upgrades

### 4. Why React 19 over alternatives?

**Considered**: Vue, Svelte, Next.js

**Chose React because**:
- Team expertise
- Rich ecosystem for medical UI components
- Concurrent rendering for complex dashboards
- Vite provides fast development experience

### 5. Why separate Frontend and Backend deployments?

**Considered**: SSR with Next.js, monolithic deployment

**Chose separation because**:
- Independent scaling (API may need more resources)
- CDN optimization for static frontend
- Cleaner security boundary
- Easier debugging and monitoring

### 6. Why Fly.io over AWS/GCP?

**Considered**: AWS ECS, Google Cloud Run, Railway

**Chose Fly.io because**:
- Simple Docker deployment
- Frankfurt region for EU data residency
- Generous free tier
- Built-in health checks and auto-restart

---

## Future Considerations

### Scalability Improvements

1. **Read replicas**: For heavy analytics queries
2. **Redis caching**: For frequently accessed patient data
3. **Background jobs**: Bull/BullMQ for async processing
4. **WebSockets**: Replace polling for real-time updates

### Security Enhancements

1. **Row-level security**: PostgreSQL RLS for multi-tenancy
2. **Audit logging**: Track all PHI access
3. **Encryption at rest**: For sensitive data columns
4. **OAuth 2.0**: Replace current auth system

### Feature Roadmap

1. **FHIR integration**: Standard healthcare data exchange
2. **Mobile app**: React Native for on-the-go access
3. **ML predictions**: Custom models for CKD progression
4. **Multi-language**: Internationalization support

---

## References

- [KDIGO 2024 CKD Guidelines](https://kdigo.org/guidelines/ckd-evaluation-and-management/)
- [AHA PREVENT Calculator](https://professional.heart.org/en/guidelines-and-statements/prevent-calculator)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Neon Serverless PostgreSQL](https://neon.tech/docs)
- [Fly.io Documentation](https://fly.io/docs/)
