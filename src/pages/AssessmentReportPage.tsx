import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Building2, User, Mail, CheckCircle2, AlertCircle, Star, Target, Zap, Flag, MessageCircleQuestion } from 'lucide-react';
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
import { getDimensionLabel, getDriverLabel, getEffortLabel, getImpactLabel, type SelectedRecommendation } from '../services/recommendations';
import { roundForDisplay, CUSTOM_ASSESSMENT_DISCLAIMER, CUSTOM_SCORING_DISCLAIMER } from '../lib/assessmentScoring';
import { FEATURE_FLAGS } from '../lib/featureFlags';

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
      const data = await fetchReportData(instanceId, profile.id, profile.role === 'admin');
      if (!data) {
        setError('Assessment report not found or you do not have access.');
        return;
      }
      setReport(data);
    } catch (err) {
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

  const { instance, template, version, organization, sections, sectionScores, overallScore, scoreBand, behavioralReadiness, contextualAnswers, showBand, recommendations } = report;

  const isCompleted = instance.status === 'submitted' || instance.status === 'report_ready';
  const sectionScoreMap = new Map(sectionScores.map((s) => [s.section_id, s]));

  return (
    <BrokerLayout title="Assessment Report">
      <PageHeader
        title={template?.name ?? 'Assessment Report'}
        subtitle={organization ? `Client: ${organization.organization_name}` : undefined}
        breadcrumbs={[{ label: 'Reports', to: '/reports' }, { label: template?.name ?? 'Report' }]}
        actions={<Button variant="ghost" size="sm" to="/reports"><ArrowLeft className="w-4 h-4" /> Back</Button>}
      />

      {/* Assessment summary */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {template && <AssessmentOwnerBadge ownerType={template.owner_type} />}
              {version && <Badge variant="neutral">v{version.version_number}</Badge>}
              <Badge variant={isCompleted ? 'success' : 'warning'} dot>{instance.status}</Badge>
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
              {scoreBand && showBand && <div className="mt-2"><Badge variant="success" dot>{scoreBand}</Badge></div>}
            </div>
          </div>
        </Card>
      )}

      {/* Strategy dimensions */}
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
                    <span className="text-sm text-neutral-muted">{normScore !== null ? `${roundForDisplay(normScore)} / 100` : 'Not scored'}</span>
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
          <p className="text-xs text-neutral-muted mb-4">Higher scores indicate stronger behavioral support for well-being participation.</p>
          <div className="space-y-4">
            {(Object.keys(DRIVER_LABELS) as Array<keyof BehavioralReadiness>).map((key) => {
              const score = behavioralReadiness[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-navy">{DRIVER_LABELS[key]}</span>
                    <span className="text-sm text-neutral-muted">{roundForDisplay(score)} / 100 · {getBehavioralInterpretation(score)}</span>
                  </div>
                  <ScoreBar score={score} size="md" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations && (
        <>
          {recommendations.strengths.length > 0 && (
            <RecommendationSection
              title="Strengths"
              icon={Star}
              iconColor="text-green-dark"
              iconBg="bg-green-tint"
              recommendations={recommendations.strengths}
            />
          )}
          {recommendations.priorityOpportunities.length > 0 && (
            <RecommendationSection
              title="Priority opportunities"
              icon={Target}
              iconColor="text-navy"
              iconBg="bg-blue-tint"
              recommendations={recommendations.priorityOpportunities}
            />
          )}
          {recommendations.quickWins.length > 0 && (
            <RecommendationSection
              title="Quick wins"
              icon={Zap}
              iconColor="text-amber-dark"
              iconBg="bg-amber-tint"
              recommendations={recommendations.quickWins}
            />
          )}
          {recommendations.highImpactMoves.length > 0 && (
            <RecommendationSection
              title="High-impact moves"
              icon={Flag}
              iconColor="text-blue-dark"
              iconBg="bg-blue-tint"
              recommendations={recommendations.highImpactMoves}
            />
          )}
          {recommendations.meetingQuestions.length > 0 && (
            <RecommendationSection
              title="Client meeting questions"
              icon={MessageCircleQuestion}
              iconColor="text-navy"
              iconBg="bg-neutral-bg"
              recommendations={recommendations.meetingQuestions}
            />
          )}
        </>
      )}

      {/* Response Details */}
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
                {answer.text_value && <p className="text-sm text-navy bg-neutral-bg/30 rounded p-2 mt-2">{answer.text_value}</p>}
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
      {FEATURE_FLAGS.ENABLE_PROPEL_STRATEGY_REVIEW && (
        <div className="mt-6">
          <Button variant="outline" size="md">Request Propel Strategy Review</Button>
        </div>
      )}
    </BrokerLayout>
  );
}

function RecommendationSection({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  recommendations,
}: {
  title: string;
  icon: typeof Star;
  iconColor: string;
  iconBg: string;
  recommendations: SelectedRecommendation[];
}) {
  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <h3 className="font-display text-base font-semibold text-navy">{title}</h3>
      </div>
      <div className="space-y-4">
        {recommendations.map((rec) => (
          <div key={rec.id} className="rounded-md border border-neutral-border-soft p-4">
            <h4 className="text-sm font-semibold text-navy mb-1">{rec.title}</h4>
            <p className="text-sm text-neutral-secondary mb-3">{rec.description}</p>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {rec.dimension_key && <Badge variant="neutral">{getDimensionLabel(rec.dimension_key)}</Badge>}
              {rec.driver_key && <Badge variant="neutral">{getDriverLabel(rec.driver_key)}</Badge>}
              {rec.effort_level && <Badge variant="neutral">{getEffortLabel(rec.effort_level)}</Badge>}
              {rec.impact_level && <Badge variant="neutral">{getImpactLabel(rec.impact_level)}</Badge>}
            </div>
            {rec.rationale && (
              <p className="text-xs text-neutral-muted italic">{rec.rationale}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
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
