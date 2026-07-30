import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Star, Target, Zap, Flag, MessageCircleQuestion } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import OpportunitySpectrum from '../components/ui/OpportunitySpectrum';
import { useAuth } from '../context/AuthContext';
import { fetchReportData, getBehavioralInterpretation, DRIVER_LABELS, DRIVER_DESCRIPTIONS, type ReportData, type BehavioralReadiness } from '../services/reportData';
import { getDimensionLabel, getDriverLabel, getEffortLabel, getImpactLabel, type SelectedRecommendation } from '../services/recommendations';
import { roundForDisplay, CUSTOM_ASSESSMENT_DISCLAIMER, CUSTOM_SCORING_DISCLAIMER, getScoreBand } from '../lib/assessmentScoring';
import { FEATURE_FLAGS } from '../lib/featureFlags';
import { maturityColor, behavioralColor } from '../lib/scores';
import StrategyReportSection from '../components/StrategyReportSection';

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

  useEffect(() => { load(); }, [load]);

  if (loading) return <BrokerLayout title="Assessment Report"><LoadingState label="Loading report…" /></BrokerLayout>;
  if (error || !report) return <BrokerLayout title="Assessment Report"><ErrorState message={error ?? 'Report not found.'} onRetry={() => navigate('/reports')} /></BrokerLayout>;

  const { instance, template, version, organization, sections, sectionScores, overallScore, scoreBand, behavioralReadiness, contextualAnswers, recommendations, scoreBands } = report;
  const sectionScoreMap = new Map(sectionScores.map((s) => [s.section_id, s]));
  const scoredSections = sections.filter((s) => s.is_scored);
  const hasStrengths = (recommendations?.strengths.length ?? 0) > 0;
  const hasPriorities = (recommendations?.priorityOpportunities.length ?? 0) > 0;
  const hasQuickWins = (recommendations?.quickWins.length ?? 0) > 0;
  const hasHighImpact = (recommendations?.highImpactMoves.length ?? 0) > 0;
  const hasMeetingQs = (recommendations?.meetingQuestions.length ?? 0) > 0;

  const completedDate = instance.submitted_at
    ? new Date(instance.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <BrokerLayout title="Assessment Report">
      {/* Simplified report header — compact text hierarchy */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-navy">{template?.name ?? 'Untitled Assessment'}</h1>
            {version && (
              <p className="text-xs text-neutral-muted mt-1">Version {version.version_number}</p>
            )}
            {organization && (
              <p className="text-sm text-navy mt-2 font-medium">{organization.organization_name}</p>
            )}
            {completedDate && (
              <p className="text-sm text-neutral-secondary mt-0.5">{completedDate}</p>
            )}
            {instance.respondent_name && (
              <p className="text-sm text-neutral-secondary mt-1">
                {instance.respondent_email ? `${instance.respondent_name} · ${instance.respondent_email}` : instance.respondent_name}
              </p>
            )}
            {instance.respondent_email && !instance.respondent_name && (
              <p className="text-sm text-neutral-secondary mt-1">{instance.respondent_email}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" to="/reports"><ArrowLeft className="w-4 h-4" /> Back to Reports</Button>
        </div>
      </Card>

      {/* Overall score hero — dark navy */}
      {overallScore !== null && version?.show_overall_score && (
        <div className="rounded-lg bg-navy-deep shadow-md mb-6 p-6">
          <OpportunitySpectrum
            score={overallScore}
            scoreBandLabel={scoreBand ?? '—'}
            bands={scoreBands}
          />
        </div>
      )}

      {/* Strengths & Priority Opportunities — side by side */}
      {recommendations && (hasStrengths || hasPriorities) && (
        <div className={`grid gap-6 mb-6 ${hasStrengths && hasPriorities ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
          {hasStrengths && (
            <StrengthsCard recommendations={recommendations.strengths} />
          )}
          {hasPriorities && (
            <PriorityOpportunitiesCard recommendations={recommendations.priorityOpportunities} />
          )}
        </div>
      )}

      {/* Strategy dimensions — two-column grid */}
      {scoredSections.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-navy mb-4">Strategy Dimensions</h2>
          <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {scoredSections.map((section) => {
              const score = sectionScoreMap.get(section.id);
              const normScore = score ? Number(score.normalized_score) : null;
              const bandLabel = normScore !== null ? getScoreBand(normScore, scoreBands) : null;
              return (
                <ScoreRow
                  key={section.id}
                  label={section.title}
                  score={normScore}
                  interpretation={bandLabel}
                  colorFn={maturityColor}
                />
              );
            })}
          </div>
        </Card>
      )}

      {/* Behavioral readiness — with descriptions, two-column grid */}
      {behavioralReadiness && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-navy mb-1">Behavioral Readiness</h2>
          <p className="text-xs text-neutral-muted mb-4">Higher scores indicate stronger behavioral support for well-being participation.</p>
          <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {(Object.keys(DRIVER_LABELS) as Array<keyof BehavioralReadiness>).map((key) => (
              <BehavioralReadinessRow
                key={key}
                driverKey={key}
                score={behavioralReadiness[key]}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Quick Wins & High-Impact Moves — side by side, with pills */}
      {recommendations && (hasQuickWins || hasHighImpact) && (
        <div className={`grid gap-6 mb-6 ${hasQuickWins && hasHighImpact ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
          {hasQuickWins && (
            <RecommendationGroupCard
              title="Quick Wins"
              icon={Zap}
              iconColor="text-green-dark"
              iconBg="bg-green-tint"
              accentBorder="border-l-green"
              recommendations={recommendations.quickWins}
            />
          )}
          {hasHighImpact && (
            <RecommendationGroupCard
              title="High-Impact Moves"
              icon={Flag}
              iconColor="text-navy"
              iconBg="bg-blue-tint"
              accentBorder="border-l-navy"
              recommendations={recommendations.highImpactMoves}
            />
          )}
        </div>
      )}

      {/* Client meeting questions — dark navy, with dimension/driver pills only */}
      {recommendations && hasMeetingQs && (
        <div className="rounded-lg bg-navy-deep shadow-md mb-6 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <MessageCircleQuestion className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white">Client Meeting Questions</h2>
          </div>
          <div className="space-y-3">
            {recommendations.meetingQuestions.map((rec) => (
              <div key={rec.id} className="rounded-md bg-white/5 border border-white/10 p-4">
                <p className="text-sm text-white leading-relaxed">{rec.title}</p>
                {(rec.dimension_key || rec.driver_key) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {rec.dimension_key && <DarkPill>{getDimensionLabel(rec.dimension_key)}</DarkPill>}
                    {rec.driver_key && <DarkPill>{getDriverLabel(rec.driver_key)}</DarkPill>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appendix — Response Detail (plain text, no pills) */}
      {contextualAnswers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-muted uppercase tracking-wide mb-3">Appendix — Response Detail</h2>
          <div className="rounded-lg border border-dashed border-neutral-border bg-transparent p-4 space-y-4">
            {contextualAnswers.map((answer, i) => (
              <div key={i} className="border-b border-neutral-border-soft pb-3 last:border-0 last:pb-0">
                <p className="text-xs font-medium text-neutral-secondary mb-1.5">{answer.question_text}</p>
                {answer.selectedOptionLabels.length > 0 && (
                  <p className="text-sm text-navy">{answer.selectedOptionLabels.join(', ')}</p>
                )}
                {answer.text_value && (
                  <p className="text-sm text-neutral-secondary italic border-l-2 border-neutral-border pl-3 mt-1.5">{answer.text_value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom assessment disclaimer */}
      {template?.owner_type === 'broker' && (
        <div className="space-y-3">
          <div className="rounded-md border border-blue/20 bg-blue-tint px-4 py-3 flex items-start gap-2.5">
            <Mail className="w-5 h-5 text-blue shrink-0 mt-0.5" />
            <p className="text-sm text-blue/80">{CUSTOM_ASSESSMENT_DISCLAIMER}</p>
          </div>
          {template.scoring_enabled && (
            <div className="rounded-md border border-neutral-border bg-neutral-bg/30 px-4 py-3 flex items-start gap-2.5">
              <Mail className="w-5 h-5 text-neutral-muted shrink-0 mt-0.5" />
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

      {/* Strategy Report Section — broker-facing generation, review, approve, print */}
      <StrategyReportSection assessmentInstanceId={instanceId} />
    </BrokerLayout>
  );
}

// ============================================================
// Score Row — single score display, zone-colored bar, label under bar
// ============================================================
function ScoreRow({
  label,
  score,
  interpretation,
  colorFn,
}: {
  label: string;
  score: number | null;
  interpretation: string | null;
  colorFn: (scoreOrLabel: number | string) => string;
}) {
  void colorFn;
  if (score === null) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-navy">{label}</span>
          <span className="text-sm text-neutral-muted">Not scored</span>
        </div>
      </div>
    );
  }

  const color = colorFn(interpretation ?? score);
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-navy">{label}</span>
        <span className="font-mono text-sm font-semibold text-navy tabular-nums">{roundForDisplay(score)} <span className="text-neutral-muted font-normal text-xs">/ 100</span></span>
      </div>
      <div className="w-full bg-neutral-bg rounded-full overflow-hidden h-2">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {interpretation && (
        <p className="text-xs text-neutral-muted mt-1.5">{interpretation}</p>
      )}
    </div>
  );
}

// ============================================================
// Behavioral Readiness Row — driver name, description, score, bar, interpretation
// ============================================================
function BehavioralReadinessRow({
  driverKey,
  score,
}: {
  driverKey: keyof BehavioralReadiness;
  score: number | null;
}) {
  if (score === null) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-navy">{DRIVER_LABELS[driverKey]}</span>
          <span className="text-sm text-neutral-muted">Not scored</span>
        </div>
      </div>
    );
  }

  const color = behavioralColor(score);
  const pct = Math.max(0, Math.min(100, score));
  const interpretation = getBehavioralInterpretation(score);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-sm font-medium text-navy">{DRIVER_LABELS[driverKey]}</span>
        <span className="font-mono text-sm font-semibold text-navy tabular-nums">{roundForDisplay(score)} <span className="text-neutral-muted font-normal text-xs">/ 100</span></span>
      </div>
      <p className="text-xs text-neutral-muted mb-1.5 leading-relaxed">{DRIVER_DESCRIPTIONS[driverKey]}</p>
      <div className="w-full bg-neutral-bg rounded-full overflow-hidden h-2">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-xs text-neutral-muted mt-1.5">{interpretation}</p>
    </div>
  );
}

// ============================================================
// Strengths card — green top border, strength_title + strength_description only
// ============================================================
function StrengthsCard({ recommendations }: { recommendations: SelectedRecommendation[] }) {
  return (
    <Card className="border-t-4 border-t-green">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-green-tint flex items-center justify-center">
          <Star className="w-4 h-4 text-green-dark" />
        </div>
        <h2 className="text-lg font-semibold text-navy">Strengths</h2>
      </div>
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div key={rec.id} className="rounded-md border border-neutral-border-soft border-l-4 border-l-green bg-white p-4">
            <h4 className="text-sm font-semibold text-navy mb-1">{rec.strength_title ?? rec.title}</h4>
            <p className="text-sm text-neutral-secondary leading-relaxed">{rec.strength_description ?? rec.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Priority Opportunities card — orange top border, title + description only
// ============================================================
function PriorityOpportunitiesCard({ recommendations }: { recommendations: SelectedRecommendation[] }) {
  return (
    <Card className="border-t-4 border-t-orange">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-orange-tint flex items-center justify-center">
          <Target className="w-4 h-4 text-orange" />
        </div>
        <h2 className="text-lg font-semibold text-navy">Priority Opportunities</h2>
      </div>
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div key={rec.id} className="rounded-md border border-neutral-border-soft border-l-4 border-l-orange bg-gradient-to-r from-orange-tint/40 to-white p-4">
            <h4 className="text-sm font-semibold text-navy mb-1">{rec.title}</h4>
            <p className="text-sm text-neutral-secondary leading-relaxed">{rec.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Recommendation group card — Quick Wins / High-Impact Moves (with pills)
// ============================================================
function RecommendationGroupCard({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  accentBorder,
  recommendations,
}: {
  title: string;
  icon: typeof Star;
  iconColor: string;
  iconBg: string;
  accentBorder: string;
  recommendations: SelectedRecommendation[];
}) {
  const accent = title === 'Quick Wins' ? 'green' : 'navy';
  return (
    <Card className={`${accentBorder} border-l-4`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <h2 className="text-lg font-semibold text-navy">{title}</h2>
      </div>
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <RecommendationCardWithPills key={rec.id} rec={rec} accent={accent} />
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Recommendation card with pills — for Quick Wins / High-Impact Moves only
// ============================================================
function RecommendationCardWithPills({ rec, accent }: { rec: SelectedRecommendation; accent: 'green' | 'navy' }) {
  const accentClasses: Record<string, string> = {
    green: 'border-l-green bg-white',
    navy: 'border-l-navy bg-white',
  };
  const accentClass = accentClasses[accent] ?? accentClasses.navy;

  return (
    <div className={`rounded-md border border-neutral-border-soft border-l-4 p-4 ${accentClass}`}>
      <h4 className="text-sm font-semibold text-navy mb-1">{rec.title}</h4>
      <p className="text-sm text-neutral-secondary mb-3 leading-relaxed">{rec.description}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {rec.dimension_key && <DimensionTag label={getDimensionLabel(rec.dimension_key) ?? ''} />}
        {rec.driver_key && <DriverTag label={getDriverLabel(rec.driver_key) ?? ''} />}
        {rec.effort_level && <EffortTag label={getEffortLabel(rec.effort_level) ?? ''} />}
        {rec.impact_level && <ImpactTag level={rec.impact_level} label={getImpactLabel(rec.impact_level) ?? ''} />}
      </div>
    </div>
  );
}

// ============================================================
// Distinct tag styles (only used in Quick Wins / High-Impact Moves)
// ============================================================
function DimensionTag({ label }: { label: string }) {
  return <span className="inline-block text-xs text-neutral-secondary border border-neutral-border px-2 py-0.5 rounded-full">{label}</span>;
}

function DriverTag({ label }: { label: string }) {
  return <span className="inline-block text-xs text-navy border border-navy/25 bg-navy/[0.03] px-2 py-0.5 rounded-full">{label}</span>;
}

function EffortTag({ label }: { label: string }) {
  return <span className="inline-block text-xs text-neutral-secondary bg-neutral-bg px-2 py-0.5 rounded-full font-medium">{label}</span>;
}

function ImpactTag({ level, label }: { level: string; label: string }) {
  const cls = level === 'high'
    ? 'text-orange-dark bg-orange-tint'
    : level === 'medium'
    ? 'text-green-dark bg-green-tint'
    : 'text-neutral-muted bg-neutral-bg';
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

function DarkPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-block text-xs text-white/80 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full">{children}</span>;
}
