import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Mail, Calendar, Building2, User, CheckCircle2, AlertCircle, Info } from 'lucide-react';
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
import { fetchInstanceById, fetchResponsesForInstance, fetchSectionScoresForInstance, fetchResultForInstance } from '../services/assessmentBuilder';
import { fetchSectionsWithQuestions, fetchVersionById, fetchTemplateById, fetchScoreBandsForVersion } from '../services/assessmentBuilder';
import { fetchOrganizationById } from '../services/organizations';
import { getScoreBand, roundForDisplay, CUSTOM_ASSESSMENT_DISCLAIMER, CUSTOM_SCORING_DISCLAIMER, canShowRecommendations, shouldShowScoreBand } from '../lib/assessmentScoring';
import type {
  AssessmentInstanceRow,
  AssessmentResponseRow,
  AssessmentSectionScoreRow,
  AssessmentResultRow,
  AssessmentSectionWithQuestions,
  AssessmentVersionRow,
  AssessmentTemplateRow,
  AssessmentScoreBandRow,
  OrganizationRow,
} from '../lib/database.types';

export default function AssessmentReportPage() {
  const { instanceId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [instance, setInstance] = useState<AssessmentInstanceRow | null>(null);
  const [organization, setOrganization] = useState<OrganizationRow | null>(null);
  const [version, setVersion] = useState<AssessmentVersionRow | null>(null);
  const [template, setTemplate] = useState<AssessmentTemplateRow | null>(null);
  const [sections, setSections] = useState<AssessmentSectionWithQuestions[]>([]);
  const [responses, setResponses] = useState<AssessmentResponseRow[]>([]);
  const [sectionScores, setSectionScores] = useState<AssessmentSectionScoreRow[]>([]);
  const [result, setResult] = useState<AssessmentResultRow | null>(null);
  const [scoreBands, setScoreBands] = useState<AssessmentScoreBandRow[]>([]);

  const load = useCallback(async () => {
    if (!instanceId || !profile) return;
    setLoading(true);
    setError(null);
    try {
      const inst = await fetchInstanceById(instanceId);
      if (!inst) {
        setError('Assessment instance not found.');
        return;
      }
      setInstance(inst);

      const [org, ver, tmpl, secs, resps, secScores, res, bands] = await Promise.all([
        fetchOrganizationById(profile.id, inst.organization_id),
        inst.assessment_version_id ? fetchVersionById(inst.assessment_version_id) : null,
        inst.assessment_template_id ? fetchTemplateById(inst.assessment_template_id) : null,
        inst.assessment_version_id ? fetchSectionsWithQuestions(inst.assessment_version_id) : [],
        fetchResponsesForInstance(inst.id),
        fetchSectionScoresForInstance(inst.id),
        fetchResultForInstance(inst.id),
        inst.assessment_version_id ? fetchScoreBandsForVersion(inst.assessment_version_id) : [],
      ]);

      setOrganization(org);
      setVersion(ver);
      setTemplate(tmpl);
      setSections(secs);
      setResponses(resps);
      setSectionScores(secScores);
      setResult(res);
      setScoreBands(bands);
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

  if (error || !instance) {
    return (
      <BrokerLayout title="Assessment Report">
        <ErrorState message={error ?? 'Report not found.'} onRetry={() => navigate('/reports')} />
      </BrokerLayout>
    );
  }

  const isCompleted = instance.status === 'submitted' || instance.status === 'report_ready';
  const showRecommendations = template ? canShowRecommendations(template.owner_type, template.recommendations_enabled) : false;
  const showBand = template ? shouldShowScoreBand(template.owner_type, scoreBands.length > 0) : false;

  const responseMap = new Map(responses.map((r) => [r.question_id, r]));
  const sectionScoreMap = new Map(sectionScores.map((s) => [s.section_id, s]));
  const overallScore = result ? Number(result.normalized_score) : instance.overall_score ? Number(instance.overall_score) : null;
  const scoreBand = result?.score_band ?? (overallScore !== null ? getScoreBand(overallScore, scoreBands) : null);

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
          <>
            <Button variant="ghost" size="sm" to="/reports"><ArrowLeft className="w-4 h-4" /> Back</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="w-4 h-4" /> Print
            </Button>
          </>
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
          <InfoRow icon={Calendar} label="Completed" value={instance.submitted_at ? new Date(instance.submitted_at).toLocaleDateString() : 'Not completed'} />
        </div>
      </Card>

      {/* Overall score */}
      {overallScore !== null && version?.show_overall_score && (
        <Card className="mb-6">
          <h3 className="font-display text-base font-semibold text-navy mb-4">Overall Score</h3>
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

      {/* Section scores */}
      {sectionScores.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-display text-base font-semibold text-navy mb-4">Section Scores</h3>
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
                      {score && ` · ${score.answered_question_count}/${score.possible_question_count} answered`}
                    </span>
                  </div>
                  {normScore !== null && <ScoreBar score={normScore} size="md" />}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Response details */}
      <Card className="mb-6">
        <h3 className="font-display text-base font-semibold text-navy mb-4">Response Details</h3>
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id}>
              <h4 className="text-sm font-semibold text-navy mb-3 pb-2 border-b border-neutral-border-soft">
                {section.title}
              </h4>
              {section.questions.length === 0 ? (
                <p className="text-sm text-neutral-muted italic">No questions.</p>
              ) : (
                <div className="space-y-4">
                  {section.questions.map((question) => {
                    const response = responseMap.get(question.id);
                    const selectedOption = response?.selected_option_id
                      ? question.options.find((o) => o.id === response.selected_option_id)
                      : null;
                    return (
                      <div key={question.id} className="rounded-md border border-neutral-border-soft p-3">
                        <p className="text-sm font-medium text-navy">{question.question_text}</p>
                        {question.help_text && <p className="text-xs text-neutral-muted mt-0.5">{question.help_text}</p>}
                        <div className="mt-2">
                          {!response ? (
                            <p className="text-sm text-neutral-muted italic flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {question.is_required ? 'Required — not answered' : 'Skipped (optional)'}
                            </p>
                          ) : selectedOption ? (
                            <p className="text-sm text-navy">
                              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-green-dark" />
                              {selectedOption.option_label}
                              {selectedOption.is_not_applicable && <Badge variant="info" className="ml-2">N/A</Badge>}
                              {question.is_scored && response.score_value !== null && (
                                <span className="text-xs text-neutral-muted ml-2">(score: {response.score_value})</span>
                              )}
                            </p>
                          ) : response.text_value ? (
                            <p className="text-sm text-navy bg-neutral-bg/30 rounded p-2">{response.text_value}</p>
                          ) : response.numeric_value !== null ? (
                            <p className="text-sm text-navy">{response.numeric_value}</p>
                          ) : response.boolean_value !== null ? (
                            <p className="text-sm text-navy">{response.boolean_value ? 'Yes' : 'No'}</p>
                          ) : (
                            <p className="text-sm text-neutral-muted italic">No response recorded</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Recommendations (only when eligible) */}
      {showRecommendations && (
        <Card className="mb-6">
          <h3 className="font-display text-base font-semibold text-navy mb-4">Recommendations</h3>
          <div className="rounded-md bg-green-tint border border-green/20 p-4">
            <p className="text-sm text-green-dark">
              Propel recommendations will appear here once the recommendation mapping engine is implemented.
            </p>
          </div>
        </Card>
      )}

      {/* Custom assessment disclaimer */}
      {template?.owner_type === 'broker' && (
        <div className="space-y-3">
          <div className="rounded-md border border-blue/20 bg-blue-tint px-4 py-3 flex items-start gap-2.5">
            <Info className="w-5 h-5 text-blue shrink-0 mt-0.5" />
            <p className="text-sm text-blue/80">{CUSTOM_ASSESSMENT_DISCLAIMER}</p>
          </div>
          {template.scoring_enabled && (
            <div className="rounded-md border border-neutral-border bg-neutral-bg/30 px-4 py-3 flex items-start gap-2.5">
              <Info className="w-5 h-5 text-neutral-muted shrink-0 mt-0.5" />
              <p className="text-sm text-neutral-secondary">{CUSTOM_SCORING_DISCLAIMER}</p>
            </div>
          )}
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
