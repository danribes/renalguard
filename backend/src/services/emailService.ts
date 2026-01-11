import { Pool } from 'pg';
import nodemailer, { Transporter } from 'nodemailer';

interface EmailConfig {
  id: number;
  doctor_email: string;
  enabled: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  from_email?: string;
  from_name?: string;
  notify_ckd_transitions?: boolean;
  notify_lab_updates?: boolean;
  notify_significant_changes?: boolean;
  notify_clinical_alerts?: boolean;
  created_at: Date;
  updated_at: Date;
}

interface EmailMessage {
  to: string;
  subject: string;
  message: string;
  priority: string;
  patientName: string;
  mrn: string;
  templateName?: string; // Optional template name to use
  templateVariables?: { [key: string]: string }; // Additional template variables
}

export class EmailService {
  private db: Pool;
  private transporter: Transporter | null = null;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Initialize email transporter with SMTP settings
   */
  private async initializeTransporter(): Promise<void> {
    try {
      const config = await this.getConfig();

      if (!config || !config.smtp_host) {
        // Use default test account for development/testing
        console.log('📧 No SMTP configured, creating Ethereal test account...');
        const testAccount = await nodemailer.createTestAccount();
        console.log('📧 Ethereal test account created:', testAccount.user);

        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log('📧 Using Ethereal test email account (emails won\'t be delivered)');
        return;
      }

      // Use configured SMTP settings
      this.transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port || 587,
        secure: config.smtp_port === 465,
        auth: config.smtp_user && config.smtp_password ? {
          user: config.smtp_user,
          pass: config.smtp_password,
        } : undefined,
      });

      console.log(`📧 Email service initialized with SMTP: ${config.smtp_host}`);
    } catch (error) {
      console.error('❌ Error initializing email transporter:', error);
      throw error;
    }
  }

  /**
   * Get email configuration from database
   */
  async getConfig(): Promise<EmailConfig | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM email_config WHERE id = 1'
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching email config:', error);
      return null;
    }
  }

  /**
   * Update email configuration
   */
  async updateConfig(
    doctorEmail: string,
    enabled: boolean,
    smtpSettings?: {
      smtp_host?: string;
      smtp_port?: number;
      smtp_user?: string;
      smtp_password?: string;
      from_email?: string;
      from_name?: string;
      notify_ckd_transitions?: boolean;
      notify_lab_updates?: boolean;
      notify_significant_changes?: boolean;
      notify_clinical_alerts?: boolean;
    }
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO email_config (id, doctor_email, enabled, smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name, notify_ckd_transitions, notify_lab_updates, notify_significant_changes, notify_clinical_alerts, updated_at)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (id)
         DO UPDATE SET
           doctor_email = $1,
           enabled = $2,
           smtp_host = $3,
           smtp_port = $4,
           smtp_user = $5,
           smtp_password = $6,
           from_email = $7,
           from_name = $8,
           notify_ckd_transitions = $9,
           notify_lab_updates = $10,
           notify_significant_changes = $11,
           notify_clinical_alerts = $12,
           updated_at = NOW()`,
        [
          doctorEmail,
          enabled,
          smtpSettings?.smtp_host || null,
          smtpSettings?.smtp_port || null,
          smtpSettings?.smtp_user || null,
          smtpSettings?.smtp_password || null,
          smtpSettings?.from_email || null,
          smtpSettings?.from_name || 'CKD Analyzer System',
          smtpSettings?.notify_ckd_transitions !== undefined ? smtpSettings.notify_ckd_transitions : true,
          smtpSettings?.notify_lab_updates !== undefined ? smtpSettings.notify_lab_updates : false,
          smtpSettings?.notify_significant_changes !== undefined ? smtpSettings.notify_significant_changes : true,
          smtpSettings?.notify_clinical_alerts !== undefined ? smtpSettings.notify_clinical_alerts : true,
        ]
      );

      // Reinitialize transporter with new settings
      this.transporter = null;
    } catch (error) {
      console.error('Error updating email config:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendNotification(messageData: EmailMessage): Promise<boolean> {
    const result = await this.sendNotificationWithDetails(messageData);
    return result.success;
  }

  /**
   * Send email notification with detailed result
   */
  async sendNotificationWithDetails(messageData: EmailMessage): Promise<{
    success: boolean;
    previewUrl?: string;
    messageId?: string;
    error?: string;
  }> {
    try {
      console.log('📧 Starting email send process...');

      // Get configuration
      const config = await this.getConfig();
      console.log('📧 Email config retrieved:', config ? `enabled=${config.enabled}, email=${config.doctor_email}` : 'null');

      if (!config || !config.enabled) {
        console.log('⚠️  Email notifications are disabled');
        return { success: false, error: 'Email notifications are disabled' };
      }

      if (!config.doctor_email) {
        console.log('⚠️  No doctor email configured');
        return { success: false, error: 'No doctor email configured' };
      }

      // Initialize transporter if not already done
      if (!this.transporter) {
        console.log('📧 Initializing email transporter...');
        await this.initializeTransporter();
      }

      if (!this.transporter) {
        throw new Error('Failed to initialize email transporter');
      }

      // Try to use template if specified
      let emailSubject = messageData.subject;
      let emailBody: { text: string; html: string };

      if (messageData.templateName) {
        console.log(`📧 Attempting to use template: ${messageData.templateName}...`);

        // Prepare template variables
        const templateVars = {
          patient_name: messageData.patientName,
          mrn: messageData.mrn,
          doctor_name: config.doctor_email.split('@')[0], // Simple extraction, could be improved
          doctor_email: config.doctor_email,
          alert_details: messageData.message,
          facility_name: config.from_name || 'CKD Analyzer System',
          priority: messageData.priority,
          ...messageData.templateVariables, // Merge additional variables
        };

        const renderedTemplate = await this.renderTemplate(
          config.doctor_email,
          messageData.templateName,
          templateVars
        );

        if (renderedTemplate) {
          console.log('✓ Template rendered successfully');
          emailSubject = renderedTemplate.subject;

          if (renderedTemplate.isHtml) {
            emailBody = {
              text: renderedTemplate.body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
              html: renderedTemplate.body
            };
          } else {
            emailBody = {
              text: renderedTemplate.body,
              html: renderedTemplate.body.replace(/\n/g, '<br>')
            };
          }
        } else {
          // Fall back to default formatting
          console.log('⚠️  Falling back to default formatting');
          emailBody = this.formatMessage(messageData);
        }
      } else {
        // Use default formatting
        console.log('📧 Formatting email message with default format...');
        emailBody = this.formatMessage(messageData);
      }

      const fromEmail = config.from_email || 'noreply@ckd-analyzer.com';
      const fromName = config.from_name || 'CKD Analyzer System';

      console.log(`📧 Sending email to ${messageData.to}...`);

      // Send email
      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: messageData.to,
        subject: emailSubject,
        text: emailBody.text,
        html: emailBody.html,
      });

      console.log(`✓ Email sent successfully! Message ID: ${info.messageId}`);

      // Log the sent message
      await this.logMessage(
        messageData.to,
        emailSubject,
        emailBody.text,
        'sent',
        info.messageId
      );

      // For test accounts (Ethereal), get the preview URL
      // getTestMessageUrl returns false if not an Ethereal email
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`📧 Ethereal preview URL generated: ${previewUrl}`);
      } else {
        console.log('📧 Email sent via configured SMTP (no preview URL available)');
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined
      };
    } catch (error) {
      console.error('❌ Error sending email notification:', error);
      if (error instanceof Error) {
        console.error('❌ Error details:', error.message);
        console.error('❌ Error stack:', error.stack);
      }

      // Log the failed message
      try {
        await this.logMessage(
          messageData.to,
          messageData.subject,
          messageData.message,
          'failed',
          null,
          error instanceof Error ? error.message : 'Unknown error'
        );
      } catch (logError) {
        console.error('❌ Error logging failed email:', logError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch email template from database
   */
  private async getTemplate(
    doctorEmail: string,
    templateName: string
  ): Promise<{ subject: string; body: string; isHtml: boolean } | null> {
    try {
      // Try to get doctor-specific template first
      let result = await this.db.query(
        `SELECT subject_template, body_template, is_html
         FROM email_templates
         WHERE doctor_email = $1 AND template_name = $2
         LIMIT 1`,
        [doctorEmail, templateName]
      );

      // Fall back to default template if no custom template exists
      if (result.rows.length === 0) {
        result = await this.db.query(
          `SELECT subject_template, body_template, is_html
           FROM email_templates
           WHERE doctor_email = 'doctor@example.com' AND template_name = $1
           LIMIT 1`,
          [templateName]
        );
      }

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        subject: row.subject_template,
        body: row.body_template,
        isHtml: row.is_html
      };
    } catch (error) {
      console.error('Error fetching email template:', error);
      return null;
    }
  }

  /**
   * Replace template variables with actual values
   */
  private replaceVariables(template: string, variables: { [key: string]: string }): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    return result;
  }

  /**
   * Render email from template
   */
  private async renderTemplate(
    doctorEmail: string,
    templateName: string,
    variables: { [key: string]: string }
  ): Promise<{ subject: string; body: string; isHtml: boolean } | null> {
    const template = await this.getTemplate(doctorEmail, templateName);

    if (!template) {
      console.log(`⚠️  No template found for ${templateName}, using default formatting`);
      return null;
    }

    // Add current date/time to variables
    const now = new Date();
    const enhancedVariables = {
      ...variables,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
    };

    const subject = this.replaceVariables(template.subject, enhancedVariables);
    const body = this.replaceVariables(template.body, enhancedVariables);

    return {
      subject,
      body,
      isHtml: template.isHtml
    };
  }

  /**
   * Format message for email
   */
  private formatMessage(data: EmailMessage): { text: string; html: string } {
    const priorityEmoji = this.getPriorityEmoji(data.priority);
    const priorityColor = this.getPriorityColor(data.priority);

    // Plain text version
    const text = `
${priorityEmoji} ${data.subject}

Patient: ${data.patientName}
MRN: ${data.mrn}
Priority: ${data.priority}

${data.message}

---
Sent from CKD Analyzer System
    `.trim();

    // HTML version
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${priorityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
    .patient-info { background-color: white; padding: 15px; border-left: 4px solid ${priorityColor}; margin: 15px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
    .priority-badge { display: inline-block; padding: 5px 10px; background-color: ${priorityColor}; color: white; border-radius: 4px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">${priorityEmoji} Patient Alert</h2>
    </div>
    <div class="content">
      <div class="patient-info">
        <p><strong>Patient:</strong> ${data.patientName}</p>
        <p><strong>MRN:</strong> ${data.mrn}</p>
        <p><strong>Priority:</strong> <span class="priority-badge">${data.priority}</span></p>
      </div>
      <div style="background-color: white; padding: 15px; border-radius: 4px;">
        <h3 style="margin-top: 0;">Alert Details</h3>
        <p>${data.message}</p>
      </div>
    </div>
    <div class="footer">
      <p>Sent from CKD Analyzer System</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return { text, html };
  }

  /**
   * Get emoji for priority level
   */
  private getPriorityEmoji(priority: string): string {
    switch (priority.toUpperCase()) {
      case 'CRITICAL':
        return '🚨';
      case 'HIGH':
        return '⚡';
      case 'MODERATE':
        return '📋';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Get color for priority level
   */
  private getPriorityColor(priority: string): string {
    switch (priority.toUpperCase()) {
      case 'CRITICAL':
        return '#dc2626'; // red-600
      case 'HIGH':
        return '#ea580c'; // orange-600
      case 'MODERATE':
        return '#2563eb'; // blue-600
      default:
        return '#6b7280'; // gray-500
    }
  }

  /**
   * Log sent/failed email message
   */
  private async logMessage(
    toEmail: string,
    subject: string,
    message: string,
    status: 'sent' | 'failed' | 'pending',
    messageId: string | null,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO email_messages (to_email, subject, message, status, email_message_id, error_message, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [toEmail, subject, message, status, messageId, errorMessage || null]
      );
    } catch (error) {
      console.error('Error logging email message:', error);
    }
  }

  /**
   * Test email connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; previewUrl?: string }> {
    try {
      const config = await this.getConfig();

      if (!config) {
        return {
          success: false,
          message: 'Email not configured. Please add your email address in settings.',
        };
      }

      if (!config.enabled) {
        return {
          success: false,
          message: 'Email notifications are disabled. Please enable them in settings.',
        };
      }

      // Send test email with details
      const result = await this.sendNotificationWithDetails({
        to: config.doctor_email,
        subject: 'Test Email - CKD Analyzer',
        message: 'This is a test email to verify your email notification settings are working correctly.',
        priority: 'MODERATE',
        patientName: 'Test Patient',
        mrn: 'TEST-12345',
      });

      if (result.success) {
        let message = `Test email sent successfully to ${config.doctor_email}`;

        // If using Ethereal test account, include preview URL
        if (result.previewUrl) {
          message += `\n\nℹ️ Note: You are using a test email account. Since no SMTP server is configured, emails are sent to a test inbox.\n\nView your test email here: ${result.previewUrl}`;
        }

        return {
          success: true,
          message,
          previewUrl: result.previewUrl
        };
      } else {
        return {
          success: false,
          message: result.error || 'Failed to send test email. Please check your SMTP settings.',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
