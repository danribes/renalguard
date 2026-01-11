import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { PatientMonitorService } from '../../services/patientMonitor';

export function createNotificationsRouter(
  db: Pool,
  monitorService: PatientMonitorService
): Router {
  const router = Router();

  /**
   * GET /api/notifications
   * Get notifications for a doctor (query param: email or default)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const doctorEmail = (req.query.email as string) || 'doctor@example.com';
      const limit = parseInt(req.query.limit as string) || 50;

      const notifications = await monitorService.getNotifications(doctorEmail, limit);

      res.json({
        notifications,
        count: notifications.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        error: 'Failed to fetch notifications',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/notifications/unread
   * Get only unread notifications
   */
  router.get('/unread', async (req: Request, res: Response) => {
    try {
      const doctorEmail = (req.query.email as string) || 'doctor@example.com';
      const limit = parseInt(req.query.limit as string) || 50;

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
          p.first_name,
          p.last_name,
          p.medical_record_number
        FROM doctor_notifications n
        JOIN patients p ON n.patient_id = p.id
        WHERE n.doctor_email = $1
          AND n.status IN ('pending', 'sent', 'delivered')
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

      const result = await db.query(query, [doctorEmail, limit]);

      res.json({
        notifications: result.rows,
        count: result.rows.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      res.status(500).json({
        error: 'Failed to fetch unread notifications',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/notifications/:id/read
   * Mark a notification as read
   */
  router.post('/:id/read', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await monitorService.markNotificationAsRead(id);

      res.json({
        success: true,
        notificationId: id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        error: 'Failed to mark notification as read',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/notifications/:id/acknowledge
   * Mark a notification as acknowledged
   */
  router.post('/:id/acknowledge', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await monitorService.acknowledgeNotification(id);

      res.json({
        success: true,
        notificationId: id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error acknowledging notification:', error);
      res.status(500).json({
        error: 'Failed to acknowledge notification',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/notifications/stats
   * Get notification statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const doctorEmail = (req.query.email as string) || 'doctor@example.com';

      const query = `
        SELECT
          COUNT(*) FILTER (WHERE status IN ('pending', 'sent', 'delivered')) as unread_count,
          COUNT(*) FILTER (WHERE priority = 'CRITICAL') as critical_count,
          COUNT(*) FILTER (WHERE priority = 'HIGH') as high_count,
          COUNT(*) FILTER (WHERE priority = 'MODERATE') as moderate_count,
          COUNT(*) as total_count
        FROM doctor_notifications
        WHERE doctor_email = $1
          AND created_at > NOW() - INTERVAL '7 days'
      `;

      const result = await db.query(query, [doctorEmail]);
      const stats = result.rows[0];

      res.json({
        stats: {
          unreadCount: parseInt(stats.unread_count) || 0,
          criticalCount: parseInt(stats.critical_count) || 0,
          highCount: parseInt(stats.high_count) || 0,
          moderateCount: parseInt(stats.moderate_count) || 0,
          totalCount: parseInt(stats.total_count) || 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      res.status(500).json({
        error: 'Failed to fetch notification statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/notifications/monitor/status
   * Get monitoring service status
   */
  router.get('/monitor/status', async (_req: Request, res: Response) => {
    try {
      const status = monitorService.getStatus();

      res.json({
        ...status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching monitor status:', error);
      res.status(500).json({
        error: 'Failed to fetch monitor status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
