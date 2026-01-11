import { Pool } from 'pg';
import { EmailService } from './emailService';
import { getAllDoctorsForPatient, isInQuietHours } from '../utils/doctorLookup';

interface PatientData {
  id: string;
  medical_record_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  home_monitoring_active?: boolean;
}

interface ClinicalChange {
  previous_egfr?: number;
  current_egfr?: number;
  previous_uacr?: number;
  current_uacr?: number;
  previous_health_state?: string;
  current_health_state?: string;
  egfr_change_percent?: number;
  uacr_change_percent?: number;
  cycle_number: number;
}

interface AdherenceData {
  compositeScore: number;
  adherenceCategory: 'GOOD' | 'SUBOPTIMAL' | 'POOR';
  compositePercentage: number;
}

export class ClinicalAlertsService {
  private emailService: EmailService;
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
    this.emailService = new EmailService(db);
  }

  /**
   * Notify all assigned doctors for a patient based on alert priority
   * Respects notification preferences and quiet hours
   */
  private async notifyAllDoctors(
    patient: PatientData,
    subject: string,
    message: string,
    priority: 'CRITICAL' | 'HIGH' | 'MODERATE'
  ): Promise<void> {
    const patientName = `${patient.first_name} ${patient.last_name}`;
    const doctors = await getAllDoctorsForPatient(this.db, patient.id, priority);

    for (const doctor of doctors) {
      // Skip if in quiet hours for non-critical alerts
      if (priority !== 'CRITICAL' && isInQuietHours(doctor.notification_preferences)) {
        console.log(`⏰ Skipping notification to ${doctor.doctor_email} due to quiet hours`);
        continue;
      }

      const doctorRole = doctor.is_primary ? 'Primary' : 'Consulting';
      console.log(`📧 Sending ${priority} alert to ${doctorRole} doctor: ${doctor.doctor_email}`);

      await this.emailService.sendNotification({
        to: doctor.doctor_email,
        subject,
        message,
        priority,
        patientName,
        mrn: patient.medical_record_number,
      });
    }
  }

  /**
   * Check and send clinical alerts after patient update
   */
  async checkAndSendAlerts(
    patient: PatientData,
    clinicalChange: ClinicalChange,
    adherenceData?: AdherenceData
  ): Promise<void> {
    console.log(`[Clinical Alerts] Checking alerts for patient ${patient.medical_record_number}...`);

    // Check each alert condition
    await this.checkWorseningTrends(patient, clinicalChange);
    await this.checkHealthStateDeterioration(patient, clinicalChange);

    if (adherenceData) {
      await this.checkPoorAdherence(patient, adherenceData, clinicalChange.cycle_number);
    }

    if (patient.home_monitoring_active) {
      await this.checkMinutefulWorseningUACR(patient, clinicalChange);
    }
  }

  /**
   * Alert 1: Patient worsening from one cycle to another
   */
  private async checkWorseningTrends(
    patient: PatientData,
    change: ClinicalChange
  ): Promise<void> {
    const { previous_egfr, current_egfr, previous_uacr, current_uacr } = change;

    // Calculate changes
    let egfrDecline = 0;
    let uacrIncrease = 0;
    let isWorsening = false;

    if (previous_egfr && current_egfr) {
      egfrDecline = ((previous_egfr - current_egfr) / previous_egfr) * 100;
      if (egfrDecline > 10) isWorsening = true; // >10% eGFR decline
    }

    if (previous_uacr && current_uacr && previous_uacr > 0) {
      uacrIncrease = ((current_uacr - previous_uacr) / previous_uacr) * 100;
      if (uacrIncrease > 25) isWorsening = true; // >25% uACR increase
    }

    if (!isWorsening) return;

    const patientName = `${patient.first_name} ${patient.last_name}`;

    let message = `🔻 **Patient Condition Worsening - Cycle ${change.cycle_number}**\n\n`;
    message += `**Clinical Changes:**\n`;

    if (egfrDecline > 10) {
      message += `• eGFR declined from ${previous_egfr?.toFixed(1)} to ${current_egfr?.toFixed(1)} mL/min/1.73m² (${egfrDecline.toFixed(1)}% decrease)\n`;
      message += `  ⚠️ This represents significant kidney function decline\n\n`;
    }

    if (uacrIncrease > 25) {
      message += `• uACR increased from ${previous_uacr?.toFixed(1)} to ${current_uacr?.toFixed(1)} mg/g (${uacrIncrease.toFixed(1)}% increase)\n`;
      message += `  ⚠️ This indicates worsening proteinuria\n\n`;
    }

    message += `**Recommended Actions:**\n`;
    message += `• Review current treatment regimen\n`;
    message += `• Consider therapy intensification\n`;
    message += `• Schedule urgent follow-up appointment\n`;
    message += `• Check medication adherence\n`;
    message += `• Review for potential contributing factors (infections, NSAIDs, volume depletion)`;

    // Notify all assigned doctors
    await this.notifyAllDoctors(
      patient,
      `🔻 ALERT: ${patientName} - Kidney Function Worsening`,
      message,
      'HIGH'
    );

    console.log(`✓ Worsening trends alert sent for ${patient.medical_record_number}`);
  }

  /**
   * Alert 2: Health state changes to worse state
   */
  private async checkHealthStateDeterioration(
    patient: PatientData,
    change: ClinicalChange
  ): Promise<void> {
    const { previous_health_state, current_health_state } = change;

    if (!previous_health_state || !current_health_state) return;
    if (previous_health_state === current_health_state) return;

    // Check if state is worse (simple check - could be enhanced)
    const severity = this.getHealthStateSeverity(current_health_state);
    const previousSeverity = this.getHealthStateSeverity(previous_health_state);

    if (severity <= previousSeverity) return; // Not worse

    const patientName = `${patient.first_name} ${patient.last_name}`;

    let message = `⚠️ **Health State Deterioration - Cycle ${change.cycle_number}**\n\n`;
    message += `**State Change:**\n`;
    message += `• Previous: ${previous_health_state}\n`;
    message += `• Current: ${current_health_state}\n\n`;

    message += `**Clinical Significance:**\n`;
    message += this.getStateChangeInterpretation(previous_health_state, current_health_state);
    message += `\n\n**Recommended Actions:**\n`;

    if (current_health_state.startsWith('G4') || current_health_state.startsWith('G5')) {
      message += `• **URGENT**: Nephrology referral if not already done\n`;
      message += `• Assess for kidney replacement therapy readiness\n`;
      message += `• Review for CKD complications (anemia, bone disease, acidosis)\n`;
    } else if (current_health_state.startsWith('G3b')) {
      message += `• Intensify nephrology co-management\n`;
      message += `• Optimize CKD treatment (RAS inhibitor + SGLT2i)\n`;
    } else {
      message += `• Review and optimize current treatment plan\n`;
    }

    message += `• Increase monitoring frequency\n`;
    message += `• Patient education on disease progression`;

    // Notify all assigned doctors (CRITICAL - everyone gets notified)
    await this.notifyAllDoctors(
      patient,
      `⚠️ CRITICAL: ${patientName} - Health State Deteriorated to ${current_health_state}`,
      message,
      'CRITICAL'
    );

    console.log(`✓ Health state deterioration alert sent for ${patient.medical_record_number}`);
  }

  /**
   * Alert 3: Poor medication adherence
   */
  private async checkPoorAdherence(
    patient: PatientData,
    adherence: AdherenceData,
    cycle: number
  ): Promise<void> {
    // Alert if adherence is POOR (<75%)
    if (adherence.adherenceCategory !== 'POOR') return;

    const patientName = `${patient.first_name} ${patient.last_name}`;

    let message = `💊 **Poor Medication Adherence Detected - Cycle ${cycle}**\n\n`;
    message += `**Adherence Assessment:**\n`;
    message += `• Overall Adherence Score: ${adherence.compositePercentage}%\n`;
    message += `• Category: ${adherence.adherenceCategory}\n`;
    message += `• This indicates patient is taking <75% of prescribed medications\n\n`;

    message += `**Clinical Impact:**\n`;
    message += `• Poor adherence is associated with faster CKD progression\n`;
    message += `• Increased risk of cardiovascular events\n`;
    message += `• Suboptimal blood pressure and proteinuria control\n\n`;

    message += `**Recommended Interventions:**\n`;
    message += `• Schedule urgent patient consultation to discuss adherence barriers\n`;
    message += `• Common barriers: cost, side effects, complexity, forgetfulness\n`;
    message += `• Consider:\n`;
    message += `  - Medication synchronization\n`;
    message += `  - Pill organizers or reminder apps\n`;
    message += `  - Patient assistance programs for cost issues\n`;
    message += `  - Simplification of regimen if possible\n`;
    message += `  - Home nursing support if appropriate\n`;
    message += `• Reassess after intervention to ensure improvement`;

    // Notify all assigned doctors
    await this.notifyAllDoctors(
      patient,
      `💊 ALERT: ${patientName} - Poor Medication Adherence (${adherence.compositePercentage}%)`,
      message,
      'HIGH'
    );

    console.log(`✓ Poor adherence alert sent for ${patient.medical_record_number}`);
  }

  /**
   * Alert 4: Worsening uACR from Minuteful Kidney home monitoring + AI scheduling
   */
  private async checkMinutefulWorseningUACR(
    patient: PatientData,
    change: ClinicalChange
  ): Promise<void> {
    const { previous_uacr, current_uacr } = change;

    if (!previous_uacr || !current_uacr || previous_uacr === 0) return;

    const uacrIncrease = ((current_uacr - previous_uacr) / previous_uacr) * 100;

    // Alert if uACR increased by >30% (concerning for home monitoring)
    if (uacrIncrease <= 30) return;

    const patientName = `${patient.first_name} ${patient.last_name}`;

    // Generate AI-powered scheduling recommendation
    const aiScheduling = await this.generateBloodAnalysisSchedule(patient, change);

    let message = `🏠 **Minuteful Kidney Alert - Worsening uACR**\n\n`;
    message += `**Home Monitoring Results:**\n`;
    message += `• Previous uACR: ${previous_uacr.toFixed(1)} mg/g\n`;
    message += `• Current uACR: ${current_uacr.toFixed(1)} mg/g\n`;
    message += `• Change: +${uacrIncrease.toFixed(1)}% increase\n`;
    message += `• Device: Minuteful Kidney home monitoring kit\n\n`;

    message += `**Clinical Significance:**\n`;
    message += `• Significant worsening of proteinuria detected at home\n`;
    message += `• This may indicate:\n`;
    message += `  - Disease progression\n`;
    message += `  - Medication non-adherence\n`;
    message += `  - Acute kidney injury\n`;
    message += `  - Volume status changes\n\n`;

    message += `🤖 **AI-Powered Blood Analysis Scheduling Recommendation:**\n\n`;
    message += aiScheduling;
    message += `\n\n**Required Lab Tests:**\n`;
    message += `• Comprehensive Metabolic Panel (CMP)\n`;
    message += `• Complete Blood Count (CBC)\n`;
    message += `• eGFR with creatinine\n`;
    message += `• Quantitative urine protein or PCR\n`;
    message += `• Hemoglobin A1c (if diabetic)\n`;
    message += `• Lipid panel`;

    // Notify all assigned doctors (CRITICAL - everyone gets notified)
    await this.notifyAllDoctors(
      patient,
      `🏠 URGENT: ${patientName} - Minuteful Kidney Shows Worsening uACR`,
      message,
      'CRITICAL'
    );

    console.log(`✓ Minuteful worsening uACR alert sent for ${patient.medical_record_number}`);
  }

  /**
   * AI-powered blood analysis scheduling
   */
  private async generateBloodAnalysisSchedule(
    _patient: PatientData,
    change: ClinicalChange
  ): Promise<string> {
    const urgency = this.calculateUrgency(change);

    let schedule = '';

    if (urgency === 'URGENT') {
      schedule += `**⚡ URGENT - Schedule within 24-48 hours**\n\n`;
      schedule += `**Rationale:**\n`;
      schedule += `Based on the severity of uACR increase (>${change.uacr_change_percent?.toFixed(0)}%), `;
      schedule += `immediate blood work is recommended to:\n`;
      schedule += `1. Rule out acute kidney injury (compare serum creatinine)\n`;
      schedule += `2. Assess for metabolic complications\n`;
      schedule += `3. Verify home monitoring accuracy\n`;
      schedule += `4. Guide urgent treatment adjustments\n\n`;
      schedule += `**Suggested Timing:** Schedule patient for blood draw tomorrow or next available urgent slot\n`;
    } else if (urgency === 'PROMPT') {
      schedule += `**📋 PROMPT - Schedule within 3-5 days**\n\n`;
      schedule += `**Rationale:**\n`;
      schedule += `The uACR increase warrants prompt evaluation but is not immediately life-threatening.\n`;
      schedule += `Blood work within the next few days will allow for:\n`;
      schedule += `1. Assessment of kidney function trends\n`;
      schedule += `2. Review of electrolytes and metabolic status\n`;
      schedule += `3. Adjustment of medications if needed\n\n`;
      schedule += `**Suggested Timing:** Schedule within this week\n`;
    } else {
      schedule += `**ℹ️  ROUTINE - Schedule within 1-2 weeks**\n\n`;
      schedule += `**Rationale:**\n`;
      schedule += `Follow-up blood work at next routine appointment is appropriate.\n`;
      schedule += `Home monitoring provides valuable trend data but should be confirmed with lab testing.\n\n`;
      schedule += `**Suggested Timing:** Next scheduled visit or within 2 weeks\n`;
    }

    return schedule;
  }

  /**
   * Calculate urgency level based on clinical changes
   */
  private calculateUrgency(change: ClinicalChange): 'URGENT' | 'PROMPT' | 'ROUTINE' {
    const { egfr_change_percent, uacr_change_percent, current_egfr } = change;

    // URGENT if: severe eGFR decline OR massive uACR increase OR very low eGFR
    if (
      (egfr_change_percent && egfr_change_percent > 25) ||
      (uacr_change_percent && uacr_change_percent > 100) ||
      (current_egfr && current_egfr < 20)
    ) {
      return 'URGENT';
    }

    // PROMPT if: moderate changes
    if (
      (egfr_change_percent && egfr_change_percent > 15) ||
      (uacr_change_percent && uacr_change_percent > 50)
    ) {
      return 'PROMPT';
    }

    return 'ROUTINE';
  }

  /**
   * Get numerical severity of health state (higher = worse)
   */
  private getHealthStateSeverity(state: string): number {
    if (state.startsWith('G5')) return 5;
    if (state.startsWith('G4')) return 4;
    if (state.startsWith('G3b')) return 3.5;
    if (state.startsWith('G3a')) return 3;
    if (state.startsWith('G2')) return 2;
    if (state.startsWith('G1')) return 1;
    return 0;
  }

  /**
   * Get interpretation of state change
   */
  private getStateChangeInterpretation(_previous: string, current: string): string {
    if (current.startsWith('G5')) {
      return '• Patient has progressed to Stage 5 CKD (Kidney Failure)\n' +
             '• Kidney replacement therapy (dialysis or transplant) should be discussed\n' +
             '• Urgent nephrology involvement required';
    }
    if (current.startsWith('G4')) {
      return '• Patient has progressed to Stage 4 CKD (Severe decrease)\n' +
             '• High risk for progression to kidney failure\n' +
             '• Nephrology co-management essential';
    }
    if (current.startsWith('G3b')) {
      return '• Progression to Stage 3b CKD (Moderate-Severe decrease)\n' +
             '• Increased risk of complications\n' +
             '• Consider nephrology referral';
    }
    return '• CKD stage progression detected\n' +
           '• Requires treatment optimization';
  }
}
