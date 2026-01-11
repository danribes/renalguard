/**
 * Analytics Service
 * Tracks and analyzes alert performance, doctor response times, and system metrics
 */

import { Pool } from 'pg';

export interface AlertMetrics {
  alert_id?: string;
  patient_id: string;
  doctor_email: string;
  alert_type: string;
  priority: 'CRITICAL' | 'HIGH' | 'MODERATE';
  alert_details?: any;
}

export interface DoctorPerformance {
  doctor_email: string;
  total_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  moderate_alerts: number;
  avg_time_to_view_seconds: number;
  avg_time_to_acknowledge_seconds: number;
  avg_time_to_resolve_seconds: number;
  acknowledgment_rate_percent: number;
  resolution_rate_percent: number;
  escalated_count: number;
  escalation_rate_percent: number;
  alerts_last_30_days: number;
  alerts_last_7_days: number;
  last_alert_time?: Date;
}

export interface AlertTrend {
  date: string;
  total_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  moderate_alerts: number;
  acknowledged_alerts: number;
  escalated_alerts: number;
  avg_response_time_seconds: number;
  acknowledgment_rate_percent: number;
}

export interface AlertTypeSummary {
  alert_type: string;
  count: number;
  critical_count: number;
  avg_response_time_seconds: number;
  acknowledgment_rate_percent: number;
  escalation_rate_percent: number;
}

export class AnalyticsService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Track alert creation
   * Called when a new alert is generated
   */
  async trackAlertCreated(metrics: AlertMetrics): Promise<string> {
    try {
      const result = await this.db.query(`
        INSERT INTO alert_analytics (
          alert_id,
          patient_id,
          doctor_email,
          alert_type,
          priority,
          created_at,
          alert_details
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), $6)
        RETURNING id
      `, [
        metrics.alert_id || null,
        metrics.patient_id,
        metrics.doctor_email,
        metrics.alert_type,
        metrics.priority,
        metrics.alert_details ? JSON.stringify(metrics.alert_details) : null
      ]);

      const analyticsId = result.rows[0].id;
      console.log(`✓ Analytics tracked for alert ${metrics.alert_type} to ${metrics.doctor_email}`);
      return analyticsId;
    } catch (error) {
      console.error('[Analytics] Error tracking alert creation:', error);
      throw error;
    }
  }

  /**
   * Track alert view
   * Called when a doctor first views an alert
   */
  async trackAlertViewed(alertId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE alert_analytics
        SET first_viewed_at = NOW()
        WHERE alert_id = $1 AND first_viewed_at IS NULL
      `, [alertId]);

      console.log(`✓ Alert ${alertId} marked as viewed`);
    } catch (error) {
      console.error('[Analytics] Error tracking alert view:', error);
    }
  }

  /**
   * Track alert acknowledgment
   * Called when a doctor acknowledges an alert
   */
  async trackAlertAcknowledged(alertId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE alert_analytics
        SET acknowledged_at = NOW()
        WHERE alert_id = $1 AND acknowledged_at IS NULL
      `, [alertId]);

      console.log(`✓ Alert ${alertId} marked as acknowledged`);
    } catch (error) {
      console.error('[Analytics] Error tracking alert acknowledgment:', error);
    }
  }

  /**
   * Track alert resolution
   * Called when an alert is marked as resolved
   */
  async trackAlertResolved(alertId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE alert_analytics
        SET resolved_at = NOW()
        WHERE alert_id = $1 AND resolved_at IS NULL
      `, [alertId]);

      console.log(`✓ Alert ${alertId} marked as resolved`);
    } catch (error) {
      console.error('[Analytics] Error tracking alert resolution:', error);
    }
  }

  /**
   * Track alert escalation
   * Called when an alert is escalated due to lack of response
   */
  async trackAlertEscalated(alertId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE alert_analytics
        SET
          escalated = true,
          escalated_at = NOW(),
          retry_count = retry_count + 1
        WHERE alert_id = $1
      `, [alertId]);

      console.log(`✓ Alert ${alertId} marked as escalated`);
    } catch (error) {
      console.error('[Analytics] Error tracking alert escalation:', error);
    }
  }

  /**
   * Get doctor performance metrics
   */
  async getDoctorPerformance(doctorEmail: string): Promise<DoctorPerformance | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM doctor_performance_stats
        WHERE doctor_email = $1
      `, [doctorEmail]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as DoctorPerformance;
    } catch (error) {
      console.error('[Analytics] Error fetching doctor performance:', error);
      throw error;
    }
  }

  /**
   * Get all doctors' performance metrics
   */
  async getAllDoctorsPerformance(): Promise<DoctorPerformance[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM doctor_performance_stats
        ORDER BY total_alerts DESC
      `);

      return result.rows as DoctorPerformance[];
    } catch (error) {
      console.error('[Analytics] Error fetching all doctors performance:', error);
      throw error;
    }
  }

  /**
   * Get alert trends over time
   */
  async getAlertTrends(days: number = 30): Promise<AlertTrend[]> {
    try {
      const result = await this.db.query(`
        SELECT *
        FROM alert_trends_daily
        WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC
      `);

      return result.rows as AlertTrend[];
    } catch (error) {
      console.error('[Analytics] Error fetching alert trends:', error);
      throw error;
    }
  }

  /**
   * Get most common alert types
   */
  async getMostCommonAlerts(): Promise<AlertTypeSummary[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM alert_type_summary
        ORDER BY count DESC
        LIMIT 10
      `);

      return result.rows as AlertTypeSummary[];
    } catch (error) {
      console.error('[Analytics] Error fetching common alerts:', error);
      throw error;
    }
  }

  /**
   * Get patient alert history
   */
  async getPatientAlertHistory(patientId: string): Promise<any> {
    try {
      const result = await this.db.query(`
        SELECT * FROM patient_alert_history
        WHERE patient_id = $1
      `, [patientId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('[Analytics] Error fetching patient alert history:', error);
      throw error;
    }
  }

  /**
   * Get system-wide analytics summary
   */
  async getSystemSummary(): Promise<any> {
    try {
      const result = await this.db.query(`
        SELECT
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN priority = 'CRITICAL' THEN 1 END) as critical_alerts,
          COUNT(CASE WHEN priority = 'HIGH' THEN 1 END) as high_alerts,
          COUNT(CASE WHEN priority = 'MODERATE' THEN 1 END) as moderate_alerts,
          ROUND(AVG(time_to_acknowledge)) as avg_response_time_seconds,
          ROUND(100.0 * COUNT(acknowledged_at) / NULLIF(COUNT(*), 0), 2) as acknowledgment_rate_percent,
          COUNT(CASE WHEN escalated = true THEN 1 END) as total_escalations,
          COUNT(DISTINCT doctor_email) as active_doctors,
          COUNT(DISTINCT patient_id) as patients_with_alerts
        FROM alert_analytics
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);

      return result.rows[0];
    } catch (error) {
      console.error('[Analytics] Error fetching system summary:', error);
      throw error;
    }
  }

  /**
   * Get response time distribution
   * Returns percentiles for response times
   */
  async getResponseTimeDistribution(): Promise<any> {
    try {
      const result = await this.db.query(`
        SELECT
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY time_to_acknowledge) as median_seconds,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY time_to_acknowledge) as p75_seconds,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY time_to_acknowledge) as p90_seconds,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY time_to_acknowledge) as p95_seconds,
          MIN(time_to_acknowledge) as min_seconds,
          MAX(time_to_acknowledge) as max_seconds
        FROM alert_analytics
        WHERE time_to_acknowledge IS NOT NULL
          AND created_at >= NOW() - INTERVAL '30 days'
      `);

      return result.rows[0];
    } catch (error) {
      console.error('[Analytics] Error fetching response time distribution:', error);
      throw error;
    }
  }
}
