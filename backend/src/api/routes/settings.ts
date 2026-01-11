import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { EmailService } from '../../services/emailService';

export function createSettingsRouter(pool: Pool): express.Router {
  const router = express.Router();
  const emailService = new EmailService(pool);

  /**
   * GET /api/settings/email
   * Get current email configuration
   */
  router.get('/email', async (_req: Request, res: Response): Promise<any> => {
    try {
      const config = await emailService.getConfig();

      if (!config) {
        return res.json({
          status: 'success',
          data: {
            doctor_email: '',
            enabled: false,
            configured: false,
            smtp_configured: false
          }
        });
      }

      // Don't send sensitive credentials to frontend
      res.json({
        status: 'success',
        data: {
          doctor_email: config.doctor_email,
          enabled: config.enabled,
          configured: true,
          smtp_configured: !!config.smtp_host,
          from_email: config.from_email,
          from_name: config.from_name,
          notify_ckd_transitions: config.notify_ckd_transitions,
          notify_lab_updates: config.notify_lab_updates,
          notify_significant_changes: config.notify_significant_changes,
          notify_clinical_alerts: config.notify_clinical_alerts
        }
      });
    } catch (error) {
      console.error('Error fetching email config:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch email configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/settings/email
   * Update email configuration
   */
  router.post('/email', async (req: Request, res: Response): Promise<any> => {
    try {
      const {
        doctor_email,
        enabled,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_password,
        from_email,
        from_name,
        notify_ckd_transitions,
        notify_lab_updates,
        notify_significant_changes,
        notify_clinical_alerts
      } = req.body;

      // Validate doctor email
      if (!doctor_email || typeof doctor_email !== 'string') {
        return res.status(400).json({
          status: 'error',
          message: 'Doctor email is required'
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(doctor_email)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid email address format'
        });
      }

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          status: 'error',
          message: 'Enabled must be a boolean value'
        });
      }

      // Prepare SMTP settings and notification preferences
      const smtpSettings = {
        smtp_host: smtp_host || undefined,
        smtp_port: smtp_port ? parseInt(smtp_port) : undefined,
        smtp_user: smtp_user || undefined,
        smtp_password: smtp_password || undefined,
        from_email: from_email || undefined,
        from_name: from_name || 'CKD Analyzer System',
        notify_ckd_transitions: notify_ckd_transitions !== undefined ? notify_ckd_transitions : true,
        notify_lab_updates: notify_lab_updates !== undefined ? notify_lab_updates : false,
        notify_significant_changes: notify_significant_changes !== undefined ? notify_significant_changes : true,
        notify_clinical_alerts: notify_clinical_alerts !== undefined ? notify_clinical_alerts : true
      };

      await emailService.updateConfig(doctor_email, enabled, smtpSettings);

      res.json({
        status: 'success',
        message: 'Email configuration updated successfully',
        data: {
          doctor_email,
          enabled
        }
      });
    } catch (error) {
      console.error('Error updating email config:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update email configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/settings/email/test
   * Send a test email
   */
  router.post('/email/test', async (_req: Request, res: Response): Promise<any> => {
    console.log('📧 [API] Test email endpoint called');
    try {
      console.log('📧 [API] Calling emailService.testConnection()...');
      const result = await emailService.testConnection();
      console.log('📧 [API] Test connection result:', { success: result.success, hasPreviewUrl: !!result.previewUrl });

      if (result.success) {
        console.log('📧 [API] Sending success response');
        res.json({
          status: 'success',
          message: result.message,
          previewUrl: result.previewUrl
        });
      } else {
        console.log('📧 [API] Sending error response:', result.message);
        res.status(400).json({
          status: 'error',
          message: result.message
        });
      }
    } catch (error) {
      console.error('❌ [API] Error testing email connection:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to test email connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/settings/email/messages
   * Get email message history
   */
  router.get('/email/messages', async (req: Request, res: Response): Promise<any> => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await pool.query(
        `SELECT id, to_email, subject, message, status, email_message_id, error_message, sent_at
         FROM email_messages
         ORDER BY sent_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM email_messages'
      );

      res.json({
        status: 'success',
        data: {
          messages: result.rows,
          total: parseInt(countResult.rows[0].total),
          limit,
          offset
        }
      });
    } catch (error) {
      console.error('Error fetching email messages:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch email messages',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
