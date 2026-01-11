import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PatientContext {
  patientId?: string;
  includeRecentLabs?: boolean;
  includeRiskAssessment?: boolean;
}

export class DoctorAgentService {
  private anthropic: Anthropic;
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
  }

  /**
   * Calls Claude API with retry logic for transient errors
   */
  private async callClaudeWithRetry(
    messages: any[],
    systemPrompt: string,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[DoctorAgent] Calling Claude API (attempt ${attempt + 1}/${maxRetries + 1})...`);

        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages,
        });

        const textContent = response.content.find(block => block.type === 'text');
        const result = textContent ? (textContent as any).text : 'No response generated';

        console.log(`[DoctorAgent] Claude API call successful`);
        return result;
      } catch (error: any) {
        lastError = error;

        // Check if it's a retryable error (529 overloaded, 5xx server errors, rate limits)
        const isRetryable =
          error.status === 529 ||
          error.status === 503 ||
          error.status === 500 ||
          (error.status >= 500 && error.status < 600) ||
          error.message?.includes('overloaded') ||
          error.message?.includes('rate_limit');

        if (!isRetryable) {
          console.error(`[DoctorAgent] Non-retryable error:`, error.status, error.message);
          throw error;
        }

        if (attempt < maxRetries) {
          // Exponential backoff: 2s, 4s, 8s
          const delayMs = Math.pow(2, attempt + 1) * 1000;
          console.log(`[DoctorAgent] Retryable error (${error.status}), waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.error(`[DoctorAgent] All retry attempts exhausted`);
        }
      }
    }

    throw lastError || new Error('Failed to call Claude API after multiple retries');
  }

  /**
   * Main chat endpoint - handles doctor queries with optional patient context
   */
  async chat(
    messages: ChatMessage[],
    context?: PatientContext
  ): Promise<string> {
    try {
      // Convert messages to Anthropic format
      const anthropicMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Check if this is a population-level query
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage && lastUserMessage.role === 'user') {
        const populationData = await this.checkForPopulationQuery(lastUserMessage.content);
        if (populationData) {
          // Enhance system prompt with population data
          const systemPrompt = await this.buildSystemPrompt(context);
          const enhancedPrompt = systemPrompt + '\n\n--- POPULATION DATA ---\n' + populationData;

          // Call Claude API with enhanced context and retry logic
          return await this.callClaudeWithRetry(anthropicMessages, enhancedPrompt);
        }
      }

      // Build system prompt based on context
      const systemPrompt = await this.buildSystemPrompt(context);

      // Call Claude API with retry logic
      return await this.callClaudeWithRetry(anthropicMessages, systemPrompt);
    } catch (error) {
      console.error('Error in doctor agent chat:', error);
      throw new Error(`Failed to process chat request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if the user's question is asking for population-level data
   * and fetches relevant statistics from the database
   */
  private async checkForPopulationQuery(question: string): Promise<string | null> {
    const lowerQ = question.toLowerCase();

    // Detect population-level questions
    const isPopulationQuery =
      lowerQ.includes('how many') ||
      lowerQ.includes('count') ||
      lowerQ.includes('patients without ckd') ||
      lowerQ.includes('high risk') ||
      lowerQ.includes('patients need') ||
      lowerQ.includes('show me patients') ||
      lowerQ.includes('on treatment') ||
      lowerQ.includes('medication') ||
      lowerQ.includes('on sglt2') ||
      lowerQ.includes('on acei') ||
      lowerQ.includes('on arb') ||
      lowerQ.includes('taking');

    if (!isPopulationQuery) {
      return null;
    }

    try {
      let dataResponse = 'Database Query Results:\n\n';

      // Query 1: High-risk patients without CKD
      if (lowerQ.includes('without ckd') || lowerQ.includes('high risk')) {
        // Try new view first, fallback to direct query if view doesn't exist
        let highRiskQuery = `
          SELECT COUNT(*) as count
          FROM v_tier3_risk_classification
          WHERE risk_level = 'HIGH'
          AND (recent_egfr >= 60 OR recent_egfr IS NULL)
          AND (recent_uacr <= 30 OR recent_uacr IS NULL)
        `;

        let highRiskResult;
        try {
          highRiskResult = await this.db.query(highRiskQuery);
        } catch (viewError) {
          // Fallback to direct query if view doesn't exist
          highRiskQuery = `
            SELECT COUNT(DISTINCT p.id) as count
            FROM patients p
            WHERE (p.has_diabetes = true OR p.has_hypertension = true
                   OR EXTRACT(YEAR FROM AGE(p.date_of_birth)) > 60
                   OR p.has_heart_failure = true OR p.has_cad = true)
          `;
          highRiskResult = await this.db.query(highRiskQuery);
        }

        const highRiskCount = highRiskResult.rows[0]?.count || 0;

        dataResponse += `High-Risk Patients WITHOUT CKD: ${highRiskCount}\n`;
        dataResponse += `(These are patients with risk factors like diabetes, hypertension, or age >60)\n\n`;

        // Get breakdown by risk factor (fallback version)
        const breakdownQuery = `
          SELECT
            CASE
              WHEN has_diabetes THEN 'Diabetes'
              WHEN has_hypertension THEN 'Hypertension'
              WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) > 60 THEN 'Age > 60'
              WHEN has_heart_failure THEN 'Heart Failure'
              WHEN has_cad THEN 'Coronary Artery Disease'
              ELSE 'Other'
            END as risk_factor,
            COUNT(*) as count
          FROM patients
          WHERE has_diabetes = true OR has_hypertension = true
                OR EXTRACT(YEAR FROM AGE(date_of_birth)) > 60
                OR has_heart_failure = true OR has_cad = true
          GROUP BY risk_factor
          ORDER BY count DESC
        `;
        const breakdownResult = await this.db.query(breakdownQuery);

        if (breakdownResult.rows.length > 0) {
          dataResponse += 'Breakdown by Risk Factor:\n';
          breakdownResult.rows.forEach((row: any) => {
            dataResponse += `- ${row.risk_factor}: ${row.count} patients\n`;
          });
          dataResponse += '\n';
        }
      }

      // Query 2: Patients needing lab orders
      if (lowerQ.includes('need') || lowerQ.includes('lab') || lowerQ.includes('screening')) {
        let labNeededResult;
        try {
          const labNeededQuery = `
            SELECT COUNT(*) as count
            FROM v_patients_requiring_action
            WHERE action_category = 'ORDER_LABS'
          `;
          labNeededResult = await this.db.query(labNeededQuery);
        } catch (viewError) {
          // Fallback: patients with risk factors but missing recent labs
          const labNeededQuery = `
            SELECT COUNT(DISTINCT p.id) as count
            FROM patients p
            WHERE (p.has_diabetes = true OR p.has_hypertension = true)
            AND NOT EXISTS (
              SELECT 1 FROM observations o
              WHERE o.patient_id = p.id
              AND o.observation_type IN ('eGFR', 'uACR')
              AND o.observation_date >= CURRENT_DATE - INTERVAL '12 months'
            )
          `;
          labNeededResult = await this.db.query(labNeededQuery);
        }

        const labNeededCount = labNeededResult.rows[0]?.count || 0;
        dataResponse += `Patients Needing Lab Orders: ${labNeededCount}\n`;
        dataResponse += `(Patients with risk factors but no recent eGFR or uACR in last 12 months)\n\n`;
      }

      // Query 3: Total patient statistics including treatments
      const statsQuery = `
        SELECT
          COUNT(*) as total_patients,
          COUNT(*) FILTER (WHERE has_diabetes = true) as diabetes_count,
          COUNT(*) FILTER (WHERE has_hypertension = true) as hypertension_count,
          COUNT(*) FILTER (WHERE has_heart_failure = true) as heart_failure_count,
          COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(date_of_birth)) > 60) as age_over_60_count,
          COUNT(*) FILTER (WHERE on_ras_inhibitor = true) as on_ras_inhibitor,
          COUNT(*) FILTER (WHERE on_sglt2i = true) as on_sglt2i,
          COUNT(*) FILTER (WHERE on_ras_inhibitor = true OR on_sglt2i = true) as on_any_treatment,
          COUNT(*) FILTER (WHERE on_ras_inhibitor = true AND on_sglt2i = true) as on_combo_therapy
        FROM patients
      `;
      const statsResult = await this.db.query(statsQuery);
      const stats = statsResult.rows[0];

      dataResponse += 'Overall Patient Statistics:\n';
      dataResponse += `- Total Patients: ${stats?.total_patients || 0}\n`;
      dataResponse += `- With Diabetes: ${stats?.diabetes_count || 0}\n`;
      dataResponse += `- With Hypertension: ${stats?.hypertension_count || 0}\n`;
      dataResponse += `- With Heart Failure: ${stats?.heart_failure_count || 0}\n`;
      dataResponse += `- Age > 60: ${stats?.age_over_60_count || 0}\n\n`;
      dataResponse += 'Treatment Statistics:\n';
      dataResponse += `- On RAS Inhibitor (ACEi/ARB): ${stats?.on_ras_inhibitor || 0}\n`;
      dataResponse += `- On SGLT2 Inhibitor: ${stats?.on_sglt2i || 0}\n`;
      dataResponse += `- On Any CKD Treatment: ${stats?.on_any_treatment || 0}\n`;
      dataResponse += `- On Combination Therapy (RAS + SGLT2i): ${stats?.on_combo_therapy || 0}\n`;

      return dataResponse;
    } catch (error) {
      console.error('Error fetching population data:', error);
      return 'Error fetching population statistics from database.';
    }
  }

  /**
   * Builds system prompt with patient context if provided
   */
  private async buildSystemPrompt(context?: PatientContext): Promise<string> {
    let basePrompt = `You are an AI medical assistant helping doctors manage primary care patients, with a focus on chronic kidney disease (CKD) and related conditions.

Your role:
- Answer clinical questions about patients
- Provide evidence-based recommendations following KDIGO 2024 guidelines
- Help interpret lab results and risk assessments
- Suggest appropriate monitoring intervals and treatments
- Alert doctors to critical findings
- Answer population-level questions using database queries

Important guidelines:
- Always prioritize patient safety
- Cite clinical guidelines when making recommendations
- Acknowledge uncertainty and suggest consulting specialists when appropriate
- Use clear, professional medical terminology
- Provide actionable insights

═══════════════════════════════════════════════════════════════════════════════
📝 RESPONSE FORMATTING GUIDELINES (CRITICAL - FOLLOW THESE STRICTLY!)
═══════════════════════════════════════════════════════════════════════════════

Your responses will be displayed in a plain-text chat interface that does NOT render markdown.
Therefore, you MUST format your responses for optimal readability WITHOUT using markdown syntax.

DO NOT USE:
- Markdown headers like # or ##
- Bold formatting like **text** or __text__
- Italic formatting like *text* or _text_
- Markdown bullet lists starting with - or *
- Markdown code blocks with backticks
- Any other markdown syntax

INSTEAD, USE:
1. SECTION TITLES in UPPERCASE followed by a colon, like:
   ASSESSMENT:
   RECOMMENDATIONS:

2. Simple numbered lists (1. 2. 3.) or letter lists (a. b. c.)

3. Arrow symbols (→) for sub-points or to indicate actions

4. Line breaks and spacing to separate sections visually

5. Simple text separators like --- or ═══ for major sections

6. Concise, clear sentences without excessive formatting

EXAMPLE OF GOOD FORMATTING:

PATIENT SUMMARY:
68-year-old male with Type 2 diabetes and hypertension.

KEY FINDINGS:
1. eGFR declining trend: 58 → 52 → 48 over 18 months
2. Elevated uACR at 120 mg/g (moderately increased)
3. HbA1c well-controlled at 6.8%

RECOMMENDATIONS:
1. Continue current SGLT2 inhibitor therapy
   → Provides both glycemic and renal protection

2. Increase monitoring frequency to every 3 months
   → Track eGFR trend closely

3. Consider nephrology referral if eGFR drops below 45

RATIONALE:
Per KDIGO 2024 guidelines, this patient is at high risk for CKD progression. Early intervention is key.

---

Keep responses concise but complete. Focus on actionable clinical insights.

Available data includes:
- Patient demographics and medical history
- Lab results (eGFR, creatinine, uACR, HbA1c, etc.)
- KDIGO risk classification
- GCUA (Geriatric Cardiorenal Unified Assessment) phenotypes
- Current medications and treatments
- Comorbidities (diabetes, hypertension, CVD)
- Risk factors and progression indicators

═══════════════════════════════════════════════════════════════════════════════
🧬 GCUA PHENOTYPE SYSTEM - CARDIORENAL RISK CLASSIFICATION
═══════════════════════════════════════════════════════════════════════════════

For patients 60+ years old, we use the GCUA (Geriatric Cardiorenal Unified Assessment) system, which integrates three validated models:
1. Nelson/CKD-PC (2019): 5-year renal risk prediction
2. AHA PREVENT (2024): 10-year cardiovascular risk prediction
3. Bansal Geriatric Score (2015): 5-year mortality/competing risk

GCUA Phenotypes:
- **Phenotype I (Accelerated Ager)**: Both high renal (≥15%) AND high CVD (≥20%) risk. Most urgent - aggressive intervention needed.
- **Phenotype II (Silent Renal)**: High renal risk (≥15%) with moderate CVD. Often missed by Framingham. Nephroprotection priority.
- **Phenotype III (Vascular Dominant)**: High CVD (≥20%) with moderate renal. Standard cardiology protocols + renal monitoring.
- **Phenotype IV (Senescent/The Senescent)**: High competing mortality risk (≥50%). Focus on quality of life, conservative management, shared decision-making about aggressive interventions.
- **Phenotype Moderate**: Moderate risks across domains. Preventive strategies, lifestyle modification.
- **Phenotype Low**: Low risk across all domains. Standard preventive care.

When a patient is classified as "Senescent" (Phenotype IV), it means their 5-year mortality risk from competing causes (non-renal, non-cardiovascular) is ≥50%. This is NOT about cellular senescence - it's about high competing mortality risk. Treatment focus should shift to quality of life rather than aggressive disease modification.

═══════════════════════════════════════════════════════════════════════════════
🚨 CRITICAL: TREATMENT AND MONITORING STATUS VERIFICATION 🚨
═══════════════════════════════════════════════════════════════════════════════

BEFORE making ANY treatment or monitoring recommendation, you MUST:

1. CHECK the patient's "CKD Treatment Status" and "Home Monitoring Status" fields
   (These will be prominently displayed in the patient context section)

2. MATCH your recommendations to the current status:

   IF Treatment Status = "Active (...)":
      ✅ Patient IS on treatment
      ✅ Say: "Continue current CKD treatment", "Optimize therapy", "Adjust dosing"
      ❌ NEVER say: "Initiate treatment", "Start therapy", "Patient not on treatment"

   IF Treatment Status = "NOT ON TREATMENT":
      ✅ Patient is NOT on treatment
      ✅ Say: "Initiate RAS inhibitor", "Start SGLT2 inhibitor", "Begin treatment"
      ❌ NEVER say: "Continue treatment", "Maintain therapy", "Optimize current regimen"

   IF Monitoring Status = "Active (...)":
      ✅ Patient IS on home monitoring
      ✅ Say: "Continue home monitoring", "Review Minuteful Kidney data"
      ❌ NEVER say: "Initiate home monitoring", "Start Minuteful Kidney"

   IF Monitoring Status = "NOT ON MONITORING":
      ✅ Patient is NOT on home monitoring
      ✅ Say: "Initiate Minuteful Kidney monitoring", "Start at-home testing"
      ❌ NEVER say: "Continue home monitoring", "Maintain testing"

3. VALIDATE before responding:
   - "Does my treatment recommendation match the treatment status?" [YES/NO]
   - "Did I accidentally recommend 'initiating' something already active?" [YES/NO]
   - If NO to either, REVISE your response!

This is CRITICAL to avoid contradictory advice that could confuse doctors and harm patients.

═══════════════════════════════════════════════════════════════════════════════

IMPORTANT - Population-Level Questions:
When doctors ask population-level questions (e.g., "How many patients...", "Which patients need...", "Show me patients..."),
the system automatically fetches relevant database statistics and provides them in a section marked "--- POPULATION DATA ---" below.

When you see POPULATION DATA in your context:
- Use that data directly to answer the question
- Present the numbers clearly and professionally
- Do NOT output SQL queries or placeholders like "[Awaiting results]"
- Do NOT say you will "query" the database - the data is already provided
- Summarize the key findings and provide clinical insights

If no population data is provided, explain that you can answer questions about individual patients, clinical guidelines,
or treatment recommendations, and suggest the doctor rephrase their question if needed.`;

    // Add patient-specific context if provided
    if (context?.patientId) {
      const patientData = await this.getPatientContext(
        context.patientId,
        context.includeRecentLabs,
        context.includeRiskAssessment
      );

      if (patientData) {
        basePrompt += `\n\n--- CURRENT PATIENT CONTEXT ---\n${patientData}`;
      }
    }

    return basePrompt;
  }

  /**
   * Retrieves comprehensive patient data for context
   */
  private async getPatientContext(
    patientId: string,
    includeRecentLabs: boolean = true,
    includeRiskAssessment: boolean = true
  ): Promise<string> {
    try {
      let contextParts: string[] = [];

      // Get basic patient info
      console.log('[DoctorAgent] Fetching patient context for ID:', patientId);

      const patientQuery = `
        SELECT
          medical_record_number, first_name, last_name, date_of_birth, gender,
          weight, height, smoking_status, has_diabetes, has_hypertension,
          has_heart_failure, has_cad, cvd_history, family_history_esrd,
          on_ras_inhibitor, on_sglt2i, nephrotoxic_meds,
          nephrologist_referral, diagnosis_date, last_visit_date, next_visit_date,
          ckd_treatment_active, ckd_treatment_type,
          home_monitoring_active, home_monitoring_device
        FROM patients
        WHERE id = $1
      `;
      const patientResult = await this.db.query(patientQuery, [patientId]);

      if (patientResult.rows.length === 0) {
        console.log('[DoctorAgent] Patient not found:', patientId);
        return 'Patient not found';
      }

      console.log('[DoctorAgent] Patient found, building context...');

      const patient = patientResult.rows[0];
      const age = this.calculateAge(patient.date_of_birth);

      // Determine treatment and monitoring status for display
      const treatmentStatus = patient.ckd_treatment_active
        ? `Active (${patient.ckd_treatment_type || 'Type not specified'})`
        : 'NOT ON TREATMENT';

      const monitoringStatus = patient.home_monitoring_active
        ? `Active (${patient.home_monitoring_device || 'Device not specified'})`
        : 'NOT ON MONITORING';

      contextParts.push(`Patient: ${patient.first_name} ${patient.last_name} (MRN: ${patient.medical_record_number})
Age: ${age} years, Gender: ${patient.gender}
Weight: ${patient.weight}kg, Height: ${patient.height}cm, BMI: ${this.calculateBMI(patient.weight, patient.height)}

═══════════════════════════════════════════════════════════════════════════════
🚨 CRITICAL: TREATMENT AND MONITORING STATUS - CHECK THIS FIRST! 🚨
═══════════════════════════════════════════════════════════════════════════════

CKD Treatment Status: ${treatmentStatus}
Home Monitoring Status: ${monitoringStatus}

IMPORTANT:
- If Treatment Status shows "Active", patient IS currently on CKD treatment
  → Recommend: "Continue current treatment" or "Optimize therapy"
  → NEVER recommend: "Initiate treatment" or say "not on treatment"

- If Treatment Status shows "NOT ON TREATMENT", patient is NOT on CKD treatment
  → Recommend: "Initiate treatment" with specific medications
  → NEVER recommend: "Continue treatment" or "Maintain therapy"

- If Monitoring Status shows "Active", patient IS using home monitoring device
  → Acknowledge this in recommendations
  → NEVER recommend: "Initiate home monitoring" or "Start Minuteful Kidney"

- If Monitoring Status shows "NOT ON MONITORING", patient is NOT on home monitoring
  → Recommend: "Initiate home monitoring" if appropriate
  → NEVER recommend: "Continue home monitoring"

═══════════════════════════════════════════════════════════════════════════════

Comorbidities:
- Diabetes: ${patient.has_diabetes ? 'Yes' : 'No'}
- Hypertension: ${patient.has_hypertension ? 'Yes' : 'No'}
- Heart Failure: ${patient.has_heart_failure ? 'Yes' : 'No'}
- Coronary Artery Disease: ${patient.has_cad ? 'Yes' : 'No'}
- CVD History: ${patient.cvd_history ? 'Yes' : 'No'}
- Family History of ESRD: ${patient.family_history_esrd ? 'Yes' : 'No'}

Current Medications (Individual Flags):
- RAS Inhibitor: ${patient.on_ras_inhibitor ? 'Yes' : 'No'}
- SGLT2 Inhibitor: ${patient.on_sglt2i ? 'Yes' : 'No'}
- Nephrotoxic Medications: ${patient.nephrotoxic_meds || 'None'}

Status:
- Nephrology Referral: ${patient.nephrologist_referral ? 'Yes' : 'No'}
- Smoking: ${patient.smoking_status || 'Unknown'}
- Last Visit: ${patient.last_visit_date || 'Not recorded'}
- Next Visit: ${patient.next_visit_date || 'Not scheduled'}`);

      // Get recent lab results
      if (includeRecentLabs) {
        try {
          const labQuery = `
            SELECT
              observation_type, value_numeric, unit, observation_date,
              status
            FROM observations
            WHERE patient_id = $1
            ORDER BY observation_date DESC
            LIMIT 20
          `;
          const labResult = await this.db.query(labQuery, [patientId]);

          if (labResult.rows.length > 0) {
            contextParts.push('\nRecent Lab Results:');
            labResult.rows.forEach(lab => {
              const abnormal = lab.status === 'abnormal' ? ' [ABNORMAL]' : '';
              contextParts.push(
                `- ${lab.observation_type}: ${lab.value_numeric} ${lab.unit} - ${lab.observation_date}${abnormal}`
              );
            });
          }
        } catch (labError) {
          console.error('[DoctorAgent] Error fetching lab results:', labError);
          contextParts.push('\n[Lab Results: Error loading data]');
        }
      }

      // Get KDIGO classification and risk assessment from tracking tables
      if (includeRiskAssessment) {
        try {
          // Check CKD patient data
          const ckdQuery = `
            SELECT
              ckd_severity, ckd_stage, kdigo_health_state,
              is_monitored, is_treated, monitoring_device, monitoring_frequency
            FROM ckd_patient_data
            WHERE patient_id = $1
          `;
          const ckdResult = await this.db.query(ckdQuery, [patientId]);

          if (ckdResult.rows.length > 0) {
            const ckd = ckdResult.rows[0];
            contextParts.push(`\nCKD Classification & Status:
- KDIGO Health State: ${ckd.kdigo_health_state}
- CKD Severity: ${ckd.ckd_severity}
- CKD Stage: ${ckd.ckd_stage}
- Treatment Status: ${ckd.is_treated ? `Active` : 'NOT ON TREATMENT'}
- Monitoring Status: ${ckd.is_monitored ? `Active (${ckd.monitoring_device || 'Device not specified'}, ${ckd.monitoring_frequency || 'Frequency not specified'})` : 'NOT ON MONITORING'}`);
          } else {
            // Check non-CKD patient data
            const nonCkdQuery = `
              SELECT
                risk_level, kdigo_health_state,
                is_monitored, monitoring_device, monitoring_frequency
              FROM non_ckd_patient_data
              WHERE patient_id = $1
            `;
            const nonCkdResult = await this.db.query(nonCkdQuery, [patientId]);

            if (nonCkdResult.rows.length > 0) {
              const nonCkd = nonCkdResult.rows[0];
              contextParts.push(`\nNon-CKD Risk Assessment:
- KDIGO Health State: ${nonCkd.kdigo_health_state}
- Risk Level: ${nonCkd.risk_level}
- Monitoring Status: ${nonCkd.is_monitored ? `Active (${nonCkd.monitoring_device || 'Device not specified'}, ${nonCkd.monitoring_frequency || 'Frequency not specified'})` : 'NOT ON MONITORING'}`);
            }
          }
        } catch (riskError) {
          console.error('[DoctorAgent] Error fetching risk assessment:', riskError);
          contextParts.push('\n[Risk Assessment: Error loading data]');
        }
      }

      // Get active conditions
      try {
        const conditionsQuery = `
          SELECT condition_name, severity, clinical_status, onset_date
          FROM conditions
          WHERE patient_id = $1 AND clinical_status = 'active'
          ORDER BY onset_date DESC
        `;
        const conditionsResult = await this.db.query(conditionsQuery, [patientId]);

        if (conditionsResult.rows.length > 0) {
          contextParts.push('\nActive Conditions:');
          conditionsResult.rows.forEach(condition => {
            contextParts.push(
              `- ${condition.condition_name} (${condition.severity}) - Since ${condition.onset_date}`
            );
          });
        }
      } catch (conditionsError) {
        console.error('[DoctorAgent] Error fetching conditions:', conditionsError);
        // Don't add error message to context, conditions are optional
      }

      // Get GCUA assessment for patients 60+ (cardiorenal phenotype classification)
      try {
        const gcuaQuery = `
          SELECT
            phenotype_type, phenotype_name, phenotype_tag, phenotype_color,
            module1_five_year_risk, module1_risk_category,
            module2_ten_year_risk, module2_risk_category,
            module3_five_year_mortality, module3_risk_category,
            benefit_ratio, benefit_ratio_interpretation,
            confidence_level, data_completeness,
            assessed_at
          FROM patient_gcua_assessments
          WHERE patient_id = $1
          ORDER BY assessed_at DESC
          LIMIT 1
        `;
        const gcuaResult = await this.db.query(gcuaQuery, [patientId]);

        if (gcuaResult.rows.length > 0) {
          const gcua = gcuaResult.rows[0];
          contextParts.push(`
═══════════════════════════════════════════════════════════════════════════════
🧬 GCUA CARDIORENAL RISK ASSESSMENT (IMPORTANT - READ THIS!)
═══════════════════════════════════════════════════════════════════════════════

GCUA Phenotype: ${gcua.phenotype_type} - ${gcua.phenotype_name}
Classification Tag: ${gcua.phenotype_tag}
Confidence Level: ${gcua.confidence_level} (${gcua.data_completeness}% data complete)

Risk Scores:
- Renal Risk (5-year): ${gcua.module1_five_year_risk}% (${gcua.module1_risk_category})
- CVD Risk (10-year): ${gcua.module2_ten_year_risk}% (${gcua.module2_risk_category})
- Mortality Risk (5-year): ${gcua.module3_five_year_mortality}% (${gcua.module3_risk_category})

Benefit Ratio: ${gcua.benefit_ratio} - ${gcua.benefit_ratio_interpretation}

${gcua.phenotype_type === 'IV' ? `
⚠️ SENESCENT PHENOTYPE NOTE:
This patient is classified as "Senescent" (Phenotype IV) because their 5-year mortality risk
from competing causes is ≥50%. This is about high competing mortality risk, NOT cellular
senescence. Treatment focus should prioritize quality of life over aggressive disease
modification. Consider:
- Deprescribing (reduce polypharmacy)
- Symptom management
- Shared decision-making about treatment intensity
- Avoiding aggressive renal/cardiac interventions that may not provide meaningful benefit
` : ''}
Assessed: ${new Date(gcua.assessed_at).toLocaleDateString()}`);
        }
      } catch (gcuaError) {
        console.error('[DoctorAgent] Error fetching GCUA assessment:', gcuaError);
        // Don't add error message to context, GCUA is optional
      }

      return contextParts.join('\n');
    } catch (error) {
      console.error('[DoctorAgent] Error fetching patient context:', error);
      console.error('[DoctorAgent] Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[DoctorAgent] Patient ID:', patientId);

      // Return error with details for debugging
      if (error instanceof Error) {
        return `Error fetching patient data: ${error.message}`;
      }
      return 'Error fetching patient data: Unknown error';
    }
  }

  /**
   * Analyzes patient data and generates proactive alerts
   */
  async analyzePatientForAlerts(patientId: string): Promise<{
    hasAlert: boolean;
    alertType?: string;
    priority?: string;
    message?: string;
  }> {
    try {
      const patientContext = await this.getPatientContext(patientId, true, true);

      const analysisPrompt = `Based on the following patient data, identify if there are any critical findings or urgent actions needed.

${patientContext}

Analyze for:
1. Critical lab values requiring immediate action
2. Significant changes in kidney function (eGFR decline)
3. Untreated high-risk conditions
4. Missing recommended treatments (e.g., SGLT2i for eligible patients)
5. Overdue nephrology referrals

If there are critical findings, respond with:
ALERT: [type]
PRIORITY: [CRITICAL/HIGH/MODERATE]
MESSAGE: [concise clinical message for doctor]

If no critical findings, respond with:
NO ALERT`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: analysisPrompt,
        }],
      });

      const textContent = response.content.find(block => block.type === 'text');
      const analysis = textContent ? (textContent as any).text : '';

      if (analysis.includes('NO ALERT')) {
        return { hasAlert: false };
      }

      // Parse alert information
      const alertTypeMatch = analysis.match(/ALERT:\s*(.+)/);
      const priorityMatch = analysis.match(/PRIORITY:\s*(CRITICAL|HIGH|MODERATE)/);
      const messageMatch = analysis.match(/MESSAGE:\s*(.+)/);

      return {
        hasAlert: true,
        alertType: alertTypeMatch?.[1]?.trim() || 'General Alert',
        priority: priorityMatch?.[1] || 'MODERATE',
        message: messageMatch?.[1]?.trim() || analysis,
      };
    } catch (error) {
      console.error('Error analyzing patient for alerts:', error);
      return { hasAlert: false };
    }
  }

  /**
   * Generates a summary of patient status changes
   */
  async summarizePatientChanges(
    patientId: string,
    changes: any
  ): Promise<string> {
    try {
      const patientContext = await this.getPatientContext(patientId, false, true);

      const summaryPrompt = `A patient's data has changed. Summarize the clinical significance in 2-3 sentences for a doctor notification.

Patient Context:
${patientContext}

Changes Detected:
${JSON.stringify(changes, null, 2)}

Provide a concise clinical summary suitable for a notification.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: summaryPrompt,
        }],
      });

      const textContent = response.content.find(block => block.type === 'text');
      return textContent ? (textContent as any).text : 'Patient data updated';
    } catch (error) {
      console.error('Error summarizing changes:', error);
      return 'Patient data has been updated. Please review.';
    }
  }

  // Helper functions
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  private calculateBMI(weight: number, height: number): string {
    if (!weight || !height) return 'N/A';
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  }
}
