export interface SearchGuidelinesInput {
  topic: string;
  ckd_stage?: string;
}

export interface GuidelineOutput {
  topic: string;
  guidelines: Array<{
    title: string;
    recommendation: string;
    evidenceLevel: string;
    source: string;
  }>;
}

// KDIGO 2024 Guidelines Database
const KDIGO_GUIDELINES: { [key: string]: any } = {
  'blood pressure': {
    title: 'Blood Pressure Management in CKD',
    recommendations: [
      {
        title: 'Target BP for CKD patients',
        recommendation: 'Target systolic BP <120 mmHg when tolerated, or <130 mmHg if unable to achieve lower target',
        evidenceLevel: 'Strong recommendation',
        source: 'KDIGO 2024 Clinical Practice Guideline',
      },
      {
        title: 'First-line agents',
        recommendation: 'ACE inhibitors or ARBs as first-line for patients with albuminuria',
        evidenceLevel: 'Strong recommendation',
        source: 'KDIGO 2024',
      },
    ],
  },
  'diabetes': {
    title: 'Diabetes Management in CKD',
    recommendations: [
      {
        title: 'Glycemic targets',
        recommendation: 'HbA1c target of approximately 7% (53 mmol/mol) to prevent or delay progression of CKD',
        evidenceLevel: 'Moderate recommendation',
        source: 'KDIGO 2024',
      },
      {
        title: 'SGLT2 inhibitors',
        recommendation: 'SGLT2 inhibitors recommended for patients with T2DM and CKD (eGFR ≥20)',
        evidenceLevel: 'Strong recommendation',
        source: 'KDIGO 2024',
      },
      {
        title: 'GLP-1 receptor agonists',
        recommendation: 'Consider GLP-1 RA for CV risk reduction in T2DM with CKD',
        evidenceLevel: 'Moderate recommendation',
        source: 'KDIGO 2024',
      },
    ],
  },
  'sglt2': {
    title: 'SGLT2 Inhibitor Use in CKD',
    recommendations: [
      {
        title: 'Indications',
        recommendation: 'SGLT2i recommended for all patients with CKD and diabetes (eGFR ≥20)',
        evidenceLevel: 'Strong recommendation',
        source: 'KDIGO 2024',
      },
      {
        title: 'Non-diabetic CKD',
        recommendation: 'Consider SGLT2i for non-diabetic CKD with significant albuminuria',
        evidenceLevel: 'Moderate recommendation',
        source: 'KDIGO 2024',
      },
    ],
  },
  'referral': {
    title: 'Nephrology Referral Criteria',
    recommendations: [
      {
        title: 'Urgent referral',
        recommendation: 'Refer immediately for eGFR <30, rapid decline (>5 ml/min/1.73m²/year), or stage 3+ CKD with complications',
        evidenceLevel: 'Strong recommendation',
        source: 'KDIGO 2024',
      },
      {
        title: 'Routine referral',
        recommendation: 'Consider referral for persistent albuminuria (>300 mg/g) or CKD stage 4-5',
        evidenceLevel: 'Moderate recommendation',
        source: 'KDIGO 2024',
      },
    ],
  },
  'monitoring': {
    title: 'CKD Monitoring Frequency',
    recommendations: [
      {
        title: 'High-risk patients',
        recommendation: 'Monitor eGFR and albuminuria every 3 months for high-risk/unstable CKD',
        evidenceLevel: 'Expert opinion',
        source: 'KDIGO 2024',
      },
      {
        title: 'Moderate-risk patients',
        recommendation: 'Monitor every 6-12 months for stable CKD stage 3',
        evidenceLevel: 'Expert opinion',
        source: 'KDIGO 2024',
      },
    ],
  },
  'diet': {
    title: 'Dietary Recommendations for CKD',
    recommendations: [
      {
        title: 'Sodium restriction',
        recommendation: 'Reduce sodium intake to <2 grams per day',
        evidenceLevel: 'Strong recommendation',
        source: 'KDIGO 2024',
      },
      {
        title: 'Protein intake',
        recommendation: 'Avoid high protein intake (>1.3 g/kg/day) in CKD stages 3-5',
        evidenceLevel: 'Moderate recommendation',
        source: 'KDIGO 2024',
      },
    ],
  },
  'anemia': {
    title: 'Anemia Management in CKD',
    recommendations: [
      {
        title: 'Hemoglobin targets',
        recommendation: 'Target hemoglobin 10-11.5 g/dL, individualize based on patient factors',
        evidenceLevel: 'Moderate recommendation',
        source: 'KDIGO 2024',
      },
      {
        title: 'Iron supplementation',
        recommendation: 'Assess iron status before initiating ESAs; supplement if deficient',
        evidenceLevel: 'Strong recommendation',
        source: 'KDIGO 2024',
      },
    ],
  },
};

export async function searchGuidelines(input: SearchGuidelinesInput): Promise<GuidelineOutput> {
  const { topic, ckd_stage } = input;

  const topicLower = topic.toLowerCase();

  // Search for matching guidelines
  let matchedGuidelines: any = null;

  // Direct match
  if (KDIGO_GUIDELINES[topicLower]) {
    matchedGuidelines = KDIGO_GUIDELINES[topicLower];
  } else {
    // Fuzzy match
    for (const [key, value] of Object.entries(KDIGO_GUIDELINES)) {
      if (topicLower.includes(key) || key.includes(topicLower)) {
        matchedGuidelines = value;
        break;
      }
    }
  }

  // If no match found, return general CKD management guidelines
  if (!matchedGuidelines) {
    matchedGuidelines = {
      title: 'General CKD Management',
      recommendations: [
        {
          title: 'Comprehensive care',
          recommendation: 'Address BP control, glycemic management, albuminuria reduction, and cardiovascular risk',
          evidenceLevel: 'Strong recommendation',
          source: 'KDIGO 2024',
        },
        {
          title: 'Multidisciplinary approach',
          recommendation: 'Involve nephrologists, dietitians, and diabetes educators in care',
          evidenceLevel: 'Expert opinion',
          source: 'KDIGO 2024',
        },
      ],
    };
  }

  // Filter recommendations by CKD stage if specified
  let recommendations = matchedGuidelines.recommendations;

  if (ckd_stage) {
    const stageNumber = parseInt(ckd_stage.replace(/[^0-9]/g, ''));

    // Add stage-specific context
    recommendations = recommendations.map((rec: any) => ({
      ...rec,
      stageNote: getStageSpecificNote(rec.title, stageNumber),
    }));
  }

  return {
    topic: matchedGuidelines.title,
    guidelines: recommendations,
  };
}

function getStageSpecificNote(title: string, stage: number): string {
  if (title.includes('SGLT2')) {
    if (stage >= 5) {
      return 'Not recommended in stage 5 CKD (eGFR <15)';
    }
    return 'Safe and beneficial at this CKD stage';
  }

  if (title.includes('referral') || title.includes('Referral')) {
    if (stage >= 4) {
      return 'Nephrology involvement strongly recommended';
    }
    if (stage === 3) {
      return 'Consider nephrology consultation';
    }
  }

  return '';
}
