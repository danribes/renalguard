import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';
import { classifyKDIGO } from '../utils/kdigo';
import { getMCPClient } from './mcpClient';

interface LabValues {
  egfr?: number;
  uacr?: number;
  creatinine?: number;
  bun?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  hba1c?: number;
  glucose?: number;
  hemoglobin?: number;
  heart_rate?: number;
  oxygen_saturation?: number;
}

interface Phase3TreatmentRecommendations {
  jardiance?: {
    indication: string;
    evidence: string;
    reasoning: string[];
  };
  rasInhibitor?: {
    indication: string;
    evidence: string;
    reasoning: string[];
  };
  minutefulKidney?: {
    recommended: boolean;
    frequency: string | null;
    rationale: string;
    adherenceBenefits: string;
  };
}

interface PatientContext {
  patientId: string;
  firstName: string;
  lastName: string;
  age: number;
  isCkd: boolean;
  currentHealthState?: string;
  previousHealthState?: string;
  treatmentActive: boolean;
  treatmentType?: string;
  monitoringActive: boolean;
  monitoringDevice?: string;
  cycleNumber: number;
  previousCycleNumber?: number;
  // CKD status transition
  hasTransitioned?: boolean;
  transitionType?: 'non-ckd-to-ckd' | 'ckd-to-non-ckd';
  // KDIGO clinical recommendations
  recommendRasInhibitor?: boolean;
  recommendSglt2i?: boolean;
  requiresNephrologyReferral?: boolean;
  riskLevel?: 'low' | 'moderate' | 'high' | 'very_high';
  gfrCategory?: string;
  albuminuriaCategory?: string;
  // Phase 3 treatment recommendations
  phase3Recommendations?: Phase3TreatmentRecommendations;
  // GCUA Assessment (for patients 60+ years) - REPLACES SCORED/Framingham
  gcua_phenotype_type?: string;
  gcua_phenotype_name?: string;
  gcua_renal_risk?: number;
  gcua_renal_risk_category?: string;
  gcua_cvd_risk?: number;
  gcua_cvd_risk_category?: string;
  gcua_mortality_risk?: number;
  gcua_mortality_risk_category?: string;
  gcua_benefit_ratio?: number;
  gcua_benefit_ratio_interpretation?: string;
  gcua_confidence_level?: string;
  gcua_home_monitoring_recommended?: boolean;
  // Demographics and comorbidities (for context)
  gender?: 'male' | 'female';
  has_hypertension?: boolean;
  has_diabetes?: boolean;
  has_cvd?: boolean;
  has_pvd?: boolean;
  smoking_status?: 'never' | 'former' | 'current';
  bmi?: number;
  // MCP Comprehensive Analyses (baseline and post-update)
  mcpBaselineAnalysis?: any;
  mcpPostUpdateAnalysis?: any;
  // MCP Error Messages (if MCP analysis failed)
  mcpBaselineError?: string;
  mcpPostUpdateError?: string;
}

interface AIAnalysisResult {
  hasSignificantChanges: boolean;
  commentText: string;
  clinicalSummary: string;
  keyChanges: string[];
  recommendedActions: string[];
  severity: 'info' | 'warning' | 'critical';
  concernLevel: 'none' | 'mild' | 'moderate' | 'high';
}

export class AIUpdateAnalysisService {
  private anthropic: Anthropic;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Analyzes patient update and generates AI-powered comment
   */
  async analyzePatientUpdate(
    patientContext: PatientContext,
    previousLabValues: LabValues,
    newLabValues: LabValues
  ): Promise<AIAnalysisResult> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[AI Analysis] 🤖 STARTING AI PATIENT UPDATE ANALYSIS`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Patient: ${patientContext.firstName} ${patientContext.lastName} (ID: ${patientContext.patientId})`);
    console.log(`CKD Status: ${patientContext.isCkd ? 'CKD Patient' : 'Non-CKD At-Risk'}`);
    console.log(`Health State: ${patientContext.previousHealthState || 'N/A'} → ${patientContext.currentHealthState || 'N/A'}`);
    console.log(`Has Transitioned: ${patientContext.hasTransitioned ? `YES (${patientContext.transitionType})` : 'NO'}`);
    console.log(`Treatment Active: ${patientContext.treatmentActive ? 'YES' : 'NO'}`);
    console.log(`Monitoring Active: ${patientContext.monitoringActive ? 'YES' : 'NO'}`);
    console.log(`${'='.repeat(80)}\n`);

    // Calculate changes
    const changes = this.calculateLabChanges(previousLabValues, newLabValues);

    // Check if there are significant changes (threshold: any change > 5% or important clinical thresholds)
    const hasSignificantChanges = this.hasSignificantChanges(changes, previousLabValues, newLabValues);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[AI Analysis] 📋 SIGNIFICANCE SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Calculated Significance: ${hasSignificantChanges ? '✅ SIGNIFICANT CHANGES DETECTED' : '❌ NO SIGNIFICANT CHANGES'}`);
    console.log(`CKD Transition: ${patientContext.hasTransitioned ? '✅ YES - WILL FORCE SIGNIFICANT' : '❌ NO'}`);
    console.log(`${'='.repeat(80)}\n`);

    // Fetch Phase 3 treatment recommendations for CKD patients or those at risk
    // This is CRITICAL for proper treatment and monitoring recommendations
    if (patientContext.isCkd || (newLabValues.egfr && newLabValues.egfr < 60) ||
        (newLabValues.uacr && newLabValues.uacr >= 30)) {
      try {
        console.log(`[AI Analysis] 💊 Fetching Phase 3 treatment recommendations for patient ${patientContext.patientId}...`);
        const phase3Recs = await this.fetchPhase3Recommendations(patientContext.patientId);
        patientContext.phase3Recommendations = phase3Recs;
        console.log(`[AI Analysis] ✓ Phase 3 recommendations received:`, {
          jardiance: phase3Recs.jardiance?.indication || 'Not recommended',
          rasInhibitor: phase3Recs.rasInhibitor?.indication || 'Not recommended',
          minutefulKidney: phase3Recs.minutefulKidney?.recommended ? `${phase3Recs.minutefulKidney.frequency}` : 'Not recommended'
        });
      } catch (error) {
        console.error('[AI Analysis] ⚠️  Error fetching Phase 3 recommendations:', error);
        // Continue without Phase 3 recommendations rather than failing
      }
    } else {
      console.log(`[AI Analysis] ⊘ Skipping Phase 3 recommendations (not CKD/at-risk)`);
    }

    // For transitions, ALWAYS generate detailed analysis even if lab changes are small
    // For non-transitions, respect the calculated significance
    const forceSignificant = patientContext.hasTransitioned || false;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[AI Analysis] 🧠 CALLING CLAUDE AI FOR ANALYSIS`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Will call AI: YES (always analyze to generate appropriate response)`);
    console.log(`${'='.repeat(80)}\n`);

    // Call Claude AI to analyze the changes
    // - For transitions: Always generate comprehensive analysis
    // - For non-transitions with significant changes: Generate detailed analysis
    // - For stable patients: Generate brief stability note
    const aiAnalysis = await this.generateAIAnalysis(patientContext, previousLabValues, newLabValues, changes);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[AI Analysis] ✅ AI ANALYSIS COMPLETE`);
    console.log(`${'='.repeat(80)}`);

    // Override hasSignificantChanges only for transitions (which are always clinically significant)
    // Otherwise, respect the calculated value from hasSignificantChanges()
    if (forceSignificant) {
      aiAnalysis.hasSignificantChanges = true;
      console.log(`Final Significance: ✅ SIGNIFICANT (CKD status transition detected)`);
      console.log(`Reason: CKD transitions are ALWAYS clinically significant`);
    } else {
      aiAnalysis.hasSignificantChanges = hasSignificantChanges;
      console.log(`Final Significance: ${hasSignificantChanges ? '✅ SIGNIFICANT' : '❌ NOT SIGNIFICANT'}`);
      console.log(`Reason: Based on clinical threshold evaluation`);
    }

    console.log(`AI Analysis Result Summary:`);
    console.log(`  - hasSignificantChanges: ${aiAnalysis.hasSignificantChanges}`);
    console.log(`  - severity: ${aiAnalysis.severity}`);
    console.log(`  - concernLevel: ${aiAnalysis.concernLevel}`);
    console.log(`  - commentText: "${aiAnalysis.commentText.substring(0, 80)}..."`);
    console.log(`${'='.repeat(80)}\n`);

    return aiAnalysis;
  }

  /**
   * Fetches Phase 3 treatment recommendations from MCP server
   */
  private async fetchPhase3Recommendations(patientId: string): Promise<Phase3TreatmentRecommendations> {
    try {
      // Get properly connected MCP client
      const mcpClient = await getMCPClient();

      const result = await mcpClient.assessTreatmentOptions(patientId);

      if (!result) {
        console.warn('[AI Analysis] Phase 3 returned no recommendations');
        return {};
      }

      // MCP client already parses the result, so we can use it directly
      const data = result;

      return {
        jardiance: data.jardiance ? {
          indication: data.jardiance.indication,
          evidence: data.jardiance.evidence,
          reasoning: data.jardiance.reasoning || []
        } : undefined,
        rasInhibitor: data.rasInhibitor ? {
          indication: data.rasInhibitor.indication,
          evidence: data.rasInhibitor.evidence,
          reasoning: data.rasInhibitor.reasoning || []
        } : undefined,
        minutefulKidney: data.minutefulKidney ? {
          recommended: data.minutefulKidney.recommended,
          frequency: data.minutefulKidney.frequency,
          rationale: data.minutefulKidney.rationale,
          adherenceBenefits: data.minutefulKidney.adherenceBenefits
        } : undefined
      };
    } catch (error) {
      console.error('[AI Analysis] Error in fetchPhase3Recommendations:', error);
      return {};
    }
  }

  /**
   * Calculates percentage and absolute changes in lab values
   */
  private calculateLabChanges(previous: LabValues, current: LabValues): Record<string, { absolute: number; percentage: number }> {
    const changes: Record<string, { absolute: number; percentage: number }> = {};

    console.log(`\n${'='.repeat(80)}`);
    console.log(`[AI Analysis] 📊 CALCULATING LAB VALUE CHANGES`);
    console.log(`${'='.repeat(80)}`);

    const keys = Object.keys(current) as Array<keyof LabValues>;
    for (const key of keys) {
      const prevValue = previous[key];
      const currValue = current[key];

      if (prevValue !== undefined && currValue !== undefined) {
        // Convert to numbers in case they're strings
        const prevNum = typeof prevValue === 'string' ? parseFloat(prevValue) : prevValue;
        const currNum = typeof currValue === 'string' ? parseFloat(currValue) : currValue;

        const absolute = currNum - prevNum;
        const percentage = prevNum !== 0 ? (absolute / prevNum) * 100 : 0;
        changes[key] = { absolute, percentage };

        console.log(`  ${key}: ${prevNum.toFixed(2)} → ${currNum.toFixed(2)} (Δ ${absolute >= 0 ? '+' : ''}${absolute.toFixed(2)}, ${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%)`);
      }
    }

    console.log(`${'='.repeat(80)}\n`);
    return changes;
  }

  /**
   * Determines if changes are clinically significant
   * Uses sensitive thresholds appropriate for CKD monitoring
   */
  private hasSignificantChanges(
    changes: Record<string, { absolute: number; percentage: number }>,
    previous: LabValues,
    current: LabValues
  ): boolean {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[AI Analysis] 🔍 EVALUATING CLINICAL SIGNIFICANCE`);
    console.log(`${'='.repeat(80)}`);

    // Check for significant changes in key metrics
    // Note: Thresholds lowered to catch gradual but clinically important changes

    // eGFR: >=1.5 ml/min/1.73m² change or >2% change
    // Even small declines (1.5-3 units) are clinically significant in CKD monitoring
    if (changes.egfr) {
      const absChange = Math.abs(changes.egfr.absolute);
      const pctChange = Math.abs(changes.egfr.percentage);
      const isSignificant = absChange >= 1.5 || pctChange > 2;

      console.log(`  ✓ eGFR Check: ${changes.egfr.absolute.toFixed(1)} units (${changes.egfr.percentage.toFixed(1)}%)`);
      console.log(`    - Absolute change: ${absChange.toFixed(1)} >= 1.5? ${absChange >= 1.5 ? '✓ YES' : '✗ NO'}`);
      console.log(`    - Percentage change: ${pctChange.toFixed(1)}% > 2%? ${pctChange > 2 ? '✓ YES' : '✗ NO'}`);
      console.log(`    - Result: ${isSignificant ? '🚨 SIGNIFICANT' : '✓ Within normal variation'}`);

      if (isSignificant) {
        console.log(`\n[AI Analysis] ✅ SIGNIFICANCE DETECTED: eGFR change`);
        console.log(`${'='.repeat(80)}\n`);
        return true;
      }
    } else {
      console.log(`  ⊘ eGFR: No change data available`);
    }

    // uACR: >10% change or crossing albuminuria categories
    // Proteinuria changes are important markers of kidney disease progression
    if (changes.uacr) {
      const pctChange = Math.abs(changes.uacr.percentage);
      const isSignificant = pctChange > 10;

      console.log(`  ✓ uACR Check: ${changes.uacr.percentage.toFixed(1)}%`);
      console.log(`    - Percentage change: ${pctChange.toFixed(1)}% > 10%? ${isSignificant ? '✓ YES' : '✗ NO'}`);
      console.log(`    - Result: ${isSignificant ? '🚨 SIGNIFICANT' : '✓ Within normal variation'}`);

      if (isSignificant) {
        console.log(`\n[AI Analysis] ✅ SIGNIFICANCE DETECTED: uACR change`);
        console.log(`${'='.repeat(80)}\n`);
        return true;
      }
    } else {
      console.log(`  ⊘ uACR: No change data available`);
    }

    // Check albuminuria category crossing (A1, A2, A3)
    if (previous.uacr !== undefined && current.uacr !== undefined) {
      const prevCategory = this.getAlbuminuriaCategory(previous.uacr);
      const currCategory = this.getAlbuminuriaCategory(current.uacr);
      const categoryCrossed = prevCategory !== currCategory;

      console.log(`  ✓ Albuminuria Category Check: ${prevCategory} → ${currCategory}`);
      console.log(`    - Category changed? ${categoryCrossed ? '✓ YES - SIGNIFICANT' : '✗ NO'}`);

      if (categoryCrossed) {
        console.log(`\n[AI Analysis] ✅ SIGNIFICANCE DETECTED: Albuminuria category crossing`);
        console.log(`${'='.repeat(80)}\n`);
        return true;
      }
    }

    // Creatinine: >10% change
    if (changes.creatinine) {
      const pctChange = Math.abs(changes.creatinine.percentage);
      const isSignificant = pctChange > 10;

      console.log(`  ✓ Creatinine Check: ${changes.creatinine.percentage.toFixed(1)}%`);
      console.log(`    - Percentage change: ${pctChange.toFixed(1)}% > 10%? ${isSignificant ? '✓ YES' : '✗ NO'}`);

      if (isSignificant) {
        console.log(`\n[AI Analysis] ✅ SIGNIFICANCE DETECTED: Creatinine change`);
        console.log(`${'='.repeat(80)}\n`);
        return true;
      }
    }

    // Blood pressure: significant hypertension or changes >10 mmHg
    if (current.systolic_bp) {
      const isAbnormal = current.systolic_bp > 160 || current.systolic_bp < 90;
      console.log(`  ✓ Blood Pressure Absolute Check: ${current.systolic_bp} mmHg`);
      console.log(`    - Abnormal (<90 or >160)? ${isAbnormal ? '✓ YES - SIGNIFICANT' : '✗ NO'}`);

      if (isAbnormal) {
        console.log(`\n[AI Analysis] ✅ SIGNIFICANCE DETECTED: Abnormal blood pressure`);
        console.log(`${'='.repeat(80)}\n`);
        return true;
      }
    }

    if (changes.systolic_bp) {
      const absChange = Math.abs(changes.systolic_bp.absolute);
      const isSignificant = absChange > 10;

      console.log(`  ✓ Blood Pressure Change Check: ${changes.systolic_bp.absolute.toFixed(1)} mmHg`);
      console.log(`    - Absolute change: ${absChange.toFixed(1)} > 10? ${isSignificant ? '✓ YES' : '✗ NO'}`);

      if (isSignificant) {
        console.log(`\n[AI Analysis] ✅ SIGNIFICANCE DETECTED: Blood pressure change`);
        console.log(`${'='.repeat(80)}\n`);
        return true;
      }
    }

    // HbA1c: >0.3% change or poor control
    if (changes.hba1c || current.hba1c) {
      const absChange = changes.hba1c ? Math.abs(changes.hba1c.absolute) : 0;
      const poorControl = current.hba1c && current.hba1c > 8;
      const isSignificant = absChange > 0.3 || poorControl;

      console.log(`  ✓ HbA1c Check: ${changes.hba1c ? changes.hba1c.absolute.toFixed(1) : '0.0'} (current: ${current.hba1c || 'N/A'})`);
      console.log(`    - Absolute change: ${absChange.toFixed(1)} > 0.3? ${absChange > 0.3 ? '✓ YES' : '✗ NO'}`);
      console.log(`    - Poor control (>8%)? ${poorControl ? '✓ YES' : '✗ NO'}`);

      if (isSignificant) {
        console.log(`\n[AI Analysis] ✅ SIGNIFICANCE DETECTED: HbA1c ${poorControl ? 'poor control' : 'change'}`);
        console.log(`${'='.repeat(80)}\n`);
        return true;
      }
    }

    // Hemoglobin: anemia concerns or >5% change
    if (current.hemoglobin) {
      const isAnemic = current.hemoglobin < 10;
      console.log(`  ✓ Hemoglobin Anemia Check: ${current.hemoglobin} g/dL`);
      console.log(`    - Anemic (<10 g/dL)? ${isAnemic ? '✓ YES - SIGNIFICANT' : '✗ NO'}`);

      if (isAnemic) {
        console.log(`\n[AI Analysis] ✅ SIGNIFICANCE DETECTED: Anemia`);
        console.log(`${'='.repeat(80)}\n`);
        return true;
      }
    }

    if (changes.hemoglobin) {
      const pctChange = Math.abs(changes.hemoglobin.percentage);
      const isSignificant = pctChange > 5;

      console.log(`  ✓ Hemoglobin Change Check: ${changes.hemoglobin.percentage.toFixed(1)}%`);
      console.log(`    - Percentage change: ${pctChange.toFixed(1)}% > 5%? ${isSignificant ? '✓ YES' : '✗ NO'}`);

      if (isSignificant) {
        console.log(`\n[AI Analysis] ✅ SIGNIFICANCE DETECTED: Hemoglobin change`);
        console.log(`${'='.repeat(80)}\n`);
        return true;
      }
    }

    // If no significant changes detected
    console.log(`\n[AI Analysis] ❌ NO SIGNIFICANT CHANGES DETECTED`);
    console.log(`  All values within acceptable clinical variation`);
    console.log(`${'='.repeat(80)}\n`);

    return false;
  }

  /**
   * Gets KDIGO albuminuria category
   */
  private getAlbuminuriaCategory(uacr: number): string {
    if (uacr < 30) return 'A1';
    if (uacr < 300) return 'A2';
    return 'A3';
  }

  /**
   * Calls Claude AI to generate clinical analysis
   */
  private async generateAIAnalysis(
    context: PatientContext,
    previous: LabValues,
    current: LabValues,
    changes: Record<string, { absolute: number; percentage: number }>
  ): Promise<AIAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(context, previous, current, changes);

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const result = this.parseAIResponse(responseText);

      // Validate AI recommendations for consistency with treatment/monitoring status
      const validation = this.validateAIRecommendations(context, result);

      // If validation fails, add warning to clinical summary
      if (!validation.valid) {
        console.warn('⚠️  AI recommendations contain contradictions. Adding validation warnings to summary.');
        result.clinicalSummary += '\n\n[VALIDATION WARNING: AI recommendations may contain inconsistencies. Please review treatment/monitoring status carefully.]';

        // Log detailed errors for debugging
        validation.errors.forEach(err => {
          console.error(`  - ${err}`);
        });
      }

      return result;
    } catch (error) {
      console.error('Error calling Claude AI for update analysis:', error);
      // Return a fallback analysis
      return this.generateFallbackAnalysis(context, previous, current, changes);
    }
  }

  /**
   * Builds the prompt for Claude AI analysis
   */
  private buildAnalysisPrompt(
    context: PatientContext,
    previous: LabValues,
    current: LabValues,
    changes: Record<string, { absolute: number; percentage: number }>
  ): string {
    // Build clinical recommendations summary
    const clinicalRecommendations: string[] = [];
    if (context.recommendRasInhibitor) {
      clinicalRecommendations.push('RAS Inhibitor (ACE-I/ARB) recommended');
    }
    if (context.recommendSglt2i) {
      clinicalRecommendations.push('SGLT2 Inhibitor recommended');
    }
    if (context.requiresNephrologyReferral) {
      clinicalRecommendations.push('Nephrology referral required');
    }

    const recommendationsText = clinicalRecommendations.length > 0
      ? clinicalRecommendations.join(', ')
      : 'Standard monitoring';

    // Build Phase 3 treatment recommendations section
    let phase3Section = '\n**Phase 3 Treatment Decision Analysis:**\n';
    if (context.phase3Recommendations) {
      const p3 = context.phase3Recommendations;

      // Jardiance/SGLT2i recommendation
      if (p3.jardiance) {
        phase3Section += `\n*SGLT2 Inhibitor (Jardiance):*\n`;
        phase3Section += `- Indication Level: ${p3.jardiance.indication}\n`;
        phase3Section += `- Evidence: ${p3.jardiance.evidence}\n`;
        if (p3.jardiance.reasoning && p3.jardiance.reasoning.length > 0) {
          phase3Section += `- Reasoning: ${p3.jardiance.reasoning.join('; ')}\n`;
        }
      }

      // RAS Inhibitor recommendation
      if (p3.rasInhibitor) {
        phase3Section += `\n*RAS Inhibitor (ACE-I/ARB):*\n`;
        phase3Section += `- Indication Level: ${p3.rasInhibitor.indication}\n`;
        phase3Section += `- Evidence: ${p3.rasInhibitor.evidence}\n`;
        if (p3.rasInhibitor.reasoning && p3.rasInhibitor.reasoning.length > 0) {
          phase3Section += `- Reasoning: ${p3.rasInhibitor.reasoning.join('; ')}\n`;
        }
      }

      // Minuteful Kidney home monitoring
      if (p3.minutefulKidney) {
        phase3Section += `\n*Home Monitoring (Minuteful Kidney):*\n`;
        phase3Section += `- Recommended: ${p3.minutefulKidney.recommended ? 'YES' : 'NO'}\n`;
        if (p3.minutefulKidney.recommended) {
          phase3Section += `- Frequency: ${p3.minutefulKidney.frequency || 'To be determined'}\n`;
          phase3Section += `- Rationale: ${p3.minutefulKidney.rationale}\n`;
          phase3Section += `- Adherence Benefits: ${p3.minutefulKidney.adherenceBenefits}\n`;
        }
      }
    } else {
      phase3Section += 'Phase 3 analysis not available for this patient.\n';
    }

    // Build GCUA risk assessment section for patients 60+ years
    // This REPLACES the old SCORED and Framingham sections
    let gcuaSection = '';
    if (context.gcua_phenotype_type) {
      gcuaSection = `
═══════════════════════════════════════════════════════════════════════════════
🧬 GCUA CARDIORENAL RISK ASSESSMENT (GERIATRIC CARDIORENAL UNIFIED ASSESSMENT)
═══════════════════════════════════════════════════════════════════════════════

**GCUA Phenotype: ${context.gcua_phenotype_type} - ${context.gcua_phenotype_name}**
Confidence Level: ${context.gcua_confidence_level || 'Unknown'}

**Integrated Risk Scores (Three Validated Models):**

1. **Renal Risk (Nelson/CKD-PC 2019):** ${context.gcua_renal_risk?.toFixed(1) || 'N/A'}% 5-year risk
   - Category: ${context.gcua_renal_risk_category || 'Unknown'}
   - Interpretation: ${context.gcua_renal_risk !== undefined && context.gcua_renal_risk >= 15
     ? 'HIGH RENAL RISK - Nephroprotective strategies essential (SGLT2i, ACE/ARB)'
     : context.gcua_renal_risk !== undefined && context.gcua_renal_risk >= 5
       ? 'MODERATE RENAL RISK - Proactive kidney monitoring recommended'
       : 'LOW RENAL RISK - Standard preventive care'}

2. **CVD Risk (AHA PREVENT 2024):** ${context.gcua_cvd_risk?.toFixed(1) || 'N/A'}% 10-year risk
   - Category: ${context.gcua_cvd_risk_category || 'Unknown'}
   - Interpretation: ${context.gcua_cvd_risk !== undefined && context.gcua_cvd_risk >= 20
     ? 'HIGH CVD RISK - Aggressive lipid management, BP control (<130/80), antiplatelet consideration'
     : context.gcua_cvd_risk !== undefined && context.gcua_cvd_risk >= 7.5
       ? 'INTERMEDIATE CVD RISK - Optimize lipid profile, manage hypertension, lifestyle changes'
       : 'LOW CVD RISK - Standard preventive care'}

3. **Mortality Risk (Bansal 2015):** ${context.gcua_mortality_risk?.toFixed(1) || 'N/A'}% 5-year risk
   - Category: ${context.gcua_mortality_risk_category || 'Unknown'}
   - Interpretation: ${context.gcua_mortality_risk !== undefined && context.gcua_mortality_risk >= 50
     ? 'HIGH COMPETING MORTALITY - Focus on quality of life, consider deprescribing, shared decision-making'
     : context.gcua_mortality_risk !== undefined && context.gcua_mortality_risk >= 30
       ? 'MODERATE MORTALITY RISK - Balance aggressive treatment with patient goals'
       : 'LOW MORTALITY RISK - Standard disease modification appropriate'}

**Benefit Ratio:** ${context.gcua_benefit_ratio?.toFixed(2) || 'N/A'}
${context.gcua_benefit_ratio_interpretation || ''}

**Home Monitoring Recommendation:** ${context.gcua_home_monitoring_recommended ? 'YES - Minuteful Kidney home uACR monitoring recommended' : 'Standard clinic monitoring sufficient'}

**PHENOTYPE-SPECIFIC CLINICAL GUIDANCE:**
${context.gcua_phenotype_type === 'I' ? `
🔴 PHENOTYPE I (${context.gcua_phenotype_name}): HIGH PRIORITY
- Both renal AND cardiovascular risk are elevated
- Requires aggressive cardiorenal protection
- SGLT2 inhibitor + RAS inhibitor recommended
- High-intensity statin therapy
- Quarterly monitoring required
- Home uACR monitoring strongly recommended
` : context.gcua_phenotype_type === 'II' ? `
🟠 PHENOTYPE II (Silent Renal): KIDNEY SPECIFIC
- High renal risk with lower CVD risk
- These patients are often MISSED by traditional Framingham screening
- Nephroprotection priority: SGLT2i + RAS inhibitor
- Consider nephrology referral
- Home uACR monitoring critical for early CKD detection
` : context.gcua_phenotype_type === 'III' ? `
🟡 PHENOTYPE III (Vascular Dominant): HEART SPECIFIC
- High CVD risk with lower renal risk
- Standard cardiology protocols apply
- High-intensity statin, BP optimization
- Consider SGLT2i for HF prevention
- Annual renal screening
` : context.gcua_phenotype_type === 'IV' ? `
⚪ PHENOTYPE IV (The Senescent): DE-ESCALATE
- High competing mortality risk (≥50% 5-year)
- Patient more likely to die from other causes than kidney failure
- Focus on quality of life and symptom control
- Consider deprescribing (reduce polypharmacy)
- Avoid aggressive renal protection protocols
- Shared decision-making about treatment intensity
` : context.gcua_phenotype_type === 'Moderate' ? `
🟡 PHENOTYPE MODERATE: PREVENTIVE FOCUS
- Moderate risk across domains
- Lifestyle modifications emphasized
- Consider SGLT2i if diabetes present
- Monitor eGFR and uACR every 6-12 months
- Address modifiable risk factors
` : `
🟢 PHENOTYPE LOW: ROUTINE CARE
- Low risk across all domains
- Maintain healthy lifestyle
- Periodic screening every 2-3 years
- Standard preventive care
`}
═══════════════════════════════════════════════════════════════════════════════
`;
    }

    // Combine risk assessment sections
    let riskAssessmentSection = '';
    if (gcuaSection) {
      riskAssessmentSection = gcuaSection;
    }

    // Build CKD transition alert if applicable
    let transitionAlert = '';
    if (context.hasTransitioned && context.transitionType) {
      if (context.transitionType === 'non-ckd-to-ckd') {
        transitionAlert = `
═══════════════════════════════════════════════════════════════════════════════
🚨 CRITICAL ALERT: CKD STATUS TRANSITION DETECTED 🚨
═══════════════════════════════════════════════════════════════════════════════

**TRANSITION TYPE:** NON-CKD → CKD

This patient has transitioned from Non-CKD to CKD status this cycle. This is a CRITICAL clinical event requiring:

1. **IMMEDIATE ACKNOWLEDGMENT:** Your clinical summary MUST start with: "🚨 CRITICAL: Patient has transitioned to CKD status..."
2. **SEVERITY LEVEL:** Set severity to "critical" and concernLevel to "high"
3. **COMPREHENSIVE ASSESSMENT:**
   - Explain WHY the transition occurred (which lab values crossed thresholds)
   - Identify the new CKD stage and KDIGO classification
   - State the clinical implications of this diagnosis
4. **URGENT ACTIONS REQUIRED:**
   - Initiate CKD treatment protocol if not already started
   - RAS inhibitor (ACE-I/ARB) if albuminuria present
   - SGLT2 inhibitor consideration per guidelines
   - Nephrology referral if stage 3b or higher
   - Increase monitoring frequency
   - Patient education about new CKD diagnosis
5. **PROGNOSIS AND MONITORING:**
   - Discuss progression risk
   - Set aggressive targets for BP, glucose control
   - Emphasize importance of treatment adherence

**DO NOT treat this as a routine update. This is a life-changing diagnosis for the patient.**

═══════════════════════════════════════════════════════════════════════════════
`;
      } else if (context.transitionType === 'ckd-to-non-ckd') {
        transitionAlert = `
═══════════════════════════════════════════════════════════════════════════════
✅ POSITIVE ALERT: CKD STATUS IMPROVEMENT DETECTED ✅
═══════════════════════════════════════════════════════════════════════════════

**TRANSITION TYPE:** CKD → NON-CKD

This patient has improved from CKD to Non-CKD status this cycle. This is excellent news requiring:

1. **ACKNOWLEDGMENT:** Your clinical summary should highlight: "✅ Excellent progress: Patient kidney function has improved to Non-CKD status..."
2. **SEVERITY LEVEL:** Set severity to "info" and concernLevel to "none"
3. **ASSESSMENT:**
   - Explain the improvement (which lab values improved and how)
   - Acknowledge the success of current management
   - Note this doesn't mean "cured" - continued monitoring essential
4. **CONTINUE CURRENT MANAGEMENT:**
   - Maintain current medications that led to improvement
   - Continue lifestyle modifications
   - Ongoing monitoring per guidelines
   - Prevent recurrence

**This is a positive outcome but requires continued vigilance.**

═══════════════════════════════════════════════════════════════════════════════
`;
      }
    }

    // Build comprehensive MCP analysis section
    let mcpComprehensiveSection = '';

    // Check if MCP analysis failed and provide error information
    if (context.mcpBaselineError || context.mcpPostUpdateError) {
      mcpComprehensiveSection = `
═══════════════════════════════════════════════════════════════════════════════
⚠️ MCP CLINICAL DECISION SUPPORT UNAVAILABLE ⚠️
═══════════════════════════════════════════════════════════════════════════════

**SYSTEM ERROR:** MCP comprehensive analysis could not be completed.

${context.mcpBaselineError ? `**Baseline Analysis Error:** ${context.mcpBaselineError}\n` : ''}
${context.mcpPostUpdateError ? `**Post-Update Analysis Error:** ${context.mcpPostUpdateError}\n` : ''}

**IMPACT:** The following advanced clinical decision support features are unavailable:
- Evidence-based treatment recommendations (Jardiance/SGLT2i, RAS inhibitors)
- Minuteful Kidney home monitoring eligibility
- Medication safety assessments and dose adjustments
- Protocol adherence tracking
- Comprehensive risk stratification

**YOUR TASK:**
- Provide analysis based on lab values and KDIGO guidelines only
- Include a clear notice to the user about the MCP system being temporarily unavailable
- Recommend manual review by healthcare provider for treatment decisions
- Base recommendations on standard KDIGO protocols

═══════════════════════════════════════════════════════════════════════════════
`;
    } else if (context.mcpBaselineAnalysis && context.mcpPostUpdateAnalysis) {
      mcpComprehensiveSection = `
═══════════════════════════════════════════════════════════════════════════════
🔬 MCP COMPREHENSIVE CLINICAL DECISION SUPPORT ANALYSIS 🔬
═══════════════════════════════════════════════════════════════════════════════

**CRITICAL: The following contains complete MCP-generated clinical intelligence including:**
- Treatment recommendations (Jardiance/SGLT2i, RAS inhibitors, home monitoring)
- Risk stratification and progression analysis
- Lifestyle modifications (diet, exercise, weight management)
- Medication safety assessments
- Protocol adherence tracking

This data is the GOLD STANDARD for your clinical recommendations. Use it extensively.

**BASELINE ANALYSIS (BEFORE UPDATE):**
${JSON.stringify(context.mcpBaselineAnalysis, null, 2)}

**POST-UPDATE ANALYSIS (AFTER UPDATE):**
${JSON.stringify(context.mcpPostUpdateAnalysis, null, 2)}

**YOUR TASK WITH MCP DATA:**
1. **Compare Baseline vs Post-Update**: Identify what changed between the two analyses
2. **Extract Treatment Recommendations**: Include specific medications, dosing, and evidence from MCP
3. **Identify Critical Alerts**: Highlight any critical alerts or action items from MCP
4. **Synthesize Lifestyle Recommendations**: Include diet, exercise, weight management suggestions
5. **Create Comprehensive Report**: Your clinical summary should reference and expand upon MCP findings

**IMPORTANT RULES FOR USING MCP DATA:**
- If MCP recommends Jardiance (SGLT2i), include the specific evidence level and reasoning
- If MCP recommends RAS inhibitor, include the indication and rationale
- If MCP recommends Minuteful Kidney monitoring, include frequency and benefits
- If MCP identifies progression risk, quantify it in your summary
- If MCP notes lifestyle factors (obesity, smoking), address them in recommended actions

═══════════════════════════════════════════════════════════════════════════════
`;
    } else if (context.mcpBaselineAnalysis) {
      mcpComprehensiveSection = `
═══════════════════════════════════════════════════════════════════════════════
🔬 MCP BASELINE ANALYSIS AVAILABLE 🔬
═══════════════════════════════════════════════════════════════════════════════

**BASELINE ANALYSIS (BEFORE UPDATE):**
${JSON.stringify(context.mcpBaselineAnalysis, null, 2)}

Note: Post-update MCP analysis not available. Base recommendations on baseline analysis and lab changes.

═══════════════════════════════════════════════════════════════════════════════
`;
    } else if (context.mcpPostUpdateAnalysis) {
      mcpComprehensiveSection = `
═══════════════════════════════════════════════════════════════════════════════
🔬 MCP POST-UPDATE ANALYSIS AVAILABLE 🔬
═══════════════════════════════════════════════════════════════════════════════

**POST-UPDATE ANALYSIS:**
${JSON.stringify(context.mcpPostUpdateAnalysis, null, 2)}

Note: Baseline MCP analysis not available. Base recommendations on current analysis.

═══════════════════════════════════════════════════════════════════════════════
`;
    }

    return `You are an expert nephrologist analyzing patient lab value changes. Generate a comprehensive clinical analysis of the following patient update, incorporating MCP clinical decision support data.

**Patient Context:**
- Name: ${context.firstName} ${context.lastName}
- Age: ${context.age}, Gender: ${context.gender || 'Unknown'}
- Patient Type: ${context.isCkd ? 'CKD Patient' : 'Non-CKD At-Risk Patient'}
- Current Health State: ${context.currentHealthState || 'Unknown'} (${context.gfrCategory || 'Unknown'}/${context.albuminuriaCategory || 'Unknown'})
- Previous Health State: ${context.previousHealthState || 'Unknown'}
- Risk Level: ${context.riskLevel || 'Unknown'}
- Treatment Status: ${context.treatmentActive ? `Active (${context.treatmentType || 'Unknown'})` : 'NOT ON TREATMENT'}
- Monitoring Status: ${context.monitoringActive ? `Active${context.monitoringDevice ? ` (${context.monitoringDevice})` : ''}` : 'NOT ON MONITORING'}
- Clinical Recommendations: ${recommendationsText}
- Cycle: ${context.previousCycleNumber || 'N/A'} → ${context.cycleNumber}
${phase3Section}${riskAssessmentSection}
${transitionAlert}
${mcpComprehensiveSection}
**Previous Lab Values (Cycle ${context.previousCycleNumber || 'N/A'}):**
${this.formatLabValues(previous)}

**Current Lab Values (Cycle ${context.cycleNumber}):**
${this.formatLabValues(current)}

**Calculated Changes:**
${this.formatChanges(changes)}

**Task:**
Analyze these changes and provide a structured response in the following JSON format.
IMPORTANT: Even if changes are minimal or the patient is stable, still provide a meaningful analysis commenting on the stability, current status, and appropriate next steps.

{
  "commentText": "A brief, patient-friendly summary (1-2 sentences) of the update",
  "clinicalSummary": "A detailed clinical interpretation (2-3 sentences) for healthcare providers. If changes are minimal, comment on stability and ongoing management needs.",
  "keyChanges": ["Change 1", "Change 2", "Change 3"] (or ["Lab values remain stable"] if minimal changes),
  "recommendedActions": ["Action 1", "Action 2", "Action 3"],
  "severity": "info|warning|critical",
  "concernLevel": "none|mild|moderate|high"
}

**CRITICAL CLINICAL GUIDELINES:**

═══════════════════════════════════════════════════════════════════════════════
🚨 MANDATORY STEP 1: STATUS VERIFICATION - DO THIS BEFORE ANYTHING ELSE! 🚨
═══════════════════════════════════════════════════════════════════════════════

BEFORE making ANY treatment or monitoring recommendation, you MUST:

**A. READ THESE TWO FIELDS from "Patient Context" section above:**

   "Treatment Status: ..." → [Will show "Active (...)" OR "NOT ON TREATMENT"]
   "Monitoring Status: ..." → [Will show "Active (...)" OR "NOT ON MONITORING"]

**B. DETERMINE CURRENT STATE (Required Internal Reasoning):**

   My assessment:
   - Patient treatment status: [Write "Active" OR "Not on Treatment"]
   - Patient monitoring status: [Write "Active" OR "Not on Monitoring"]

**C. APPLY CORRECT RECOMMENDATION LOGIC:**

   IF Treatment Status contains "Active" OR shows medication names:
      ✅ Patient IS on treatment
      ✅ Use phrases: "Continue current treatment", "Optimize therapy", "Adjust regimen"
      ❌ NEVER use: "Initiate treatment", "Start therapy", "Consider starting treatment"
      ❌ NEVER say: "Patient not currently on treatment" (This is FALSE!)

   IF Treatment Status says "NOT ON TREATMENT":
      ✅ Patient is NOT on treatment
      ✅ Use phrases: "Initiate RAS inhibitor", "Start SGLT2 inhibitor", "Begin treatment"
      ❌ NEVER use: "Continue treatment", "Maintain therapy", "Optimize current regimen"

   IF Monitoring Status contains "Active" OR shows device name:
      ✅ Patient IS being monitored at home
      ✅ Use phrases: "Continue home monitoring", "Maintain Minuteful Kidney testing"
      ❌ NEVER use: "Initiate home monitoring", "Start Minuteful Kidney"

   IF Monitoring Status says "NOT ON MONITORING":
      ✅ Patient is NOT being monitored at home
      ✅ Use phrases: "Initiate Minuteful Kidney monitoring", "Start at-home testing"
      ❌ NEVER use: "Continue home monitoring", "Maintain current monitoring"

**D. FINAL VALIDATION (Required Before Submitting Response):**

   Ask yourself:
   - "Does my treatment recommendation match the treatment status I identified?" [YES/NO]
   - "Does my monitoring recommendation match the monitoring status I identified?" [YES/NO]
   - "Did I accidentally recommend 'initiating' something that's already active?" [YES/NO]

   If ANY answer is wrong, REVISE your recommendations immediately!

═══════════════════════════════════════════════════════════════════════════════

1. **Status Verification (CHECK THIS FIRST!):**
   - Look at "Treatment Status:" field in Patient Context section
     * If it says "Active (...)" → Patient IS currently on treatment
     * If it says "NOT ON TREATMENT" → Patient is NOT currently on treatment
   - Look at "Monitoring Status:" field in Patient Context section
     * If it says "Active (...)" → Patient IS currently being monitored
     * If it says "NOT ON MONITORING" → Patient is NOT currently being monitored
   - Look at "Phase 3 Treatment Decision Analysis:" section for detailed treatment/monitoring recommendations
   - These fields are the ONLY source of truth for treatment/monitoring status - use them!

2. **For Patients CURRENTLY ON TREATMENT (Treatment Status: Active):**
   - NEVER recommend "initiating treatment" - they're already being treated!
   - If STABLE/IMPROVING: Acknowledge treatment effectiveness, recommend continuing current regimen
   - If WORSENING: Recommend treatment optimization, dose adjustment, or adding additional agents
   - Use phrases: "continue current treatment", "optimize current therapy", "adjust current regimen", "maintain current management"

3. **For Patients NOT ON TREATMENT (Treatment Status: NOT ON TREATMENT):**
   - CHECK THE PHASE 3 TREATMENT DECISION ANALYSIS SECTION FIRST!
   - If Phase 3 shows STRONG or MODERATE indication for Jardiance OR RAS Inhibitor:
     * MUST recommend initiating the specific medication
     * Include the evidence base from Phase 3 (e.g., "EMPA-KIDNEY trial", "KDIGO Grade 1A")
     * Reference the specific reasoning provided in Phase 3
   - If CKD Stage 3 or higher WITHOUT Phase 3 recommendations: recommend general treatment evaluation
   - If showing WORSENING kidney function: URGENT - recommend immediate treatment initiation
   - Use specific phrases: "Initiate SGLT2 inhibitor (Jardiance)", "Start RAS inhibitor (ACE-I or ARB)"
   - DO NOT use vague phrases like "consider treatment" - be specific based on Phase 3 analysis

4. **Severity Assessment:**
   - Stage 4 CKD (G4) or higher without treatment = CRITICAL severity, HIGH concern
   - Declining eGFR in untreated patient = WARNING or CRITICAL severity
   - Worsening in treated patient = WARNING severity (treatment needs optimization)
   - Any progression to higher risk category = at least WARNING severity
   - **HEALTH STATE TRANSITION** (e.g., Non-CKD → CKD, G3a → G3b, A1 → A2) = WARNING or CRITICAL severity

5. **Actionable Recommendations:**
   - Be SPECIFIC based on treatment status
   - For TREATED patients: "Continue RAS inhibitor", "Optimize SGLT2i dosing", "Monitor treatment response"
   - For UNTREATED patients: "Initiate RAS inhibitor therapy", "Start SGLT2 inhibitor"
   - Always verify treatment status before suggesting any treatment-related action

6. **Health State Changes - CRITICAL: Detect and Alert on Transitions:**

   **A. Check for Health State Transition:**
   - Compare "Previous Health State" vs "Current Health State" in Patient Context
   - Examples of transitions:
     * Non-CKD → CKD (ANY stage): **CRITICAL - New CKD diagnosis**
     * G1/G2 → G3a/G3b: **WARNING - Progressed to CKD**
     * G3a → G3b: **WARNING - Worsening kidney function**
     * G3b → G4: **CRITICAL - Advanced CKD**
     * A1 → A2: **WARNING - Developing albuminuria**
     * A2 → A3: **CRITICAL - Severe proteinuria**

   **B. If Health State Changed:**
   - Severity: Set to WARNING (for one-stage progression) or CRITICAL (for multi-stage or to G4/G5)
   - Concern Level: Set to MODERATE or HIGH (never "none" for state transition)
   - Comment Text: MUST mention the transition explicitly
     * Example: "Patient has progressed from Non-CKD to Moderate CKD (G3a-A1)"
     * Example: "Health state worsened from G2-A1 to G3a-A2"
   - Clinical Summary: Explain WHAT changed, WHY it matters, WHAT to do
     * Example: "eGFR declined from [X] to [Y] mL/min/1.73m², crossing threshold into CKD Stage 3a. This represents new-onset CKD requiring treatment initiation and closer monitoring."

   **C. For NON-CKD → CKD Transition (MOST CRITICAL):**
   - This is a MAJOR clinical event - NOT routine!
   - Severity: WARNING or CRITICAL
   - Concern Level: MODERATE or HIGH
   - MUST include in recommended actions:
     * "Initiate CKD disease-modifying therapy" (with specific medications from Phase 3)
     * "Initiate Minuteful Kidney home monitoring" (if recommended)
     * "Schedule follow-up in [specific timeframe]" (based on new KDIGO risk)
     * "Patient education about CKD diagnosis and kidney-protective measures"
     * "Assess for CKD complications" (anemia, bone disease if eGFR <45)

   **D. For Worsening Within CKD Stages:**
   - Declining eGFR: Quantify the decline (mL/min/year)
   - Worsening albuminuria: Note percentage increase
   - If UNTREATED: "Progressive CKD without disease-modifying therapy - URGENT need for treatment initiation"
   - If TREATED: "Progression despite treatment - consider therapy optimization or nephrology referral"

   **E. Stable Health State:**
   - If "Previous Health State" = "Current Health State":
     * Acknowledge stability in clinical summary
     * Still assess if biomarkers changed within same health state
     * Example: "Health state remains G3a-A1 (stable), but eGFR declined 3 mL/min since last cycle"

7. **Monitoring Status Considerations - CRITICAL: Distinguish Between TWO Types of Monitoring:**

   **A. CLINICAL/LAB MONITORING (Scheduled clinic visits and laboratory tests):**
   - This is ALWAYS ongoing for CKD patients
   - Frequency based on risk level: Every 1-3 months (RED), 3-6 months (ORANGE), 6-12 months (YELLOW), Annually (GREEN)
   - Use phrases: "Continue scheduled lab monitoring every [X months] per [risk level] guidelines"
   - NEVER say just "continue monitoring" without specifying what type

   **B. HOME MONITORING (Minuteful Kidney device for at-home uACR testing):**
   - CHECK THE PHASE 3 TREATMENT DECISION ANALYSIS FOR HOME MONITORING (Minuteful Kidney) RECOMMENDATIONS!
   - If "Monitoring Status: NOT ON MONITORING" AND Phase 3 shows "Recommended: YES":
     * MUST recommend initiating Minuteful Kidney home monitoring
     * Include the specific frequency from Phase 3 (Weekly, Bi-weekly, Monthly)
     * Include the rationale from Phase 3
     * Emphasize adherence benefits: "At-home convenience, 99% usability, ~50% completion in non-compliant populations"
   - If "Monitoring Status: Active (...)" → Patient IS using home monitoring device, acknowledge this
   - For patients WITHOUT Phase 3 monitoring recommendation but high-risk/CKD → Recommend evaluation for home monitoring
   - Use specific phrases: "Initiate Minuteful Kidney home monitoring (Monthly frequency) for at-home uACR tracking between clinic visits"

   **IMPORTANT**: ALWAYS specify BOTH types of monitoring in your recommendations:
   - Example CORRECT: "Continue scheduled lab monitoring every 6-12 months. Initiate Minuteful Kidney home monitoring (Monthly) for at-home uACR tracking."
   - Example WRONG: "Continue monitoring and follow up as scheduled" ← TOO VAGUE!

8. **Biomarker Evolution Analysis - MUST Comment on Trends:**

   **A. eGFR Trends:**
   - Compare current eGFR to previous value
   - Declining trend (any decrease): "eGFR declined from [X] to [Y] mL/min/1.73m² ([Z]% decrease)"
   - Stable (<2 mL/min change): "eGFR remains stable at [Y] mL/min/1.73m²"
   - Improving: "eGFR improved from [X] to [Y] mL/min/1.73m²"
   - Contextualize: "This represents [stable kidney function / gradual progression / concerning decline]"

   **B. uACR Trends:**
   - Compare current uACR to previous value
   - Increasing: "Albuminuria increased from [X] to [Y] mg/g ([Z]% increase)"
   - Decreasing: "Albuminuria decreased from [X] to [Y] mg/g ([Z]% decrease)"
   - Stable: "Albuminuria remains stable at [Y] mg/g"
   - Note category changes: "Progressed from A1 (normal) to A2 (moderate albuminuria)" or "Improved from A2 to A1"
   - If on treatment: "On RAS inhibitor therapy, expect 30-40% reduction in proteinuria"

   **C. Clinical Significance:**
   - eGFR decline >5 mL/min/year = rapid progression
   - eGFR decline 2-5 mL/min/year = moderate progression
   - uACR doubling = significant worsening
   - Both stable = treatment effective OR disease stable

   **D. Integration with Treatment Status:**
   - If UNTREATED and declining → "Progressive decline without treatment intervention - URGENT need for therapy initiation"
   - If TREATED and stable/improving → "Current treatment appears effective in stabilizing kidney function"
   - If TREATED and declining → "Despite treatment, kidney function declining - consider treatment optimization"

9. **Comorbidity Assessment - Address Impact on CKD:**

   **A. Diabetes Impact:**
   - If patient has diabetes: Comment on HbA1c control and its impact on kidney disease
   - HbA1c >8%: "Poor glycemic control (HbA1c [X]%) accelerates kidney damage - intensify diabetes management"
   - HbA1c 7-8%: "Moderate glycemic control - optimize to <7% to slow CKD progression"
   - HbA1c <7%: "Good glycemic control - continue current diabetes management"
   - If diabetic CKD without SGLT2i: "Diabetic kidney disease - SGLT2 inhibitor provides dual benefit for diabetes and kidney protection"

   **B. Hypertension Impact:**
   - Comment on blood pressure control
   - BP ≥140/90: "Uncontrolled hypertension accelerates CKD progression"
   - BP 130-139/80-89: "Borderline BP control - target <130/80 for CKD patients"
   - BP <130/80: "Good BP control - continue current management"
   - If hypertensive with albuminuria without RAS inhibitor: "Hypertensive CKD with albuminuria - RAS inhibitor provides BP control AND kidney protection"

   **C. Heart Failure Impact:**
   - If heart failure present: "Heart failure present - SGLT2 inhibitors provide cardiovascular AND kidney protection"
   - Comment on fluid management and medication interactions

   **D. Integrated Comorbidity Recommendations:**
   - Diabetes + CKD → "Recommend SGLT2 inhibitor for dual glycemic and kidney benefit"
   - Hypertension + Albuminuria → "Recommend RAS inhibitor for BP control and proteinuria reduction"
   - Diabetes + Hypertension + CKD → "Consider both RAS inhibitor AND SGLT2 inhibitor for comprehensive disease modification"

10. **Follow-Up Timing - MUST Specify Exact Timeframe:**

   **CRITICAL**: NEVER say "Follow up as scheduled" or "Continue monitoring" without specifying WHEN

   **A. For CKD Patients - Based on KDIGO Risk Level:**

   - **RED (Very High Risk)** - G4/G5, or A3 (any G), or G3b-A2:
     * "Schedule follow-up in 1-3 months (very high risk per KDIGO)"
     * "Next labs due in [1-3 months]: comprehensive metabolic panel, eGFR, uACR, CBC"
     * If declining: "Follow up in 1 month due to concerning decline"

   - **ORANGE (High Risk)** - G3a-A2, or G3b-A1:
     * "Schedule follow-up in 3-6 months (high risk per KDIGO)"
     * "Next labs due in [3-6 months]: eGFR, uACR, electrolytes, BP check"

   - **YELLOW (Moderate Risk)** - G1/G2-A2, or G3a-A1:
     * "Schedule follow-up in 6-12 months (moderate risk per KDIGO)"
     * "Next labs due in [6-12 months]: eGFR, uACR, routine monitoring"

   - **GREEN (Low Risk)** - G1/G2-A1:
     * "Schedule annual follow-up in 12 months (low risk per KDIGO)"
     * "Next screening in 12 months: eGFR, uACR"

   **B. For Non-CKD Patients - Based on Risk Factors:**

   - **High Risk** (Diabetes + Hypertension, or multiple risk factors):
     * "Schedule follow-up in 6-12 months for CKD screening"
     * "Next eGFR and uACR screening in [6-12 months] due to diabetes/hypertension"

   - **Moderate Risk** (Single risk factor: diabetes OR hypertension OR age >60):
     * "Schedule annual follow-up in 12 months for CKD screening"
     * "Next kidney function screening in 12 months"

   - **Low Risk** (G1/G2-A1, no risk factors):
     * "Schedule follow-up in 1-2 years or as needed for routine health maintenance"
     * "Next kidney screening in 1-2 years or if symptoms develop"

   **C. Timing Modifiers - Adjust Based on Clinical Context:**

   - **If eGFR declining rapidly** (>5 mL/min/year): Shorten interval by 50%
     * Example: YELLOW normally 6-12 months → "Follow up in 3-6 months due to rapid decline"

   - **If uACR increasing significantly** (>50% increase): Shorten interval
     * Example: GREEN normally 12 months → "Follow up in 6 months due to rising albuminuria"

   - **If new treatment initiated**: Follow up in 1-2 weeks for safety labs
     * "Follow up in 1-2 weeks after starting RAS inhibitor to check potassium and creatinine"
     * "Then resume normal [X-month] monitoring schedule"

   - **If stable on treatment**: Use standard interval for risk level
     * "Continue current treatment. Follow up in [X months] per [risk level] guidelines"

   **REQUIRED FORMAT Examples:**
   - ✅ CORRECT: "Schedule follow-up in 6 months (moderate risk). Next labs: eGFR, uACR, electrolytes."
   - ✅ CORRECT: "Follow up in 1-2 weeks after starting RAS inhibitor for safety labs, then every 6 months."
   - ✅ CORRECT: "Annual follow-up in 12 months for routine CKD screening (low risk)."
   - ❌ WRONG: "Follow up as scheduled" (no timeframe specified)
   - ❌ WRONG: "Continue monitoring" (no timeframe or specifics)

Return ONLY the JSON response, no additional text.`;
  }

  /**
   * Formats lab values for display
   */
  private formatLabValues(labs: LabValues): string {
    const lines: string[] = [];

    // Convert string values to numbers before calling .toFixed()
    if (labs.egfr !== undefined) {
      const egfr = typeof labs.egfr === 'string' ? parseFloat(labs.egfr) : labs.egfr;
      lines.push(`- eGFR: ${egfr.toFixed(1)} mL/min/1.73m²`);
    }
    if (labs.uacr !== undefined) {
      const uacr = typeof labs.uacr === 'string' ? parseFloat(labs.uacr) : labs.uacr;
      lines.push(`- uACR: ${uacr.toFixed(1)} mg/g`);
    }
    if (labs.creatinine !== undefined) {
      const creatinine = typeof labs.creatinine === 'string' ? parseFloat(labs.creatinine) : labs.creatinine;
      lines.push(`- Serum Creatinine: ${creatinine.toFixed(2)} mg/dL`);
    }
    if (labs.bun !== undefined) {
      const bun = typeof labs.bun === 'string' ? parseFloat(labs.bun) : labs.bun;
      lines.push(`- BUN: ${bun.toFixed(1)} mg/dL`);
    }
    if (labs.systolic_bp !== undefined && labs.diastolic_bp !== undefined) {
      lines.push(`- Blood Pressure: ${labs.systolic_bp}/${labs.diastolic_bp} mmHg`);
    }
    if (labs.hba1c !== undefined) {
      const hba1c = typeof labs.hba1c === 'string' ? parseFloat(labs.hba1c) : labs.hba1c;
      lines.push(`- HbA1c: ${hba1c.toFixed(1)}%`);
    }
    if (labs.glucose !== undefined) {
      const glucose = typeof labs.glucose === 'string' ? parseFloat(labs.glucose) : labs.glucose;
      lines.push(`- Glucose: ${glucose.toFixed(0)} mg/dL`);
    }
    if (labs.hemoglobin !== undefined) {
      const hemoglobin = typeof labs.hemoglobin === 'string' ? parseFloat(labs.hemoglobin) : labs.hemoglobin;
      lines.push(`- Hemoglobin: ${hemoglobin.toFixed(1)} g/dL`);
    }
    if (labs.heart_rate !== undefined) lines.push(`- Heart Rate: ${labs.heart_rate} bpm`);
    if (labs.oxygen_saturation !== undefined) lines.push(`- O2 Saturation: ${labs.oxygen_saturation}%`);

    return lines.join('\n');
  }

  /**
   * Formats changes for display
   */
  private formatChanges(changes: Record<string, { absolute: number; percentage: number }>): string {
    const lines: string[] = [];

    for (const [key, change] of Object.entries(changes)) {
      const direction = change.absolute > 0 ? '↑' : '↓';
      const absValue = Math.abs(change.absolute).toFixed(2);
      const pctValue = Math.abs(change.percentage).toFixed(1);
      lines.push(`- ${key}: ${direction} ${absValue} (${pctValue}%)`);
    }

    return lines.length > 0 ? lines.join('\n') : 'No changes detected';
  }

  /**
   * Parses Claude AI response
   */
  private parseAIResponse(responseText: string): AIAnalysisResult {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        hasSignificantChanges: true,
        commentText: parsed.commentText || 'Patient labs updated',
        clinicalSummary: parsed.clinicalSummary || '',
        keyChanges: parsed.keyChanges || [],
        recommendedActions: parsed.recommendedActions || [],
        severity: parsed.severity || 'info',
        concernLevel: parsed.concernLevel || 'none'
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('Response text:', responseText);
      throw error;
    }
  }

  /**
   * Validates AI recommendations for consistency with treatment/monitoring status
   * Prevents contradictory advice (e.g., "initiate treatment" for patients already on treatment)
   */
  private validateAIRecommendations(
    context: PatientContext,
    result: AIAnalysisResult
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const allText = [
      result.clinicalSummary,
      ...result.recommendedActions
    ].join(' ').toLowerCase();

    // Check for treatment contradictions
    if (context.treatmentActive) {
      // Patient IS on treatment - should NOT recommend initiating
      const hasInitiatePhrase =
        /initiat(e|ing) (ckd )?treatment/i.test(allText) ||
        /start(ing)? therapy/i.test(allText) ||
        /consider starting (ckd )?treatment/i.test(allText) ||
        /begin (ckd )?treatment/i.test(allText);

      const saysNotOnTreatment =
        /not (currently )?on (ckd )?treatment/i.test(allText) ||
        /not (currently )?receiving treatment/i.test(allText);

      if (hasInitiatePhrase) {
        errors.push(
          `CONTRADICTION: AI recommended initiating treatment for patient with Treatment Status: Active. ` +
          `Patient is already on treatment (${context.treatmentType || 'Unknown'}). ` +
          `AI should recommend "continue current treatment" or "optimize therapy" instead.`
        );
      }

      if (saysNotOnTreatment) {
        errors.push(
          `CONTRADICTION: AI stated patient is "not on treatment" when Treatment Status: Active. ` +
          `Patient IS on treatment (${context.treatmentType || 'Unknown'}).`
        );
      }
    } else {
      // Patient is NOT on treatment - should NOT recommend continuing
      const hasContinuePhrase =
        /continue (current )?(ckd )?treatment/i.test(allText) ||
        /maintain (current )?therapy/i.test(allText) ||
        /optimize (current )?therapy/i.test(allText) ||
        /continue (current )?regimen/i.test(allText);

      if (hasContinuePhrase) {
        errors.push(
          `CONTRADICTION: AI recommended continuing treatment for patient with Treatment Status: NOT ON TREATMENT. ` +
          `Patient is not on treatment yet. AI should recommend "initiate treatment" instead.`
        );
      }
    }

    // Check for monitoring contradictions
    if (context.monitoringActive) {
      // Patient IS on monitoring - should NOT recommend initiating
      const hasInitiateMonitoring =
        /initiat(e|ing) (home )?monitoring/i.test(allText) ||
        /start(ing)? minuteful kidney/i.test(allText) ||
        /begin (home )?monitoring/i.test(allText);

      if (hasInitiateMonitoring) {
        errors.push(
          `CONTRADICTION: AI recommended initiating monitoring for patient with Monitoring Status: Active. ` +
          `Patient is already on home monitoring (${context.monitoringDevice || 'Unknown'}). ` +
          `AI should recommend "continue home monitoring" instead.`
        );
      }
    } else {
      // Patient is NOT on monitoring - should NOT recommend continuing
      const hasContinueMonitoring =
        /continue (home )?monitoring/i.test(allText) ||
        /maintain minuteful kidney/i.test(allText) ||
        /continue (current )?testing/i.test(allText);

      if (hasContinueMonitoring) {
        errors.push(
          `CONTRADICTION: AI recommended continuing monitoring for patient with Monitoring Status: NOT ON MONITORING. ` +
          `Patient is not on home monitoring yet. AI should recommend "initiate Minuteful Kidney monitoring" instead.`
        );
      }
    }

    // Check for vague follow-up timing
    const hasFollowUp = /follow.?up/i.test(allText);
    const hasScheduled = /as scheduled/i.test(allText);
    const hasSpecificTiming = /\d+\s*(month|week|year)/i.test(allText);

    if (hasFollowUp && hasScheduled && !hasSpecificTiming) {
      errors.push(
        `VAGUE TIMING: AI used "follow up as scheduled" without specifying exact interval. ` +
        `Should specify timeframe like "in 6 months" or "in 1-3 months" based on risk level.`
      );
    }

    // Log validation results
    if (errors.length > 0) {
      console.error('❌ AI Recommendation Validation FAILED:');
      console.error('Patient:', context.firstName, context.lastName, `(${context.currentHealthState})`);
      console.error('Treatment Status:', context.treatmentActive ? `Active (${context.treatmentType})` : 'NOT ON TREATMENT');
      console.error('Monitoring Status:', context.monitoringActive ? `Active (${context.monitoringDevice})` : 'NOT ON MONITORING');
      console.error('Validation Errors:');
      errors.forEach((err, idx) => {
        console.error(`  ${idx + 1}. ${err}`);
      });
      console.error('AI Clinical Summary:', result.clinicalSummary);
      console.error('AI Recommended Actions:', result.recommendedActions);
    } else {
      console.log('✅ AI Recommendation Validation PASSED');
      console.log('Patient:', context.firstName, context.lastName, `(${context.currentHealthState})`);
      console.log('Treatment Status:', context.treatmentActive ? `Active (${context.treatmentType})` : 'NOT ON TREATMENT');
      console.log('Monitoring Status:', context.monitoringActive ? `Active (${context.monitoringDevice})` : 'NOT ON MONITORING');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generates fallback analysis if AI call fails
   */
  private generateFallbackAnalysis(
    context: PatientContext,
    _previous: LabValues,
    _current: LabValues,
    changes: Record<string, { absolute: number; percentage: number }>
  ): AIAnalysisResult {
    const keyChanges: string[] = [];
    let severity: 'info' | 'warning' | 'critical' = 'info';
    let concernLevel: 'none' | 'mild' | 'moderate' | 'high' = 'none';

    // Analyze key metrics
    if (changes.egfr) {
      const change = changes.egfr;
      if (change.absolute < -10) {
        keyChanges.push(`eGFR declined by ${Math.abs(change.absolute).toFixed(1)} mL/min/1.73m²`);
        severity = 'warning';
        concernLevel = 'moderate';
      } else if (change.absolute > 5) {
        keyChanges.push(`eGFR improved by ${change.absolute.toFixed(1)} mL/min/1.73m²`);
      }
    }

    if (changes.uacr) {
      const change = changes.uacr;
      if (change.percentage > 50) {
        keyChanges.push(`Albuminuria increased by ${change.percentage.toFixed(0)}%`);
        // Escalate severity if not already critical
        if (severity === 'info') {
          severity = 'warning';
        } else if (severity === 'warning') {
          severity = 'critical';
        }
        concernLevel = 'high';
      } else if (change.percentage < -30) {
        keyChanges.push(`Albuminuria decreased by ${Math.abs(change.percentage).toFixed(0)}%`);
      }
    }

    return {
      hasSignificantChanges: true,
      commentText: `Patient labs updated (Cycle ${context.cycleNumber}). ${keyChanges.length > 0 ? keyChanges[0] : 'Labs reviewed.'}`,
      clinicalSummary: `Lab values updated from cycle ${context.previousCycleNumber} to ${context.cycleNumber}. ${context.treatmentActive ? 'Patient is on active treatment.' : 'Patient not currently on CKD treatment.'}`,
      keyChanges,
      recommendedActions: ['Review latest lab trends', 'Monitor kidney function'],
      severity,
      concernLevel
    };
  }

  /**
   * Creates AI-generated comment in database
   */
  async createAIUpdateComment(
    patientId: string,
    analysis: AIAnalysisResult,
    cycleNumber: number,
    previousLabValues: LabValues,
    newLabValues: LabValues
  ): Promise<string | null> {
    if (!analysis.hasSignificantChanges) {
      return null; // No comment needed
    }

    try {
      // Delete previous AI-generated comments for this patient to keep only the latest
      // This ensures doctors see a comprehensive latest comment rather than historical ones
      console.log('[AI Update] Deleting previous AI comments for patient:', patientId);
      const deleteResult = await this.pool.query(
        `DELETE FROM patient_health_state_comments
         WHERE patient_id = $1
           AND comment_type = 'ai_generated'
           AND created_by_type = 'ai'`,
        [patientId]
      );
      console.log('[AI Update] Deleted', deleteResult.rowCount, 'previous AI comments');

      // Calculate KDIGO classification from the new lab values instead of querying the database
      // (kdigo_classification is computed on-the-fly, not stored in the patients table)
      const currentKdigo = classifyKDIGO(
        newLabValues.egfr || 90,
        newLabValues.uacr || 15
      );

      // Extract and validate health state (max 10 chars)
      let healthStateTo = currentKdigo.health_state || 'Unknown';
      if (healthStateTo && healthStateTo.length > 10) {
        console.warn(`[AI Update] health_state too long (${healthStateTo.length} chars), truncating:`, healthStateTo);
        healthStateTo = healthStateTo.substring(0, 10);
      }

      // Extract risk level (always one of the valid values from KDIGO classification)
      const riskLevelTo: 'low' | 'moderate' | 'high' | 'very_high' = currentKdigo.risk_level || 'low';

      // Determine if patient has CKD from classification
      const isCkdPatient = currentKdigo.has_ckd || false;

      // Determine change_type based on lab values
      let changeType: string | null = null;
      if (previousLabValues.egfr !== undefined && previousLabValues.egfr !== null &&
          newLabValues.egfr !== undefined && newLabValues.egfr !== null) {
        const egfrChange = newLabValues.egfr - previousLabValues.egfr;
        if (egfrChange > 0) {
          changeType = 'improved'; // eGFR increase is improvement
        } else if (egfrChange < -3) { // Significant decline
          changeType = 'worsened';
        } else {
          changeType = 'stable';
        }
      } else if (previousLabValues.uacr !== undefined && previousLabValues.uacr !== null &&
                 newLabValues.uacr !== undefined && newLabValues.uacr !== null) {
        const uacrChange = newLabValues.uacr - previousLabValues.uacr;
        if (uacrChange < 0) {
          changeType = 'improved'; // uACR decrease is improvement
        } else if (uacrChange > 30) { // Significant increase
          changeType = 'worsened';
        } else {
          changeType = 'stable';
        }
      } else {
        changeType = 'initial';
      }

      // Validate severity
      const validSeverities = ['info', 'warning', 'critical'];
      const severity = validSeverities.includes(analysis.severity) ? analysis.severity : 'info';

      // Validate comment text
      const commentText = analysis.commentText || 'AI-generated update analysis';

      // Validate clinical summary
      const clinicalSummary = analysis.clinicalSummary || '';

      // Validate recommended actions (ensure it's an array)
      const recommendedActions = Array.isArray(analysis.recommendedActions) ? analysis.recommendedActions : [];

      console.log('[AI Update] Creating comment with values:', {
        patientId,
        healthStateTo,
        riskLevelTo,
        changeType,
        isCkdPatient,
        severity,
        cycleNumber,
        egfr_from: previousLabValues.egfr,
        egfr_to: newLabValues.egfr,
        uacr_from: previousLabValues.uacr,
        uacr_to: newLabValues.uacr,
        comment_text_length: commentText.length,
        has_recommended_actions: Array.isArray(recommendedActions) && recommendedActions.length > 0
      });

      const result = await this.pool.query(
        `INSERT INTO patient_health_state_comments (
          patient_id,
          comment_text,
          comment_type,
          health_state_to,
          risk_level_to,
          change_type,
          is_ckd_patient,
          clinical_summary,
          recommended_actions,
          mitigation_measures,
          severity,
          cycle_number,
          egfr_from,
          egfr_to,
          egfr_change,
          uacr_from,
          uacr_to,
          uacr_change,
          created_by,
          created_by_type,
          visibility
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING id`,
        [
          patientId,
          commentText,
          'ai_generated',
          healthStateTo,
          riskLevelTo,
          changeType,
          isCkdPatient,
          clinicalSummary,
          recommendedActions,
          [], // mitigation_measures - empty array for AI-generated comments
          severity,
          cycleNumber,
          previousLabValues.egfr !== undefined && previousLabValues.egfr !== null ? previousLabValues.egfr : null,
          newLabValues.egfr !== undefined && newLabValues.egfr !== null ? newLabValues.egfr : null,
          (newLabValues.egfr !== undefined && newLabValues.egfr !== null &&
           previousLabValues.egfr !== undefined && previousLabValues.egfr !== null)
            ? newLabValues.egfr - previousLabValues.egfr : null,
          previousLabValues.uacr !== undefined && previousLabValues.uacr !== null ? previousLabValues.uacr : null,
          newLabValues.uacr !== undefined && newLabValues.uacr !== null ? newLabValues.uacr : null,
          (newLabValues.uacr !== undefined && newLabValues.uacr !== null &&
           previousLabValues.uacr !== undefined && previousLabValues.uacr !== null)
            ? newLabValues.uacr - previousLabValues.uacr : null,
          'AI Analysis System',
          'ai',
          'visible'
        ]
      );

      console.log('[AI Update] Comment created successfully, ID:', result.rows[0].id);

      // Check if this is a health state transition and send email notification
      await this.sendHealthStateTransitionEmail(
        patientId,
        analysis,
        healthStateTo,
        severity,
        changeType
      );

      return result.rows[0].id;
    } catch (error) {
      console.error('[AI Update] Error creating AI update comment:', error);
      if (error instanceof Error) {
        console.error('[AI Update] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  /**
   * Sends email notification to doctor when significant health state transition occurs
   */
  private async sendHealthStateTransitionEmail(
    patientId: string,
    analysis: AIAnalysisResult,
    newHealthState: string,
    severity: string,
    changeType: string | null
  ): Promise<void> {
    // Only send email for significant changes (warning or critical severity)
    if (severity !== 'warning' && severity !== 'critical') {
      console.log('[Email] Skipping email - severity is info:', severity);
      return;
    }

    // Only send for worsened state (not for improved or stable)
    if (changeType !== 'worsened') {
      console.log('[Email] Skipping email - change type is not worsened:', changeType);
      return;
    }

    try {
      // Get patient information for email
      const patientQuery = await this.pool.query(
        `SELECT first_name, last_name, medical_record_number, date_of_birth
         FROM patients
         WHERE id = $1`,
        [patientId]
      );

      if (patientQuery.rows.length === 0) {
        console.log('[Email] Patient not found, skipping email');
        return;
      }

      const patient = patientQuery.rows[0];
      const patientName = `${patient.first_name} ${patient.last_name}`;
      const mrn = patient.medical_record_number;

      // Import EmailService (dynamic import to avoid circular dependency)
      const { EmailService } = await import('./emailService');
      const emailService = new EmailService(this.pool);

      // Build email subject based on severity
      const subjectPrefix = severity === 'critical' ? '🚨 URGENT' : '⚠️ ALERT';
      const subject = `${subjectPrefix}: Health State Change - ${patientName} (${mrn})`;

      // Build email message with comprehensive information
      const message = `
Health State Transition Alert

Patient: ${patientName}
MRN: ${mrn}
New Health State: ${newHealthState}
Severity: ${severity.toUpperCase()}

${analysis.clinicalSummary}

Key Changes:
${analysis.keyChanges.map(change => `• ${change}`).join('\n')}

Recommended Actions:
${analysis.recommendedActions.map(action => `• ${action}`).join('\n')}

Please review this patient's chart and take appropriate action.

This is an automated notification from the RenalGuard CKD Management System.
`;

      // Send email notification
      console.log('[Email] Sending health state transition email for:', patientName);
      const emailSent = await emailService.sendNotification({
        to: '', // Will use default doctor email from config
        subject,
        message,
        priority: severity === 'critical' ? 'urgent' : 'high',
        patientName,
        mrn
      });

      if (emailSent) {
        console.log('[Email] ✅ Successfully sent health state transition email for:', patientName);
      } else {
        console.log('[Email] ❌ Failed to send health state transition email for:', patientName);
      }
    } catch (error) {
      console.error('[Email] Error sending health state transition email:', error);
      // Don't throw error - email failure shouldn't break the comment creation
    }
  }

  /**
   * Fetches previous lab values for a patient
   */
  async getPreviousLabValues(patientId: string, beforeCycle: number): Promise<LabValues> {
    const result = await this.pool.query(
      `SELECT
        observation_type,
        value_numeric,
        value_text
      FROM observations
      WHERE patient_id = $1
        AND month_number < $2
      ORDER BY month_number DESC
      LIMIT 20`,
      [patientId, beforeCycle]
    );

    return this.parseObservationsToLabValues(result.rows);
  }

  /**
   * Fetches latest lab values for a patient
   */
  async getLatestLabValues(patientId: string, cycle: number): Promise<LabValues> {
    const result = await this.pool.query(
      `SELECT
        observation_type,
        value_numeric,
        value_text
      FROM observations
      WHERE patient_id = $1
        AND month_number = $2
      ORDER BY observation_date DESC`,
      [patientId, cycle]
    );

    return this.parseObservationsToLabValues(result.rows);
  }

  /**
   * Parses observation rows to lab values object
   */
  private parseObservationsToLabValues(rows: any[]): LabValues {
    const labValues: LabValues = {};

    for (const row of rows) {
      const value = row.value_numeric || parseFloat(row.value_text);
      if (isNaN(value)) continue;

      switch (row.observation_type) {
        case 'egfr':
          labValues.egfr = value;
          break;
        case 'uacr':
          labValues.uacr = value;
          break;
        case 'serum_creatinine':
          labValues.creatinine = value;
          break;
        case 'bun':
          labValues.bun = value;
          break;
        case 'systolic_bp':
          labValues.systolic_bp = value;
          break;
        case 'diastolic_bp':
          labValues.diastolic_bp = value;
          break;
        case 'hba1c':
          labValues.hba1c = value;
          break;
        case 'glucose':
          labValues.glucose = value;
          break;
        case 'hemoglobin':
          labValues.hemoglobin = value;
          break;
        case 'heart_rate':
          labValues.heart_rate = value;
          break;
        case 'oxygen_saturation':
          labValues.oxygen_saturation = value;
          break;
      }
    }

    return labValues;
  }
}
