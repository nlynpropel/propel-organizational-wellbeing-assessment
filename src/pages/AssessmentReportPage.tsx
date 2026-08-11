import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Zap, Flag, MessageCircleQuestion, Sparkles } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import OpportunitySpectrum from '../components/ui/OpportunitySpectrum';
import { useAuth } from '../context/AuthContext';
import { fetchReportData, type ReportData } from '../services/reportData';
import { getDimensionLabel, getDriverLabel, getEffortLabel, getImpactLabel, type SelectedRecommendation } from '../services/recommendations';
import { CUSTOM_ASSESSMENT_DISCLAIMER, CUSTOM_SCORING_DISCLAIMER } from '../lib/assessmentScoring';
import { FEATURE_FLAGS } from '../lib/featureFlags';
import StrategyReportSection from '../components/StrategyReportSection';
import ParticipationOpportunityResults from '../components/respondent/ParticipationOpportunityResults';
import { mapPrintData } from '../lib/printHelpers';
import {
  StrengthsSection,
  PriorityOpportunitiesSection,
  StrategyDimensionsSection,
  BehavioralReadinessSection,
  deriveStrategyDimensions,
} from '../components/report/ReportSections';

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
      const data = await fetchReportData(instanceId, profile.id, profile.role === 'superadmin');
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

  const isUnscoredInternal = report.template?.report_type === 'unscored_internal';

  if (isUnscoredInternal) {
    return <UnscoredInternalReport report={report} instanceId={instanceId!} navigate={navigate} profile={profile} />;
  }

  return <ScoredReport report={report} instanceId={instanceId!} />;
}

// ============================================================
// 360 / unscored_internal report — metadata + AI analysis only
// ============================================================
function UnscoredInternalReport({
  report,
  instanceId,
  profile,
}: {
  report: ReportData;
  instanceId: string;
  profile: { role: string } | null;
}) {
  const { instance, template, organization } = report;
  const canAccessAI = profile?.role === 'superadmin' || profile?.role === 'propel_csm';

  const completedDate = instance.submitted_at
    ? new Date(instance.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <BrokerLayout title="Assessment Report">
      {/* Report header — assessment name, client, respondent, date, status */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-navy">{template?.name ?? 'Untitled Assessment'}</h1>
            {organization && (
              <p className="text-sm text-navy mt-2 font-medium">{organization.organization_name}</p>
            )}
            {instance.respondent_name && (
              <p className="text-sm text-neutral-secondary mt-1">
                {instance.respondent_email ? `${instance.respondent_name} · ${instance.respondent_email}` : instance.respondent_name}
              </p>
            )}
            {instance.respondent_email && !instance.respondent_name && (
              <p className="text-sm text-neutral-secondary mt-1">{instance.respondent_email}</p>
            )}
            {completedDate && (
              <p className="text-sm text-neutral-secondary mt-0.5">{completedDate}</p>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2.5 py-0.5 text-xs font-medium text-green-dark">
                Submitted
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" to="/reports"><ArrowLeft className="w-4 h-4" /> Back to Reports</Button>
        </div>
      </Card>

      {/* Internal AI Analysis card — Superadmin / Propel CSM only */}
      {canAccessAI && (
        <Card className="mb-6 border-l-4 border-l-navy">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-navy/5 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-navy" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-navy">Internal AI Analysis</h2>
                <p className="text-xs text-neutral-secondary mt-0.5">
                  Generate or view the internal 360 engagement analysis. Propel Client Services only.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" to={`/reports/${instanceId}/360-analysis`}>
              Open Analysis
            </Button>
          </div>
        </Card>
      )}
    </BrokerLayout>
  );
}

// ============================================================
// Standard scored report (Well-being Opportunity Index, etc.)
// ============================================================
function ScoredReport({
  report,
  instanceId,
}: {
  report: ReportData;
  instanceId: string;
}) {
  const { instance, template, version, organization, sections, sectionScores, overallScore, scoreBand, behavioralReadiness, contextualAnswers, recommendations, scoreBands } = report;
  const hasStrengths = (recommendations?.strengths.length ?? 0) > 0;
  const hasPriorities = (recommendations?.priorityOpportunities.length ?? 0) > 0;
  const hasQuickWins = (recommendations?.quickWins.length ?? 0) > 0;
  const hasHighImpact = (recommendations?.highImpactMoves.length ?? 0) > 0;
  const hasMeetingQs = (recommendations?.meetingQuestions.length ?? 0) > 0;

  const completedDate = instance.submitted_at
    ? new Date(instance.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const strategyDimensions = deriveStrategyDimensions(sections, sectionScores, scoreBands);
  const isCategoryWeighted = version?.scoring_method === 'category_weighted';

  const reportSectionsData = {
    strengths: recommendations?.strengths ?? [],
    priorityOpportunities: recommendations?.priorityOpportunities ?? [],
    strategyDimensions,
    behavioralReadiness,
    scoreBands,
  };

  return (
    <BrokerLayout title="Assessment Report">
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

      {/* Strategy Report Section — broker-facing generation, review, approve, print.
          Not applicable to category_weighted assessments (e.g. the Participation
          Finder) -- those show the same AI-generated result the respondent saw
          instead, since there's no broker-reviewed strategy report for this type. */}
      {isCategoryWeighted ? (
        <ParticipationOpportunityResults token={instance.secure_token} />
      ) : (
        <StrategyReportSection
          assessmentInstanceId={instanceId}
          printContext={mapPrintData({
            organizationName: organization?.organization_name,
            templateName: template?.name,
            submittedAt: instance.submitted_at,
            overallScore,
            scoreBandLabel: scoreBand,
          })}
          printableGraph={
            overallScore !== null && version?.show_overall_score ? (
              <OpportunitySpectrum
                score={overallScore}
                scoreBandLabel={scoreBand ?? '—'}
                bands={scoreBands}
              />
            ) : null
          }
          reportSectionsData={reportSectionsData}
        />
      )}

      {/* Strengths & Priority Opportunities — side by side */}
      {recommendations && (hasStrengths || hasPriorities) && (
        <>
          <SectionDivider />
          <div className={`grid gap-6 ${hasStrengths && hasPriorities ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {hasStrengths && (
              <StrengthsSection recommendations={recommendations.strengths} />
            )}
            {hasPriorities && (
              <PriorityOpportunitiesSection recommendations={recommendations.priorityOpportunities} />
            )}
          </div>
        </>
      )}

      {/* Strategy dimensions — two-column grid. Not applicable to
          category_weighted assessments (no comparable dimension model). */}
      {!isCategoryWeighted && strategyDimensions.length > 0 && (
        <>
          <SectionDivider />
          <StrategyDimensionsSection dimensions={strategyDimensions} />
        </>
      )}

      {/* Behavioral readiness — with descriptions, two-column grid */}
      {behavioralReadiness && (
        <>
          <SectionDivider />
          <BehavioralReadinessSection readiness={behavioralReadiness} />
        </>
      )}

      {/* Quick Wins & High-Impact Moves — side by side, with pills */}
      {recommendations && (hasQuickWins || hasHighImpact) && (
        <>
          <SectionDivider />
          <div className={`grid gap-6 ${hasQuickWins && hasHighImpact ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
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
        </>
      )}

      {/* Client meeting questions — dark navy, with dimension/driver pills only */}
      {recommendations && hasMeetingQs && (
        <>
          <SectionDivider />
          <div className="rounded-lg bg-navy-deep shadow-md p-6">
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
        </>
      )}

      {/* Appendix — Response Detail (plain text, no pills) */}
      {contextualAnswers.length > 0 && (
        <>
          <SectionDivider />
          <div>
            <h2 className="text-sm font-semibold text-neutral-muted uppercase tracking-wide mb-3.5">Appendix — Response Detail</h2>
            <div className="rounded-lg border border-dashed border-neutral-border bg-transparent p-4 space-y-3">
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
        </>
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
    </BrokerLayout>
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
  icon: typeof Zap;
  iconColor: string;
  iconBg: string;
  accentBorder: string;
  recommendations: SelectedRecommendation[];
}) {
  const accent = title === 'Quick Wins' ? 'green' : 'navy';
  return (
    <Card className={`${accentBorder} border-l-4`}>
      <div className="flex items-center gap-2 mb-3.5">
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

function SectionDivider() {
  return <hr className="border-0 border-t border-neutral-border-soft my-8" />;
}