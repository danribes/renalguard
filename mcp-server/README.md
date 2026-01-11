# Healthcare MCP Server v2.0

Model Context Protocol (MCP) server for **Unified CKD Management System**. Provides phase-based clinical decision support covering the complete patient journey from pre-diagnosis through adherence monitoring.

**Based on**: Unified CKD Complete Specification Enhanced v3.0
**Coverage**: Pre-Diagnosis → Diagnosis → Treatment → Adherence Monitoring

## Architecture Philosophy

This MCP server implements a **phase-based approach** aligned with the clinical workflow:

1. **Phase 1**: Pre-Diagnosis Risk Assessment (when labs unavailable)
2. **Phase 2**: CKD Diagnosis & KDIGO Classification
3. **Phase 3**: Treatment Initiation Decision Support
4. **Phase 4**: Adherence Monitoring & Outcome Correlation

## Core Features

### Phase-Based Tools (NEW in v2.0)
- **3-Tier Risk Stratification**: HIGH/MODERATE/LOW risk when eGFR/uACR unavailable
- **KDIGO Classification Matrix**: G1-G5 × A1-A3 with trajectory analysis
- **Evidence-Based Treatment Decisions**: Jardiance & RAS inhibitor eligibility (EMPA-KIDNEY, KDIGO 2024)
- **MPR-Based Adherence Monitoring**: Smart alerts linking adherence to clinical outcomes

### Legacy Tools (Maintained for Compatibility)
- **Patient Data Retrieval**: Comprehensive patient information
- **Lab Results Query**: Laboratory values with clinical context
- **Population Statistics**: Aggregate data across patient populations
- **Clinical Guidelines**: Search KDIGO 2024 practice guidelines

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
nano .env

# Build TypeScript
npm run build
```

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Inspect tools
npm run inspect
```

## Available Tools

### Phase-Based Tools (Primary Workflow)

#### Phase 1: `assess_pre_diagnosis_risk`
**When to use**: Patient lacks recent eGFR/uACR labs but may have CKD risk factors.

Implements 3-tier risk stratification using multi-source data:
- Comorbidities (diabetes, hypertension, heart failure)
- Blood pressure (SBP/DBP)
- Medication proxies (SGLT2i, RAS inhibitors indicate existing CKD)
- Vitals (BMI, age)
- Lab values if partially available

**Input:**
```json
{
  "patient_id": "uuid-string"
}
```

**Output:**
```json
{
  "riskTier": "TIER_1_HIGH" | "TIER_2_MODERATE" | "TIER_3_LOW",
  "riskScore": 65,
  "riskFactors": [
    {"factor": "Type 2 Diabetes + Age >40", "points": 30, "category": "Comorbidity"}
  ],
  "priority": "URGENT" | "ROUTINE" | "STANDARD",
  "testingTimeline": "Order tests immediately (this week)",
  "expectedYield": "40-60% will have abnormal results",
  "recommendations": ["Order eGFR and uACR testing", ...],
  "renalGuardRecommendation": "Consider home monitoring device"
}
```

---

#### Phase 2: `classify_kdigo`
**When to use**: Patient has eGFR and uACR results for KDIGO classification.

Implements KDIGO risk matrix (GFR × Albuminuria) with trajectory analysis to detect rapid progressors.

**Input:**
```json
{
  "patient_id": "uuid-string"
}
```

**Output:**
```json
{
  "gfrCategory": "G3a",
  "egfr": 52,
  "albuminuriaCategory": "A2",
  "uacr": 45,
  "riskLevel": "ORANGE",
  "riskDescription": "High risk - Increased monitoring needed",
  "trajectory": {
    "progressionRisk": "RAPID" | "MODERATE" | "STABLE",
    "egfrDeclineRate": -6.2,
    "alert": "CRITICAL: Rapid decline >5 mL/min/year",
    "recommendation": "Immediate nephrology referral + intensify therapy"
  },
  "monitoringFrequency": "Every 3 months",
  "clinicalRecommendations": [
    "KDIGO 2024: Initiate RAS inhibitor if not already on",
    "Consider SGLT2 inhibitor (strong indication)",
    ...
  ]
}
```

---

#### Phase 3: `assess_treatment_options`
**When to use**: Patient diagnosed with CKD, need treatment eligibility assessment.

Evaluates eligibility for:
- **Jardiance (SGLT2 inhibitor)**: Based on EMPA-KIDNEY trial (28% risk reduction)
- **RAS Inhibitors**: ACE inhibitors or ARBs for proteinuria
- **RenalGuard**: Home monitoring device recommendations

**Input:**
```json
{
  "patient_id": "uuid-string"
}
```

**Output:**
```json
{
  "jardiance": {
    "medication": "Jardiance (Empagliflozin)",
    "indication": "STRONG" | "MODERATE" | "NOT_INDICATED" | "CONTRAINDICATED",
    "evidence": "KDIGO Grade 1A - EMPA-KIDNEY: 28% reduction in progression",
    "reasoning": [
      "Type 2 Diabetes + eGFR ≥20 + significant albuminuria (uACR ≥200)",
      "28% relative risk reduction for kidney disease progression or CV death"
    ],
    "safetyMonitoring": ["Monitor for genital infections", "Check eGFR at 2-4 weeks"],
    "contraindications": []
  },
  "rasInhibitor": {
    "medication": "RAS Inhibitor (ACEi or ARB)",
    "indication": "STRONG",
    "evidence": "KDIGO Grade 1A - First-line for albuminuria (30-40% proteinuria reduction)",
    "reasoning": ["Albuminuria present (uACR 45 mg/g)", "Should be initiated BEFORE SGLT2i"],
    "safetyMonitoring": ["Check K+ and creatinine 1-2 weeks after initiation"],
    "contraindications": []
  },
  "renalGuard": {
    "recommended": true,
    "frequency": "Bi-weekly",
    "rationale": "Moderate CKD on SGLT2 inhibitor - monitor treatment response",
    "costEffectiveness": "Moderate-High - Helps optimize therapy"
  },
  "overallPlan": [
    "FIRST PRIORITY: Initiate RAS inhibitor",
    "SECOND PRIORITY: Add Jardiance after RAS inhibitor established",
    "RenalGuard Home Monitoring: Bi-weekly"
  ]
}
```

---

#### Phase 4: `monitor_adherence`
**When to use**: Patient on CKD medications, need adherence assessment.

Calculates Medication Possession Ratio (MPR) from prescription fill records and correlates adherence with clinical outcomes.

**Input:**
```json
{
  "patient_id": "uuid-string",
  "medication_type": "SGLT2i" | "RAS_inhibitor" | "ALL",
  "measurement_period_days": 90
}
```

**Output:**
```json
{
  "medications": [
    {
      "medicationName": "Jardiance (Empagliflozin) 10mg",
      "mpr": 76.5,
      "adherenceStatus": "SUBOPTIMAL",
      "refillCount": 2,
      "daysCovered": 69,
      "measurementPeriod": 90,
      "barriers": [
        {
          "type": "GAP_IN_COVERAGE",
          "severity": "MODERATE",
          "details": "21-day gap between refills",
          "recommendation": "Assess financial or access barriers"
        }
      ]
    }
  ],
  "overallAdherence": 76.5,
  "clinicalCorrelation": {
    "egfrTrend": "STABLE" | "IMPROVING" | "WORSENING",
    "uacrTrend": "STABLE" | "IMPROVING" | "WORSENING",
    "interpretation": "Suboptimal adherence with stable kidney function"
  },
  "alerts": [
    {
      "priority": "HIGH",
      "message": "Suboptimal adherence (MPR 76.5%) detected",
      "action": "Patient outreach recommended - assess barriers",
      "reasoning": ["MPR <80% associated with worse outcomes"]
    }
  ],
  "recommendations": [
    "Schedule medication review with patient",
    "Assess cost/access barriers (possible gap in coverage)",
    "Consider adherence aids (pill organizers, reminders)"
  ]
}
```

---

### Legacy Tools (Backwards Compatibility)

#### `get_patient_data`
Retrieve comprehensive patient information including demographics, vitals, comorbidities, medications.

**Note**: Use phase-specific tools for clinical decisions.

**Input:**
```json
{
  "patient_id": "uuid-string",
  "include_labs": true,
  "include_risk": true
}
```

---

#### `query_lab_results`
Query laboratory results with optional filtering by observation type and date range.

**Input:**
```json
{
  "patient_id": "uuid-string",
  "observation_type": "eGFR" | "uACR" | "Creatinine" | "HbA1c" | "All",
  "date_range": {"start": "2024-01-01", "end": "2024-12-31"},
  "limit": 20
}
```

---

#### `get_population_stats`
Get aggregated statistics across the patient population with optional filtering and grouping.

**Input:**
```json
{
  "filters": {
    "has_diabetes": true,
    "on_sglt2i": false,
    "risk_level": "HIGH"
  },
  "group_by": "risk_level" | "ckd_stage" | "medication"
}
```

---

#### `search_guidelines`
Search KDIGO 2024 clinical practice guidelines for specific topics.

**Input:**
```json
{
  "topic": "blood pressure",
  "ckd_stage": "G3a"
}
```

## Integration with Claude

### Option 1: Direct MCP Integration (Recommended)

Use the MCP SDK to connect Claude directly to the server:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  env: { DATABASE_URL: process.env.DATABASE_URL }
});

const client = new Client({
  name: 'doctor-chat-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: 'get_patient_data',
  arguments: { patient_id: 'some-uuid' }
});
```

### Option 2: HTTP Wrapper (For Remote Access)

Create an Express wrapper around the MCP server for HTTP/REST access.

## Testing

Test individual tools using the MCP Inspector:

```bash
# Start the inspector
npm run inspect

# In another terminal, use the MCP CLI
npx @modelcontextprotocol/inspector
```

Or test manually:

```bash
# Test patient data retrieval
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_patient_data","arguments":{"patient_id":"test-id"}}}' | node dist/index.js
```

## Architecture

### Phase-Based Clinical Workflow

```
                    ┌─────────────────────────────────┐
                    │      Doctor Chat (Claude)       │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │     MCP Server v2.0             │
                    │  (Phase-Based Tool Orchestrator)│
                    └─┬──────┬──────┬──────┬──────────┘
                      │      │      │      │
           ┌──────────┘      │      │      └──────────┐
           │                 │      │                 │
    ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │   Phase 1   │  │   Phase 2   │  │   Phase 3   │  │   Phase 4   │
    │  Pre-Dx     │  │   KDIGO     │  │  Treatment  │  │  Adherence  │
    │   Risk      │  │ Classifier  │  │  Decision   │  │  Monitor    │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                 │                 │                 │
           └─────────────────┴─────────────────┴─────────────────┘
                                     │
                          ┌──────────▼───────────┐
                          │   PostgreSQL         │
                          │   (Patient Data)     │
                          └──────────────────────┘

Clinical Decision Flow:
1. Pre-Diagnosis: Risk stratification → Order tests
2. Diagnosis: KDIGO classification → Stage CKD
3. Treatment: Eligibility assessment → Prescribe therapy
4. Adherence: MPR monitoring → Intervene on barriers
```

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                      │
│              Doctor Chat Interface                      │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP/WebSocket
┌───────────────────────▼─────────────────────────────────┐
│                Backend (Express + Claude SDK)           │
│  - Doctor Agent Service                                 │
│  - Chat message handling                                │
│  - Session management                                   │
└───────────────────────┬─────────────────────────────────┘
                        │ MCP Protocol (stdio)
┌───────────────────────▼─────────────────────────────────┐
│              MCP Server (This Service)                  │
│                                                          │
│  Phase 1: assess_pre_diagnosis_risk                    │
│  Phase 2: classify_kdigo                               │
│  Phase 3: assess_treatment_options                     │
│  Phase 4: monitor_adherence                            │
│                                                          │
│  Legacy: get_patient_data, query_lab_results, etc.    │
└───────────────────────┬─────────────────────────────────┘
                        │ pg (node-postgres)
┌───────────────────────▼─────────────────────────────────┐
│                   PostgreSQL Database                   │
│  Tables: patients, observations, prescriptions,         │
│          refills, medications                           │
└─────────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Logging level | `info` |

## Error Handling

The server includes comprehensive error handling:

- Database connection errors
- Invalid patient IDs
- Missing lab data
- Query timeouts

All errors return structured JSON with descriptive messages.

## Security Considerations

- **Input Validation**: All inputs are validated using Zod schemas
- **SQL Injection Prevention**: All queries use parameterized statements
- **Data Privacy**: Patient IDs are UUIDs; sensitive data is never logged
- **Rate Limiting**: Consider adding rate limiting for production use
- **Authentication**: Add authentication layer for production deployment

## Performance

- **Connection Pooling**: Max 10 database connections
- **Query Optimization**: Indexed queries on patient_id, observation_type
- **Caching**: Consider implementing Redis for frequently accessed data

## Monitoring

Log all tool invocations for audit and debugging:

```typescript
{
  timestamp: '2025-11-14T12:00:00Z',
  tool: 'get_patient_data',
  patient_id: 'hashed-id',
  duration_ms: 45,
  success: true
}
```

## Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t healthcare-mcp-server .
docker run -e DATABASE_URL=... healthcare-mcp-server
```

## Contributing

1. Add new tools in `src/tools/`
2. Register tools in `src/index.ts`
3. Update this README with tool documentation
4. Add tests for new functionality

## License

MIT

## Resources

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [KDIGO 2024 Guidelines](https://kdigo.org/guidelines/)
