import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

/**
 * MCP Client wrapper for Healthcare MCP Server
 * Provides typed access to phase-based CKD clinical decision tools
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected: boolean = false;

  constructor() {}

  /**
   * Initialize connection to MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Determine MCP server path
      // __dirname = /app/backend/dist/services (in production)
      // Go up 3 levels to /app, then to mcp-server/dist/index.js
      const mcpServerPath = path.resolve(__dirname, '../../../mcp-server/dist/index.js');

      console.log(`[MCP Client] Connecting to MCP server at: ${mcpServerPath}`);

      // Create stdio transport to spawn MCP server as child process
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [mcpServerPath],
        env: {
          ...process.env,
          // Ensure NODE_ENV is set
          NODE_ENV: process.env.NODE_ENV || 'development',
        } as Record<string, string>,
      });

      // Create MCP client
      this.client = new Client(
        {
          name: 'healthcare-backend-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect client to transport
      await this.client.connect(this.transport);

      this.isConnected = true;
      console.log('[MCP Client] Successfully connected to MCP server');

      // List available tools for debugging
      const tools = await this.listTools();
      console.log(`[MCP Client] Available tools: ${tools.map(t => t.name).join(', ')}`);
    } catch (error) {
      console.error('[MCP Client] Failed to connect to MCP server:', error);
      throw new Error(`MCP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.isConnected = false;
    console.log('[MCP Client] Disconnected from MCP server');
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.listTools();
    return result.tools;
  }

  /**
   * MASTER ORCHESTRATOR: Comprehensive CKD Analysis
   *
   * Single entry point for complete patient assessment.
   * Runs deterministic pipeline:
   *   1. Clinical calculation (eGFR, KDIGO staging)
   *   2. Risk stratification (KDIGO heatmap → risk color)
   *   3. Protocol adherence check (monitoring intervals vs actual dates)
   *   4. Medication safety assessment (Jardiance, RAS inhibitors)
   *   5. Adherence analysis (refill gaps, overdue tests)
   *   6. Treatment opportunity identification
   *
   * Returns comprehensive report with patient_summary, critical_alerts, and action_plan.
   * USE THIS FIRST for patient assessments instead of calling multiple individual tools.
   */
  async comprehensiveCKDAnalysis(patientId: string): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'comprehensive_ckd_analysis',
      arguments: { patient_id: patientId },
    });

    return this.parseToolResult(result);
  }

  /**
   * PHASE 1: Assess pre-diagnosis CKD risk
   * Use when patient lacks recent eGFR/uACR labs
   */
  async assessPreDiagnosisRisk(patientId: string): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'assess_pre_diagnosis_risk',
      arguments: { patient_id: patientId },
    });

    return this.parseToolResult(result);
  }

  /**
   * PHASE 2: Perform KDIGO classification
   * Use when patient has eGFR and uACR results
   */
  async classifyKDIGO(patientId: string): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'classify_kdigo',
      arguments: { patient_id: patientId },
    });

    return this.parseToolResult(result);
  }

  /**
   * PHASE 3: Assess treatment options
   * Evaluate eligibility for Jardiance, RAS inhibitors, and Minuteful Kidney home monitoring
   */
  async assessTreatmentOptions(patientId: string): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'assess_treatment_options',
      arguments: { patient_id: patientId },
    });

    return this.parseToolResult(result);
  }

  /**
   * PHASE 4: Monitor medication adherence
   * Calculate MPR and detect adherence barriers
   */
  async monitorAdherence(
    patientId: string,
    medicationType: 'SGLT2i' | 'RAS_inhibitor' | 'ALL' = 'ALL',
    measurementPeriodDays: number = 90
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'monitor_adherence',
      arguments: {
        patient_id: patientId,
        medication_type: medicationType,
        measurement_period_days: measurementPeriodDays,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * PHASE 4 ENHANCED: Monitor composite adherence (MPR + Lab-based + Self-report)
   * Comprehensive adherence assessment combining multiple measurement methods
   */
  async monitorCompositeAdherence(
    patientId: string,
    measurementPeriodDays: number = 90,
    includePredictions: boolean = true
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'monitor_composite_adherence',
      arguments: {
        patient_id: patientId,
        measurement_period_days: measurementPeriodDays,
        include_predictions: includePredictions,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * CLINICAL: Calculate eGFR using CKD-EPI 2021 formula
   * Use for on-the-fly eGFR calculation from creatinine values
   */
  async calculateEGFR(
    patientId: string,
    creatinineMgdl?: number
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'calculate_egfr',
      arguments: {
        patient_id: patientId,
        creatinine_mgdl: creatinineMgdl,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * CLINICAL: Predict kidney failure risk using KFRE
   * Returns 2-year and 5-year risk of dialysis/transplant
   */
  async predictKidneyFailureRisk(
    patientId: string,
    timeHorizon: 2 | 5 = 5
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'predict_kidney_failure_risk',
      arguments: {
        patient_id: patientId,
        time_horizon: timeHorizon,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * CLINICAL: Check adherence to screening protocols
   * Identifies missing or overdue screening tests
   */
  async checkScreeningProtocol(patientId: string): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'check_screening_protocol',
      arguments: {
        patient_id: patientId,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * CLINICAL: Assess medication safety based on kidney function
   * Returns dose adjustments, contraindications, and nephrotoxic risks
   */
  async assessMedicationSafety(
    patientId: string,
    medicationName?: string
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'assess_medication_safety',
      arguments: {
        patient_id: patientId,
        medication_name: medicationName,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * CLINICAL: Analyze medication and screening protocol adherence
   * Tracks refill gaps and KDIGO-based screening compliance
   */
  async analyzeAdherence(
    patientId: string,
    checkMedication?: string,
    reportDate?: string
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'analyze_adherence',
      arguments: {
        patient_id: patientId,
        check_medication: checkMedication,
        report_date: reportDate,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * Legacy: Get comprehensive patient data
   */
  async getPatientData(
    patientId: string,
    includeLabs: boolean = true,
    includeRisk: boolean = true
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'get_patient_data',
      arguments: {
        patient_id: patientId,
        include_labs: includeLabs,
        include_risk: includeRisk,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * Legacy: Query lab results
   */
  async queryLabResults(
    patientId: string,
    observationType?: string,
    dateRange?: { start: string; end: string },
    limit: number = 20
  ): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'query_lab_results',
      arguments: {
        patient_id: patientId,
        observation_type: observationType,
        date_range: dateRange,
        limit,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * Legacy: Get population statistics
   */
  async getPopulationStats(filters?: any, groupBy?: string): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'get_population_stats',
      arguments: {
        filters: filters || {},
        group_by: groupBy,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * Legacy: Search clinical guidelines
   */
  async searchGuidelines(topic: string, ckdStage?: string): Promise<any> {
    if (!this.client || !this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'search_guidelines',
      arguments: {
        topic,
        ckd_stage: ckdStage,
      },
    });

    return this.parseToolResult(result);
  }

  /**
   * Parse tool result from MCP response
   */
  private parseToolResult(result: any): any {
    if (!result || !result.content || result.content.length === 0) {
      throw new Error('Empty response from MCP server');
    }

    // MCP returns content as array of content blocks
    const textContent = result.content.find((block: any) => block.type === 'text');
    if (!textContent) {
      throw new Error('No text content in MCP response');
    }

    try {
      // Parse JSON response
      return JSON.parse(textContent.text);
    } catch (error) {
      // If not JSON, return raw text
      return textContent.text;
    }
  }
}

// Singleton instance
let mcpClientInstance: MCPClient | null = null;

/**
 * Get or create MCP client singleton
 */
export async function getMCPClient(): Promise<MCPClient> {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
    await mcpClientInstance.connect();
  }
  return mcpClientInstance;
}

/**
 * Close MCP client connection (for graceful shutdown)
 */
export async function closeMCPClient(): Promise<void> {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
    mcpClientInstance = null;
  }
}
