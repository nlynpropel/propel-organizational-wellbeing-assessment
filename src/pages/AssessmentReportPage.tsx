import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Building2, User, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import ScoreBar from '../components/ui/ScoreBar';
import AssessmentOwnerBadge from '../components/builder/AssessmentOwnerBadge';
import RecommendationEligibilityBadge from '../components/builder/RecommendationEligibilityBadge';
import { useAuth } from '../context/AuthContext';
import { fetchReportData, getBehavioralInterpretation, DRIVER_LABELS } from '../services/reportData';
import type { ReportData, BehavioralReadiness } from '../services/reportData';
import { roundForDisplay, CUSTOM_ASSESSMENT_DISCLAIMER, CUSTOM_SCORING_DISCLAIMER } from '../lib/assessmentScoring';

// Feature flag for Propel Strategy Review — future phase.
// TODO: When the Propel strategy review workflow is implemented, this will initiate
// a strategy-review request tied to the assessment instance. For now it stays dormant.
const ENABLE_PROPEL_STRATEGY_REVIEW = false;

export default function AssessmentReportPage() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);

  const load = useCallback(async () => {
    if (!instanceId || !profile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReportData(
        instanceId,
        profile.id,
        profile.role === 'admin'
      );
      if (!data) {
        setError('Assessment report not found or you do not have access.');
        return;
      }
      setReport(data);
    } catch (err) {
      console.error('[AssessmentReportPage.load] Failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [instanceId, profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <BrokerLayout title="Assessment Report">
        <LoadingState label="Loading report…" />
      </BrokerLayout>
    );
  }

  if (error || !report) {
    return (
      <BrokerLayout title="Assessment Report">
        <ErrorState message={error ?? 'Report not found.'} onRetry={() => navigate('/reports')} />
      </BrokerLayout>
    );
  }

  const { instance, template, version, organization, sections, sectionScores, overallScore, scoreBand, behavioralReadiness, contextualAnswers, showBand } = report;

  const isCompleted = instance.status === 'submitted' || instance.status === 'report_ready';

  const sectionScoreMap = new Map(sectionScores.map((s) => [s.section_id, s]));

  return (
    <BrokerLayout title="Assessment Report">
      <PageHeader
        title={template?.name ?? 'Assessment Report'}
        subtitle={organization ? `Client: ${organization.organization_name}` : undefined}
        breadcrumbs={[
          { label: 'Reports', to: '/reports' },
          { label: template?.name ?? 'Report' },
        ]}
        actions={
          <Button variant="ghost" size="sm" to="/reports"><ArrowLeft className="w-4 h-4" /> Back</Button>
        }
      />

      {/* Assessment summary */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {template && <AssessmentOwnerBadge ownerType={template.owner_type} />}
              {version && <Badge variant="neutral">v{version.version_number}</Badge>}
              <Badge variant={isCompleted ? 'success' : 'warning'} dot>
                {instance.status}
              </Badge>
            </div>
            <h2 className="font-display text-xl font-semibold text-navy">{template?.name ?? 'Untitled Assessment'}</h2>
            {template?.short_description && <p className="text-sm text-neutral-secondary mt-1">{template.short_description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {template && <RecommendationEligibilityBadge ownerType={template.owner_type} recommendationsEnabled={template.recommendations_enabled} />}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-neutral-border-soft">
          <InfoRow icon={Building2} label="Client" value={organization?.organization_name ?? '—'} />
          <InfoRow icon={User} label="Respondent" value={instance.respondent_name ?? '—'} />
          <InfoRow icon={Mail} label="Email" value={instance.respondent_email ?? '—'} />
          <InfoRow icon={Calendar} label="Completed" value={instance.submitted_at ? new Date(instance.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not completed'} />
        </div>
      </Card>

      {/* Overall Opportunity Index */}
      {overallScore !== null && version?.show_overall_score && (
        <Card className="mb-6">
          <h3 className="font-display text-base font-semibold text-navy mb-4">Overall Opportunity Index</h3>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="font-display text-4xl font-bold text-navy">{roundForDisplay(overallScore)}</div>
              <div className="text-sm text-neutral-muted mt-1">out of 100</div>
            </div>
            <div className="flex-1">
              <ScoreBar score={overallScore} size="lg" />
              {scoreBand && showBand && (
                <div className="mt-2">
                  <Badge variant="success" dot>{scoreBand}</Badge>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Strategy dimensions (section scores) */}
      {sectionScores.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-display text-base font-semibold text-navy mb-4">Strategy dimensions</h3>
          <div className="space-y-4">
            {sections.filter((s) => s.is_scored).map((section) => {
              const score = sectionScoreMap.get(section.id);
              const normScore = score ? Number(score.normalized_score) : null;
              return (
                <div key={section.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-navy">{section.title}</span>
                    <span className="text-sm text-neutral-muted">
                      {normScore !== null ? `${roundForDisplay(normScore)} / 100` : 'Not scored'}
                    </span>
                  </div>
                  {normScore !== null && <ScoreBar score={normScore} size="md" />}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Behavioral readiness */}
      {behavioralReadiness && (
        <Card className="mb-6">
          <h3 className="font-display text-base font-semibold text-navy mb-1">Behavioral readiness</h3>
          <p className="text-xs text-neutral-muted mb-4">
            Higher scores indicate stronger behavioral support for well-being participation.
          </p>
          <div className="space-y-4">
            {(Object.keys(DRIVER_LABELS) as Array<keyof BehavioralReadiness>).map((key) => {
              const score = behavioralReadiness[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-navy">{DRIVER_LABELS[key]}</span>
                    <span className="text-sm text-neutral-muted">
                      {roundForDisplay(score)} / 100 · {getBehavioralInterpretation(score)}
                    </span>
                  </div>
                  <ScoreBar score={score} size="md" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Response Details (contextual answers only — no internal IDs or scoring tags) */}
      {contextualAnswers.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-display text-base font-semibold text-navy mb-4">Response Details</h3>
          <div className="space-y-6">
            {contextualAnswers.map((answer, i) => (
              <div key={i} className="rounded-md border border-neutral-border-soft p-3">
                <p className="text-sm font-medium text-navy mb-2">{answer.question_text}</p>
                {answer.selectedOptionLabels.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {answer.selectedOptionLabels.map((label: string, j: number) => (
                      <Badge key={j} variant="neutral">{label}</Badge>
                    ))}
                  </div>
                )}
                {answer.text_value && (
                  <p className="text-sm text-navy bg-neutral-bg/30 rounded p-2 mt-2">{answer.text_value}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Custom assessment disclaimer */}
      {template?.owner_type === 'broker' && (
        <div className="space-y-3">
          <div className="rounded-md border border-blue/20 bg-blue-tint px-4 py-3 flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-blue shrink-0 mt-0.5" />
            <p className="text-sm text-blue/80">{CUSTOM_ASSESSMENT_DISCLAIMER}</p>
          </div>
          {template.scoring_enabled && (
            <div className="rounded-md border border-neutral-border bg-neutral-bg/30 px-4 py-3 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-neutral-muted shrink-0 mt-0.5" />
              <p className="text-sm text-neutral-secondary">{CUSTOM_SCORING_DISCLAIMER}</p>
            </div>
          )}
        </div>
      )}

      {/* Dormant Propel Strategy Review — hidden behind feature flag */}
      {ENABLE_PROPEL_STRATEGY_REVIEW && (
        <div className="mt-6">
          <Button variant="outline" size="md">
            Request Propel Strategy Review
          </Button>
        </div>
      )}
    </BrokerLayout>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-neutral-muted uppercase tracking-wide mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-sm text-navy font-medium">{value}</p>
    </div>
  );
}
