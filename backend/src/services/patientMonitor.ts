import { Pool, PoolClient } from 'pg';
import { DoctorAgentService } from './doctorAgent';
import { EmailService } from './emailService';
import { getPrimaryDoctor } from '../utils/doctorLookup';

interface PatientChangeEvent {
  patient_id: string;
  change_type: string;
  old_risk_level?: string;
  new_risk_level?: string;
  timestamp: Date;
}

export class PatientMonitorService {
  private db: Pool;
  private agentService: DoctorAgentService;
  private emailService: EmailService;
  private listenerClient: PoolClient | null = null;
  private isMonitoring = false;

  constructor(db: Pool, agentService: DoctorAgentService) {
    this.db = db;
    this.agentService = agentService;
    this.emailService = new EmailService(db);
  }

  /**
   * Start monitoring patient data changes via PostgreSQL LISTEN/NOTIFY
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('Patient monitoring is already active');
      return;
    }

    try {
      // Get a dedicated client for listening
      this.listenerClient = await this.db.connect();

      // Listen to the patient_data_updated channel (created by database triggers)
      await this.listenerClient.query('LISTEN patient_data_updated');

      // Set up notification handler
      this.listenerClient.on('notification', async (msg) => {
        if (msg.channel === 'patient_data_updated') {
          await this.handlePatientChange(msg.payload);
        }
      });

      // Handle connection errors
      this.listenerClient.on('error', (err) => {
        console.error('Error in patient monitor listener:', err);
        this.reconnect();
      });

      this.isMonitoring = true;
      console.log('✓ Patient monitoring service started - listening for changes');
    } catch (error) {
      console.error('Failed to start patient monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (this.listenerClient) {
      try {
        await this.listenerClient.query('UNLISTEN patient_data_updated');
        this.listenerClient.release();
        this.listenerClient = null;
        this.isMonitoring = false;
        console.log('✓ Patient monitoring service stopped');
      } catch (error) {
        console.error('Error stopping patient monitor:', error);
      }
    }
  }

  /**
   * Reconnect to database if connection is lost
   */
  private async reconnect(): Promise<void> {
    console.log('Attempting to reconnect patient monitor...');
    await this.stopMonitoring();

    setTimeout(async () => {
      try {
        await this.startMonitoring();
        console.log('✓ Patient monitor reconnected');
      } catch (error) {
        console.error('Failed to reconnect:', error);
        // Try again in 30 seconds
        setTimeout(() => this.reconnect(), 30000);
      }
    }, 5000);
  }

  /**
   * Handle patient change notification from database
   */
  private async handlePatientChange(payload: string | undefined): Promise<void> {
    if (!payload) {
      return;
    }

    try {
      const changeEvent: PatientChangeEvent = JSON.parse(payload);
      console.log(`[Patient Monitor] Change detected for patient ${changeEvent.patient_id}:`, changeEvent.change_type);

      // Check if this change requires an alert
      if (this.shouldCreateAlert(changeEvent)) {
        await this.createAlert(changeEvent);
      }

      // For significant risk level changes, run AI analysis
      if (changeEvent.change_type === 'risk_level_change' ||
          changeEvent.change_type === 'critical_lab_value') {
        await this.runAIAnalysis(changeEvent);
      }
    } catch (error) {
      console.error('Error handling patient change:', error);
    }
  }

  /**
   * Determine if a change event should trigger an alert
   */
  private shouldCreateAlert(event: PatientChangeEvent): boolean {
    const alertTriggers = [
      'risk_level_change',
      'critical_lab_value',
      'state_change',
      'treatment_required',
      'referral_needed',
    ];

    return alertTriggers.includes(event.change_type);
  }

  /**
   * Create an alert notification for doctors
   */
  private async createAlert(event: PatientChangeEvent): Promise<void> {
    try {
      // Get patient information
      const patientQuery = `
        SELECT first_name, last_name, medical_record_number
        FROM patients
        WHERE id = $1
      `;
      const patientResult = await this.db.query(patientQuery, [event.patient_id]);

      if (patientResult.rows.length === 0) {
        console.error('Patient not found for alert:', event.patient_id);
        return;
      }

      const patient = patientResult.rows[0];
      const patientName = `${patient.first_name} ${patient.last_name}`;
      const mrn = patient.medical_record_number;

      // Determine alert priority and type
      const { priority, notificationType } = this.determineAlertPriority(event);

      // Generate alert message
      let subject = '';
      let message = '';

      switch (event.change_type) {
        case 'risk_level_change':
          subject = `Risk Level Change: ${patientName} (MRN: ${mrn})`;
          message = `Patient risk level changed from ${event.old_risk_level || 'unknown'} to ${event.new_risk_level || 'unknown'}. Review recommended.`;
          break;

        case 'critical_lab_value':
          subject = `Critical Lab Value: ${patientName} (MRN: ${mrn})`;
          message = `Critical laboratory value detected. Immediate review required.`;
          break;

        case 'state_change':
          subject = `Patient Status Change: ${patientName} (MRN: ${mrn})`;
          message = `Significant change in patient health status detected.`;
          break;

        case 'treatment_required':
          subject = `Treatment Action Needed: ${patientName} (MRN: ${mrn})`;
          message = `Patient may require treatment modification or initiation.`;
          break;

        case 'referral_needed':
          subject = `Referral Recommended: ${patientName} (MRN: ${mrn})`;
          message = `Patient may require specialist referral based on current status.`;
          break;

        default:
          subject = `Patient Update: ${patientName} (MRN: ${mrn})`;
          message = `Patient data has been updated. Review recommended.`;
      }

      // Insert notification into database
      const insertQuery = `
        INSERT INTO doctor_notifications (
          patient_id,
          notification_type,
          priority,
          subject,
          message,
          doctor_email,
          doctor_name,
          status,
          alert_summary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;

      const alertSummary = {
        change_type: event.change_type,
        old_risk_level: event.old_risk_level,
        new_risk_level: event.new_risk_level,
        timestamp: event.timestamp,
      };

      // Fetch assigned doctor for this patient
      const doctor = await getPrimaryDoctor(this.db, event.patient_id);

      await this.db.query(insertQuery, [
        event.patient_id,
        notificationType,
        priority,
        subject,
        message,
        doctor.doctor_email,
        doctor.doctor_name || 'Primary Care Provider',
        'pending',
        JSON.stringify(alertSummary),
      ]);

      console.log(`✓ Alert created: ${subject} [${priority}] for Dr. ${doctor.doctor_name}`);

      // Send email notification for risk/severity changes
      if (event.change_type === 'risk_level_change' || event.change_type === 'critical_lab_value') {
        try {
          await this.emailService.sendNotification({
            to: doctor.doctor_email,
            subject,
            message,
            priority,
            patientName,
            mrn,
          });
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
          // Don't fail the alert creation if email fails
        }
      }
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  }

  /**
   * Run AI analysis for complex patient changes
   */
  private async runAIAnalysis(event: PatientChangeEvent): Promise<void> {
    try {
      console.log(`[AI Analysis] Analyzing patient ${event.patient_id}...`);

      const alertResult = await this.agentService.analyzePatientForAlerts(event.patient_id);

      if (alertResult.hasAlert) {
        console.log(`✓ AI detected ${alertResult.priority} priority issue: ${alertResult.alertType}`);

        // Get patient info for notification
        const patientQuery = `
          SELECT first_name, last_name, medical_record_number
          FROM patients
          WHERE id = $1
        `;
        const patientResult = await this.db.query(patientQuery, [event.patient_id]);

        if (patientResult.rows.length > 0) {
          const patient = patientResult.rows[0];
          const patientName = `${patient.first_name} ${patient.last_name}`;
          const mrn = patient.medical_record_number;

          // Create enhanced notification with AI insights
          const insertQuery = `
            INSERT INTO doctor_notifications (
              patient_id,
              notification_type,
              priority,
              subject,
              message,
              doctor_email,
              doctor_name,
              status,
              alert_summary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `;

          const alertSummary = {
            ai_generated: true,
            alert_type: alertResult.alertType,
            analysis_timestamp: new Date().toISOString(),
            original_change: event.change_type,
          };

          // Fetch assigned doctor for this patient
          const aiAlertDoctor = await getPrimaryDoctor(this.db, event.patient_id);

          await this.db.query(insertQuery, [
            event.patient_id,
            'critical_alert',
            alertResult.priority,
            `AI Alert: ${alertResult.alertType} - ${patientName} (MRN: ${mrn})`,
            alertResult.message || 'AI analysis detected a significant finding requiring review.',
            aiAlertDoctor.doctor_email,
            aiAlertDoctor.doctor_name || 'Primary Care Provider',
            'pending',
            JSON.stringify(alertSummary),
          ]);

          console.log(`✓ AI-generated alert created for patient ${event.patient_id}, sent to Dr. ${aiAlertDoctor.doctor_name}`);

          // Send email notification for AI-generated alerts
          try {
            await this.emailService.sendNotification({
              to: aiAlertDoctor.doctor_email,
              subject: `AI Alert: ${alertResult.alertType} - ${patientName} (MRN: ${mrn})`,
              message: alertResult.message || 'AI analysis detected a significant finding requiring review.',
              priority: alertResult.priority || 'HIGH',
              patientName,
              mrn,
            });
          } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Don't fail the alert creation if email fails
          }
        }
      } else {
        console.log(`✓ AI analysis complete - no critical findings for patient ${event.patient_id}`);
      }
    } catch (error) {
      console.error('Error in AI analysis:', error);
    }
  }

  /**
   * Determine alert priority based on change type and severity
   */
  private determineAlertPriority(event: PatientChangeEvent): {
    priority: string;
    notificationType: string;
  } {
    let priority = 'MODERATE';
    let notificationType = 'state_change';

    switch (event.change_type) {
      case 'critical_lab_value':
        priority = 'CRITICAL';
        notificationType = 'critical_alert';
        break;

      case 'risk_level_change':
        if (event.new_risk_level === 'CRITICAL' || event.new_risk_level === 'HIGH') {
          priority = 'HIGH';
          notificationType = 'state_change';
        } else {
          priority = 'MODERATE';
          notificationType = 'state_change';
        }
        break;

      case 'treatment_required':
        priority = 'HIGH';
        notificationType = 'monitoring_required';
        break;

      case 'referral_needed':
        priority = 'HIGH';
        notificationType = 'monitoring_required';
        break;

      default:
        priority = 'MODERATE';
        notificationType = 'state_change';
    }

    return { priority, notificationType };
  }

  /**
   * Get pending notifications for a doctor
   */
  async getNotifications(doctorEmail: string, limit: number = 50): Promise<any[]> {
    try {
      const query = `
        SELECT
          n.id,
          n.patient_id,
          n.notification_type,
          n.priority,
          n.subject,
          n.message,
          n.status,
          n.alert_summary,
          n.created_at,
          n.sent_at,
          n.read_at,
          p.first_name,
          p.last_name,
          p.medical_record_number
        FROM doctor_notifications n
        JOIN patients p ON n.patient_id = p.id
        WHERE n.doctor_email = $1
        ORDER BY
          CASE n.priority
            WHEN 'CRITICAL' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MODERATE' THEN 3
            ELSE 4
          END,
          n.created_at DESC
        LIMIT $2
      `;

      const result = await this.db.query(query, [doctorEmail, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE doctor_notifications
         SET status = 'read', read_at = NOW()
         WHERE id = $1`,
        [notificationId]
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Mark notification as acknowledged
   */
  async acknowledgeNotification(notificationId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE doctor_notifications
         SET status = 'acknowledged', acknowledged_at = NOW()
         WHERE id = $1`,
        [notificationId]
      );
    } catch (error) {
      console.error('Error acknowledging notification:', error);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): { isMonitoring: boolean } {
    return { isMonitoring: this.isMonitoring };
  }
}
