#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { testConnection } from './database.js';

// Import Phase-based Tools (Aligned with Unified CKD Specification v3.0)
import { assessPreDiagnosisRisk } from './tools/phase1PreDiagnosisRisk.js';
import { classifyKDIGO } from './tools/phase2KDIGOClassification.js';
import { assessTreatmentOptions } from './tools/phase3TreatmentDecision.js';
import { monitorAdherence } from './tools/phase4AdherenceMonitoring.js';
import { monitorCompositeAdherence } from './tools/compositeAdherenceMonitoring.js';

// Import Orchestrator Tool (Master Pipeline)
import { comprehensiveCKDAnalysis } from './tools/comprehensiveCKDAnalysis.js';

// Import Clinical Calculation Tools (CKD-EPI 2021, KFRE)
import { calculateEGFR } from './tools/calculateEGFR.js';
import { predictKidneyFailureRisk } from './tools/predictKidneyFailureRisk.js';

// Import GCUA (Geriatric Cardiorenal Unified Assessment)
import { assessGCUA } from './tools/gcuaAssessment.js';
import { checkScreeningProtocol } from './tools/checkScreeningProtocol.js';
import { assessMedicationSafety } from './tools/assessMedicationSafety.js';
import { analyzeAdherence } from './tools/analyzeAdherence.js';

// Import Legacy Tools (kept for backwards compatibility)
import { getPatientData } from './tools/patientData.js';
import { queryLabResults } from './tools/labResults.js';
import { calculateCKDRisk } from './tools/riskAssessment.js';
import { getPopulationStats } from './tools/populationStats.js';
import { searchGuidelines } from './tools/guidelines.js';

/**
 * Healthcare MCP Server - Unified CKD Management System
 *
 * Based on: "Unified CKD Complete Specification Enhanced v3 Adherence Risk"
 * Document Version: 3.0
 * Coverage: Pre-Diagnosis → Diagnosis → Treatment → Adherence
 *
 * PHASE-BASED TOOLS:
 * - Phase 1: Pre-Diagnosis Risk Assessment (3-tier stratification)
 * - Phase 2: CKD Diagnosis & KDIGO Classification (with trajectory analysis)
 * - Phase 3: Treatment Initiation Decision Support (Jardiance, RAS inhibitors, Minuteful Kidney)
 * - Phase 4: Adherence Monitoring (MPR calculation, barrier detection, smart alerts)
 */

// Define available tools
const TOOLS: Tool[] = [
  // ==================== MASTER ORCHESTRATOR TOOL ====================
  {
    name: 'comprehensive_ckd_analysis',
    description:
      'MASTER ORCHESTRATOR: Single entry point for complete CKD assessment. Runs deterministic pipeline: (1) Clinical calc (eGFR, staging), (2) Risk stratification (KDIGO heatmap → risk color), (3) Protocol check (monitoring intervals vs actual dates), (4) Medication safety (Jardiance, RAS inhibitors), (5) Adherence check (refill gaps, overdue tests), (6) Opportunity analysis (should start treatment?). Returns comprehensive report with patient_summary, critical_alerts, and action_plan. USE THIS FIRST for patient assessments.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier (UUID)',
        },
      },
      required: ['patient_id'],
    },
  },

  // ==================== PHASE 1: PRE-DIAGNOSIS RISK ASSESSMENT ====================
  {
    name: 'assess_pre_diagnosis_risk',
    description:
      'PHASE 1: Assess CKD risk when eGFR/uACR unavailable. Uses 3-tier stratification (HIGH/MODERATE/LOW) based on comorbidities, medications, vitals, and clinical indicators. Returns testing urgency, expected yield, and Minuteful Kidney recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier (UUID)',
        },
      },
      required: ['patient_id'],
    },
  },

  // ==================== PHASE 2: CKD DIAGNOSIS & STAGING ====================
  {
    name: 'classify_kdigo',
    description:
      'PHASE 2: Perform KDIGO classification using eGFR and uACR values. Returns GFR category (G1-G5), albuminuria category (A1-A3), risk level (GREEN/YELLOW/ORANGE/RED), trajectory analysis for rapid progressors, and monitoring frequency recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier',
        },
      },
      required: ['patient_id'],
    },
  },

  // ==================== PHASE 3: TREATMENT DECISION SUPPORT ====================
  {
    name: 'assess_treatment_options',
    description:
      'PHASE 3: Evaluate eligibility for Jardiance (SGLT2i) and RAS inhibitors based on KDIGO 2024 guidelines. Returns indication strength (STRONG/MODERATE/CONTRAINDICATED), EMPA-KIDNEY evidence, contraindications, safety monitoring requirements, and Minuteful Kidney recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier',
        },
      },
      required: ['patient_id'],
    },
  },

  // ==================== PHASE 4: ADHERENCE MONITORING ====================
  {
    name: 'monitor_adherence',
    description:
      'PHASE 4: Calculate Medication Possession Ratio (MPR) from prescription fill records. Detects adherence barriers (gaps, discontinuation, declining frequency), generates smart alerts (CRITICAL/HIGH/MEDIUM), correlates adherence with clinical outcomes (eGFR/uACR trends), and provides barrier-specific recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier',
        },
        medication_type: {
          type: 'string',
          enum: ['SGLT2i', 'RAS_inhibitor', 'ALL'],
          description: 'Type of medication to assess (default: ALL)',
        },
        measurement_period_days: {
          type: 'number',
          description: 'Period for MPR calculation in days (default: 90)',
        },
      },
      required: ['patient_id'],
    },
  },

  {
    name: 'monitor_composite_adherence',
    description:
      'PHASE 4 ENHANCED: Comprehensive composite adherence monitoring combining multiple methods: (1) MPR from pharmacy data, (2) Lab-based treatment response from eGFR/uACR trends, (3) Patient self-reported adherence. Calculates weighted composite score, detects barriers, predicts non-adherence risk, and provides actionable interventions. Recommended for comprehensive adherence assessment of treated patients.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier',
        },
        measurement_period_days: {
          type: 'number',
          description: 'Period for adherence calculation in days (default: 90)',
        },
        include_predictions: {
          type: 'boolean',
          description: 'Include adherence risk prediction (default: true)',
        },
      },
      required: ['patient_id'],
    },
  },

  // ==================== CLINICAL CALCULATION TOOLS ====================
  {
    name: 'calculate_egfr',
    description:
      'Calculate eGFR using CKD-EPI 2021 formula (race-free). Computes kidney function from creatinine, age, and sex. Use this for on-the-fly eGFR calculation or when database values need validation.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier (UUID)',
        },
        creatinine_mgdl: {
          type: 'number',
          description: 'Serum creatinine in mg/dL (optional - will use latest from DB if not provided)',
        },
      },
      required: ['patient_id'],
    },
  },

  {
    name: 'predict_kidney_failure_risk',
    description:
      'Predict kidney failure risk using KFRE (Kidney Failure Risk Equation). Calculates 2-year and 5-year risk of requiring dialysis or transplant. Use for CKD Stage 3-5 patients to guide treatment intensity and nephrology referral.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier',
        },
        time_horizon: {
          type: 'number',
          enum: [2, 5],
          description: 'Prediction timeframe in years (default: 5)',
        },
      },
      required: ['patient_id'],
    },
  },

  // ==================== GCUA: GERIATRIC CARDIORENAL UNIFIED ASSESSMENT ====================
  {
    name: 'assess_gcua',
    description:
      'GCUA (Geriatric Cardiorenal Unified Assessment): Comprehensive risk stratification for adults 60+ with eGFR > 60. Integrates three validated models: (1) Nelson/CKD-PC 2019 for 5-year incident CKD risk (C-stat 0.845), (2) AHA PREVENT 2024 for 10-year CVD risk with CKM integration, (3) Bansal 2015 for 5-year mortality (competing risk). Assigns patients to one of four phenotypes: I. Accelerated Ager (high renal + CVD), II. Silent Renal (high renal, low CVD - often MISSED by Framingham), III. Vascular Dominant (low renal, high CVD), IV. Senescent (high mortality). Returns treatment recommendations including SGLT2i, RAS inhibitors, statins, BP targets, and monitoring frequency. Use for non-CKD elderly patients to catch silent kidney disease before Framingham misses it.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier (UUID)',
        },
      },
      required: ['patient_id'],
    },
  },

  {
    name: 'check_screening_protocol',
    description:
      'Check adherence to CKD screening protocols based on KDIGO 2024 guidelines. Identifies missing tests (eGFR, uACR, HbA1c) for high-risk patients (DM/HTN) and CKD patients. Returns overdue screening tests with urgency levels.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier',
        },
      },
      required: ['patient_id'],
    },
  },

  {
    name: 'assess_medication_safety',
    description:
      'Assess medication safety based on current kidney function. Identifies medications requiring dose reduction (e.g., gabapentin, metformin), contraindications (e.g., NSAIDs in CKD), and nephrotoxic exposures. Returns specific dosing recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier',
        },
        medication_name: {
          type: 'string',
          description: 'Optional: Check specific medication (e.g., "Metformin", "Gabapentin")',
        },
      },
      required: ['patient_id'],
    },
  },

  {
    name: 'analyze_adherence',
    description:
      'Analyze medication and screening protocol adherence. Tracks medication refill gaps (Jardiance, RAS inhibitors) and screening compliance (eGFR, uACR, HbA1c) based on KDIGO risk-stratified monitoring schedules. Returns adherence score (0-100) and actionable alerts.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier',
        },
        check_medication: {
          type: 'string',
          description: 'Optional: Focus analysis on specific medication (e.g., "Jardiance")',
        },
        report_date: {
          type: 'string',
          description: 'Optional: Date for analysis in YYYY-MM-DD format (default: today)',
        },
      },
      required: ['patient_id'],
    },
  },

  // ==================== LEGACY TOOLS (Backwards Compatibility) ====================
  {
    name: 'get_patient_data',
    description:
      'LEGACY: Retrieve comprehensive patient information including demographics, vitals, comorbidities, medications. Use phase-specific tools for clinical decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier (UUID)',
        },
        include_labs: {
          type: 'boolean',
          description: 'Include recent lab results (default: true)',
        },
        include_risk: {
          type: 'boolean',
          description: 'Include risk assessment (default: true)',
        },
      },
      required: ['patient_id'],
    },
  },

  {
    name: 'query_lab_results',
    description:
      'Query laboratory results for a patient with optional filtering by observation type and date range.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: {
          type: 'string',
          description: 'Patient identifier',
        },
        observation_type: {
          type: 'string',
          description: 'Type of lab test',
          enum: ['eGFR', 'uACR', 'Creatinine', 'HbA1c', 'Albumin', 'All'],
        },
        date_range: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date' },
            end: { type: 'string', format: 'date' },
          },
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 20)',
        },
      },
      required: ['patient_id'],
    },
  },

  {
    name: 'get_population_stats',
    description:
      'Get aggregated statistics across the patient population with optional filtering and grouping.',
    inputSchema: {
      type: 'object',
      properties: {
        filters: {
          type: 'object',
          properties: {
            has_diabetes: { type: 'boolean' },
            has_hypertension: { type: 'boolean' },
            on_sglt2i: { type: 'boolean' },
            on_ras_inhibitor: { type: 'boolean' },
            risk_level: {
              type: 'string',
              enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
            },
            age_min: { type: 'number' },
            age_max: { type: 'number' },
          },
        },
        group_by: {
          type: 'string',
          enum: ['risk_level', 'ckd_stage', 'medication', 'comorbidity'],
        },
      },
    },
  },

  {
    name: 'search_guidelines',
    description: 'Search KDIGO 2024 clinical practice guidelines for specific topics.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Topic to search (e.g., "blood pressure", "diabetes", "referral")',
        },
        ckd_stage: {
          type: 'string',
          description: 'CKD stage for stage-specific recommendations',
        },
      },
      required: ['topic'],
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'healthcare-mcp-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handler for tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ========== MASTER ORCHESTRATOR TOOL ==========
      case 'comprehensive_ckd_analysis': {
        const result = await comprehensiveCKDAnalysis(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // ========== PHASE-BASED TOOLS ==========
      case 'assess_pre_diagnosis_risk': {
        const result = await assessPreDiagnosisRisk(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'classify_kdigo': {
        const result = await classifyKDIGO(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'assess_treatment_options': {
        const result = await assessTreatmentOptions(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'monitor_adherence': {
        const result = await monitorAdherence(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'monitor_composite_adherence': {
        const result = await monitorCompositeAdherence(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // ========== CLINICAL CALCULATION TOOLS ==========
      case 'calculate_egfr': {
        const result = await calculateEGFR(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'predict_kidney_failure_risk': {
        const result = await predictKidneyFailureRisk(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'assess_gcua': {
        const result = await assessGCUA(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'check_screening_protocol': {
        const result = await checkScreeningProtocol(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'assess_medication_safety': {
        const result = await assessMedicationSafety(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'analyze_adherence': {
        const result = await analyzeAdherence(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // ========== LEGACY TOOLS ==========
      case 'get_patient_data': {
        const result = await getPatientData(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'query_lab_results': {
        const result = await queryLabResults(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'calculate_ckd_risk': {
        const result = await calculateCKDRisk(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_population_stats': {
        const result = await getPopulationStats(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_guidelines': {
        const result = await searchGuidelines(args as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  console.error('========================================');
  console.error('Healthcare MCP Server v2.0');
  console.error('Unified CKD Management System');
  console.error('========================================');

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('✗ Failed to connect to database');
    process.exit(1);
  }

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  console.error('\n✓ MCP Server running');
  console.error('\n📋 Available Tools:');
  console.error('  🎯 ORCHESTRATOR: comprehensive_ckd_analysis (USE THIS FIRST!)');
  console.error('  PHASE 1: assess_pre_diagnosis_risk');
  console.error('  PHASE 2: classify_kdigo');
  console.error('  PHASE 3: assess_treatment_options');
  console.error('  PHASE 4: monitor_adherence, monitor_composite_adherence (ENHANCED)');
  console.error('  CLINICAL: calculate_egfr, predict_kidney_failure_risk, assess_gcua, check_screening_protocol, assess_medication_safety, analyze_adherence');
  console.error('  LEGACY: get_patient_data, query_lab_results, get_population_stats, search_guidelines');
  console.error('\n========================================\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
