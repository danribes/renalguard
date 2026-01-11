#!/usr/bin/env python3
"""
Minuteful Kidney: uACR Monitoring & Treatment Adherence Algorithm
Monitors uACR changes, evaluates adherence, and provides treatment recommendations
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class uACRCategory(Enum):
    """uACR categories based on clinical guidelines"""
    NORMOALBUMINURIA = "Normoalbuminuria (<30 mg/g)"
    MICROALBUMINURIA = "Microalbuminuria (30-300 mg/g)"
    MACROALBUMINURIA = "Macroalbuminuria (>300 mg/g)"


class WorseningLevel(Enum):
    """Severity levels for uACR worsening"""
    NO_CHANGE = "No significant change"
    MILD = "Mild worsening (30-50% increase)"
    MODERATE = "Moderate worsening (50-100% increase)"
    SEVERE = "Severe worsening (>100% increase)"
    CATEGORY_PROGRESSION = "Category progression"


class TreatmentRecommendation(Enum):
    """Treatment recommendation levels"""
    CONTINUE_MONITORING = "Continue monitoring"
    CONSIDER_TREATMENT = "Consider initiating treatment"
    STRONGLY_RECOMMEND = "Strongly recommend treatment initiation"
    URGENT_TREATMENT = "Urgent treatment initiation required"


@dataclass
class uACRAnalysis:
    """Results of uACR analysis"""
    patient_id: str
    patient_name: str
    current_uacr: float
    previous_uacr: float
    percent_change: float
    current_category: uACRCategory
    previous_category: uACRCategory
    worsening_level: WorseningLevel
    is_worsening: bool
    date_current: str
    date_previous: str
    days_between: int


@dataclass
class AdherenceAnalysis:
    """Results of adherence analysis"""
    on_treatment: bool
    medication: Optional[str]
    mpr: Optional[float]
    pdc: Optional[float]
    adherence_category: Optional[str]
    last_30_days: Optional[float]
    last_90_days: Optional[float]
    refill_gap_days: Optional[int]
    is_adherent: bool
    barriers: List[str]
    interventions: List[str]


@dataclass
class ClinicalAlert:
    """Clinical alert for physician"""
    alert_id: str
    severity: str
    patient_id: str
    patient_name: str
    alert_type: str
    message: str
    uacr_analysis: uACRAnalysis
    adherence_analysis: Optional[AdherenceAnalysis]
    treatment_recommendation: Optional[TreatmentRecommendation]
    recommended_actions: List[str]
    clinical_rationale: str
    timestamp: str


class uACRMonitoringSystem:
    """Main system for monitoring uACR changes and adherence"""
    
    def __init__(self):
        self.alerts = []
        
    @staticmethod
    def categorize_uacr(uacr_value: float) -> uACRCategory:
        """Categorize uACR value into clinical categories"""
        if uacr_value < 30:
            return uACRCategory.NORMOALBUMINURIA
        elif uacr_value <= 300:
            return uACRCategory.MICROALBUMINURIA
        else:
            return uACRCategory.MACROALBUMINURIA
    
    @staticmethod
    def calculate_mpr(refill_dates: List[str], days_supply: int, period_days: int) -> float:
        """
        Calculate Medication Possession Ratio (MPR)
        MPR = (Total days of medication supplied / Days in period) × 100
        """
        if not refill_dates:
            return 0.0
        
        total_days_supplied = len(refill_dates) * days_supply
        mpr = (total_days_supplied / period_days) * 100
        
        return min(mpr, 100.0)
    
    @staticmethod
    def calculate_pdc(refill_dates: List[str], days_supply: int, 
                     start_date: str, end_date: str) -> float:
        """
        Calculate Proportion of Days Covered (PDC)
        More accurate than MPR - accounts for overlapping fills
        """
        if not refill_dates:
            return 0.0
        
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        period_days = (end - start).days
        
        if period_days <= 0:
            return 0.0
        
        # Create a set of covered days
        covered_days = set()
        
        for refill_date_str in refill_dates:
            refill_date = datetime.fromisoformat(refill_date_str)
            # Add each day covered by this refill
            for i in range(days_supply):
                day = refill_date + timedelta(days=i)
                if start <= day <= end:
                    covered_days.add(day.date())
        
        pdc = (len(covered_days) / period_days) * 100
        return min(pdc, 100.0)
    
    def analyze_uacr_change(self, patient: Dict[str, Any]) -> Optional[uACRAnalysis]:
        """
        Analyze uACR changes for a patient
        Returns uACRAnalysis if new data detected, None otherwise
        """
        # Check if patient has uACR history
        if 'uacr_history' not in patient or len(patient['uacr_history']) < 2:
            return None
        
        # Get current (most recent) and previous uACR values
        uacr_history = sorted(patient['uacr_history'], 
                             key=lambda x: x['date'], 
                             reverse=True)
        
        current = uacr_history[0]
        previous = uacr_history[1]
        
        current_value = current['value']
        previous_value = previous['value']
        
        # Calculate change
        percent_change = ((current_value - previous_value) / previous_value) * 100
        
        # Categorize
        current_category = self.categorize_uacr(current_value)
        previous_category = self.categorize_uacr(previous_value)
        
        # Determine worsening level
        is_worsening = current_value > previous_value
        
        if not is_worsening:
            worsening_level = WorseningLevel.NO_CHANGE
        elif current_category != previous_category:
            worsening_level = WorseningLevel.CATEGORY_PROGRESSION
        elif percent_change > 100:
            worsening_level = WorseningLevel.SEVERE
        elif percent_change > 50:
            worsening_level = WorseningLevel.MODERATE
        elif percent_change > 30:
            worsening_level = WorseningLevel.MILD
        else:
            worsening_level = WorseningLevel.NO_CHANGE
            is_worsening = False
        
        # Calculate days between measurements
        date_current = datetime.fromisoformat(current['date'])
        date_previous = datetime.fromisoformat(previous['date'])
        days_between = (date_current - date_previous).days
        
        return uACRAnalysis(
            patient_id=patient['patientId'],
            patient_name=patient['name'],
            current_uacr=current_value,
            previous_uacr=previous_value,
            percent_change=percent_change,
            current_category=current_category,
            previous_category=previous_category,
            worsening_level=worsening_level,
            is_worsening=is_worsening,
            date_current=current['date'],
            date_previous=previous['date'],
            days_between=days_between
        )
    
    def analyze_adherence(self, patient: Dict[str, Any]) -> AdherenceAnalysis:
        """
        Analyze medication adherence for patients on treatment
        """
        # Check if patient is on Jardiance
        if 'jardiance' not in patient or not patient['jardiance'].get('prescribed', False):
            return AdherenceAnalysis(
                on_treatment=False,
                medication=None,
                mpr=None,
                pdc=None,
                adherence_category=None,
                last_30_days=None,
                last_90_days=None,
                refill_gap_days=None,
                is_adherent=False,
                barriers=[],
                interventions=[]
            )
        
        jardiance_data = patient['jardiance']
        adherence_data = jardiance_data.get('adherence', {})
        refill_data = jardiance_data.get('refills', {})
        
        # Extract adherence metrics
        mpr = adherence_data.get('MPR', 0)
        pdc = adherence_data.get('PDC', 0)
        adherence_category = adherence_data.get('category', 'Unknown')
        last_30_days = adherence_data.get('last_30_days', 0)
        last_90_days = adherence_data.get('last_90_days', 0)
        refill_gap_days = refill_data.get('refill_gap_days', 0)
        
        # Determine if adherent (using 80% MPR threshold - clinical standard)
        is_adherent = mpr >= 80 and refill_gap_days <= 7
        
        barriers = jardiance_data.get('barriers', [])
        interventions = jardiance_data.get('interventions', [])
        
        return AdherenceAnalysis(
            on_treatment=True,
            medication=jardiance_data.get('medication', 'Jardiance'),
            mpr=mpr,
            pdc=pdc,
            adherence_category=adherence_category,
            last_30_days=last_30_days,
            last_90_days=last_90_days,
            refill_gap_days=refill_gap_days,
            is_adherent=is_adherent,
            barriers=barriers,
            interventions=interventions
        )
    
    def evaluate_treatment_eligibility(self, patient: Dict[str, Any]) -> Tuple[bool, TreatmentRecommendation, str]:
        """
        Evaluate if untreated patient should be started on Jardiance
        Based on KDIGO/EMPA-KIDNEY criteria
        """
        egfr = patient.get('eGFR', 0)
        ckd_stage = patient.get('ckdStage', 0)
        uacr = patient.get('uACR', 0)
        comorbidities = patient.get('comorbidities', [])
        has_diabetes = 'Diabetes' in comorbidities
        
        # JARDIANCE ELIGIBILITY CRITERIA:
        # 1. eGFR 20-75 mL/min/1.73m²
        # 2a. Diabetic CKD Stage 2+ OR
        # 2b. Non-diabetic CKD Stage 3+ with uACR ≥200 mg/g
        # 3. On stable RAS inhibitor (assumed in this dataset)
        
        reasons = []
        
        # Check eGFR range
        if egfr < 20:
            return False, TreatmentRecommendation.CONTINUE_MONITORING, \
                   "eGFR <20 mL/min - below approved range for Jardiance"
        elif egfr > 75:
            # Early CKD - may still benefit if other criteria met
            pass
        
        # Primary eligibility check
        eligible = False
        recommendation_level = TreatmentRecommendation.CONTINUE_MONITORING
        
        if has_diabetes and ckd_stage >= 2:
            eligible = True
            reasons.append(f"Diabetic CKD Stage {ckd_stage}")
            
            if uacr >= 300:
                recommendation_level = TreatmentRecommendation.URGENT_TREATMENT
                reasons.append(f"Macroalbuminuria (uACR {uacr:.0f} mg/g)")
            elif uacr >= 200:
                recommendation_level = TreatmentRecommendation.STRONGLY_RECOMMEND
                reasons.append(f"Significant albuminuria (uACR {uacr:.0f} mg/g)")
            elif uacr >= 30:
                recommendation_level = TreatmentRecommendation.STRONGLY_RECOMMEND
                reasons.append(f"Microalbuminuria (uACR {uacr:.0f} mg/g)")
            else:
                recommendation_level = TreatmentRecommendation.CONSIDER_TREATMENT
                
        elif not has_diabetes and ckd_stage >= 3 and uacr >= 200:
            eligible = True
            reasons.append(f"Non-diabetic CKD Stage {ckd_stage}")
            
            if uacr >= 300:
                recommendation_level = TreatmentRecommendation.URGENT_TREATMENT
                reasons.append(f"Macroalbuminuria (uACR {uacr:.0f} mg/g)")
            else:
                recommendation_level = TreatmentRecommendation.STRONGLY_RECOMMEND
                reasons.append(f"Significant albuminuria (uACR {uacr:.0f} mg/g)")
        
        # Additional risk factors that strengthen recommendation
        if eligible:
            if 'Hypertension' in comorbidities:
                reasons.append("Hypertension present (additional CV benefit)")
            if 'Heart Failure' in comorbidities:
                reasons.append("Heart failure present (additional cardioprotection)")
            if ckd_stage >= 4:
                reasons.append(f"Advanced CKD Stage {ckd_stage} (urgent need for nephroprotection)")
                recommendation_level = TreatmentRecommendation.URGENT_TREATMENT
        
        rationale = "; ".join(reasons) if reasons else "Does not meet treatment criteria"
        
        return eligible, recommendation_level, rationale
    
    def generate_clinical_alert(self, patient: Dict[str, Any], 
                               uacr_analysis: uACRAnalysis,
                               adherence_analysis: Optional[AdherenceAnalysis]) -> ClinicalAlert:
        """
        Generate comprehensive clinical alert for physician
        """
        alert_id = f"ALERT-{patient['patientId']}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Determine alert severity
        if uacr_analysis.worsening_level == WorseningLevel.SEVERE:
            severity = "CRITICAL"
        elif uacr_analysis.worsening_level == WorseningLevel.CATEGORY_PROGRESSION:
            severity = "HIGH"
        elif uacr_analysis.worsening_level == WorseningLevel.MODERATE:
            severity = "HIGH"
        elif uacr_analysis.worsening_level == WorseningLevel.MILD:
            severity = "MODERATE"
        else:
            severity = "LOW"
        
        # Build alert message
        if adherence_analysis and adherence_analysis.on_treatment:
            alert_type = "UACR_WORSENING_ON_TREATMENT"
            
            if not adherence_analysis.is_adherent:
                message = (f"⚠️ uACR WORSENING WITH POOR ADHERENCE\n"
                          f"Patient {uacr_analysis.patient_name} shows {uacr_analysis.worsening_level.value} "
                          f"({uacr_analysis.percent_change:+.1f}%) despite being prescribed {adherence_analysis.medication}. "
                          f"Current adherence: {adherence_analysis.adherence_category} (MPR: {adherence_analysis.mpr:.1f}%)")
            else:
                message = (f"⚠️ uACR WORSENING DESPITE GOOD ADHERENCE\n"
                          f"Patient {uacr_analysis.patient_name} shows {uacr_analysis.worsening_level.value} "
                          f"({uacr_analysis.percent_change:+.1f}%) despite good adherence to {adherence_analysis.medication} "
                          f"(MPR: {adherence_analysis.mpr:.1f}%). Consider treatment adjustment or additional evaluation.")
        else:
            alert_type = "UACR_WORSENING_UNTREATED"
            
            # Evaluate treatment eligibility
            eligible, recommendation, rationale = self.evaluate_treatment_eligibility(patient)
            
            message = (f"⚠️ uACR WORSENING IN UNTREATED PATIENT\n"
                      f"Patient {uacr_analysis.patient_name} shows {uacr_analysis.worsening_level.value} "
                      f"({uacr_analysis.percent_change:+.1f}%) and is not currently on CKD-specific treatment.")
        
        # Generate recommended actions
        recommended_actions = self._generate_recommended_actions(
            patient, uacr_analysis, adherence_analysis
        )
        
        # Generate clinical rationale
        clinical_rationale = self._generate_clinical_rationale(
            patient, uacr_analysis, adherence_analysis
        )
        
        # Determine treatment recommendation for untreated patients
        treatment_recommendation = None
        if not (adherence_analysis and adherence_analysis.on_treatment):
            _, treatment_recommendation, _ = self.evaluate_treatment_eligibility(patient)
        
        return ClinicalAlert(
            alert_id=alert_id,
            severity=severity,
            patient_id=patient['patientId'],
            patient_name=uacr_analysis.patient_name,
            alert_type=alert_type,
            message=message,
            uacr_analysis=uacr_analysis,
            adherence_analysis=adherence_analysis,
            treatment_recommendation=treatment_recommendation,
            recommended_actions=recommended_actions,
            clinical_rationale=clinical_rationale,
            timestamp=datetime.now().isoformat()
        )
    
    def _generate_recommended_actions(self, patient: Dict[str, Any],
                                     uacr_analysis: uACRAnalysis,
                                     adherence_analysis: Optional[AdherenceAnalysis]) -> List[str]:
        """Generate specific recommended actions for physician"""
        actions = []
        
        if adherence_analysis and adherence_analysis.on_treatment:
            # Patient is on treatment
            if not adherence_analysis.is_adherent:
                actions.append(f"🎯 IMMEDIATE: Address medication adherence - Current MPR: {adherence_analysis.mpr:.1f}%")
                
                if adherence_analysis.refill_gap_days > 7:
                    actions.append(f"📞 URGENT: Patient has {adherence_analysis.refill_gap_days}-day refill gap - Contact patient today")
                
                if adherence_analysis.barriers:
                    actions.append(f"🔍 Identified barriers: {', '.join(adherence_analysis.barriers)}")
                    actions.append("💡 Implement targeted interventions to address barriers")
                else:
                    actions.append("🔍 Schedule adherence counseling to identify barriers")
                
                actions.append("📱 Consider smart pill bottle or medication reminder app")
                
            else:
                # Good adherence but worsening uACR
                actions.append("✅ Adherence is good (MPR ≥80%) - Treatment failure or progression")
                actions.append("🔬 Consider additional diagnostic evaluation:")
                actions.append("   • Repeat uACR in 1-2 weeks to confirm")
                actions.append("   • Review blood pressure control")
                actions.append("   • Assess dietary sodium intake")
                actions.append("   • Evaluate for acute illness or dehydration")
                
                if uacr_analysis.current_uacr >= 300:
                    actions.append("⚠️ Consider adding/optimizing:")
                    actions.append("   • Mineralocorticoid receptor antagonist (finerenone)")
                    actions.append("   • GLP-1 receptor agonist if diabetic")
                    actions.append("   • Referral to nephrologist")
        
        else:
            # Patient not on treatment
            eligible, recommendation, rationale = self.evaluate_treatment_eligibility(patient)
            
            if eligible:
                if recommendation == TreatmentRecommendation.URGENT_TREATMENT:
                    actions.append("🚨 URGENT: Initiate Jardiance (empagliflozin) 10mg daily")
                    actions.append(f"📋 Clinical indication: {rationale}")
                    actions.append("⚠️ Evidence: 28% reduction in CKD progression (EMPA-KIDNEY trial)")
                    actions.append("📅 Schedule follow-up in 2-4 weeks to assess tolerance")
                    
                elif recommendation == TreatmentRecommendation.STRONGLY_RECOMMEND:
                    actions.append("⚡ STRONGLY RECOMMEND: Initiate Jardiance (empagliflozin) 10mg daily")
                    actions.append(f"📋 Clinical indication: {rationale}")
                    actions.append("💊 Expected benefit: 50% slower eGFR decline, 26+ year dialysis delay")
                    
                else:  # CONSIDER_TREATMENT
                    actions.append("💭 CONSIDER: Jardiance (empagliflozin) may provide benefit")
                    actions.append(f"📋 Rationale: {rationale}")
                    actions.append("📊 Discuss risks/benefits with patient")
            else:
                actions.append("📊 Continue monitoring - Does not yet meet treatment criteria")
                actions.append("📅 Repeat uACR in 3 months")
                actions.append("🔍 Optimize blood pressure and RAS inhibitor therapy")
                actions.append("🥗 Reinforce lifestyle modifications (diet, exercise, smoking cessation)")
        
        # Common actions for all worsening cases
        actions.append(f"📈 Trend monitoring: uACR {uacr_analysis.previous_uacr:.0f} → {uacr_analysis.current_uacr:.0f} mg/g ({uacr_analysis.percent_change:+.1f}%)")
        actions.append(f"🔄 Schedule next uACR check in {'2-4 weeks' if uacr_analysis.worsening_level != WorseningLevel.MILD else '1-2 months'}")
        
        return actions
    
    def _generate_clinical_rationale(self, patient: Dict[str, Any],
                                    uacr_analysis: uACRAnalysis,
                                    adherence_analysis: Optional[AdherenceAnalysis]) -> str:
        """Generate detailed clinical rationale"""
        rationale_parts = []
        
        # uACR change description
        rationale_parts.append(
            f"Patient shows {uacr_analysis.worsening_level.value.lower()} "
            f"with uACR increasing from {uacr_analysis.previous_uacr:.0f} to "
            f"{uacr_analysis.current_uacr:.0f} mg/g ({uacr_analysis.percent_change:+.1f}%) "
            f"over {uacr_analysis.days_between} days."
        )
        
        # Category change
        if uacr_analysis.current_category != uacr_analysis.previous_category:
            rationale_parts.append(
                f"Progression from {uacr_analysis.previous_category.value} to "
                f"{uacr_analysis.current_category.value} indicates advancing kidney disease."
            )
        
        # Clinical context
        egfr = patient.get('eGFR', 0)
        ckd_stage = patient.get('ckdStage', 0)
        rationale_parts.append(
            f"Current kidney function: eGFR {egfr:.1f} mL/min/1.73m² (CKD Stage {ckd_stage})."
        )
        
        # Treatment context
        if adherence_analysis and adherence_analysis.on_treatment:
            if adherence_analysis.is_adherent:
                rationale_parts.append(
                    f"Despite good adherence to {adherence_analysis.medication} "
                    f"(MPR: {adherence_analysis.mpr:.1f}%, PDC: {adherence_analysis.pdc:.1f}%), "
                    f"proteinuria is worsening. This may indicate treatment resistance, "
                    f"progressive disease, or need for additional therapies."
                )
            else:
                rationale_parts.append(
                    f"Poor adherence to {adherence_analysis.medication} "
                    f"(MPR: {adherence_analysis.mpr:.1f}%) is likely contributing to disease progression. "
                    f"Improving adherence is critical to achieving therapeutic benefit "
                    f"(28% reduction in CKD progression with good adherence)."
                )
                
                if adherence_analysis.refill_gap_days > 30:
                    rationale_parts.append(
                        f"Patient has been without medication for {adherence_analysis.refill_gap_days} days, "
                        f"eliminating any protective benefit."
                    )
        else:
            eligible, recommendation, elig_rationale = self.evaluate_treatment_eligibility(patient)
            if eligible:
                rationale_parts.append(
                    f"Patient meets criteria for SGLT2 inhibitor therapy. {elig_rationale}. "
                    f"EMPA-KIDNEY trial demonstrated 28% reduction in kidney disease progression "
                    f"and 50% slower eGFR decline with empagliflozin."
                )
            else:
                rationale_parts.append(
                    f"Patient does not currently meet criteria for Jardiance therapy. "
                    f"Continue optimizing blood pressure control and RAS inhibition. "
                    f"Monitor closely for disease progression."
                )
        
        return " ".join(rationale_parts)
    
    def process_patient(self, patient: Dict[str, Any]) -> Optional[ClinicalAlert]:
        """
        Main processing function for a single patient
        Returns ClinicalAlert if action needed, None otherwise
        """
        # Step 1: Analyze uACR changes
        uacr_analysis = self.analyze_uacr_change(patient)
        
        if not uacr_analysis or not uacr_analysis.is_worsening:
            return None  # No worsening detected
        
        # Step 2: Analyze adherence (if on treatment)
        adherence_analysis = self.analyze_adherence(patient)
        
        # Step 3: Generate clinical alert
        alert = self.generate_clinical_alert(patient, uacr_analysis, adherence_analysis)
        
        self.alerts.append(alert)
        return alert
    
    def process_database(self, patients: List[Dict[str, Any]]) -> List[ClinicalAlert]:
        """
        Process entire patient database and generate alerts
        """
        self.alerts = []
        
        print(f"\n{'='*80}")
        print("MINUTEFUL KIDNEY: uACR MONITORING & ADHERENCE ANALYSIS")
        print(f"{'='*80}\n")
        print(f"Processing {len(patients)} patients...\n")
        
        for patient in patients:
            alert = self.process_patient(patient)
            
            if alert:
                self._print_alert(alert)
        
        print(f"\n{'='*80}")
        print(f"SUMMARY: {len(self.alerts)} alerts generated")
        print(f"{'='*80}\n")
        
        return self.alerts
    
    def _print_alert(self, alert: ClinicalAlert):
        """Print formatted alert to console"""
        severity_icons = {
            'CRITICAL': '🔴',
            'HIGH': '🟠',
            'MODERATE': '🟡',
            'LOW': '🟢'
        }
        
        print(f"\n{severity_icons[alert.severity]} {alert.severity} ALERT: {alert.alert_id}")
        print(f"{'─'*80}")
        print(f"Patient: {alert.patient_name} (ID: {alert.patient_id})")
        print(f"Timestamp: {alert.timestamp}")
        print(f"\n{alert.message}\n")
        
        print(f"📊 uACR ANALYSIS:")
        print(f"   Previous: {alert.uacr_analysis.previous_uacr:.0f} mg/g ({alert.uacr_analysis.date_previous})")
        print(f"   Current:  {alert.uacr_analysis.current_uacr:.0f} mg/g ({alert.uacr_analysis.date_current})")
        print(f"   Change:   {alert.uacr_analysis.percent_change:+.1f}% over {alert.uacr_analysis.days_between} days")
        print(f"   Category: {alert.uacr_analysis.previous_category.value} → {alert.uacr_analysis.current_category.value}")
        
        if alert.adherence_analysis and alert.adherence_analysis.on_treatment:
            print(f"\n💊 ADHERENCE ANALYSIS:")
            print(f"   Medication: {alert.adherence_analysis.medication}")
            print(f"   MPR: {alert.adherence_analysis.mpr:.1f}%")
            print(f"   PDC: {alert.adherence_analysis.pdc:.1f}%")
            print(f"   Category: {alert.adherence_analysis.adherence_category}")
            print(f"   Last 30 days: {alert.adherence_analysis.last_30_days:.1f}%")
            print(f"   Last 90 days: {alert.adherence_analysis.last_90_days:.1f}%")
            print(f"   Refill gap: {alert.adherence_analysis.refill_gap_days} days")
            print(f"   Status: {'✅ ADHERENT' if alert.adherence_analysis.is_adherent else '❌ NON-ADHERENT'}")
            
            if alert.adherence_analysis.barriers:
                print(f"   Barriers: {', '.join(alert.adherence_analysis.barriers)}")
            if alert.adherence_analysis.interventions:
                print(f"   Interventions: {', '.join(alert.adherence_analysis.interventions)}")
        else:
            print(f"\n💊 TREATMENT STATUS: Not currently on CKD-specific medication")
            if alert.treatment_recommendation:
                print(f"   Recommendation: {alert.treatment_recommendation.value}")
        
        print(f"\n🎯 RECOMMENDED ACTIONS:")
        for i, action in enumerate(alert.recommended_actions, 1):
            print(f"   {i}. {action}")
        
        print(f"\n📋 CLINICAL RATIONALE:")
        print(f"   {alert.clinical_rationale}")
        
        print(f"{'─'*80}\n")
    
    def export_alerts_to_json(self, output_file: str):
        """Export alerts to JSON file"""
        alerts_data = []
        
        for alert in self.alerts:
            alert_dict = {
                'alert_id': alert.alert_id,
                'severity': alert.severity,
                'patient_id': alert.patient_id,
                'patient_name': alert.patient_name,
                'alert_type': alert.alert_type,
                'message': alert.message,
                'timestamp': alert.timestamp,
                'uacr_analysis': {
                    'current_uacr': alert.uacr_analysis.current_uacr,
                    'previous_uacr': alert.uacr_analysis.previous_uacr,
                    'percent_change': alert.uacr_analysis.percent_change,
                    'current_category': alert.uacr_analysis.current_category.value,
                    'previous_category': alert.uacr_analysis.previous_category.value,
                    'worsening_level': alert.uacr_analysis.worsening_level.value,
                    'date_current': alert.uacr_analysis.date_current,
                    'date_previous': alert.uacr_analysis.date_previous,
                    'days_between': alert.uacr_analysis.days_between
                },
                'recommended_actions': alert.recommended_actions,
                'clinical_rationale': alert.clinical_rationale
            }
            
            if alert.adherence_analysis and alert.adherence_analysis.on_treatment:
                alert_dict['adherence_analysis'] = {
                    'medication': alert.adherence_analysis.medication,
                    'mpr': alert.adherence_analysis.mpr,
                    'pdc': alert.adherence_analysis.pdc,
                    'adherence_category': alert.adherence_analysis.adherence_category,
                    'last_30_days': alert.adherence_analysis.last_30_days,
                    'last_90_days': alert.adherence_analysis.last_90_days,
                    'refill_gap_days': alert.adherence_analysis.refill_gap_days,
                    'is_adherent': alert.adherence_analysis.is_adherent,
                    'barriers': alert.adherence_analysis.barriers,
                    'interventions': alert.adherence_analysis.interventions
                }
            
            if alert.treatment_recommendation:
                alert_dict['treatment_recommendation'] = alert.treatment_recommendation.value
            
            alerts_data.append(alert_dict)
        
        output_data = {
            'metadata': {
                'generated_timestamp': datetime.now().isoformat(),
                'total_alerts': len(alerts_data),
                'system_version': '1.0.0'
            },
            'alerts': alerts_data
        }
        
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        print(f"✅ Alerts exported to: {output_file}")


def main():
    """Main execution function"""
    # Load patient database
    input_file = 'ckd_patients_with_adherence.json'
    
    print("\n🏥 Loading patient database...")
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    patients = data['patients']
    
    # Initialize monitoring system
    monitoring_system = uACRMonitoringSystem()
    
    # Process all patients
    alerts = monitoring_system.process_database(patients)
    
    # Export alerts
    if alerts:
        output_file = 'uacr_monitoring_alerts.json'
        monitoring_system.export_alerts_to_json(output_file)
        
        # Generate summary statistics
        severity_counts = {}
        for alert in alerts:
            severity_counts[alert.severity] = severity_counts.get(alert.severity, 0) + 1
        
        print("\n📊 ALERT BREAKDOWN BY SEVERITY:")
        for severity in ['CRITICAL', 'HIGH', 'MODERATE', 'LOW']:
            count = severity_counts.get(severity, 0)
            if count > 0:
                print(f"   {severity}: {count} alerts")
        
        # Count treatment status
        on_treatment = sum(1 for a in alerts if a.adherence_analysis and a.adherence_analysis.on_treatment)
        not_on_treatment = len(alerts) - on_treatment
        
        print(f"\n💊 TREATMENT STATUS:")
        print(f"   On treatment (adherence issues): {on_treatment}")
        print(f"   Not on treatment (consider initiation): {not_on_treatment}")
        
        # Adherence breakdown for those on treatment
        if on_treatment > 0:
            non_adherent = sum(1 for a in alerts 
                             if a.adherence_analysis and a.adherence_analysis.on_treatment 
                             and not a.adherence_analysis.is_adherent)
            print(f"\n📉 ADHERENCE ISSUES:")
            print(f"   Non-adherent patients: {non_adherent}/{on_treatment} ({non_adherent/on_treatment*100:.1f}%)")
    else:
        print("\n✅ No alerts generated - all patients stable or improving")


if __name__ == "__main__":
    main()
