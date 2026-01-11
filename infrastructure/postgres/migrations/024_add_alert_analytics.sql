-- Migration 024: Alert Analytics and Monitoring
-- Tracks alert response times, acknowledgments, and doctor performance metrics

-- Create alert_analytics table
CREATE TABLE IF NOT EXISTS alert_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID, -- References doctor_notifications(id) but not FK to allow orphaned records
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_email VARCHAR(255) NOT NULL,
  alert_type VARCHAR(100) NOT NULL,
  priority VARCHAR(20) NOT NULL,

  -- Timing metrics
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  first_viewed_at TIMESTAMP,
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,

  -- Response time in seconds
  time_to_view INTEGER,
  time_to_acknowledge INTEGER,
  time_to_resolve INTEGER,

  -- Alert characteristics
  retry_count INTEGER DEFAULT 0,
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMP,

  -- Additional metadata
  alert_details JSONB,

  CONSTRAINT valid_timestamps CHECK (
    (first_viewed_at IS NULL OR first_viewed_at >= created_at) AND
    (acknowledged_at IS NULL OR acknowledged_at >= created_at) AND
    (resolved_at IS NULL OR resolved_at >= created_at)
  )
);

-- Create indexes for performance
CREATE INDEX idx_alert_analytics_doctor ON alert_analytics(doctor_email);
CREATE INDEX idx_alert_analytics_created ON alert_analytics(created_at);
CREATE INDEX idx_alert_analytics_priority ON alert_analytics(priority);
CREATE INDEX idx_alert_analytics_alert_type ON alert_analytics(alert_type);
CREATE INDEX idx_alert_analytics_patient ON alert_analytics(patient_id);
CREATE INDEX idx_alert_analytics_acknowledged ON alert_analytics(acknowledged_at);

-- Add comments
COMMENT ON TABLE alert_analytics IS 'Tracks alert performance metrics and doctor response times';
COMMENT ON COLUMN alert_analytics.time_to_view IS 'Seconds from creation to first view';
COMMENT ON COLUMN alert_analytics.time_to_acknowledge IS 'Seconds from creation to acknowledgment';
COMMENT ON COLUMN alert_analytics.time_to_resolve IS 'Seconds from creation to resolution';
COMMENT ON COLUMN alert_analytics.escalated IS 'Whether alert was escalated due to delayed response';

-- Create aggregate statistics view
CREATE OR REPLACE VIEW doctor_performance_stats AS
SELECT
  doctor_email,

  -- Overall counts
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN priority = 'CRITICAL' THEN 1 END) as critical_alerts,
  COUNT(CASE WHEN priority = 'HIGH' THEN 1 END) as high_alerts,
  COUNT(CASE WHEN priority = 'MODERATE' THEN 1 END) as moderate_alerts,

  -- Response metrics (in seconds)
  ROUND(AVG(time_to_view)) as avg_time_to_view_seconds,
  ROUND(AVG(time_to_acknowledge)) as avg_time_to_acknowledge_seconds,
  ROUND(AVG(time_to_resolve)) as avg_time_to_resolve_seconds,

  -- Acknowledgment and resolution rates
  ROUND(100.0 * COUNT(acknowledged_at) / NULLIF(COUNT(*), 0), 2) as acknowledgment_rate_percent,
  ROUND(100.0 * COUNT(resolved_at) / NULLIF(COUNT(*), 0), 2) as resolution_rate_percent,

  -- Escalation metrics
  COUNT(CASE WHEN escalated = true THEN 1 END) as escalated_count,
  ROUND(100.0 * COUNT(CASE WHEN escalated = true THEN 1 END) / NULLIF(COUNT(*), 0), 2) as escalation_rate_percent,

  -- Recent period (last 30 days)
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as alerts_last_30_days,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as alerts_last_7_days,

  -- Timestamp
  MAX(created_at) as last_alert_time

FROM alert_analytics
GROUP BY doctor_email;

COMMENT ON VIEW doctor_performance_stats IS 'Aggregate performance metrics per doctor for dashboard display';

-- Create alert trends view (daily rollup)
CREATE OR REPLACE VIEW alert_trends_daily AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN priority = 'CRITICAL' THEN 1 END) as critical_alerts,
  COUNT(CASE WHEN priority = 'HIGH' THEN 1 END) as high_alerts,
  COUNT(CASE WHEN priority = 'MODERATE' THEN 1 END) as moderate_alerts,
  COUNT(CASE WHEN acknowledged_at IS NOT NULL THEN 1 END) as acknowledged_alerts,
  COUNT(CASE WHEN escalated = true THEN 1 END) as escalated_alerts,
  ROUND(AVG(time_to_acknowledge)) as avg_response_time_seconds,
  ROUND(100.0 * COUNT(acknowledged_at) / NULLIF(COUNT(*), 0), 2) as acknowledgment_rate_percent
FROM alert_analytics
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

COMMENT ON VIEW alert_trends_daily IS 'Daily alert trends for the last 90 days';

-- Create alert type summary view
CREATE OR REPLACE VIEW alert_type_summary AS
SELECT
  alert_type,
  COUNT(*) as count,
  COUNT(CASE WHEN priority = 'CRITICAL' THEN 1 END) as critical_count,
  ROUND(AVG(time_to_acknowledge)) as avg_response_time_seconds,
  ROUND(100.0 * COUNT(acknowledged_at) / NULLIF(COUNT(*), 0), 2) as acknowledgment_rate_percent,
  ROUND(100.0 * COUNT(escalated = true AND escalated IS TRUE) / NULLIF(COUNT(*), 0), 2) as escalation_rate_percent
FROM alert_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY alert_type
ORDER BY count DESC;

COMMENT ON VIEW alert_type_summary IS 'Summary of alerts by type for the last 30 days';

-- Create patient alert history view
CREATE OR REPLACE VIEW patient_alert_history AS
SELECT
  aa.patient_id,
  p.first_name,
  p.last_name,
  p.medical_record_number,
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN aa.priority = 'CRITICAL' THEN 1 END) as critical_alerts,
  MAX(aa.created_at) as last_alert_time,
  ARRAY_AGG(DISTINCT aa.alert_type) as alert_types,
  ARRAY_AGG(DISTINCT aa.doctor_email) as notified_doctors
FROM alert_analytics aa
JOIN patients p ON aa.patient_id = p.id
WHERE aa.created_at >= NOW() - INTERVAL '90 days'
GROUP BY aa.patient_id, p.first_name, p.last_name, p.medical_record_number;

COMMENT ON VIEW patient_alert_history IS 'Alert history per patient for the last 90 days';

-- Create function to automatically update response times
CREATE OR REPLACE FUNCTION update_alert_response_times()
RETURNS TRIGGER AS $$
BEGIN
  -- Update time_to_view when first_viewed_at is set
  IF NEW.first_viewed_at IS NOT NULL AND OLD.first_viewed_at IS NULL THEN
    NEW.time_to_view := EXTRACT(EPOCH FROM (NEW.first_viewed_at - NEW.created_at))::INTEGER;
  END IF;

  -- Update time_to_acknowledge when acknowledged_at is set
  IF NEW.acknowledged_at IS NOT NULL AND OLD.acknowledged_at IS NULL THEN
    NEW.time_to_acknowledge := EXTRACT(EPOCH FROM (NEW.acknowledged_at - NEW.created_at))::INTEGER;
  END IF;

  -- Update time_to_resolve when resolved_at is set
  IF NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN
    NEW.time_to_resolve := EXTRACT(EPOCH FROM (NEW.resolved_at - NEW.created_at))::INTEGER;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_alert_response_times_trigger
  BEFORE UPDATE ON alert_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_alert_response_times();

-- Insert sample analytics data for testing (optional, can be removed)
-- This helps visualize the analytics dashboard with initial data
INSERT INTO alert_analytics (
  patient_id,
  doctor_email,
  alert_type,
  priority,
  created_at,
  acknowledged_at,
  time_to_acknowledge,
  retry_count
)
SELECT
  p.id,
  'doctor@example.com',
  (ARRAY['kidney_function_decline', 'health_state_change', 'poor_adherence', 'home_monitoring_alert'])[floor(random() * 4 + 1)],
  (ARRAY['CRITICAL', 'HIGH', 'MODERATE'])[floor(random() * 3 + 1)],
  NOW() - (random() * INTERVAL '30 days'),
  NOW() - (random() * INTERVAL '29 days'),
  floor(random() * 7200)::INTEGER, -- Random response time up to 2 hours
  floor(random() * 3)::INTEGER -- 0-2 retries
FROM patients p
LIMIT 50
ON CONFLICT DO NOTHING;

-- Verification queries
-- SELECT * FROM doctor_performance_stats;
-- SELECT * FROM alert_trends_daily LIMIT 30;
-- SELECT * FROM alert_type_summary;
-- SELECT * FROM patient_alert_history LIMIT 10;
