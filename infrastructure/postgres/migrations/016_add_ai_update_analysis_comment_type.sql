-- Migration: Add AI Update Analysis Comment Type
-- Purpose: Support AI-powered update analysis comments for patient lab changes
-- Date: 2025-11-18

-- Drop the existing constraint
ALTER TABLE patient_health_state_comments
DROP CONSTRAINT IF EXISTS valid_comment_type;

-- Add the new constraint with 'ai_update_analysis' type
ALTER TABLE patient_health_state_comments
ADD CONSTRAINT valid_comment_type CHECK (comment_type IN ('automatic', 'manual', 'ai_generated', 'ai_update_analysis'));

-- Add comment explaining the new type
COMMENT ON COLUMN patient_health_state_comments.comment_type IS 'Type of comment: automatic (rule-based health state change), manual (doctor-entered), ai_generated (AI-generated insights), ai_update_analysis (AI analysis of lab value updates)';
