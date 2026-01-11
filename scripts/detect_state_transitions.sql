-- ====================================================================
-- Detect and Record KDIGO Health State Transitions
-- ====================================================================
-- This script analyzes the health_state_history table and detects
-- when patients transition between KDIGO health states.
-- It populates the state_transitions table with detailed transition data.
-- ====================================================================

\echo 'Detecting health state transitions...'
\echo ''

-- Clear existing transitions (if re-running)
TRUNCATE TABLE state_transitions;

-- ====================================================================
-- Detect transitions by comparing consecutive measurements
-- ====================================================================

INSERT INTO state_transitions (
    patient_id,
    transition_date,
    from_cycle,
    to_cycle,

    -- Previous state
    from_health_state,
    from_gfr_category,
    from_albuminuria_category,
    from_risk_level,
    from_egfr,
    from_uacr,

    -- Current state
    to_health_state,
    to_gfr_category,
    to_albuminuria_category,
    to_risk_level,
    to_egfr,
    to_uacr,

    -- Change analysis
    change_type,
    egfr_change,
    uacr_change,
    gfr_trend,
    albuminuria_trend,

    -- Severity flags
    category_changed,
    risk_changed,
    risk_increased,
    crossed_critical_threshold,

    -- Alert info
    alert_generated,
    alert_severity,

    detected_at
)
SELECT
    curr.patient_id,
    curr.measured_at AS transition_date,
    prev.cycle_number AS from_cycle,
    curr.cycle_number AS to_cycle,

    -- Previous state
    prev.health_state AS from_health_state,
    prev.gfr_category AS from_gfr_category,
    prev.albuminuria_category AS from_albuminuria_category,
    prev.risk_level AS from_risk_level,
    prev.egfr_value AS from_egfr,
    prev.uacr_value AS from_uacr,

    -- Current state
    curr.health_state AS to_health_state,
    curr.gfr_category AS to_gfr_category,
    curr.albuminuria_category AS to_albuminuria_category,
    curr.risk_level AS to_risk_level,
    curr.egfr_value AS to_egfr,
    curr.uacr_value AS to_uacr,

    -- Determine change type
    CASE
        -- Worsened if GFR category declined OR albuminuria category increased OR risk increased
        WHEN (
            (curr.gfr_category > prev.gfr_category) OR
            (curr.albuminuria_category > prev.albuminuria_category) OR
            (
                CASE curr.risk_level
                    WHEN 'low' THEN 1
                    WHEN 'moderate' THEN 2
                    WHEN 'high' THEN 3
                    WHEN 'very_high' THEN 4
                END >
                CASE prev.risk_level
                    WHEN 'low' THEN 1
                    WHEN 'moderate' THEN 2
                    WHEN 'high' THEN 3
                    WHEN 'very_high' THEN 4
                END
            )
        ) THEN 'worsened'

        -- Improved if GFR category improved AND/OR albuminuria decreased
        WHEN (
            (curr.gfr_category < prev.gfr_category) OR
            (curr.albuminuria_category < prev.albuminuria_category) OR
            (curr.egfr_value - prev.egfr_value > 5)
        ) THEN 'improved'

        -- Otherwise stable
        ELSE 'stable'
    END AS change_type,

    -- Numeric changes
    (curr.egfr_value - prev.egfr_value) AS egfr_change,
    (curr.uacr_value - prev.uacr_value) AS uacr_change,

    -- GFR trend
    CASE
        WHEN (curr.egfr_value - prev.egfr_value) > 5 THEN 'improving'
        WHEN (curr.egfr_value - prev.egfr_value) < -5 THEN 'declining'
        ELSE 'stable'
    END AS gfr_trend,

    -- Albuminuria trend
    CASE
        WHEN (curr.uacr_value - prev.uacr_value) < -10 THEN 'improving'
        WHEN (curr.uacr_value - prev.uacr_value) > 10 THEN 'worsening'
        ELSE 'stable'
    END AS albuminuria_trend,

    -- Category changed?
    (curr.health_state != prev.health_state) AS category_changed,

    -- Risk changed?
    (curr.risk_level != prev.risk_level) AS risk_changed,

    -- Risk increased?
    (
        CASE curr.risk_level
            WHEN 'low' THEN 1
            WHEN 'moderate' THEN 2
            WHEN 'high' THEN 3
            WHEN 'very_high' THEN 4
        END >
        CASE prev.risk_level
            WHEN 'low' THEN 1
            WHEN 'moderate' THEN 2
            WHEN 'high' THEN 3
            WHEN 'very_high' THEN 4
        END
    ) AS risk_increased,

    -- Crossed critical threshold?
    (
        (curr.egfr_value < 30 AND prev.egfr_value >= 30) OR  -- Crossed into G4
        (curr.egfr_value < 15 AND prev.egfr_value >= 15) OR  -- Crossed into G5
        (curr.uacr_value > 300 AND prev.uacr_value <= 300) OR -- Crossed into A3
        (curr.egfr_value < 45 AND prev.egfr_value >= 45) OR  -- Crossed into G3b
        (curr.uacr_value > 30 AND prev.uacr_value <= 30)     -- Crossed into A2
    ) AS crossed_critical_threshold,

    -- Generate alert if significant change
    (
        (curr.health_state != prev.health_state) OR
        (curr.risk_level != prev.risk_level AND
         CASE curr.risk_level
             WHEN 'low' THEN 1
             WHEN 'moderate' THEN 2
             WHEN 'high' THEN 3
             WHEN 'very_high' THEN 4
         END >
         CASE prev.risk_level
             WHEN 'low' THEN 1
             WHEN 'moderate' THEN 2
             WHEN 'high' THEN 3
             WHEN 'very_high' THEN 4
         END) OR
        (curr.egfr_value < 30 AND prev.egfr_value >= 30) OR
        (curr.uacr_value > 300 AND prev.uacr_value <= 300)
    ) AS alert_generated,

    -- Alert severity
    CASE
        WHEN (curr.egfr_value < 15 AND prev.egfr_value >= 15) THEN 'critical'
        WHEN (curr.egfr_value < 30 AND prev.egfr_value >= 30) THEN 'critical'
        WHEN (curr.uacr_value > 300 AND prev.uacr_value <= 300) THEN 'critical'
        WHEN (curr.gfr_category != prev.gfr_category) THEN 'warning'
        WHEN (curr.albuminuria_category != prev.albuminuria_category) THEN 'warning'
        WHEN (curr.risk_level != prev.risk_level) THEN 'warning'
        ELSE 'info'
    END AS alert_severity,

    NOW() AS detected_at

FROM health_state_history curr
INNER JOIN health_state_history prev
    ON curr.patient_id = prev.patient_id
    AND curr.cycle_number = prev.cycle_number + 1
WHERE
    -- Only record transitions where something changed
    (curr.health_state != prev.health_state)
    OR (curr.risk_level != prev.risk_level)
    OR (ABS(curr.egfr_value - prev.egfr_value) > 5)
    OR (ABS(curr.uacr_value - prev.uacr_value) > 10)
ORDER BY curr.patient_id, curr.cycle_number;

\echo ''
\echo 'State transitions detected and recorded!'
\echo ''

-- ====================================================================
-- Summary Statistics
-- ====================================================================

\echo 'Transition Summary:'
\echo ''

SELECT
    'Total Transitions Detected' AS metric,
    COUNT(*)::TEXT AS value
FROM state_transitions

UNION ALL

SELECT
    'Patients with Transitions',
    COUNT(DISTINCT patient_id)::TEXT
FROM state_transitions

UNION ALL

SELECT
    'Worsening Transitions',
    COUNT(*)::TEXT
FROM state_transitions
WHERE change_type = 'worsened'

UNION ALL

SELECT
    'Improving Transitions',
    COUNT(*)::TEXT
FROM state_transitions
WHERE change_type = 'improved'

UNION ALL

SELECT
    'Stable (minor changes)',
    COUNT(*)::TEXT
FROM state_transitions
WHERE change_type = 'stable'

UNION ALL

SELECT
    'Alerts Generated',
    COUNT(*)::TEXT
FROM state_transitions
WHERE alert_generated = true

UNION ALL

SELECT
    'Critical Alerts',
    COUNT(*)::TEXT
FROM state_transitions
WHERE alert_severity = 'critical'

UNION ALL

SELECT
    'Warning Alerts',
    COUNT(*)::TEXT
FROM state_transitions
WHERE alert_severity = 'warning'

UNION ALL

SELECT
    'Patients Crossing Critical Thresholds',
    COUNT(DISTINCT patient_id)::TEXT
FROM state_transitions
WHERE crossed_critical_threshold = true;

\echo ''
\echo 'Transitions by Change Type:'

SELECT
    change_type,
    COUNT(*) AS count,
    ROUND(AVG(egfr_change), 2) AS avg_egfr_change,
    ROUND(AVG(uacr_change), 2) AS avg_uacr_change,
    COUNT(CASE WHEN alert_generated THEN 1 END) AS alerts_generated
FROM state_transitions
GROUP BY change_type
ORDER BY count DESC;

\echo ''
\echo 'Critical Transitions (requiring immediate attention):'

SELECT
    p.medical_record_number,
    p.first_name,
    p.last_name,
    t.from_health_state,
    t.to_health_state,
    t.from_egfr,
    t.to_egfr,
    t.alert_severity,
    t.transition_date
FROM state_transitions t
JOIN patients p ON t.patient_id = p.id
WHERE t.alert_severity = 'critical'
ORDER BY t.transition_date DESC
LIMIT 10;

\echo ''
\echo '======================================================================'
\echo 'Transition detection complete!'
\echo 'Next: Generate monitoring alerts and action recommendations'
\echo '======================================================================'
\echo ''
