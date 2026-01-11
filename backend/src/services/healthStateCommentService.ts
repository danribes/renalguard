/**
 * Health State Comment Service
 * Generates automated comments when patient health states change
 * Provides clinical summaries, mitigation measures, and acknowledgments
 */

import { Pool } from 'pg';
import { classifyKDIGO, getCKDSeverity, KDIGOClassification } from '../utils/kdigo';

interface HealthStateChangeData {
  patient_id: string;
  from_health_state: string | null;
  to_health_state: string;
  from_risk_level: string | null;
  to_risk_level: string;
  egfr_from: number | null;
  egfr_to: number;
  uacr_from: number | null;
  uacr_to: number;
  cycle_number: number;
  is_ckd_patient: boolean;
  state_transition_id?: string;
}

interface GeneratedComment {
  comment_text: string;
  clinical_summary: string;
  recommended_actions: string[];
  mitigation_measures: string[];
  acknowledgment_text: string | null;
  severity: 'info' | 'warning' | 'critical';
  change_type: 'improved' | 'worsened' | 'stable' | 'initial';
}

export class HealthStateCommentService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Main entry point: Create comment when health state changes
   */
  async createCommentForHealthStateChange(data: HealthStateChangeData): Promise<string | null> {
    try {
      // If this is the initial state (no previous state), create an initial comment
      if (!data.from_health_state) {
        return await this.createInitialComment(data);
      }

      // Check if health state changed OR if there are significant lab value changes
      const healthStateChanged = data.from_health_state !== data.to_health_state;
      const hasSignificantLabChanges = this.hasSignificantLabChanges(data);

      if (!healthStateChanged && !hasSignificantLabChanges) {
        console.log(`[Health State Comment] No significant changes for patient ${data.patient_id}`);
        return null;
      }

      // Generate the comment based on the change
      const generatedComment = healthStateChanged
        ? this.generateCommentForChange(data)
        : this.generateCommentForLabChanges(data);

      // Calculate severity information for CKD patients
      const toClassification = classifyKDIGO(data.egfr_to, data.uacr_to);
      const severity_to = getCKDSeverity(toClassification.ckd_stage);

      let severity_from = null;
      if (data.egfr_from && data.uacr_from) {
        const fromClassification = classifyKDIGO(data.egfr_from, data.uacr_from);
        severity_from = getCKDSeverity(fromClassification.ckd_stage);
      }

      // Insert comment into database
      const insertQuery = `
        INSERT INTO patient_health_state_comments (
          patient_id,
          state_transition_id,
          comment_text,
          comment_type,
          health_state_from,
          health_state_to,
          risk_level_from,
          risk_level_to,
          change_type,
          is_ckd_patient,
          severity_from,
          severity_to,
          cycle_number,
          egfr_from,
          egfr_to,
          egfr_change,
          uacr_from,
          uacr_to,
          uacr_change,
          clinical_summary,
          recommended_actions,
          mitigation_measures,
          acknowledgment_text,
          severity,
          created_by,
          created_by_type
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26
        )
        RETURNING id
      `;

      const egfr_change = data.egfr_from ? data.egfr_to - data.egfr_from : null;
      const uacr_change = data.uacr_from ? data.uacr_to - data.uacr_from : null;

      const result = await this.db.query(insertQuery, [
        data.patient_id,
        data.state_transition_id || null,
        generatedComment.comment_text,
        'automatic',
        data.from_health_state,
        data.to_health_state,
        data.from_risk_level,
        data.to_risk_level,
        generatedComment.change_type,
        data.is_ckd_patient,
        severity_from,
        severity_to,
        data.cycle_number,
        data.egfr_from,
        data.egfr_to,
        egfr_change,
        data.uacr_from,
        data.uacr_to,
        uacr_change,
        generatedComment.clinical_summary,
        generatedComment.recommended_actions,
        generatedComment.mitigation_measures,
        generatedComment.acknowledgment_text,
        generatedComment.severity,
        'system',
        'system'
      ]);

      const commentId = result.rows[0].id;
      console.log(`✓ Health state comment created for patient ${data.patient_id}: ${generatedComment.change_type}`);

      return commentId;
    } catch (error) {
      console.error('Error creating health state comment:', error);
      throw error;
    }
  }

  /**
   * Create initial comment for first health state observation
   */
  private async createInitialComment(data: HealthStateChangeData): Promise<string> {
    const classification = classifyKDIGO(data.egfr_to, data.uacr_to);
    const severity = getCKDSeverity(classification.ckd_stage);

    const comment_text = this.generateInitialCommentText(data, classification);
    const clinical_summary = `Initial health state assessment: ${data.to_health_state} (${classification.ckd_stage_name}). ` +
      `Risk level: ${data.to_risk_level}. ` +
      (data.is_ckd_patient
        ? `Patient has CKD with ${severity} severity. Baseline monitoring established.`
        : `Patient does not have CKD. Baseline risk assessment established.`);

    const recommended_actions = this.getRecommendedActions(classification, 'initial');

    const insertQuery = `
      INSERT INTO patient_health_state_comments (
        patient_id,
        comment_text,
        comment_type,
        health_state_to,
        risk_level_to,
        change_type,
        is_ckd_patient,
        severity_to,
        cycle_number,
        egfr_to,
        uacr_to,
        clinical_summary,
        recommended_actions,
        severity,
        created_by,
        created_by_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `;

    const result = await this.db.query(insertQuery, [
      data.patient_id,
      comment_text,
      'automatic',
      data.to_health_state,
      data.to_risk_level,
      'initial',
      data.is_ckd_patient,
      severity,
      data.cycle_number,
      data.egfr_to,
      data.uacr_to,
      clinical_summary,
      recommended_actions,
      'info',
      'system',
      'system'
    ]);

    console.log(`✓ Initial health state comment created for patient ${data.patient_id}`);
    return result.rows[0].id;
  }

  /**
   * Generate comment text for initial observation
   */
  private generateInitialCommentText(data: HealthStateChangeData, classification: KDIGOClassification): string {
    if (data.is_ckd_patient) {
      return `Initial assessment: Patient has ${classification.ckd_stage_name} with health state ${data.to_health_state}. ` +
        `Risk level: ${data.to_risk_level}. Baseline established for monitoring.`;
    } else {
      return `Initial assessment: Patient does not have CKD. Health state: ${data.to_health_state}. ` +
        `Risk level: ${data.to_risk_level}. Continue routine monitoring.`;
    }
  }

  /**
   * Generate comment for health state change
   */
  private generateCommentForChange(data: HealthStateChangeData): GeneratedComment {
    const change_type = this.determineChangeType(data);
    const toClassification = classifyKDIGO(data.egfr_to, data.uacr_to);

    let fromClassification: KDIGOClassification | null = null;
    if (data.egfr_from && data.uacr_from) {
      fromClassification = classifyKDIGO(data.egfr_from, data.uacr_from);
    }

    let comment_text = '';
    let clinical_summary = '';
    let recommended_actions: string[] = [];
    let mitigation_measures: string[] = [];
    let acknowledgment_text: string | null = null;
    let severity: 'info' | 'warning' | 'critical' = 'info';

    if (change_type === 'worsened') {
      const result = this.generateWorseningComment(data, toClassification, fromClassification);
      comment_text = result.comment_text;
      clinical_summary = result.clinical_summary;
      recommended_actions = result.recommended_actions;
      mitigation_measures = result.mitigation_measures;
      severity = result.severity;
    } else if (change_type === 'improved') {
      const result = this.generateImprovementComment(data, toClassification, fromClassification);
      comment_text = result.comment_text;
      clinical_summary = result.clinical_summary;
      recommended_actions = result.recommended_actions;
      acknowledgment_text = result.acknowledgment_text;
      severity = 'info';
    } else {
      // Stable - minimal change
      const egfr_change = data.egfr_from ? data.egfr_to - data.egfr_from : 0;
      const uacr_change = data.uacr_from ? data.uacr_to - data.uacr_from : 0;

      comment_text = `Health state remains ${data.to_health_state} (${data.to_risk_level} risk). `;

      // Add current values to comment text
      if (data.egfr_from && data.uacr_from) {
        comment_text += `eGFR: ${data.egfr_from.toFixed(1)} → ${data.egfr_to.toFixed(1)} mL/min/1.73m² (${egfr_change >= 0 ? '+' : ''}${egfr_change.toFixed(1)}), uACR: ${data.uacr_from.toFixed(1)} → ${data.uacr_to.toFixed(1)} mg/g (${uacr_change >= 0 ? '+' : ''}${uacr_change.toFixed(1)}). `;
      }

      comment_text += `Continue current management plan.`;
      clinical_summary = `Health state stable with no significant changes. Current values: eGFR ${data.egfr_to.toFixed(1)} mL/min/1.73m², uACR ${data.uacr_to.toFixed(1)} mg/g.`;
      recommended_actions = ['Continue current monitoring schedule', 'Maintain current treatment plan'];
    }

    return {
      comment_text,
      clinical_summary,
      recommended_actions,
      mitigation_measures,
      acknowledgment_text,
      severity,
      change_type
    };
  }

  /**
   * Determine if health state improved, worsened, or stayed stable
   */
  private determineChangeType(data: HealthStateChangeData): 'improved' | 'worsened' | 'stable' {
    // First, check if the KDIGO categories (GFR or albuminuria) changed
    // This is important because risk level alone may not capture category transitions
    // (e.g., G3b-A3 → G4-A3 are both "very_high" risk but G4 is worse than G3b)
    if (data.from_health_state && data.to_health_state) {
      const fromParts = data.from_health_state.split('-');
      const toParts = data.to_health_state.split('-');

      if (fromParts.length === 2 && toParts.length === 2) {
        const fromGFR = fromParts[0]; // e.g., "G3b"
        const toGFR = toParts[0]; // e.g., "G4"
        const fromAlb = fromParts[1]; // e.g., "A2"
        const toAlb = toParts[1]; // e.g., "A3"

        // GFR category order (higher number = worse kidney function)
        const gfrOrder: { [key: string]: number } = {
          'G1': 1, 'G2': 2, 'G3a': 3, 'G3b': 4, 'G4': 5, 'G5': 6
        };

        // Albuminuria category order (higher number = worse)
        const albOrder: { [key: string]: number } = {
          'A1': 1, 'A2': 2, 'A3': 3
        };

        const fromGFRNum = gfrOrder[fromGFR] || 0;
        const toGFRNum = gfrOrder[toGFR] || 0;
        const fromAlbNum = albOrder[fromAlb] || 0;
        const toAlbNum = albOrder[toAlb] || 0;

        // Check if GFR or albuminuria category changed
        if (toGFRNum > fromGFRNum || toAlbNum > fromAlbNum) {
          // Category worsened
          return 'worsened';
        } else if (toGFRNum < fromGFRNum || toAlbNum < fromAlbNum) {
          // Category improved
          return 'improved';
        }
      }
    }

    // If KDIGO categories didn't change, check risk level
    const riskOrder: { [key: string]: number } = {
      'low': 1,
      'moderate': 2,
      'high': 3,
      'very_high': 4
    };

    const fromRisk = data.from_risk_level ? riskOrder[data.from_risk_level] : 0;
    const toRisk = riskOrder[data.to_risk_level];

    if (toRisk < fromRisk) {
      return 'improved';
    } else if (toRisk > fromRisk) {
      return 'worsened';
    }

    // If risk level is the same, check eGFR and uACR changes
    const egfr_change = data.egfr_from ? data.egfr_to - data.egfr_from : 0;
    const uacr_change = data.uacr_from ? data.uacr_to - data.uacr_from : 0;

    // Improvement: eGFR increased and/or uACR decreased
    if (egfr_change > 5 || uacr_change < -50) {
      return 'improved';
    }

    // Worsening: eGFR decreased and/or uACR increased
    if (egfr_change < -5 || uacr_change > 50) {
      return 'worsened';
    }

    return 'stable';
  }

  /**
   * Check if there are significant lab value changes even if health state category didn't change
   * This catches gradual declines within the same KDIGO category
   */
  private hasSignificantLabChanges(data: HealthStateChangeData): boolean {
    if (!data.egfr_from || !data.uacr_from) {
      return false;
    }

    const egfr_change = data.egfr_to - data.egfr_from;
    const uacr_change = data.uacr_to - data.uacr_from;

    const egfr_pct_change = data.egfr_from !== 0 ? Math.abs(egfr_change / data.egfr_from) * 100 : 0;
    const uacr_pct_change = data.uacr_from !== 0 ? Math.abs(uacr_change / data.uacr_from) * 100 : 0;

    // Detect significant changes:
    // - eGFR: decrease/increase > 3 units OR > 5% change
    // - uACR: change > 20% or crossing key thresholds (30, 300)

    // Significant eGFR change
    if (Math.abs(egfr_change) > 3 || egfr_pct_change > 5) {
      console.log(`[Health State Comment] Significant eGFR change detected: ${egfr_change.toFixed(1)} units (${egfr_pct_change.toFixed(1)}%)`);
      return true;
    }

    // Significant uACR change
    if (uacr_pct_change > 20) {
      console.log(`[Health State Comment] Significant uACR change detected: ${uacr_pct_change.toFixed(1)}%`);
      return true;
    }

    // Check if uACR crossed important clinical thresholds (30 or 300 mg/g)
    // even if percentage change is < 20%
    const crossedA1A2 = (data.uacr_from < 30 && data.uacr_to >= 30) || (data.uacr_from >= 30 && data.uacr_to < 30);
    const crossedA2A3 = (data.uacr_from < 300 && data.uacr_to >= 300) || (data.uacr_from >= 300 && data.uacr_to < 300);

    if (crossedA1A2 || crossedA2A3) {
      console.log(`[Health State Comment] uACR crossed albuminuria threshold: ${data.uacr_from} → ${data.uacr_to}`);
      return true;
    }

    return false;
  }

  /**
   * Generate comment for significant lab changes without health state category change
   * This handles cases where eGFR/uACR change significantly but stay within the same KDIGO category
   */
  private generateCommentForLabChanges(data: HealthStateChangeData): GeneratedComment {
    const egfr_change = data.egfr_from ? data.egfr_to - data.egfr_from : 0;
    const uacr_change = data.uacr_from ? data.uacr_to - data.uacr_from : 0;

    const toClassification = classifyKDIGO(data.egfr_to, data.uacr_to);

    // Determine if labs worsened or improved
    const isWorsening = egfr_change < 0 || uacr_change > 0;
    const change_type: 'improved' | 'worsened' | 'stable' = isWorsening ? 'worsened' : 'improved';

    let comment_text = '';
    let clinical_summary = '';
    let recommended_actions: string[] = [];
    let mitigation_measures: string[] = [];
    let severity: 'info' | 'warning' | 'critical' = 'info';

    if (isWorsening) {
      severity = 'warning';

      // Check for critical decline
      if (egfr_change < -10 || toClassification.gfr_category === 'G5' || toClassification.gfr_category === 'G4') {
        severity = 'critical';
      }

      comment_text = `⚠️ Kidney function decline detected within ${data.to_health_state} health state. `;

      clinical_summary = `Patient remains in ${data.to_health_state} (${toClassification.ckd_stage_name}) but shows concerning lab value changes. `;

      if (egfr_change < 0) {
        clinical_summary += `eGFR decreased by ${Math.abs(egfr_change).toFixed(1)} mL/min/1.73m² (from ${data.egfr_from?.toFixed(1)} to ${data.egfr_to.toFixed(1)}). `;
        comment_text += `eGFR declined ${Math.abs(egfr_change).toFixed(1)} units. `;
      }

      if (uacr_change > 0) {
        clinical_summary += `uACR increased by ${uacr_change.toFixed(1)} mg/g (from ${data.uacr_from?.toFixed(1)} to ${data.uacr_to.toFixed(1)}), indicating worsening proteinuria. `;
        comment_text += `uACR increased ${uacr_change.toFixed(1)} mg/g. `;
      }

      clinical_summary += `Risk level: ${data.to_risk_level}. Intervention may be needed to prevent progression.`;

      recommended_actions = this.getRecommendedActions(toClassification, 'worsened');
      mitigation_measures = this.getMitigationMeasures(data, toClassification);

    } else {
      // Improvement
      comment_text = `✓ Kidney function improvement within ${data.to_health_state} health state. `;

      clinical_summary = `Patient remains in ${data.to_health_state} (${toClassification.ckd_stage_name}) with positive lab value changes. `;

      if (egfr_change > 0) {
        clinical_summary += `eGFR increased by ${egfr_change.toFixed(1)} mL/min/1.73m² (from ${data.egfr_from?.toFixed(1)} to ${data.egfr_to.toFixed(1)}). `;
        comment_text += `eGFR improved ${egfr_change.toFixed(1)} units. `;
      }

      if (uacr_change < 0) {
        clinical_summary += `uACR decreased by ${Math.abs(uacr_change).toFixed(1)} mg/g (from ${data.uacr_from?.toFixed(1)} to ${data.uacr_to.toFixed(1)}), indicating reduced proteinuria. `;
        comment_text += `uACR decreased ${Math.abs(uacr_change).toFixed(1)} mg/g. `;
      }

      clinical_summary += `Risk level: ${data.to_risk_level}. Continue current management.`;

      recommended_actions = this.getRecommendedActions(toClassification, 'improved');
    }

    return {
      comment_text,
      clinical_summary,
      recommended_actions,
      mitigation_measures,
      acknowledgment_text: null,
      severity,
      change_type
    };
  }

  /**
   * Generate comment for worsening health state
   */
  private generateWorseningComment(
    data: HealthStateChangeData,
    toClassification: KDIGOClassification,
    fromClassification: KDIGOClassification | null
  ): {
    comment_text: string;
    clinical_summary: string;
    recommended_actions: string[];
    mitigation_measures: string[];
    severity: 'info' | 'warning' | 'critical';
  } {
    const egfr_change = data.egfr_from ? data.egfr_to - data.egfr_from : 0;
    const uacr_change = data.uacr_from ? data.uacr_to - data.uacr_from : 0;

    let severity: 'info' | 'warning' | 'critical' = 'warning';

    // Determine severity
    if (toClassification.risk_level === 'very_high' || toClassification.gfr_category === 'G5' || toClassification.gfr_category === 'G4') {
      severity = 'critical';
    }

    let comment_text = '';
    let clinical_summary = '';

    if (data.is_ckd_patient) {
      const to_severity = getCKDSeverity(toClassification.ckd_stage);
      const from_severity = fromClassification ? getCKDSeverity(fromClassification.ckd_stage) : null;

      comment_text = `⚠️ Health state worsened from ${data.from_health_state} to ${data.to_health_state}. `;

      if (from_severity && to_severity && from_severity !== to_severity) {
        comment_text += `CKD severity progressed from ${from_severity} to ${to_severity}. `;
      }

      // Add values to comment text
      if (egfr_change < 0 && uacr_change > 0) {
        comment_text += `eGFR declined from ${data.egfr_from?.toFixed(1)} to ${data.egfr_to.toFixed(1)} mL/min/1.73m² (${Math.abs(egfr_change).toFixed(1)} decrease) and uACR increased from ${data.uacr_from?.toFixed(1)} to ${data.uacr_to.toFixed(1)} mg/g (+${uacr_change.toFixed(1)}). `;
      } else if (egfr_change < 0) {
        comment_text += `eGFR declined from ${data.egfr_from?.toFixed(1)} to ${data.egfr_to.toFixed(1)} mL/min/1.73m² (${Math.abs(egfr_change).toFixed(1)} decrease). `;
      } else if (uacr_change > 0) {
        comment_text += `uACR increased from ${data.uacr_from?.toFixed(1)} to ${data.uacr_to.toFixed(1)} mg/g (+${uacr_change.toFixed(1)}). `;
      }

      clinical_summary = `Patient's kidney function has declined. `;

      if (egfr_change < 0) {
        clinical_summary += `eGFR decreased by ${Math.abs(egfr_change).toFixed(1)} mL/min/1.73m² (from ${data.egfr_from?.toFixed(1)} to ${data.egfr_to.toFixed(1)}). `;
      }

      if (uacr_change > 0) {
        clinical_summary += `uACR increased by ${uacr_change.toFixed(1)} mg/g (from ${data.uacr_from?.toFixed(1)} to ${data.uacr_to.toFixed(1)}), indicating worsening proteinuria. `;
      }

      clinical_summary += `Current risk level: ${data.to_risk_level}. ${toClassification.ckd_stage_name}.`;
    } else {
      comment_text = `⚠️ Health state worsened from ${data.from_health_state} to ${data.to_health_state}. ` +
        `Risk level increased from ${data.from_risk_level} to ${data.to_risk_level}. `;

      // Add values to comment text
      if (egfr_change < 0 && uacr_change > 0) {
        comment_text += `eGFR: ${data.egfr_from?.toFixed(1)} → ${data.egfr_to.toFixed(1)} mL/min/1.73m² (${Math.abs(egfr_change).toFixed(1)} decrease), uACR: ${data.uacr_from?.toFixed(1)} → ${data.uacr_to.toFixed(1)} mg/g (+${uacr_change.toFixed(1)}).`;
      } else if (egfr_change < 0) {
        comment_text += `eGFR: ${data.egfr_from?.toFixed(1)} → ${data.egfr_to.toFixed(1)} mL/min/1.73m² (${Math.abs(egfr_change).toFixed(1)} decrease).`;
      } else if (uacr_change > 0) {
        comment_text += `uACR: ${data.uacr_from?.toFixed(1)} → ${data.uacr_to.toFixed(1)} mg/g (+${uacr_change.toFixed(1)}).`;
      }

      clinical_summary = `Patient's kidney function markers have deteriorated. `;

      if (egfr_change < 0) {
        clinical_summary += `eGFR decreased by ${Math.abs(egfr_change).toFixed(1)} mL/min/1.73m² (${data.egfr_from?.toFixed(1)} → ${data.egfr_to.toFixed(1)}). `;
      }

      if (uacr_change > 0) {
        clinical_summary += `uACR increased by ${uacr_change.toFixed(1)} mg/g (${data.uacr_from?.toFixed(1)} → ${data.uacr_to.toFixed(1)}). `;
      }

      clinical_summary += `Increased monitoring recommended.`;
    }

    const recommended_actions = this.getRecommendedActions(toClassification, 'worsened');
    const mitigation_measures = this.getMitigationMeasures(data, toClassification);

    return {
      comment_text,
      clinical_summary,
      recommended_actions,
      mitigation_measures,
      severity
    };
  }

  /**
   * Generate comment for improving health state
   */
  private generateImprovementComment(
    data: HealthStateChangeData,
    toClassification: KDIGOClassification,
    fromClassification: KDIGOClassification | null
  ): {
    comment_text: string;
    clinical_summary: string;
    recommended_actions: string[];
    acknowledgment_text: string;
  } {
    const egfr_change = data.egfr_from ? data.egfr_to - data.egfr_from : 0;
    const uacr_change = data.uacr_from ? data.uacr_to - data.uacr_from : 0;

    let comment_text = '';
    let clinical_summary = '';
    let acknowledgment_text = '';

    if (data.is_ckd_patient) {
      const to_severity = getCKDSeverity(toClassification.ckd_stage);
      const from_severity = fromClassification ? getCKDSeverity(fromClassification.ckd_stage) : null;

      comment_text = `✓ Positive change: Health state improved from ${data.from_health_state} to ${data.to_health_state}. `;

      if (from_severity && to_severity && from_severity !== to_severity) {
        comment_text += `CKD severity improved from ${from_severity} to ${to_severity}. `;
      }

      // Add values to comment text
      if (egfr_change > 0 && uacr_change < 0) {
        comment_text += `eGFR improved from ${data.egfr_from?.toFixed(1)} to ${data.egfr_to.toFixed(1)} mL/min/1.73m² (+${egfr_change.toFixed(1)}) and uACR decreased from ${data.uacr_from?.toFixed(1)} to ${data.uacr_to.toFixed(1)} mg/g (${Math.abs(uacr_change).toFixed(1)} reduction). `;
      } else if (egfr_change > 0) {
        comment_text += `eGFR improved from ${data.egfr_from?.toFixed(1)} to ${data.egfr_to.toFixed(1)} mL/min/1.73m² (+${egfr_change.toFixed(1)}). `;
      } else if (uacr_change < 0) {
        comment_text += `uACR decreased from ${data.uacr_from?.toFixed(1)} to ${data.uacr_to.toFixed(1)} mg/g (${Math.abs(uacr_change).toFixed(1)} reduction). `;
      }

      clinical_summary = `Patient showing improvement in kidney function markers. `;

      if (egfr_change > 0) {
        clinical_summary += `eGFR increased by ${egfr_change.toFixed(1)} mL/min/1.73m² (from ${data.egfr_from?.toFixed(1)} to ${data.egfr_to.toFixed(1)}). `;
      }

      if (uacr_change < 0) {
        clinical_summary += `uACR decreased by ${Math.abs(uacr_change).toFixed(1)} mg/g (from ${data.uacr_from?.toFixed(1)} to ${data.uacr_to.toFixed(1)}), indicating reduced proteinuria. `;
      }

      clinical_summary += `Current risk level: ${data.to_risk_level}. ${toClassification.ckd_stage_name}.`;

      acknowledgment_text = `Excellent progress! The improvement in CKD severity from ${from_severity} to ${to_severity} demonstrates effective disease management. ` +
        `Continue current treatment plan and lifestyle modifications to maintain this positive trend.`;
    } else {
      comment_text = `✓ Positive change: Health state improved from ${data.from_health_state} to ${data.to_health_state}. ` +
        `Risk level decreased from ${data.from_risk_level} to ${data.to_risk_level}. `;

      // Add values to comment text
      if (egfr_change > 0 && uacr_change < 0) {
        comment_text += `eGFR: ${data.egfr_from?.toFixed(1)} → ${data.egfr_to.toFixed(1)} mL/min/1.73m² (+${egfr_change.toFixed(1)}), uACR: ${data.uacr_from?.toFixed(1)} → ${data.uacr_to.toFixed(1)} mg/g (${Math.abs(uacr_change).toFixed(1)} reduction).`;
      } else if (egfr_change > 0) {
        comment_text += `eGFR: ${data.egfr_from?.toFixed(1)} → ${data.egfr_to.toFixed(1)} mL/min/1.73m² (+${egfr_change.toFixed(1)}).`;
      } else if (uacr_change < 0) {
        comment_text += `uACR: ${data.uacr_from?.toFixed(1)} → ${data.uacr_to.toFixed(1)} mg/g (${Math.abs(uacr_change).toFixed(1)} reduction).`;
      }

      clinical_summary = `Patient showing improvement in kidney function markers. `;

      if (egfr_change > 0) {
        clinical_summary += `eGFR increased by ${egfr_change.toFixed(1)} mL/min/1.73m² (${data.egfr_from?.toFixed(1)} → ${data.egfr_to.toFixed(1)}). `;
      }

      if (uacr_change < 0) {
        clinical_summary += `uACR decreased by ${Math.abs(uacr_change).toFixed(1)} mg/g (${data.uacr_from?.toFixed(1)} → ${data.uacr_to.toFixed(1)}). `;
      }

      clinical_summary += `Reduced risk level indicates effective risk factor management.`;

      acknowledgment_text = `Great improvement! The reduction in risk from ${data.from_risk_level} to ${data.to_risk_level} ` +
        `reflects successful management of kidney health risk factors. Continue current preventive measures.`;
    }

    const recommended_actions = this.getRecommendedActions(toClassification, 'improved');

    return {
      comment_text,
      clinical_summary,
      recommended_actions,
      acknowledgment_text
    };
  }

  /**
   * Get recommended clinical actions based on health state
   */
  private getRecommendedActions(
    classification: KDIGOClassification,
    change_type: 'improved' | 'worsened' | 'stable' | 'initial'
  ): string[] {
    const actions: string[] = [];

    // Nephrology referral
    if (classification.requires_nephrology_referral) {
      actions.push('Refer to nephrology for specialist evaluation');
    }

    // Dialysis planning
    if (classification.requires_dialysis_planning) {
      actions.push('Initiate dialysis planning and patient education');
      actions.push('Evaluate for kidney transplant candidacy');
    }

    // Medication recommendations
    if (classification.recommend_ras_inhibitor) {
      actions.push('Consider RAS inhibitor therapy (ACE inhibitor or ARB) to reduce proteinuria');
    }

    if (classification.recommend_sglt2i) {
      actions.push('Consider SGLT2 inhibitor therapy for kidney protection and cardiovascular benefits');
    }

    // BP management
    if (classification.albuminuria_category !== 'A1') {
      actions.push(`Target blood pressure: ${classification.target_bp}`);
    }

    // Monitoring
    actions.push(`Monitor kidney function: ${classification.monitoring_frequency}`);

    // Lifestyle modifications
    if (change_type === 'worsened' || change_type === 'initial') {
      actions.push('Counsel on lifestyle modifications: diet, exercise, smoking cessation');
      actions.push('Optimize management of diabetes, hypertension, and other cardiovascular risk factors');
    }

    // For improvement, encourage continuation
    if (change_type === 'improved') {
      actions.push('Continue current treatment plan and lifestyle modifications');
      actions.push('Maintain adherence to medications and follow-up schedule');
    }

    return actions;
  }

  /**
   * Get specific mitigation measures for worsening health state
   */
  private getMitigationMeasures(
    data: HealthStateChangeData,
    classification: KDIGOClassification
  ): string[] {
    const measures: string[] = [];

    // Critical measures for advanced CKD
    if (classification.gfr_category === 'G5') {
      measures.push('URGENT: Immediate nephrology consultation required for end-stage kidney disease management');
      measures.push('Prepare for renal replacement therapy (dialysis or transplant)');
      measures.push('Avoid nephrotoxic medications (NSAIDs, certain antibiotics, contrast agents)');
    } else if (classification.gfr_category === 'G4') {
      measures.push('Expedited nephrology referral for Stage 4 CKD management');
      measures.push('Discuss kidney replacement options with patient and family');
      measures.push('Strict medication review to avoid nephrotoxins');
    }

    // eGFR decline
    const egfr_change = data.egfr_from ? data.egfr_to - data.egfr_from : 0;
    if (egfr_change < -10) {
      measures.push(`Significant eGFR decline (${Math.abs(egfr_change).toFixed(1)} mL/min/1.73m²): Investigate potential acute kidney injury causes`);
      measures.push('Review recent medications, imaging with contrast, or acute illness episodes');
    } else if (egfr_change < -5) {
      measures.push('Moderate eGFR decline: Intensify BP control and optimize CKD medications');
    }

    // Proteinuria increase
    const uacr_change = data.uacr_from ? data.uacr_to - data.uacr_from : 0;
    if (uacr_change > 200) {
      measures.push('Significant proteinuria increase: Maximize RAS inhibitor therapy if tolerated');
      measures.push('Ensure strict blood pressure control (<130/80 mmHg)');
    } else if (uacr_change > 50) {
      measures.push('Rising proteinuria: Optimize ACE inhibitor or ARB dosing');
    }

    // Risk-specific measures
    if (classification.risk_level === 'very_high') {
      measures.push('Very high risk: Intensify monitoring frequency to monthly');
      measures.push('Implement comprehensive CKD management protocol');
    } else if (classification.risk_level === 'high') {
      measures.push('High risk: Increase monitoring frequency to quarterly');
    }

    // Albuminuria-specific
    if (classification.albuminuria_category === 'A3') {
      measures.push('Severe proteinuria (>300 mg/g): Target BP <130/80 mmHg with RAS blockade');
      measures.push('Consider adding SGLT2 inhibitor and mineralocorticoid receptor antagonist if not contraindicated');
    }

    // General measures if no specific critical findings
    if (measures.length === 0) {
      measures.push('Review and optimize management of cardiovascular risk factors');
      measures.push('Ensure medication adherence and lifestyle modification compliance');
      measures.push('Consider increasing monitoring frequency temporarily');
    }

    return measures;
  }

  /**
   * Get comments for a specific patient
   */
  async getCommentsForPatient(patientId: string, limit: number = 50): Promise<any[]> {
    try {
      const query = `
        SELECT
          id,
          patient_id,
          state_transition_id,
          comment_text,
          comment_type,
          health_state_from,
          health_state_to,
          risk_level_from,
          risk_level_to,
          change_type,
          is_ckd_patient,
          severity_from,
          severity_to,
          cycle_number,
          egfr_from,
          egfr_to,
          egfr_change,
          uacr_from,
          uacr_to,
          uacr_change,
          clinical_summary,
          recommended_actions,
          mitigation_measures,
          acknowledgment_text,
          severity,
          created_by,
          created_by_type,
          created_at,
          visibility,
          is_pinned,
          is_read,
          read_at
        FROM patient_health_state_comments
        WHERE patient_id = $1 AND visibility = 'visible'
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await this.db.query(query, [patientId, limit]);

      // Ensure array fields are properly formatted as JavaScript arrays
      // PostgreSQL arrays should be automatically parsed, but we'll ensure they're always arrays
      const comments = result.rows.map(comment => ({
        ...comment,
        recommended_actions: Array.isArray(comment.recommended_actions)
          ? comment.recommended_actions
          : (comment.recommended_actions ? [comment.recommended_actions] : []),
        mitigation_measures: Array.isArray(comment.mitigation_measures)
          ? comment.mitigation_measures
          : (comment.mitigation_measures ? [comment.mitigation_measures] : [])
      }));

      return comments;
    } catch (error) {
      console.error('Error fetching comments for patient:', error);
      return [];
    }
  }

  /**
   * Get patients with recent health state changes (for filtering)
   */
  async getPatientsWithRecentHealthStateChanges(daysBack: number = 30): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT patient_id
        FROM patient_health_state_comments
        WHERE created_at >= NOW() - INTERVAL '${daysBack} days'
          AND visibility = 'visible'
          AND (
            change_type IN ('improved', 'worsened', 'stable')
            OR comment_type = 'ai_generated'
          )
        ORDER BY patient_id
      `;

      const result = await this.db.query(query);
      return result.rows.map(row => row.patient_id);
    } catch (error) {
      console.error('Error fetching patients with recent health state changes:', error);
      return [];
    }
  }

  /**
   * Mark comment as read
   */
  async markCommentAsRead(commentId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE patient_health_state_comments
         SET is_read = true, read_at = NOW()
         WHERE id = $1`,
        [commentId]
      );
    } catch (error) {
      console.error('Error marking comment as read:', error);
    }
  }

  /**
   * Archive a comment
   */
  async archiveComment(commentId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE patient_health_state_comments
         SET visibility = 'archived'
         WHERE id = $1`,
        [commentId]
      );
    } catch (error) {
      console.error('Error archiving comment:', error);
    }
  }
}
