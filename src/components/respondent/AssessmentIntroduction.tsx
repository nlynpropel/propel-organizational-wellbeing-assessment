import { Clock, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import Button from '../ui/Button';
import type { ResolvedAssessment } from '../../lib/database.types';

export default function AssessmentIntroduction({
  assessment,
  onStart,
}: {
  assessment: ResolvedAssessment;
  onStart: () => void;
}) {
  const { template, instance, version } = assessment;
  return (
    <div className="bg-white rounded-lg shadow-md border border-neutral-border p-8">
      <span className="eyebrow">{template.category || 'Assessment'}</span>
      <h1 className="font-display text-2xl font-semibold text-navy mt-3 leading-tight">
        {template.name}
      </h1>
      {template.short_description && (
        <p className="text-sm text-neutral-secondary mt-3 leading-relaxed">
          {template.short_description}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="rounded-md border border-neutral-border p-4 bg-neutral-bg/50">
          <Clock className="w-4 h-4 text-green-dark mb-2" />
          <p className="text-sm font-medium text-navy">
            ~{template.estimated_minutes || 10} minutes
          </p>
          <p className="text-xs text-neutral-muted mt-0.5">Approximate completion time</p>
        </div>
        <div className="rounded-md border border-neutral-border p-4 bg-neutral-bg/50">
          <ShieldCheck className="w-4 h-4 text-green-dark mb-2" />
          <p className="text-sm font-medium text-navy">Private &amp; secure</p>
          <p className="text-xs text-neutral-muted mt-0.5">No account needed</p>
        </div>
      </div>

      {instance.broker_name && (
        <div className="rounded-md bg-blue-tint border border-blue/20 p-4 mt-5">
          <p className="text-sm text-blue">
            <strong>Your advisor:</strong> {instance.broker_name} will review your responses and
            prepare a personalized report.
          </p>
        </div>
      )}

      {instance.broker_message && (
        <div className="rounded-md border border-neutral-border bg-neutral-bg/50 p-4 mt-4">
          <p className="text-xs font-medium text-neutral-muted uppercase tracking-wide">
            Message from your advisor
          </p>
          <p className="text-sm text-neutral-text mt-2 leading-relaxed whitespace-pre-wrap">
            {instance.broker_message}
          </p>
        </div>
      )}

      {version.introduction_text && (
        <div className="mt-6">
          <p className="text-sm text-neutral-text leading-relaxed whitespace-pre-wrap">
            {version.introduction_text}
          </p>
        </div>
      )}

      <p className="text-xs text-neutral-muted mt-5 leading-relaxed">
        Your responses are confidential and shared only with your advisor. Individual answers are
        never attributed to specific employees. This link is unique to you — please don&apos;t
        forward it.
      </p>

      <Button size="lg" className="w-full mt-6" onClick={onStart}>
        Begin Assessment
        <ArrowRight className="w-4 h-4" />
      </Button>

      <p className="text-xs text-neutral-muted text-center mt-4 flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3" />
        Your progress saves automatically
      </p>
    </div>
  );
}
