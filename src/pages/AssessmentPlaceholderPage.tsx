import { Link } from 'react-router-dom';
import { Sparkles, Clock, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import Button from '../components/ui/Button';

export default function AssessmentPlaceholderPage() {
  // The organization name and broker name are placeholders.
  // Real secure-token lookup will be implemented via a server-side function
  // in a later phase — direct table access is not available to unauthenticated users.
  const organization = 'Your Organization';
  const brokerName = 'Your Broker';

  return (
    <div className="min-h-screen bg-neutral-bg flex flex-col">
      <header className="bg-white border-b border-neutral-border">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-green flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-navy-deep" />
          </div>
          <span className="font-display text-lg font-semibold text-navy">Propel</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8">
            <span className="eyebrow">Well-being Opportunity Assessment</span>
            <h1 className="font-display text-2xl font-semibold text-navy mt-3 leading-tight">
              {organization} well-being assessment
            </h1>
            <p className="text-sm text-neutral-secondary mt-3 leading-relaxed">
              This brief assessment helps your benefits broker understand your organization's current
              well-being strategy and identify meaningful opportunities. Your responses shape a
              practical, client-ready report.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="rounded-md border border-neutral-border p-4 bg-neutral-bg/50">
                <Clock className="w-4 h-4 text-green-dark mb-2" />
                <p className="text-sm font-medium text-navy">~10 minutes</p>
                <p className="text-xs text-neutral-muted mt-0.5">Approximate completion time</p>
              </div>
              <div className="rounded-md border border-neutral-border p-4 bg-neutral-bg/50">
                <ShieldCheck className="w-4 h-4 text-green-dark mb-2" />
                <p className="text-sm font-medium text-navy">Private & secure</p>
                <p className="text-xs text-neutral-muted mt-0.5">No account needed</p>
              </div>
            </div>

            <div className="rounded-md bg-blue-tint border border-blue/20 p-4 mt-5">
              <p className="text-sm text-blue">
                <strong>Your broker:</strong> {brokerName} will review your responses and prepare a
                personalized report.
              </p>
            </div>

            <p className="text-xs text-neutral-muted mt-5 leading-relaxed">
              Your responses are confidential and shared only with your broker. Individual answers are
              never attributed to specific employees. This link is unique to {organization} — please
              don't forward it.
            </p>

            <Button size="lg" className="w-full mt-6">
              Begin Assessment
              <ArrowRight className="w-4 h-4" />
            </Button>

            <p className="text-xs text-neutral-muted text-center mt-4 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" />
              Secure assessment · Powered by Propel
            </p>
          </div>

          <p className="text-center text-xs text-neutral-muted mt-6">
            Assessment questions will be available in a later phase. This is a placeholder screen.
          </p>
          <div className="text-center mt-3">
            <Link to="/" className="text-xs text-neutral-muted hover:text-navy transition">
              What is Propel?
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
