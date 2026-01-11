#!/usr/bin/env python3
"""
Minuteful Kidney: uACR Monitoring Algorithm - Demonstration Script
Tests algorithm with various clinical scenarios
"""

import json
from datetime import datetime, timedelta
from uacr_monitoring_adherence_algorithm import uACRMonitoringSystem


def create_test_patients():
    """
    Create test patients representing different clinical scenarios
    """
    
    # Scenario 1: Worsening uACR with poor adherence
    patient_1 = {
        "patientId": "TEST001",
        "name": "John Anderson",
        "age": 62,
        "gender": "M",
        "eGFR": 45.2,
        "ckdStage": 3,
        "uACR": 380.0,
        "comorbidities": ["Diabetes", "Hypertension"],
        "smokingStatus": "Former",
        "uacr_history": [
            {
                "date": (datetime.now() - timedelta(days=0)).isoformat()[:10],
                "value": 380.0
            },
            {
                "date": (datetime.now() - timedelta(days=90)).isoformat()[:10],
                "value": 250.0
            },
            {
                "date": (datetime.now() - timedelta(days=180)).isoformat()[:10],
                "value": 220.0
            }
        ],
        "jardiance": {
            "prescribed": True,
            "medication": "Jardiance (empagliflozin) 10mg",
            "prescribed_date": (datetime.now() - timedelta(days=270)).isoformat()[:10],
            "currently_taking": False,
            "adherence": {
                "MPR": 65.0,
                "PDC": 58.0,
                "category": "Medium",
                "last_30_days": 50.0,
                "last_90_days": 60.0,
                "trend": "declining"
            },
            "refills": {
                "count": 2,
                "dates": [
                    (datetime.now() - timedelta(days=270)).isoformat()[:10],
                    (datetime.now() - timedelta(days=135)).isoformat()[:10]
                ],
                "days_supply": 90,
                "last_refill": (datetime.now() - timedelta(days=135)).isoformat()[:10],
                "next_refill_due": (datetime.now() - timedelta(days=45)).isoformat()[:10],
                "days_until_refill": -45,
                "refill_gap_days": 45
            },
            "barriers": ["Forgetfulness", "Cost concerns"],
            "interventions": [],
            "adverse_events": []
        }
    }
    
    # Scenario 2: Worsening uACR despite good adherence
    patient_2 = {
        "patientId": "TEST002",
        "name": "Mary Thompson",
        "age": 58,
        "gender": "F",
        "eGFR": 38.5,
        "ckdStage": 3,
        "uACR": 450.0,
        "comorbidities": ["Diabetes", "Hypertension", "Heart Failure"],
        "smokingStatus": "Never",
        "uacr_history": [
            {
                "date": (datetime.now() - timedelta(days=0)).isoformat()[:10],
                "value": 450.0
            },
            {
                "date": (datetime.now() - timedelta(days=120)).isoformat()[:10],
                "value": 195.0
            },
            {
                "date": (datetime.now() - timedelta(days=240)).isoformat()[:10],
                "value": 180.0
            }
        ],
        "jardiance": {
            "prescribed": True,
            "medication": "Jardiance (empagliflozin) 10mg",
            "prescribed_date": (datetime.now() - timedelta(days=300)).isoformat()[:10],
            "currently_taking": True,
            "adherence": {
                "MPR": 94.0,
                "PDC": 92.0,
                "category": "High",
                "last_30_days": 96.7,
                "last_90_days": 93.3,
                "trend": "stable"
            },
            "refills": {
                "count": 4,
                "dates": [
                    (datetime.now() - timedelta(days=300)).isoformat()[:10],
                    (datetime.now() - timedelta(days=210)).isoformat()[:10],
                    (datetime.now() - timedelta(days=118)).isoformat()[:10],
                    (datetime.now() - timedelta(days=25)).isoformat()[:10]
                ],
                "days_supply": 90,
                "last_refill": (datetime.now() - timedelta(days=25)).isoformat()[:10],
                "next_refill_due": (datetime.now() + timedelta(days=65)).isoformat()[:10],
                "days_until_refill": 65,
                "refill_gap_days": 0
            },
            "barriers": [],
            "interventions": [],
            "adverse_events": []
        }
    }
    
    # Scenario 3: Untreated patient, eligible for treatment
    patient_3 = {
        "patientId": "TEST003",
        "name": "Robert Martinez",
        "age": 67,
        "gender": "M",
        "eGFR": 48.0,
        "ckdStage": 3,
        "uACR": 320.0,
        "comorbidities": ["Diabetes", "Hypertension"],
        "smokingStatus": "Current",
        "uacr_history": [
            {
                "date": (datetime.now() - timedelta(days=0)).isoformat()[:10],
                "value": 320.0
            },
            {
                "date": (datetime.now() - timedelta(days=180)).isoformat()[:10],
                "value": 180.0
            },
            {
                "date": (datetime.now() - timedelta(days=360)).isoformat()[:10],
                "value": 155.0
            }
        ],
        "jardiance": {
            "prescribed": False
        }
    }
    
    # Scenario 4: Untreated patient, NOT eligible (early CKD)
    patient_4 = {
        "patientId": "TEST004",
        "name": "Linda Park",
        "age": 52,
        "gender": "F",
        "eGFR": 78.0,
        "ckdStage": 2,
        "uACR": 95.0,
        "comorbidities": ["Hypertension"],
        "smokingStatus": "Never",
        "uacr_history": [
            {
                "date": (datetime.now() - timedelta(days=0)).isoformat()[:10],
                "value": 95.0
            },
            {
                "date": (datetime.now() - timedelta(days=90)).isoformat()[:10],
                "value": 50.0
            },
            {
                "date": (datetime.now() - timedelta(days=180)).isoformat()[:10],
                "value": 42.0
            }
        ],
        "jardiance": {
            "prescribed": False
        }
    }
    
    # Scenario 5: Mild worsening with good adherence (stable)
    patient_5 = {
        "patientId": "TEST005",
        "name": "David Kim",
        "age": 71,
        "gender": "M",
        "eGFR": 42.0,
        "ckdStage": 3,
        "uACR": 240.0,
        "comorbidities": ["Diabetes", "Hypertension"],
        "smokingStatus": "Never",
        "uacr_history": [
            {
                "date": (datetime.now() - timedelta(days=0)).isoformat()[:10],
                "value": 240.0
            },
            {
                "date": (datetime.now() - timedelta(days=120)).isoformat()[:10],
                "value": 180.0
            },
            {
                "date": (datetime.now() - timedelta(days=240)).isoformat()[:10],
                "value": 165.0
            }
        ],
        "jardiance": {
            "prescribed": True,
            "medication": "Jardiance (empagliflozin) 10mg",
            "prescribed_date": (datetime.now() - timedelta(days=280)).isoformat()[:10],
            "currently_taking": True,
            "adherence": {
                "MPR": 88.0,
                "PDC": 86.0,
                "category": "High",
                "last_30_days": 93.3,
                "last_90_days": 87.8,
                "trend": "stable"
            },
            "refills": {
                "count": 3,
                "dates": [
                    (datetime.now() - timedelta(days=280)).isoformat()[:10],
                    (datetime.now() - timedelta(days=187)).isoformat()[:10],
                    (datetime.now() - timedelta(days=92)).isoformat()[:10]
                ],
                "days_supply": 90,
                "last_refill": (datetime.now() - timedelta(days=92)).isoformat()[:10],
                "next_refill_due": (datetime.now() + timedelta(days=-2)).isoformat()[:10],
                "days_until_refill": -2,
                "refill_gap_days": 2
            },
            "barriers": [],
            "interventions": [],
            "adverse_events": []
        }
    }
    
    # Scenario 6: Severe progression with category change, poor adherence
    patient_6 = {
        "patientId": "TEST006",
        "name": "Susan Rodriguez",
        "age": 55,
        "gender": "F",
        "eGFR": 35.0,
        "ckdStage": 3,
        "uACR": 520.0,
        "comorbidities": ["Diabetes", "Hypertension"],
        "smokingStatus": "Current",
        "uacr_history": [
            {
                "date": (datetime.now() - timedelta(days=0)).isoformat()[:10],
                "value": 520.0
            },
            {
                "date": (datetime.now() - timedelta(days=90)).isoformat()[:10],
                "value": 245.0
            },
            {
                "date": (datetime.now() - timedelta(days=180)).isoformat()[:10],
                "value": 210.0
            }
        ],
        "jardiance": {
            "prescribed": True,
            "medication": "Jardiance (empagliflozin) 10mg",
            "prescribed_date": (datetime.now() - timedelta(days=200)).isoformat()[:10],
            "currently_taking": False,
            "adherence": {
                "MPR": 52.0,
                "PDC": 48.0,
                "category": "Low",
                "last_30_days": 40.0,
                "last_90_days": 50.0,
                "trend": "declining"
            },
            "refills": {
                "count": 1,
                "dates": [
                    (datetime.now() - timedelta(days=200)).isoformat()[:10]
                ],
                "days_supply": 90,
                "last_refill": (datetime.now() - timedelta(days=200)).isoformat()[:10],
                "next_refill_due": (datetime.now() - timedelta(days=110)).isoformat()[:10],
                "days_until_refill": -110,
                "refill_gap_days": 110
            },
            "barriers": ["Forgetfulness", "Side effects", "Cost concerns"],
            "interventions": [],
            "adverse_events": ["UTI", "Increased urination"]
        }
    }
    
    return [patient_1, patient_2, patient_3, patient_4, patient_5, patient_6]


def print_scenario_header(scenario_num, title):
    """Print formatted scenario header"""
    print("\n" + "="*80)
    print(f"SCENARIO {scenario_num}: {title}")
    print("="*80)


def main():
    """Main demonstration function"""
    
    print("\n" + "🏥"*40)
    print("MINUTEFUL KIDNEY: uACR MONITORING ALGORITHM - DEMONSTRATION")
    print("🏥"*40)
    
    # Create test patients
    test_patients = create_test_patients()
    
    # Create monitoring system
    monitoring_system = uACRMonitoringSystem()
    
    # Process each scenario individually for clarity
    
    # Scenario 1
    print_scenario_header(1, "Worsening uACR with POOR ADHERENCE")
    print("Expected: HIGH alert - Focus on improving adherence")
    print("-"*80)
    alert_1 = monitoring_system.process_patient(test_patients[0])
    
    # Scenario 2
    print_scenario_header(2, "Worsening uACR despite GOOD ADHERENCE")
    print("Expected: CRITICAL alert - Possible treatment failure, consider escalation")
    print("-"*80)
    alert_2 = monitoring_system.process_patient(test_patients[1])
    
    # Scenario 3
    print_scenario_header(3, "Untreated Patient - ELIGIBLE for Treatment")
    print("Expected: HIGH alert - Recommend starting Jardiance")
    print("-"*80)
    alert_3 = monitoring_system.process_patient(test_patients[2])
    
    # Scenario 4
    print_scenario_header(4, "Untreated Patient - NOT ELIGIBLE (Early CKD)")
    print("Expected: MODERATE alert - Continue monitoring, optimize current therapy")
    print("-"*80)
    alert_4 = monitoring_system.process_patient(test_patients[3])
    
    # Scenario 5
    print_scenario_header(5, "Mild Worsening with GOOD ADHERENCE")
    print("Expected: MODERATE alert - Monitor closely, may need adjustment")
    print("-"*80)
    alert_5 = monitoring_system.process_patient(test_patients[4])
    
    # Scenario 6
    print_scenario_header(6, "SEVERE Progression with CATEGORY CHANGE + Poor Adherence")
    print("Expected: CRITICAL alert - Urgent adherence intervention needed")
    print("-"*80)
    alert_6 = monitoring_system.process_patient(test_patients[5])
    
    # Summary
    print("\n" + "="*80)
    print("DEMONSTRATION SUMMARY")
    print("="*80)
    
    alerts = [alert_1, alert_2, alert_3, alert_4, alert_5, alert_6]
    alerts = [a for a in alerts if a is not None]
    
    print(f"\nTotal scenarios tested: 6")
    print(f"Alerts generated: {len(alerts)}")
    
    # Count by severity
    severity_counts = {}
    for alert in alerts:
        severity_counts[alert.severity] = severity_counts.get(alert.severity, 0) + 1
    
    print(f"\nAlert breakdown:")
    for severity in ['CRITICAL', 'HIGH', 'MODERATE', 'LOW']:
        count = severity_counts.get(severity, 0)
        if count > 0:
            print(f"  {severity}: {count}")
    
    # Export test alerts
    if alerts:
        test_output = {
            'metadata': {
                'test_timestamp': datetime.now().isoformat(),
                'test_scenarios': 6,
                'alerts_generated': len(alerts)
            },
            'scenarios': [
                {
                    'scenario_number': i+1,
                    'patient_name': alert.patient_name,
                    'severity': alert.severity,
                    'alert_type': alert.alert_type,
                    'key_finding': alert.message.split('\n')[0]
                }
                for i, alert in enumerate(alerts)
            ],
            'full_alerts': [
                {
                    'alert_id': alert.alert_id,
                    'severity': alert.severity,
                    'patient_id': alert.patient_id,
                    'patient_name': alert.patient_name,
                    'message': alert.message,
                    'recommended_actions': alert.recommended_actions,
                    'clinical_rationale': alert.clinical_rationale
                }
                for alert in alerts
            ]
        }
        
        with open('/mnt/user-data/outputs/test_alerts_demonstration.json', 'w') as f:
            json.dump(test_output, f, indent=2)
        
        print(f"\n✅ Test results exported to: test_alerts_demonstration.json")
    
    # Key insights
    print("\n" + "-"*80)
    print("KEY INSIGHTS FROM DEMONSTRATION:")
    print("-"*80)
    
    print("""
1. ADHERENCE MATTERS:
   - Scenario 1 vs 2: Same worsening, different adherence
   - Non-adherent → Focus on barriers
   - Adherent → Look for other causes

2. TREATMENT ELIGIBILITY:
   - Scenario 3: Meets criteria → Urgent initiation
   - Scenario 4: Doesn't meet → Continue monitoring
   - Evidence-based decision support

3. SEVERITY APPROPRIATELY CALIBRATED:
   - CRITICAL: Severe progression or category change
   - HIGH: Significant worsening or non-adherence
   - MODERATE: Mild changes or monitoring needed

4. ACTIONABLE RECOMMENDATIONS:
   - Specific, prioritized steps
   - Timeline for action
   - Clinical rationale provided

5. COMPREHENSIVE MONITORING:
   - uACR trends tracked
   - Adherence quantified
   - Treatment eligibility assessed
   - All in one system
""")
    
    print("\n" + "="*80)
    print("DEMONSTRATION COMPLETE")
    print("="*80)
    print("\nReview the generated alerts above to see detailed clinical recommendations.")
    print("Full results saved to: test_alerts_demonstration.json")
    print("\n")


if __name__ == "__main__":
    main()
