/**
 * Analytics API Routes
 * Provides endpoints for alert performance metrics and doctor analytics
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../config/database';
import { AnalyticsService } from '../../services/analyticsService';

const router = Router();

/**
 * GET /api/analytics/summary
 * Get system-wide analytics summary
 */
router.get('/summary', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    const summary = await analyticsService.getSystemSummary();

    return res.json({
      status: 'success',
      summary
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching summary:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch analytics summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/doctor/:email
 * Get performance metrics for a specific doctor
 */
router.get('/doctor/:email', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.params;
    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    const performance = await analyticsService.getDoctorPerformance(email);

    if (!performance) {
      return res.status(404).json({
        status: 'error',
        message: 'No analytics data found for this doctor'
      });
    }

    return res.json({
      status: 'success',
      performance
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching doctor performance:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch doctor performance data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/doctors/all
 * Get performance metrics for all doctors
 */
router.get('/doctors/all', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    const doctors = await analyticsService.getAllDoctorsPerformance();

    return res.json({
      status: 'success',
      doctors
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching all doctors performance:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch doctors performance data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/trends
 * Get alert trends over time
 */
router.get('/trends', async (req: Request, res: Response): Promise<any> => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    if (days < 1 || days > 365) {
      return res.status(400).json({
        status: 'error',
        message: 'Days parameter must be between 1 and 365'
      });
    }

    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    const trends = await analyticsService.getAlertTrends(days);

    return res.json({
      status: 'success',
      trends
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching trends:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch alert trends',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/common-alerts
 * Get most common alert types
 */
router.get('/common-alerts', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    const alerts = await analyticsService.getMostCommonAlerts();

    return res.json({
      status: 'success',
      alerts
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching common alerts:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch common alerts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/patient/:id
 * Get alert history for a specific patient
 */
router.get('/patient/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id: patientId } = req.params;
    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    const history = await analyticsService.getPatientAlertHistory(patientId);

    if (!history) {
      return res.status(404).json({
        status: 'error',
        message: 'No alert history found for this patient'
      });
    }

    return res.json({
      status: 'success',
      history
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching patient alert history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch patient alert history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/response-times
 * Get response time distribution (percentiles)
 */
router.get('/response-times', async (_req: Request, res: Response): Promise<any> => {
  try {
    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    const distribution = await analyticsService.getResponseTimeDistribution();

    return res.json({
      status: 'success',
      distribution
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching response time distribution:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch response time distribution',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analytics/track/viewed/:alertId
 * Track that an alert was viewed
 */
router.post('/track/viewed/:alertId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { alertId } = req.params;
    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    await analyticsService.trackAlertViewed(alertId);

    return res.json({
      status: 'success',
      message: 'Alert view tracked'
    });
  } catch (error) {
    console.error('[Analytics API] Error tracking alert view:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to track alert view',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analytics/track/acknowledged/:alertId
 * Track that an alert was acknowledged
 */
router.post('/track/acknowledged/:alertId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { alertId } = req.params;
    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    await analyticsService.trackAlertAcknowledged(alertId);

    return res.json({
      status: 'success',
      message: 'Alert acknowledgment tracked'
    });
  } catch (error) {
    console.error('[Analytics API] Error tracking alert acknowledgment:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to track alert acknowledgment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analytics/track/resolved/:alertId
 * Track that an alert was resolved
 */
router.post('/track/resolved/:alertId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { alertId } = req.params;
    const pool = getPool();
    const analyticsService = new AnalyticsService(pool);

    await analyticsService.trackAlertResolved(alertId);

    return res.json({
      status: 'success',
      message: 'Alert resolution tracked'
    });
  } catch (error) {
    console.error('[Analytics API] Error tracking alert resolution:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to track alert resolution',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
