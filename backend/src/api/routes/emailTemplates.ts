/**
 * Email Templates API Routes
 * Manages custom email templates for doctor notifications
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database';

const router = Router();

/**
 * GET /api/email-templates/:doctorEmail
 * Get all templates for a specific doctor
 */
router.get('/:doctorEmail', async (req: Request, res: Response): Promise<any> => {
  try {
    const { doctorEmail } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        id,
        doctor_email,
        template_name,
        subject_template,
        body_template,
        is_html,
        created_at,
        updated_at
      FROM email_templates
      WHERE doctor_email = $1
      ORDER BY template_name
    `, [doctorEmail]);

    return res.json({
      status: 'success',
      templates: result.rows
    });
  } catch (error) {
    console.error('[Email Templates API] Error fetching templates:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch email templates',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/email-templates/:doctorEmail/:templateName
 * Get a specific template
 */
router.get('/:doctorEmail/:templateName', async (req: Request, res: Response): Promise<any> => {
  try {
    const { doctorEmail, templateName } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      SELECT *
      FROM email_templates
      WHERE doctor_email = $1 AND template_name = $2
    `, [doctorEmail, templateName]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Template not found'
      });
    }

    return res.json({
      status: 'success',
      template: result.rows[0]
    });
  } catch (error) {
    console.error('[Email Templates API] Error fetching template:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch email template',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/email-templates/defaults/all
 * Get default templates (from doctor@example.com)
 */
router.get('/defaults/all', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT *
      FROM email_templates
      WHERE doctor_email = 'doctor@example.com'
      ORDER BY template_name
    `);

    return res.json({
      status: 'success',
      templates: result.rows
    });
  } catch (error) {
    console.error('[Email Templates API] Error fetching default templates:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch default templates',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/email-templates/variables/reference
 * Get available template variables
 */
router.get('/variables/reference', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT * FROM template_variables_reference
      ORDER BY variable_name
    `);

    return res.json({
      status: 'success',
      variables: result.rows
    });
  } catch (error) {
    console.error('[Email Templates API] Error fetching template variables:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch template variables',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/email-templates
 * Create or update an email template
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { doctor_email, template_name, subject_template, body_template, is_html } = req.body;

    if (!doctor_email || !template_name || !subject_template || !body_template) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: doctor_email, template_name, subject_template, body_template'
      });
    }

    const pool = getPool();

    const result = await pool.query(`
      INSERT INTO email_templates (
        doctor_email,
        template_name,
        subject_template,
        body_template,
        is_html
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (doctor_email, template_name)
      DO UPDATE SET
        subject_template = EXCLUDED.subject_template,
        body_template = EXCLUDED.body_template,
        is_html = EXCLUDED.is_html,
        updated_at = NOW()
      RETURNING *
    `, [doctor_email, template_name, subject_template, body_template, is_html || false]);

    return res.json({
      status: 'success',
      template: result.rows[0],
      message: 'Template saved successfully'
    });
  } catch (error) {
    console.error('[Email Templates API] Error saving template:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to save email template',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/email-templates/:doctorEmail/:templateName
 * Update an existing template
 */
router.put('/:doctorEmail/:templateName', async (req: Request, res: Response): Promise<any> => {
  try {
    const { doctorEmail, templateName } = req.params;
    const { subject_template, body_template, is_html } = req.body;

    const pool = getPool();

    const result = await pool.query(`
      UPDATE email_templates
      SET
        subject_template = COALESCE($1, subject_template),
        body_template = COALESCE($2, body_template),
        is_html = COALESCE($3, is_html),
        updated_at = NOW()
      WHERE doctor_email = $4 AND template_name = $5
      RETURNING *
    `, [subject_template, body_template, is_html, doctorEmail, templateName]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Template not found'
      });
    }

    return res.json({
      status: 'success',
      template: result.rows[0],
      message: 'Template updated successfully'
    });
  } catch (error) {
    console.error('[Email Templates API] Error updating template:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update email template',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/email-templates/:doctorEmail/:templateName
 * Delete a template
 */
router.delete('/:doctorEmail/:templateName', async (req: Request, res: Response): Promise<any> => {
  try {
    const { doctorEmail, templateName } = req.params;
    const pool = getPool();

    const result = await pool.query(`
      DELETE FROM email_templates
      WHERE doctor_email = $1 AND template_name = $2
      RETURNING template_name
    `, [doctorEmail, templateName]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Template not found'
      });
    }

    return res.json({
      status: 'success',
      message: `Template '${templateName}' deleted successfully`
    });
  } catch (error) {
    console.error('[Email Templates API] Error deleting template:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete email template',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/email-templates/preview
 * Preview a template with sample data
 */
router.post('/preview', async (req: Request, res: Response): Promise<any> => {
  try {
    const { subject_template, body_template, sample_data } = req.body;

    if (!subject_template || !body_template) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: subject_template, body_template'
      });
    }

    // Default sample data if none provided
    const data = sample_data || {
      patient_name: 'John Doe',
      mrn: 'MRN-123456',
      doctor_name: 'Dr. Smith',
      doctor_email: 'doctor@example.com',
      alert_details: 'eGFR declined from 45 to 38 mL/min/1.73m²',
      facility_name: 'General Hospital',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      priority: 'HIGH'
    };

    // Simple variable replacement
    const replaceVariables = (template: string): string => {
      let result = template;
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, String(value));
      }
      return result;
    };

    const previewSubject = replaceVariables(subject_template);
    const previewBody = replaceVariables(body_template);

    return res.json({
      status: 'success',
      preview: {
        subject: previewSubject,
        body: previewBody
      }
    });
  } catch (error) {
    console.error('[Email Templates API] Error generating preview:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate preview',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
