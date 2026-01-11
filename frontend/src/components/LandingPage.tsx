import {
  Shield,
  Brain,
  Activity,
  TrendingUp,
  Users,
  Heart,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Stethoscope,
  Pill,
  Home,
  FileText,
  Target,
  Zap,
  BarChart3,
  ChevronRight,
  Search,
  Bell,
  Mail,
  UserCog
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
}

export function LandingPage({ onEnterApp }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" style={{ colorScheme: 'dark' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">RENALGUARD AI</span>
            </div>
            <button
              onClick={onEnterApp}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-lg shadow-emerald-500/25 flex items-center space-x-2"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-8">
            <Brain className="w-4 h-4 text-emerald-400 mr-2" />
            <span className="text-emerald-400 text-sm font-medium">Powered by Claude AI</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Early Detection.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Better Outcomes.
            </span>
          </h1>

          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-10">
            RENALGUARD AI is an intelligent clinical decision support system that helps primary care physicians
            detect chronic kidney disease early, monitor progression, and optimize treatment strategies.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onEnterApp}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-lg rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-xl shadow-emerald-500/30 flex items-center justify-center space-x-2"
            >
              <span>Start Managing Patients</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-4 bg-slate-800 text-white font-semibold text-lg rounded-xl border border-slate-700 hover:bg-slate-700 transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <span>Learn More</span>
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              { value: '1 in 7', label: 'Adults have CKD globally' },
              { value: '50%', label: 'Unaware until Stage 5' },
              { value: '$90K+', label: 'Annual dialysis cost' },
              { value: '30-50%', label: 'Progression can be slowed' },
            ].map((stat, index) => (
              <div key={index} className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
                <div className="text-2xl sm:text-3xl font-bold text-emerald-400">{stat.value}</div>
                <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">The Challenge</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              CKD is a silent disease that often goes undetected until significant damage has occurred
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: AlertTriangle, title: 'Late Detection', desc: 'CKD is often asymptomatic until Stage 3-4' },
              { icon: Clock, title: 'Time-Consuming', desc: 'Manual KDIGO classification is error-prone' },
              { icon: FileText, title: 'Guideline Complexity', desc: 'Treatment decisions require constant lookup' },
              { icon: Activity, title: 'Lab Overload', desc: 'Distinguishing significant changes is difficult' },
              { icon: TrendingUp, title: 'Missed Progression', desc: 'Gradual decline can go unnoticed' },
              { icon: Users, title: 'Patient Volume', desc: 'Managing many at-risk patients is overwhelming' },
            ].map((item, index) => (
              <div key={index} className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 hover:border-red-500/50 transition-colors">
                <item.icon className="w-10 h-10 text-red-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-4">
              <Zap className="w-4 h-4 text-purple-400 mr-2" />
              <span className="text-purple-400 text-sm font-medium">AI-Powered Intelligence</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Where AI Makes the Difference</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Multiple layers of artificial intelligence working together for comprehensive clinical support
            </p>
          </div>

          {/* AI Diagram */}
          <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 mb-12">
            <div className="flex flex-col items-center">
              {/* Central AI */}
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-500/30 mb-8">
                <Brain className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Claude Sonnet 4.5</h3>
              <p className="text-slate-400 text-center mb-8">Anthropic's Advanced AI Engine</p>

              {/* AI Capabilities */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                {[
                  { icon: Stethoscope, title: 'Clinical Analysis', desc: 'Every lab result analyzed for significance' },
                  { icon: Pill, title: 'Treatment Recommendations', desc: 'Validated against contraindications' },
                  { icon: Users, title: 'Doctor Assistant', desc: 'Natural language conversations' },
                  { icon: TrendingUp, title: 'Transition Detection', desc: 'CKD status change explanation' },
                ].map((item, index) => (
                  <div key={index} className="bg-slate-900/50 rounded-xl p-4 border border-purple-500/20 text-center">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <item.icon className="w-6 h-6 text-purple-400" />
                    </div>
                    <h4 className="text-white font-medium mb-1">{item.title}</h4>
                    <p className="text-slate-400 text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GCUA - Geriatric Cardiorenal Unified Assessment */}
          <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-2xl p-8 border border-purple-500/20 mb-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-4">
                <Users className="w-4 h-4 text-purple-400 mr-2" />
                <span className="text-purple-400 text-sm font-medium">For Patients 60+ Years</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">GCUA - Geriatric Cardiorenal Unified Assessment</h3>
              <p className="text-slate-400">A specialized triple-risk assessment combining renal, cardiovascular, and mortality risk for elderly patients</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-900/50 rounded-xl p-5 border border-amber-500/20">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-amber-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">Nelson / CKD-PC</h4>
                <p className="text-amber-400 text-sm font-medium italic mb-3">"Will this patient's kidneys fail?"</p>
                <p className="text-slate-400 text-sm mb-3">5-year renal risk prediction</p>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 mr-2" />
                    <span>Kidney failure progression</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 mr-2" />
                    <span>eGFR + uACR based model</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-5 border border-red-500/20">
                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Heart className="w-6 h-6 text-red-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">AHA PREVENT</h4>
                <p className="text-red-400 text-sm font-medium italic mb-3">"Will this patient have a heart attack or stroke?"</p>
                <p className="text-slate-400 text-sm mb-3">10-year cardiovascular risk</p>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-red-400 mr-2" />
                    <span>Heart attack & stroke risk</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-red-400 mr-2" />
                    <span>BP, cholesterol, diabetes factors</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-500/20">
                <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">Bansal Geriatric</h4>
                <p className="text-slate-300 text-sm font-medium italic mb-3">"Will this patient benefit from aggressive treatment?"</p>
                <p className="text-slate-400 text-sm mb-3">5-year mortality index</p>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-slate-400 mr-2" />
                    <span>Frailty & comorbidity scoring</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-slate-400 mr-2" />
                    <span>Goals-of-care alignment</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* GCUA Phenotypes */}
          <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-700 mb-8">
            <h3 className="text-xl font-bold text-white mb-2 text-center">GCUA Phenotype Classification</h3>
            <p className="text-slate-400 text-center mb-6">Phenotype is assigned based on the combination of Renal Risk and CVD Risk scores</p>

            {/* Mortality Override Notice */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-300 text-sm text-center">
                <span className="font-bold">Important:</span> If Bansal Mortality ≥50%, patient is automatically assigned <span className="font-bold">Phenotype IV (Senescent)</span> regardless of other scores
              </p>
            </div>

            {/* Phenotype Matrix */}
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2"></th>
                    <th className="p-2" colSpan={3}>
                      <div className="text-center text-slate-300 font-medium mb-2">CVD Risk (AHA PREVENT 10-year)</div>
                    </th>
                  </tr>
                  <tr>
                    <th className="p-2 text-left text-slate-400">Renal Risk<br/><span className="text-xs">(Nelson 5-year)</span></th>
                    <th className="p-2 text-center text-emerald-400">Low<br/><span className="text-xs text-slate-500">&lt;7.5%</span></th>
                    <th className="p-2 text-center text-amber-400">Intermediate<br/><span className="text-xs text-slate-500">7.5-19.9%</span></th>
                    <th className="p-2 text-center text-red-400">High<br/><span className="text-xs text-slate-500">≥20%</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 text-red-400 font-medium">High <span className="text-xs text-slate-500">≥15%</span></td>
                    <td className="p-2">
                      <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-2 text-center">
                        <div className="text-orange-400 font-bold">II</div>
                        <div className="text-white text-xs">Silent Renal</div>
                        <div className="text-slate-400 text-xs mt-1">Kidney-specific</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-2 text-center">
                        <div className="text-red-400 font-bold">I</div>
                        <div className="text-white text-xs">Cardiorenal High</div>
                        <div className="text-slate-400 text-xs mt-1">Aggressive Tx</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="bg-red-500/30 border border-red-500/40 rounded-lg p-2 text-center">
                        <div className="text-red-400 font-bold">I</div>
                        <div className="text-white text-xs">Accelerated Ager</div>
                        <div className="text-slate-400 text-xs mt-1">Full aggressive</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-amber-400 font-medium">Moderate <span className="text-xs text-slate-500">5-14.9%</span></td>
                    <td className="p-2">
                      <div className="bg-orange-500/15 border border-orange-500/25 rounded-lg p-2 text-center">
                        <div className="text-orange-400 font-bold">Mod</div>
                        <div className="text-white text-xs">Renal Watch</div>
                        <div className="text-slate-400 text-xs mt-1">Monitor kidneys</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-2 text-center">
                        <div className="text-purple-400 font-bold">Mod</div>
                        <div className="text-white text-xs">Cardiorenal Mod</div>
                        <div className="text-slate-400 text-xs mt-1">Dual-benefit meds</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="bg-purple-500/25 border border-purple-500/35 rounded-lg p-2 text-center">
                        <div className="text-purple-400 font-bold">Mod</div>
                        <div className="text-white text-xs">Cardiorenal Mod</div>
                        <div className="text-slate-400 text-xs mt-1">CV priority</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 text-emerald-400 font-medium">Low <span className="text-xs text-slate-500">&lt;5%</span></td>
                    <td className="p-2">
                      <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-2 text-center">
                        <div className="text-emerald-400 font-bold">Low</div>
                        <div className="text-white text-xs">Low Risk</div>
                        <div className="text-slate-400 text-xs mt-1">Preventive care</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="bg-teal-500/20 border border-teal-500/30 rounded-lg p-2 text-center">
                        <div className="text-teal-400 font-bold">Low</div>
                        <div className="text-white text-xs">CV Intermediate</div>
                        <div className="text-slate-400 text-xs mt-1">CV monitoring</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-2 text-center">
                        <div className="text-amber-400 font-bold">III</div>
                        <div className="text-white text-xs">Vascular Dominant</div>
                        <div className="text-slate-400 text-xs mt-1">CVD prevention</div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Phenotype Actions Summary */}
            <h4 className="text-lg font-bold text-white mb-4 text-center">Treatment Actions by Phenotype</h4>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <div className="flex items-center mb-2">
                  <span className="text-red-400 font-bold mr-2">I</span>
                  <span className="text-white text-sm">High Priority</span>
                </div>
                <p className="text-slate-400 text-xs">SGLT2i + RAS inhibitor + Statin. BP &lt;120/80. Monitor every 3 months.</p>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                <div className="flex items-center mb-2">
                  <span className="text-orange-400 font-bold mr-2">II</span>
                  <span className="text-white text-sm">Kidney Specific</span>
                </div>
                <p className="text-slate-400 text-xs">SGLT2i + RAS inhibitor. Focus on renal protection. Nephrology referral.</p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                <div className="flex items-center mb-2">
                  <span className="text-amber-400 font-bold mr-2">III</span>
                  <span className="text-white text-sm">Heart Specific</span>
                </div>
                <p className="text-slate-400 text-xs">High-intensity statin + SGLT2i for HF prevention. Annual renal screening.</p>
              </div>
              <div className="bg-slate-500/10 rounded-lg p-3 border border-slate-500/20">
                <div className="flex items-center mb-2">
                  <span className="text-slate-400 font-bold mr-2">IV</span>
                  <span className="text-white text-sm">De-escalate</span>
                </div>
                <p className="text-slate-400 text-xs">Goals-of-care discussion. Consider deprescribing. Focus on QoL.</p>
              </div>
              <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                <div className="flex items-center mb-2">
                  <span className="text-purple-400 font-bold mr-2">Mod</span>
                  <span className="text-white text-sm">Balanced</span>
                </div>
                <p className="text-slate-400 text-xs">SGLT2i + Statin. BP &lt;130/80. Monitor every 6 months.</p>
              </div>
              <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
                <div className="flex items-center mb-2">
                  <span className="text-emerald-400 font-bold mr-2">Low</span>
                  <span className="text-white text-sm">Routine</span>
                </div>
                <p className="text-slate-400 text-xs">Lifestyle focus. Monitor every 1-3 years. Minimal pharmacotherapy.</p>
              </div>
            </div>
          </div>

          {/* Standard Risk Models */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-6 border border-emerald-500/20">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">KDIGO 2024</h3>
              <p className="text-slate-400 mb-4">Evidence-based CKD staging and risk stratification</p>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  <span>eGFR + uACR classification</span>
                </div>
                <div className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                  <span>Heat map risk visualization</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-6 border border-amber-500/20">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">SCORED Model</h3>
              <p className="text-slate-400 mb-4">Detects hidden CKD in non-CKD patients (all ages)</p>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 mr-2" />
                  <span>Age, gender, comorbidity scoring</span>
                </div>
                <div className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 mr-2" />
                  <span>Score ≥4 = 20%+ chance of hidden CKD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Diagram Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Clinical Assessment Workflow</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Age-appropriate risk stratification and phenotype-based treatment planning
            </p>
          </div>

          {/* Workflow Steps */}
          <div className="relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-purple-500 to-cyan-500 transform -translate-y-1/2"></div>

            <div className="grid md:grid-cols-4 gap-8">
              {/* Step 1: Patient Intake */}
              <div className="relative">
                <div className="bg-slate-800 rounded-xl p-6 border border-emerald-500/30 relative z-10">
                  <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mb-4 mx-auto shadow-md">
                    <span className="text-xl font-bold text-white">1</span>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center mb-2">Patient Intake</h3>
                  <p className="text-slate-400 text-center text-sm">Age-based routing: 60+ triggers GCUA, others use SCORED screening</p>
                </div>
              </div>

              {/* Step 2: Risk Assessment */}
              <div className="relative">
                <div className="bg-slate-800 rounded-xl p-6 border border-purple-500/30 relative z-10">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mb-4 mx-auto shadow-md">
                    <span className="text-xl font-bold text-white">2</span>
                  </div>
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Target className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center mb-2">GCUA Assessment</h3>
                  <p className="text-slate-400 text-center text-sm">Triple-risk calculation: Renal, CVD, and Mortality scores</p>
                </div>
              </div>

              {/* Step 3: Phenotype Assignment */}
              <div className="relative">
                <div className="bg-slate-800 rounded-xl p-6 border border-cyan-500/30 relative z-10">
                  <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center mb-4 mx-auto shadow-md">
                    <span className="text-xl font-bold text-white">3</span>
                  </div>
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center mb-2">Phenotype Classification</h3>
                  <p className="text-slate-400 text-center text-sm">Assign clinical phenotype (I-IV, Moderate, Low) based on risk profile</p>
                </div>
              </div>

              {/* Step 4: Treatment Plan */}
              <div className="relative">
                <div className="bg-slate-800 rounded-xl p-6 border border-blue-500/30 relative z-10">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mb-4 mx-auto shadow-md">
                    <span className="text-xl font-bold text-white">4</span>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Pill className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white text-center mb-2">Personalized Plan</h3>
                  <p className="text-slate-400 text-center text-sm">Phenotype-specific treatment, monitoring, and home testing recommendations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Monitoring Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Dual-Track Monitoring</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Comprehensive surveillance using home-based and laboratory tests
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Minuteful Kidney */}
            <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 rounded-2xl p-8 border border-pink-500/20">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 bg-pink-500/20 rounded-xl flex items-center justify-center mr-4">
                  <Home className="w-7 h-7 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Minuteful Kidney</h3>
                  <p className="text-pink-400">Home-Based Monitoring</p>
                </div>
              </div>

              <p className="text-slate-300 mb-6">
                FDA-cleared smartphone-based home urine ACR test that enables frequent monitoring without lab visits.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                  <span className="text-slate-300">Weekly</span>
                  <span className="text-pink-400 text-sm">High-risk patients</span>
                </div>
                <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                  <span className="text-slate-300">Biweekly</span>
                  <span className="text-pink-400 text-sm">Moderate-risk</span>
                </div>
                <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                  <span className="text-slate-300">Monthly</span>
                  <span className="text-pink-400 text-sm">Stable on treatment</span>
                </div>
                <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                  <span className="text-slate-300">Quarterly</span>
                  <span className="text-pink-400 text-sm">Low-risk monitored</span>
                </div>
              </div>
            </div>

            {/* Blood Tests */}
            <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-2xl p-8 border border-violet-500/20">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 bg-violet-500/20 rounded-xl flex items-center justify-center mr-4">
                  <Activity className="w-7 h-7 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Blood Tests</h3>
                  <p className="text-violet-400">Laboratory Monitoring</p>
                </div>
              </div>

              <p className="text-slate-300 mb-6">
                10 key biomarkers tracked with evidence-based alert thresholds to prevent alert fatigue.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {['eGFR', 'uACR', 'Creatinine', 'BUN', 'Blood Pressure', 'HbA1c', 'Glucose', 'Hemoglobin', 'Heart Rate', 'O2 Sat'].map((marker, i) => (
                  <div key={i} className="flex items-center bg-slate-800/50 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-violet-400 mr-2 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{marker}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Treatment Monitoring Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Treatment Monitoring & Outcomes</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Track medication adherence and assess treatment response for every patient
            </p>
          </div>

          {/* Adherence Tracking */}
          <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-700 mb-8">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Pill className="w-6 h-6 text-emerald-400 mr-3" />
              Medication Possession Ratio (MPR) Tracking
            </h3>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-400 font-semibold">Good</span>
                  <span className="text-white font-bold">&gt;80%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{width: '85%'}}></div>
                </div>
                <p className="text-slate-400 text-sm mt-2">Continue current approach</p>
              </div>

              <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-amber-400 font-semibold">Suboptimal</span>
                  <span className="text-white font-bold">50-80%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{width: '65%'}}></div>
                </div>
                <p className="text-slate-400 text-sm mt-2">Medication counseling needed</p>
              </div>

              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-400 font-semibold">Poor</span>
                  <span className="text-white font-bold">&lt;50%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{width: '35%'}}></div>
                </div>
                <p className="text-slate-400 text-sm mt-2">Investigate barriers</p>
              </div>
            </div>
          </div>

          {/* Improvement vs Worsening */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-emerald-500/5 rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Improvement Detection
              </h3>
              <div className="space-y-3">
                {[
                  'eGFR increase ≥1.5 ml/min',
                  'uACR decrease >10%',
                  'Move to better KDIGO stage',
                  'Blood pressure at target',
                  'HbA1c improving'
                ].map((item, i) => (
                  <div key={i} className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-red-500/5 rounded-2xl p-6 border border-red-500/20">
              <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Worsening Detection
              </h3>
              <div className="space-y-3">
                {[
                  'eGFR decline >10% from baseline',
                  'uACR increase >25%',
                  'Health state deterioration',
                  'Persistent high blood pressure',
                  'Poor medication adherence'
                ].map((item, i) => (
                  <div key={i} className="flex items-center">
                    <AlertTriangle className="w-4 h-4 text-red-400 mr-2" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Decision Support Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">AI-Powered Decision Support</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Clear, actionable recommendations for every patient scenario
            </p>
          </div>

          {/* Example AI Recommendation */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-6 py-4 border-b border-slate-700">
              <div className="flex items-center">
                <Brain className="w-6 h-6 text-emerald-400 mr-3" />
                <span className="text-white font-semibold">AI Recommendation Example</span>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <p className="text-slate-400 text-sm mb-2">Patient Context:</p>
                <p className="text-white">65-year-old with diabetes, hypertension, Stage 3a CKD, eGFR 52, uACR 85 mg/g, NOT on treatment</p>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Pill, text: 'INITIATE: ACE inhibitor or ARB (first-line for albuminuria)', priority: 'urgent' },
                  { icon: Pill, text: 'ADD: SGLT2 inhibitor (cardio-renal protection)', priority: 'high' },
                  { icon: Target, text: 'TARGET: Blood pressure <130/80 mmHg', priority: 'medium' },
                  { icon: Activity, text: 'MONITOR: eGFR/uACR every 3 months initially', priority: 'medium' },
                  { icon: Home, text: 'CONSIDER: Minuteful Kidney for home monitoring', priority: 'low' },
                  { icon: Stethoscope, text: 'REFER: Nephrology if eGFR <30 or rapid decline', priority: 'info' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 ${
                      item.priority === 'urgent' ? 'bg-red-500/20' :
                      item.priority === 'high' ? 'bg-amber-500/20' :
                      item.priority === 'medium' ? 'bg-blue-500/20' :
                      item.priority === 'low' ? 'bg-emerald-500/20' : 'bg-slate-700'
                    }`}>
                      <item.icon className={`w-4 h-4 ${
                        item.priority === 'urgent' ? 'text-red-400' :
                        item.priority === 'high' ? 'text-amber-400' :
                        item.priority === 'medium' ? 'text-blue-400' :
                        item.priority === 'low' ? 'text-emerald-400' : 'text-slate-400'
                      }`} />
                    </div>
                    <span className="text-slate-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Complete Clinical Platform</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Beyond risk assessment - a full suite of tools for managing your CKD patient population
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Doctor Management */}
            <div className="bg-slate-900/50 rounded-xl p-6 border border-blue-500/20 hover:border-blue-500/40 transition-colors">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <UserCog className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Doctor Management</h3>
              <p className="text-slate-400 text-sm mb-4">Intelligent patient-to-doctor assignment with workload balancing</p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
                  <span>7-category patient segmentation</span>
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
                  <span>Doctor dashboard & statistics</span>
                </li>
              </ul>
            </div>

            {/* Alerts & Notifications */}
            <div className="bg-slate-900/50 rounded-xl p-6 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                <Bell className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Smart Alerts</h3>
              <p className="text-slate-400 text-sm mb-4">Clinical alerts with full lifecycle tracking and priority management</p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 mr-2 flex-shrink-0" />
                  <span>View → Acknowledge → Resolve</span>
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 mr-2 flex-shrink-0" />
                  <span>Priority-based filtering</span>
                </li>
              </ul>
            </div>

            {/* Silent Hunter */}
            <div className="bg-slate-900/50 rounded-xl p-6 border border-pink-500/20 hover:border-pink-500/40 transition-colors">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Silent Hunter</h3>
              <p className="text-slate-400 text-sm mb-4">Proactive uACR gap detection to find patients needing testing</p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-pink-400 mr-2 flex-shrink-0" />
                  <span>Automated gap analysis</span>
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-pink-400 mr-2 flex-shrink-0" />
                  <span>Prioritized outreach lists</span>
                </li>
              </ul>
            </div>

            {/* Email Notifications */}
            <div className="bg-slate-900/50 rounded-xl p-6 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Email System</h3>
              <p className="text-slate-400 text-sm mb-4">Automated notifications keep care teams informed</p>
              <ul className="space-y-2">
                <li className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  <span>Daily digest reports</span>
                </li>
                <li className="flex items-center text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                  <span>Critical alert notifications</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">The Impact of Early Treatment</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Better outcomes for patients, doctors, and healthcare systems
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* For Patients */}
            <div className="bg-slate-900/80 rounded-2xl p-6 border border-emerald-500/20">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <Heart className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">For Patients</h3>
              <ul className="space-y-3">
                {[
                  'Earlier detection and intervention',
                  'Preserved kidney function longer',
                  'Fewer symptoms (uremia, anemia)',
                  'Delayed or avoided dialysis',
                  'Better quality of life'
                ].map((item, i) => (
                  <li key={i} className="flex items-start">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* For Doctors */}
            <div className="bg-slate-900/80 rounded-2xl p-6 border border-blue-500/20">
              <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <Stethoscope className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">For Doctors</h3>
              <ul className="space-y-3">
                {[
                  '80% reduction in manual calculations',
                  'Instant evidence-based recommendations',
                  'Smart alerts reduce alert fatigue',
                  'No patient falls through cracks',
                  'AI assistant for complex decisions'
                ].map((item, i) => (
                  <li key={i} className="flex items-start">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* For Healthcare Systems */}
            <div className="bg-slate-900/80 rounded-2xl p-6 border border-purple-500/20">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">For Healthcare Systems</h3>
              <ul className="space-y-3">
                {[
                  'Save $90,000+/patient/year (dialysis)',
                  'Prevent $15-50K hospitalizations',
                  'Reduce unnecessary referrals',
                  'Standardize CKD care',
                  'Improve population health'
                ].map((item, i) => (
                  <li key={i} className="flex items-start">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-3xl p-12 border border-emerald-500/30">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Transform CKD Care?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Join the future of kidney disease management. Early detection saves lives and reduces costs.
            </p>

            <button
              onClick={onEnterApp}
              className="px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-lg rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-xl shadow-emerald-500/30 flex items-center justify-center space-x-3 mx-auto"
            >
              <span>Enter RENALGUARD AI</span>
              <ChevronRight className="w-6 h-6" />
            </button>

            <p className="text-slate-400 text-sm mt-6">
              Demo system with 1000 mock patients ready to explore
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold">RENALGUARD AI</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400 text-sm">
            <span>Built with</span>
            <Brain className="w-4 h-4 text-purple-400" />
            <span>Claude AI</span>
            <span className="mx-2">|</span>
            <span>KDIGO 2024 Guidelines</span>
          </div>
          <div className="text-slate-500 text-sm mt-4 md:mt-0">
            Version 2.0.0 | November 2025
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
