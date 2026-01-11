#!/usr/bin/env python3
"""
CKD High-Risk Patient Monitoring System
Scans patient database and identifies patients requiring urgent monitoring
"""

import json
from datetime import datetime
from typing import List, Dict, Any

def assess_patient_risk(patient: Dict[str, Any]) -> Dict[str, Any]:
    """
    Assess a patient's risk level and generate alerts based on clinical criteria.
    
    Args:
        patient: Dictionary containing patient clinical data
        
    Returns:
        Dictionary with risk assessment results and alerts
    """
    alerts = []
    severity_score = 0
    
    # =================================================================
    # CRITICAL ALERTS (10 points each)
    # =================================================================
    
    # 1. Rapid eGFR Decline (>10% decline)
    if patient['eGFRTrend'] == 'down' and patient['eGFRChange'] <= -10:
        alerts.append({
            'severity': 'CRITICAL',
            'code': 'RAPID_DECLINE',
            'message': f"Rapid eGFR decline ({patient['eGFRChange']}%)",
            'action': 'Urgent nephrology referral, investigate reversible causes (AKI, medications, obstruction)'
        })
        severity_score += 10
    
    # 2. Severe CKD Without Specialist (Stage 4-5)
    if patient['ckdStage'] >= 4 and not patient['nephrologistReferral']:
        alerts.append({
            'severity': 'CRITICAL',
            'code': 'NO_SPECIALIST',
            'message': f"Stage {patient['ckdStage']} CKD without nephrologist",
            'action': 'IMMEDIATE nephrology referral - dialysis planning may be needed'
        })
        severity_score += 10
    
    # 3. Dangerous Hyperkalemia (K+ >6.0)
    if patient['potassium'] > 6.0:
        alerts.append({
            'severity': 'CRITICAL',
            'code': 'HYPERKALEMIA',
            'message': f"Severe hyperkalemia (K+ {patient['potassium']} mEq/L)",
            'action': 'IMMEDIATE evaluation - cardiac monitoring, stop K+-sparing agents, consider dialysis'
        })
        severity_score += 10
    
    # 4. Severe Anemia (Hb <9.0 in Stage 3+)
    if patient['hemoglobin'] < 9.0 and patient['ckdStage'] >= 3:
        alerts.append({
            'severity': 'CRITICAL',
            'code': 'SEVERE_ANEMIA',
            'message': f"Severe anemia (Hb {patient['hemoglobin']} g/dL)",
            'action': 'Urgent investigation: iron studies, B12/folate, GI evaluation; consider ESA therapy'
        })
        severity_score += 10
    
    # 5. Nephrotic-Range Proteinuria with Decline
    if patient['uACR'] > 300 and patient['eGFRTrend'] == 'down':
        alerts.append({
            'severity': 'CRITICAL',
            'code': 'NEPHROTIC_DECLINE',
            'message': f"Nephrotic-range proteinuria (uACR {patient['uACR']} mg/g) with declining eGFR",
            'action': 'Urgent nephrology referral - consider kidney biopsy, exclude glomerulonephritis'
        })
        severity_score += 10
    
    # =================================================================
    # HIGH PRIORITY ALERTS (5 points each)
    # =================================================================
    
    # 6. Heavy Proteinuria (A3 category)
    if patient['proteinuriaCategory'] == 'A3' and patient['uACR'] <= 300:  # A3 but not nephrotic
        alerts.append({
            'severity': 'HIGH',
            'code': 'HEAVY_PROTEINURIA',
            'message': f"Heavy proteinuria (A3, uACR {patient['uACR']} mg/g)",
            'action': 'Optimize RAS inhibition (ACE-I/ARB), add SGLT2i if diabetic'
        })
        severity_score += 5
    
    # 7. Uncontrolled Hypertension in Stage 3+
    if (patient['systolicBP'] >= 140 or patient['diastolicBP'] >= 90) and patient['ckdStage'] >= 3:
        alerts.append({
            'severity': 'HIGH',
            'code': 'UNCONTROLLED_HTN',
            'message': f"Uncontrolled hypertension ({patient['systolicBP']}/{patient['diastolicBP']} mmHg)",
            'action': 'Intensify antihypertensive therapy - target <130/80 in CKD with proteinuria'
        })
        severity_score += 5
    
    # 8. Uncontrolled Diabetes (HbA1c >7.5%)
    if patient.get('hba1c', 0) > 7.5 and 'Diabetes' in patient['comorbidities']:
        alerts.append({
            'severity': 'HIGH',
            'code': 'UNCONTROLLED_DM',
            'message': f"Uncontrolled diabetes (HbA1c {patient['hba1c']}%)",
            'action': 'Optimize glycemic control - target HbA1c <7%, strongly consider SGLT2i'
        })
        severity_score += 5
    
    # 9. Hyperphosphatemia in Stage 4+
    if patient['phosphorus'] > 4.5 and patient['ckdStage'] >= 4:
        alerts.append({
            'severity': 'HIGH',
            'code': 'HYPERPHOSPHATEMIA',
            'message': f"Elevated phosphorus ({patient['phosphorus']} mg/dL)",
            'action': 'Dietary counseling (limit high-phosphate foods), initiate phosphate binders'
        })
        severity_score += 5
    
    # 10. Nephrotoxic Medications with Decline
    if patient['nephrotoxicMeds'] and patient['eGFRTrend'] == 'down':
        alerts.append({
            'severity': 'HIGH',
            'code': 'NEPHROTOXIC_MEDS',
            'message': "Nephrotoxic medications with declining kidney function",
            'action': 'URGENT medication review - discontinue/substitute NSAIDs, aminoglycosides, etc.'
        })
        severity_score += 5
    
    # 11. Moderate Anemia (9-11 g/dL in Stage 3+)
    if 9.0 <= patient['hemoglobin'] < 11.0 and patient['ckdStage'] >= 3:
        alerts.append({
            'severity': 'HIGH',
            'code': 'MODERATE_ANEMIA',
            'message': f"Moderate anemia (Hb {patient['hemoglobin']} g/dL)",
            'action': 'Iron studies, address iron deficiency, monitor for progression'
        })
        severity_score += 5
    
    # 12. Moderate Hyperkalemia (5.5-6.0)
    if 5.5 < patient['potassium'] <= 6.0:
        alerts.append({
            'severity': 'HIGH',
            'code': 'MODERATE_HYPERKALEMIA',
            'message': f"Moderate hyperkalemia (K+ {patient['potassium']} mEq/L)",
            'action': 'Dietary counseling, review medications, consider K+ binder if persistent'
        })
        severity_score += 5
    
    # =================================================================
    # MODERATE ALERTS (2 points each)
    # =================================================================
    
    # 13. Missing RAS Inhibitor (proteinuria without ACE-I/ARB)
    if patient['ckdStage'] >= 2 and patient['uACR'] > 30 and not patient['onRASInhibitor']:
        alerts.append({
            'severity': 'MODERATE',
            'code': 'NO_RAS_INHIBITOR',
            'message': "Proteinuria without RAS inhibitor therapy",
            'action': 'Initiate ACE inhibitor or ARB (first-line for proteinuric CKD)'
        })
        severity_score += 2
    
    # 14. Missing SGLT2i in Diabetic CKD
    if 'Diabetes' in patient['comorbidities'] and patient['ckdStage'] >= 2 and not patient['onSGLT2i'] and patient['eGFR'] >= 20:
        alerts.append({
            'severity': 'MODERATE',
            'code': 'NO_SGLT2I',
            'message': "Diabetic CKD without SGLT2 inhibitor",
            'action': 'Consider SGLT2i (empagliflozin/dapagliflozin) - proven renoprotection'
        })
        severity_score += 2
    
    # 15. Obesity (BMI ≥30)
    if patient['bmi'] >= 30 and patient['ckdStage'] >= 2:
        alerts.append({
            'severity': 'MODERATE',
            'code': 'OBESITY',
            'message': f"Obesity (BMI {patient['bmi']} kg/m²)",
            'action': 'Weight management program - target 5-10% weight loss, dietary counseling'
        })
        severity_score += 2
    
    # 16. Active Smoking
    if patient['smokingStatus'] == 'Current' and patient['ckdStage'] >= 2:
        alerts.append({
            'severity': 'MODERATE',
            'code': 'ACTIVE_SMOKING',
            'message': "Active smoker - accelerates CKD progression",
            'action': 'Smoking cessation counseling, pharmacotherapy (varenicline, bupropion)'
        })
        severity_score += 2
    
    # 17. Stage 3+ with declining function but stable
    if patient['ckdStage'] >= 3 and patient['eGFRTrend'] == 'down' and patient['eGFRChange'] < -5:
        alerts.append({
            'severity': 'MODERATE',
            'code': 'PROGRESSIVE_CKD',
            'message': f"Progressive CKD (Stage {patient['ckdStage']}, eGFR declining {patient['eGFRChange']}%)",
            'action': 'Review medications, optimize BP/DM control, ensure nephrology follow-up'
        })
        severity_score += 2
    
    # Determine priority level
    if severity_score >= 20:
        priority = 'CRITICAL'
    elif severity_score >= 10:
        priority = 'HIGH'
    elif severity_score >= 5:
        priority = 'MODERATE'
    else:
        priority = 'LOW'
    
    return {
        'patient_id': patient['id'],
        'name': patient['name'],
        'mrn': patient['mrn'],
        'age': patient['age'],
        'gender': patient['gender'],
        'stage': patient['ckdStage'],
        'egfr': patient['eGFR'],
        'egfr_trend': patient['eGFRTrend'],
        'egfr_change': patient['eGFRChange'],
        'comorbidities': patient['comorbidities'],
        'alerts': alerts,
        'alert_count': len(alerts),
        'severity_score': severity_score,
        'priority': priority,
        'requires_monitoring': len(alerts) > 0
    }


def scan_patient_database(json_file: str) -> Dict[str, Any]:
    """
    Scan entire patient database and identify high-risk patients.
    
    Args:
        json_file: Path to patient database JSON file
        
    Returns:
        Dictionary with scan results and statistics
    """
    # Load patient data
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    patients = data['patients']
    
    # Assess each patient
    results = []
    for patient in patients:
        assessment = assess_patient_risk(patient)
        if assessment['requires_monitoring']:
            results.append(assessment)
    
    # Sort by severity score (highest first)
    results.sort(key=lambda x: x['severity_score'], reverse=True)
    
    # Calculate statistics
    total_patients = len(patients)
    high_risk_count = len(results)
    
    priority_counts = {
        'CRITICAL': sum(1 for r in results if r['priority'] == 'CRITICAL'),
        'HIGH': sum(1 for r in results if r['priority'] == 'HIGH'),
        'MODERATE': sum(1 for r in results if r['priority'] == 'MODERATE'),
    }
    
    # Alert type statistics
    alert_codes = {}
    for result in results:
        for alert in result['alerts']:
            code = alert['code']
            alert_codes[code] = alert_codes.get(code, 0) + 1
    
    return {
        'scan_date': datetime.now().isoformat(),
        'total_patients_scanned': total_patients,
        'high_risk_patients': high_risk_count,
        'high_risk_percentage': round((high_risk_count / total_patients) * 100, 1),
        'priority_distribution': priority_counts,
        'alert_frequency': dict(sorted(alert_codes.items(), key=lambda x: x[1], reverse=True)),
        'patients': results
    }


def generate_report(results: Dict[str, Any], output_file: str):
    """Generate detailed monitoring report."""
    
    with open(output_file, 'w') as f:
        f.write("=" * 80 + "\n")
        f.write("CKD HIGH-RISK PATIENT MONITORING REPORT\n")
        f.write("=" * 80 + "\n\n")
        
        f.write(f"Scan Date: {results['scan_date']}\n")
        f.write(f"Total Patients Scanned: {results['total_patients_scanned']}\n")
        f.write(f"High-Risk Patients Identified: {results['high_risk_patients']} ({results['high_risk_percentage']}%)\n\n")
        
        f.write("PRIORITY DISTRIBUTION:\n")
        f.write("-" * 80 + "\n")
        for priority, count in results['priority_distribution'].items():
            pct = (count / results['high_risk_patients']) * 100 if results['high_risk_patients'] > 0 else 0
            f.write(f"  {priority:12} : {count:3} patients ({pct:5.1f}%)\n")
        
        f.write("\n" + "=" * 80 + "\n")
        f.write("TOP ALERT TYPES (Most Common Issues)\n")
        f.write("=" * 80 + "\n")
        for i, (code, count) in enumerate(list(results['alert_frequency'].items())[:10], 1):
            f.write(f"{i:2}. {code:25} : {count:3} patients\n")
        
        f.write("\n" + "=" * 80 + "\n")
        f.write("CRITICAL PRIORITY PATIENTS (Immediate Action Required)\n")
        f.write("=" * 80 + "\n\n")
        
        critical_patients = [p for p in results['patients'] if p['priority'] == 'CRITICAL']
        
        if critical_patients:
            for patient in critical_patients:
                f.write(f"\n{patient['name']} ({patient['mrn']})\n")
                f.write(f"  Age/Gender: {patient['age']}yo {patient['gender']}\n")
                f.write(f"  CKD Stage: {patient['stage']}, eGFR: {patient['egfr']} mL/min (trend: {patient['egfr_trend']}, {patient['egfr_change']}%)\n")
                f.write(f"  Comorbidities: {', '.join(patient['comorbidities']) if patient['comorbidities'] else 'None'}\n")
                f.write(f"  SEVERITY SCORE: {patient['severity_score']} points\n")
                f.write(f"  ALERTS ({len(patient['alerts'])}):\n")
                
                for alert in patient['alerts']:
                    f.write(f"    [{alert['severity']}] {alert['message']}\n")
                    f.write(f"        → ACTION: {alert['action']}\n")
                f.write("\n" + "-" * 80 + "\n")
        else:
            f.write("  No critical priority patients identified.\n")
        
        f.write("\n" + "=" * 80 + "\n")
        f.write("HIGH PRIORITY PATIENTS (Action Within 1-2 Weeks)\n")
        f.write("=" * 80 + "\n\n")
        
        high_patients = [p for p in results['patients'] if p['priority'] == 'HIGH']
        
        if high_patients:
            for patient in high_patients[:20]:  # Show top 20
                f.write(f"{patient['name']} ({patient['mrn']}) - Stage {patient['stage']}, eGFR {patient['egfr']}\n")
                f.write(f"  Score: {patient['severity_score']} | Alerts: {patient['alert_count']}\n")
                for alert in patient['alerts']:
                    f.write(f"  • [{alert['severity']}] {alert['message']}\n")
                f.write("\n")
            
            if len(high_patients) > 20:
                f.write(f"\n  ... and {len(high_patients) - 20} more high priority patients\n")
        else:
            f.write("  No high priority patients identified.\n")
        
        f.write("\n" + "=" * 80 + "\n")
        f.write("END OF REPORT\n")
        f.write("=" * 80 + "\n")


if __name__ == "__main__":
    # Scan the database
    print("Scanning patient database for high-risk patients...")
    results = scan_patient_database('ckd_patients_dataset.json')
    
    # Save detailed JSON results
    with open('high_risk_patients.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"✓ Scan complete!")
    print(f"✓ {results['high_risk_patients']} high-risk patients identified ({results['high_risk_percentage']}%)")
    print(f"✓ Critical: {results['priority_distribution']['CRITICAL']}")
    print(f"✓ High: {results['priority_distribution']['HIGH']}")
    print(f"✓ Moderate: {results['priority_distribution']['MODERATE']}")
    
    # Generate readable report
    generate_report(results, 'high_risk_monitoring_report.txt')
    print(f"\n✓ Detailed report saved to 'high_risk_monitoring_report.txt'")
    print(f"✓ JSON results saved to 'high_risk_patients.json'")
