import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Send, Edit, Archive, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import AssessmentOwnerBadge from '../components/builder/AssessmentOwnerBadge';
import AssessmentVersionBadge from '../components/builder/AssessmentVersionBadge';
import RecommendationEligibilityBadge from '../components/builder/RecommendationEligibilityBadge';
import { useAuth } from '../context/AuthContext';
import { fetchTemplatesForBroker, archiveTemplate, retireAssessmentVersion, fetchQuestionCountForVersion } from '../services/assessmentBuilder';
import { CUSTOM_ASSESSMENT_DISCLAIMER } from '../lib/assessmentScoring';
import type { AssessmentTemplateWithVersion } from '../lib/database.types';

type FilterTab = 'all' | 'propel' | 'mine' | 'drafts' | 'published' | 'archived';

export default function AssessmentsPage() {
  const location = useLocation();
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<AssessmentTemplateWithVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('all');
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [justPublished, setJustPublished] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTemplatesForBroker(profile.id);
      // Also fetch archived for the archived tab
      const allData = [...data];
      setTemplates(allData);

      const counts: Record<string, number> = {};
      for (const t of allData) {
        if (t.latest_version) {
          counts[t.latest_version.id] = await fetchQuestionCountForVersion(t.latest_version.id);
        }
      }
      setQuestionCounts(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessments.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (location.state?.justPublished) {
      setJustPublished(true);
      const t = setTimeout(() => setJustPublished(false), 4000);
      return () => clearTimeout(t);
    }
  }, [location.state]);

  const handleArchive = async (id: string) => {
    try {
      await archiveTemplate(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive assessment.');
    }
  };

  const handleRetire = async (versionId: string) => {
    try {
      await retireAssessmentVersion(versionId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retire version.');
    }
  };

  const filtered = templates.filter((t) => {
    switch (tab) {
      case 'propel': return t.owner_type === 'propel' && t.status !== 'archived';
      case 'mine': return t.owner_type === 'broker' && t.status !== 'archived';
      case 'drafts': return t.status === 'draft';
      case 'published': return t.status === 'published';
      case 'archived': return t.status === 'archived';
      default: return t.status !== 'archived';
    }
  });

  const tabs: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'propel', label: 'Propel' },
    { value: 'mine', label: 'My Assessments' },
    { value: 'drafts', label: 'Drafts' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
  ];

  return (
    <BrokerLayout title="Assessments">
      <PageHeader
        title="Assessment Library"
        subtitle="Browse available assessments, create custom questionnaires, and send them to clients."
        breadcrumbs={[{ label: 'Assessments' }]}
        actions={
          <>
            <Button variant="outline" size="sm" to="/assessments/send">
              <Send className="w-4 h-4" /> Send assessment
            </Button>
            <Button variant="primary" size="sm" to="/assessments/builder">
              <Plus className="w-4 h-4" /> Create custom assessment
            </Button>
          </>
        }
      />

      {justPublished && (
        <div className="mb-4 rounded-md border border-green/30 bg-green-tint px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-dark" />
          <p className="text-sm text-green-dark font-medium">Assessment published successfully.</p>
        </div>
      )}

      {/* Custom assessment info banner */}
      <div className="rounded-md border border-blue/20 bg-blue-tint px-4 py-3 mb-6 flex items-start gap-2.5">
        <Sparkles className="w-5 h-5 text-blue shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue">Create your own client questionnaire</p>
          <p className="text-sm text-blue/80 mt-0.5">{CUSTOM_ASSESSMENT_DISCLAIMER}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-neutral-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === t.value
                ? 'border-green text-navy'
                : 'border-transparent text-neutral-muted hover:text-navy hover:border-neutral-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <LoadingState label="Loading assessments…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No assessments here"
          description={tab === 'archived'
            ? 'No archived assessments.'
            : tab === 'drafts'
            ? 'No draft assessments. Create one to get started.'
            : 'No assessments match this filter.'}
          action={tab === 'drafts' || tab === 'mine' || tab === 'all'
            ? <Button variant="primary" size="sm" to="/assessments/builder"><Plus className="w-4 h-4" /> Create custom assessment</Button>
            : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-display text-base font-semibold text-navy">{t.name}</h3>
                <AssessmentOwnerBadge ownerType={t.owner_type} />
              </div>
              {t.short_description && (
                <p className="text-sm text-neutral-secondary mb-3 line-clamp-2">{t.short_description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {t.category && <Badge variant="neutral">{t.category}</Badge>}
                {t.estimated_minutes && <Badge variant="neutral">{t.estimated_minutes} min</Badge>}
                {t.latest_version && (
                  <Badge variant="neutral">
                    {t.latest_version ? questionCounts[t.latest_version.id] ?? 0 : 0} questions
                  </Badge>
                )}
                {t.latest_version && <AssessmentVersionBadge status={t.latest_version.status} />}
              </div>
              <div className="flex items-center gap-2 mb-4">
                {t.scoring_enabled && <Badge variant="progress">Scoring</Badge>}
                <RecommendationEligibilityBadge ownerType={t.owner_type} recommendationsEnabled={t.recommendations_enabled} />
              </div>
              <div className="flex items-center gap-1 mt-auto pt-3 border-t border-neutral-border-soft">
                <Button variant="ghost" size="sm" to={`/assessments/send`}>
                  <Send className="w-3.5 h-3.5" /> Send
                </Button>
                {t.owner_type === 'broker' && t.status === 'draft' && (
                  <Button variant="ghost" size="sm" to={`/assessments/builder/${t.id}`}>
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </Button>
                )}
                {t.owner_type === 'broker' && t.status !== 'archived' && t.latest_version?.status === 'published' && (
                  <Button variant="ghost" size="sm" onClick={() => handleRetire(t.latest_version!.id)}>
                    <Ban className="w-3.5 h-3.5" /> Retire
                  </Button>
                )}
                {t.owner_type === 'broker' && t.status !== 'archived' && (
                  <Button variant="ghost" size="sm" onClick={() => handleArchive(t.id)}>
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </BrokerLayout>
  );
}
