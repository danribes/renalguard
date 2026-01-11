/**
 * Alert Reminder Service
 * Checks for unacknowledged CRITICAL alerts and sends reminder notifications
 */

import { Pool } from 'pg';
import { EmailService } from './emailService';

export class AlertReminderService {
  private db: Pool;
  private emailService: EmailService;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(db: Pool) {
    this.db = db;
    this.emailService = new EmailService(db);
  }

  /**
   * Start the reminder service (runs every 30 minutes)
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Alert Reminder] Service already running');
      return;
    }

    console.log('[Alert Reminder] Starting service (runs every 30 minutes)...');
    this.isRunning = true;

    // Run immediately on start
    this.checkUnacknowledgedAlerts().catch(err => {
      console.error('[Alert Reminder] Error on initial run:', err);
    });

    // Then run every 30 minutes
    this.intervalId = setInterval(() => {
      this.checkUnacknowledgedAlerts().catch(err => {
        console.error('[Alert Reminder] Error in periodic check:', err);
      });
    }, 30 * 60 * 1000); // 30 minutes

    console.log('[Alert Reminder] Service started successfully');
  }

  /**
   * Stop the reminder service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Alert Reminder] Service stopped');
  }

  /**
   * Check for unacknowledged CRITICAL alerts older than 4 hours
   */
  async checkUnacknowledgedAlerts(): Promise<void> {
    try {
      console.log('[Alert Reminder] Checking for unacknowledged CRITICAL alerts...');

      const result = await this.db.query(`
        SELECT
          dn.id,
          dn.patient_id,
          dn.notification_type,
          dn.priority,
          dn.subject,
          dn.message,
          dn.doctor_email,
          dn.doctor_name,
          dn.created_at,
          dn.retry_count,
          p.first_name,
          p.last_name,
          p.medical_record_number
        FROM doctor_notifications dn
        INNER JOIN patients p ON dn.patient_id = p.id
        WHERE dn.priority = 'CRITICAL'
          AND dn.acknowledged_at IS NULL
          AND dn.created_at < NOW() - INTERVAL '4 hours'
          AND (dn.retry_count IS NULL OR dn.retry_count < 3)
          AND dn.status != 'failed'
        ORDER BY dn.created_at ASC
      `);

      if (result.rows.length === 0) {
        console.log('[Alert Reminder] No unacknowledged CRITICAL alerts found');
        return;
      }

      console.log(`[Alert Reminder] Found ${result.rows.length} unacknowledged CRITICAL alerts`);

      for (const alert of result.rows) {
        await this.sendReminderNotification(alert);
      }

      console.log(`[Alert Reminder] Processed ${result.rows.length} reminder notifications`);
    } catch (error) {
      console.error('[Alert Reminder] Error checking unacknowledged alerts:', error);
      throw error;
    }
  }

  /**
   * Send reminder notification for an unacknowledged alert
   */
  private async sendReminderNotification(alert: any): Promise<void> {
    try {
      const patientName = `${alert.first_name} ${alert.last_name}`;
      const retryCount = (alert.retry_count || 0) + 1;
      const hoursUnacknowledged = Math.floor(
        (Date.now() - new Date(alert.created_at).getTime()) / (1000 * 60 * 60)
      );

      // Build escalation message
      let escalationMessage = `⚠️ **REMINDER #${retryCount} - UNACKNOWLEDGED CRITICAL ALERT**\n\n`;
      escalationMessage += `This alert was sent ${hoursUnacknowledged} hours ago and has not been acknowledged.\n\n`;
      escalationMessage += `**Original Alert:**\n`;
      escalationMessage += `• Patient: ${patientName} (MRN: ${alert.medical_record_number})\n`;
      escalationMessage += `• Priority: ${alert.priority}\n`;
      escalationMessage += `• Created: ${new Date(alert.created_at).toLocaleString()}\n\n`;
      escalationMessage += `---\n\n`;
      escalationMessage += alert.message;
      escalationMessage += `\n\n---\n\n`;
      escalationMessage += `**Action Required:**\n`;
      escalationMessage += `• Please acknowledge this alert in the system\n`;
      escalationMessage += `• Review patient status and take appropriate clinical action\n`;
      escalationMessage += `• If already addressed, mark as acknowledged to prevent further reminders\n`;

      if (retryCount >= 3) {
        escalationMessage += `\n\n⚠️ **FINAL REMINDER** - This is the ${retryCount}rd reminder. No further automated reminders will be sent.`;
      }

      // Send reminder email
      const emailSent = await this.emailService.sendNotification({
        to: alert.doctor_email,
        subject: `🔴 REMINDER #${retryCount}: ${alert.subject}`,
        message: escalationMessage,
        priority: 'CRITICAL',
        patientName,
        mrn: alert.medical_record_number,
      });

      if (emailSent) {
        // Update retry count
        await this.db.query(`
          UPDATE doctor_notifications
          SET
            retry_count = $1,
            updated_at = NOW()
          WHERE id = $2
        `, [retryCount, alert.id]);

        console.log(`[Alert Reminder] Sent reminder #${retryCount} to ${alert.doctor_email} for patient ${alert.medical_record_number}`);
      } else {
        console.error(`[Alert Reminder] Failed to send reminder for alert ${alert.id}`);

        // Mark as failed if retry count is 3
        if (retryCount >= 3) {
          await this.db.query(`
            UPDATE doctor_notifications
            SET status = 'failed', retry_count = $1, updated_at = NOW()
            WHERE id = $2
          `, [retryCount, alert.id]);
        }
      }
    } catch (error) {
      console.error(`[Alert Reminder] Error sending reminder for alert ${alert.id}:`, error);
    }
  }

  /**
   * Get statistics about unacknowledged alerts
   */
  async getUnacknowledgedStats(): Promise<any> {
    try {
      const result = await this.db.query(`
        SELECT
          COUNT(*) as total_unacknowledged,
          COUNT(CASE WHEN priority = 'CRITICAL' THEN 1 END) as critical_unacknowledged,
          COUNT(CASE WHEN created_at < NOW() - INTERVAL '4 hours' THEN 1 END) as overdue_4h,
          COUNT(CASE WHEN created_at < NOW() - INTERVAL '24 hours' THEN 1 END) as overdue_24h,
          AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) as avg_hours_unacknowledged
        FROM doctor_notifications
        WHERE acknowledged_at IS NULL
          AND status != 'failed'
      `);

      return result.rows[0];
    } catch (error) {
      console.error('[Alert Reminder] Error getting unacknowledged stats:', error);
      throw error;
    }
  }

  /**
   * Manually trigger reminder check (for testing/admin purposes)
   */
  async triggerManualCheck(): Promise<{ processed: number; errors: number }> {
    console.log('[Alert Reminder] Manual check triggered');
    let processed = 0;
    let errors = 0;

    try {
      const result = await this.db.query(`
        SELECT COUNT(*) as count
        FROM doctor_notifications
        WHERE priority = 'CRITICAL'
          AND acknowledged_at IS NULL
          AND created_at < NOW() - INTERVAL '4 hours'
          AND (retry_count IS NULL OR retry_count < 3)
          AND status != 'failed'
      `);

      processed = parseInt(result.rows[0].count);

      await this.checkUnacknowledgedAlerts();
    } catch (error) {
      errors = 1;
      console.error('[Alert Reminder] Error in manual check:', error);
    }

    return { processed, errors };
  }
}
