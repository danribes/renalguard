/**
 * Doctor Lookup Utility
 * Provides functions to fetch doctor assignments for patients
 */

import { Pool } from 'pg';

export interface DoctorAssignment {
  doctor_email: string;
  doctor_name: string;
  is_primary: boolean;
  notification_preferences?: any;
  email_signature?: string;
  facility_name?: string;
}

/**
 * Get primary doctor for a patient
 * @param db Database pool
 * @param patientId Patient UUID
 * @returns Doctor email and name, or default if none assigned
 */
export async function getPrimaryDoctor(
  db: Pool,
  patientId: string
): Promise<DoctorAssignment> {
  try {
    const result = await db.query(
      `SELECT
        dpa.doctor_email,
        dpa.doctor_name,
        dpa.is_primary,
        d.notification_preferences,
        d.email_signature,
        d.facility_name
      FROM doctor_patient_assignments dpa
      LEFT JOIN doctors d ON dpa.doctor_email = d.email
      WHERE dpa.patient_id = $1 AND dpa.is_primary = true
      LIMIT 1`,
      [patientId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Fallback to any assigned doctor
    const fallbackResult = await db.query(
      `SELECT
        dpa.doctor_email,
        dpa.doctor_name,
        dpa.is_primary,
        d.notification_preferences,
        d.email_signature,
        d.facility_name
      FROM doctor_patient_assignments dpa
      LEFT JOIN doctors d ON dpa.doctor_email = d.email
      WHERE dpa.patient_id = $1
      ORDER BY dpa.assigned_at DESC
      LIMIT 1`,
      [patientId]
    );

    if (fallbackResult.rows.length > 0) {
      return fallbackResult.rows[0];
    }

    // Default fallback
    return {
      doctor_email: 'doctor@example.com',
      doctor_name: 'Default Doctor',
      is_primary: true,
    };
  } catch (error) {
    console.error('Error fetching primary doctor:', error);
    return {
      doctor_email: 'doctor@example.com',
      doctor_name: 'Default Doctor',
      is_primary: true,
    };
  }
}

/**
 * Get all doctors assigned to a patient
 * @param db Database pool
 * @param patientId Patient UUID
 * @param priorityLevel Alert priority level (CRITICAL, HIGH, MODERATE)
 * @returns Array of doctor assignments
 */
export async function getAllDoctorsForPatient(
  db: Pool,
  patientId: string,
  priorityLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' = 'HIGH'
): Promise<DoctorAssignment[]> {
  try {
    const result = await db.query(
      `SELECT
        dpa.doctor_email,
        dpa.doctor_name,
        dpa.is_primary,
        d.notification_preferences,
        d.email_signature,
        d.facility_name,
        d.is_active
      FROM doctor_patient_assignments dpa
      LEFT JOIN doctors d ON dpa.doctor_email = d.email
      WHERE dpa.patient_id = $1
        AND (d.is_active IS NULL OR d.is_active = true)
      ORDER BY dpa.is_primary DESC, dpa.assigned_at ASC`,
      [patientId]
    );

    if (result.rows.length === 0) {
      // Return default doctor if no assignments found
      return [{
        doctor_email: 'doctor@example.com',
        doctor_name: 'Default Doctor',
        is_primary: true,
      }];
    }

    // Filter based on priority and preferences
    const doctors = result.rows.filter((doc: any) => {
      // Primary doctors always get notified
      if (doc.is_primary) return true;

      // Check notification preferences for non-primary doctors
      const prefs = doc.notification_preferences || {};

      // Critical alerts go to all doctors
      if (priorityLevel === 'CRITICAL') return true;

      // Check if doctor wants to receive this priority level
      const prefKey = priorityLevel.toLowerCase() + '_via';
      return prefs[prefKey] === 'email';
    });

    return doctors.length > 0 ? doctors : result.rows;
  } catch (error) {
    console.error('Error fetching all doctors for patient:', error);
    return [{
      doctor_email: 'doctor@example.com',
      doctor_name: 'Default Doctor',
      is_primary: true,
    }];
  }
}

/**
 * Check if we're in quiet hours for a doctor
 * @param preferences Doctor's notification preferences
 * @returns true if currently in quiet hours
 */
export function isInQuietHours(preferences: any): boolean {
  if (!preferences || !preferences.quiet_hours_enabled) {
    return false;
  }

  const now = new Date();
  const currentTime = now.getHours() * 100 + now.getMinutes(); // e.g., 14:30 = 1430

  const start = parseTimeString(preferences.quiet_hours_start || '22:00');
  const end = parseTimeString(preferences.quiet_hours_end || '07:00');

  if (start < end) {
    // Normal case: 22:00 to 07:00
    return currentTime >= start && currentTime < end;
  } else {
    // Wraps midnight: 22:00 to 07:00
    return currentTime >= start || currentTime < end;
  }
}

/**
 * Parse time string to numeric format
 * @param timeStr Time string like "22:00"
 * @returns Numeric time (e.g., 2200)
 */
function parseTimeString(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 100 + minutes;
}
