import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Link2, ClipboardList } from 'lucide-react';
import PublicHeader from '../components/layout/PublicHeader';

const steps = [
  {
    icon: ClipboardList,
    title: 'Create a client assessment',
    description: 'Set up an employer profile and generate a Propel Well-being Opportunity Index assessment.',
  },
  {
    icon: Link2,
    title: 'Send a secure link',
    description: 'Your client receives a secure, no-account link to complete the assessment on their own.',
  },
  {
    icon: FileText,
    title: 'Review a client-ready report',
    description: 'Get a polished report with maturity scoring, priority opportunities, and recommendations.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-navy hero-radial relative overflow-hidden">
      <PublicHeader />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-3xl">
          <span className="eyebrow text-green">Propel Well-being Opportunity Index</span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.05] mt-4">
            Lead a More Valuable Well-being Conversation
          </h1>
          <p className="text-lg text-white/75 mt-6 leading-relaxed max-w-2xl">
            Assess a client's well-being strategy, identify meaningful opportunities, and generate a
            client-ready report with practical recommendations.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-green hover:bg-green-dark text-navy-deep font-semibold px-6 py-3 rounded-md transition shadow-md"
            >
              Broker Sign In
              <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="text-sm text-white/50">For employee-benefits brokers</span>
          </div>
        </div>
      </section>

      {/* Three-step section */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <span className="eyebrow">How it works</span>
            <h2 className="font-display text-3xl font-semibold text-navy mt-3">
              Three steps to a stronger client conversation
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-md bg-navy text-white font-mono font-bold flex items-center justify-center text-sm">
                    {i + 1}
                  </div>
                  <step.icon className="w-5 h-5 text-green-dark" />
                </div>
                <h3 className="text-lg font-semibold text-navy">{step.title}</h3>
                <p className="text-sm text-neutral-secondary mt-2 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-deep py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <img src="/Propel_Logo_2020_v4-3.png" alt="Propel" className="h-5 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
            <span>Well-being Opportunity Index</span>
          </div>
          <p className="text-white/40 text-xs">Application shell · Sample data for demonstration</p>
        </div>
      </footer>
    </div>
  );
}
