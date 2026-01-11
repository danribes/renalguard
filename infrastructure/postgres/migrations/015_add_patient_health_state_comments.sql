-- Migration: Add Patient Health State Comments Table
-- Purpose: Track health state changes with automated comments and recommendations
-- Date: 2025-11-17

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create patient_health_state_comments table
CREATE TABLE IF NOT EXISTS patient_health_state_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- State Change Reference
    state_transition_id UUID REFERENCES state_transitions(id) ON DELETE SET NULL,

    -- Comment Content
    comment_text TEXT NOT NULL,
    comment_type VARCHAR(50) NOT NULL DEFAULT 'automatic', -- 'automatic', 'manual', 'ai_generated'

    -- Health State Change Details
    health_state_from VARCHAR(10),
    health_state_to VARCHAR(10) NOT NULL,
    risk_level_from VARCHAR(20),
    risk_level_to VARCHAR(20) NOT NULL,
    change_type VARCHAR(20), -- 'improved', 'worsened', 'stable', 'initial'

    -- Patient Context
    is_ckd_patient BOOLEAN NOT NULL DEFAULT false,
    severity_from VARCHAR(20), -- For CKD patients: 'mild', 'moderate', 'severe', 'kidney_failure'
    severity_to VARCHAR(20),

    -- Cycle tracking
    cycle_number INTEGER,

    -- Lab Value Changes (that drove the health state change)
    egfr_from DECIMAL(5, 2),
    egfr_to DECIMAL(5, 2),
    egfr_change DECIMAL(6, 2),
    uacr_from DECIMAL(8, 2),
    uacr_to DECIMAL(8, 2),
    uacr_change DECIMAL(8, 2),

    -- Clinical Context
    clinical_summary TEXT, -- Description of the evolution
    recommended_actions TEXT[], -- Array of recommended actions
    mitigation_measures TEXT[], -- Specific measures for worsening cases
    acknowledgment_text TEXT, -- Acknowledgment for improvement cases

    -- Metadata
    severity VARCHAR(20) NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
    created_by VARCHAR(100) DEFAULT 'system', -- 'system', 'ai', or user email
    created_by_type VARCHAR(20) DEFAULT 'system', -- 'system', 'doctor', 'ai'
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Tracking & Display
    visibility VARCHAR(20) DEFAULT 'visible', -- 'visible', 'archived'
    is_pinned BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_comment_type CHECK (comment_type IN ('automatic', 'manual', 'ai_generated')),
    CONSTRAINT valid_change_type CHECK (change_type IN ('improved', 'worsened', 'stable', 'initial')),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical')),
    CONSTRAINT valid_visibility CHECK (visibility IN ('visible', 'archived')),
    CONSTRAINT valid_created_by_type CHECK (created_by_type IN ('system', 'doctor', 'ai'))
);

-- Create indexes for efficient querying
CREATE INDEX idx_patient_comments_patient_id ON patient_health_state_comments(patient_id);
CREATE INDEX idx_patient_comments_state_transition ON patient_health_state_comments(state_transition_id);
CREATE INDEX idx_patient_comments_created_at ON patient_health_state_comments(created_at DESC);
CREATE INDEX idx_patient_comments_visibility ON patient_health_state_comments(visibility);
CREATE INDEX idx_patient_comments_is_read ON patient_health_state_comments(is_read);
CREATE INDEX idx_patient_comments_change_type ON patient_health_state_comments(change_type);
CREATE INDEX idx_patient_comments_severity ON patient_health_state_comments(severity);

-- Composite index for filtering patients with recent health state changes
CREATE INDEX idx_patient_comments_recent_changes ON patient_health_state_comments(patient_id, created_at DESC, change_type)
WHERE visibility = 'visible' AND change_type IN ('improved', 'worsened');

-- Add comment to table
COMMENT ON TABLE patient_health_state_comments IS 'Tracks health state changes with automated comments, clinical summaries, and recommendations for CKD and non-CKD patients';

-- Add comments to important columns
COMMENT ON COLUMN patient_health_state_comments.change_type IS 'Type of health state change: improved (better), worsened (worse), stable (no change), initial (first observation)';
COMMENT ON COLUMN patient_health_state_comments.clinical_summary IS 'AI-generated or manual description of patient evolution and health state change';
COMMENT ON COLUMN patient_health_state_comments.recommended_actions IS 'Array of recommended clinical actions based on the health state change';
COMMENT ON COLUMN patient_health_state_comments.mitigation_measures IS 'Specific measures to mitigate worsening health state (populated when change_type = worsened)';
COMMENT ON COLUMN patient_health_state_comments.acknowledgment_text IS 'Acknowledgment message for health state improvement (populated when change_type = improved)';
