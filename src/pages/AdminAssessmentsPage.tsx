import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Archive, FileText, Shield, Check } from 'lucide-react';
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
import { fetchAllTemplatesAdmin, archiveTemplate, fetchInstanceCountForTemplate, fetchCompletedCountForTemplate, fetchQuestionCountForVersion } from '../services/assessmentBuilder';
import type { AssessmentTemplateWithVersion } from '../lib/database.types';

type TemplateWithStats = AssessmentTemplateWithVersion & {
  instanceCount: number;
  completedCount: number;
  questionCount: number;
};

export default function AdminAssessmentsPage() {
  const [templates, setTemplates] = useState<TemplateWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllTemplatesAdmin();
      const withStats: TemplateWithStats[] = await Promise.all(
        data.map(async (t) => ({
          ...t,
          instanceCount: await fetchInstanceCountForTemplate(t.id),
          completedCount: await fetchCompletedCountForTemplate(t.id),
          questionCount: t.latest_version ? await fetchQuestionCountForVersion(t.latest_version.id) : 0,
        }))
      );
      setTemplates(withStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleArchive = async (id: string) => {
    try {
      await archiveTemplate(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive assessment.');
    }
  };

  return (
    <BrokerLayout title="Admin: Assessments">
      <PageHeader
        title="Assessment Management"
        subtitle="Manage all Propel and broker-created assessments."
        breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Assessments' }]}
        actions={<Button variant="primary" size="sm" to="/assessments/builder"><Plus className="w-4 h-4" /> Create Propel assessment</Button>}
      />

      <div className="rounded-md border border-orange/25 bg-orange-tint px-4 py-3 mb-6 flex items-start gap-2.5">
        <Shield className="w-5 h-5 text-orange shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-orange">Super Admin</p>
          <p className="text-sm text-orange/80 mt-0.5">
            You can create, publish, and archive assessments. Assessments with historical instances cannot be deleted.
          </p>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <LoadingState label="Loading assessments…" />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No assessments yet"
          description="Create the first Propel assessment to get started."
          action={<Button variant="primary" size="sm" to="/assessments/builder"><Plus className="w-4 h-4" /> Create Propel assessment</Button>}
        />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-border-soft text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide">Owner</th>
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden md:table-cell">Version</th>
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden md:table-cell">Questions</th>
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden md:table-cell">Sent</th>
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden md:table-cell">Completed</th>
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden lg:table-cell">Scoring</th>
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden lg:table-cell">Recommendations</th>
                  <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border-soft">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-bg/50 transition">
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-navy">{t.name}</p>
                        {t.category && <p className="text-xs text-neutral-muted">{t.category}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3"><AssessmentOwnerBadge ownerType={t.owner_type} /></td>
                    <td className="px-5 py-3">
                      <Badge variant={t.status === 'published' ? 'success' : t.status === 'draft' ? 'neutral' : 'danger'} dot>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      {t.latest_version ? <AssessmentVersionBadge status={t.latest_version.status} /> : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-navy hidden md:table-cell">{t.questionCount}</td>
                    <td className="px-5 py-3 text-sm text-navy hidden md:table-cell">{t.instanceCount}</td>
                    <td className="px-5 py-3 text-sm text-navy hidden md:table-cell">{t.completedCount}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      {t.scoring_enabled ? <Check className="w-4 h-4 text-green-dark" /> : <span className="text-neutral-muted">—</span>}
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <RecommendationEligibilityBadge ownerType={t.owner_type} recommendationsEnabled={t.recommendations_enabled} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 text-neutral-muted hover:text-navy" aria-label="Preview"><Eye className="w-4 h-4" /></button>
                        {t.status !== 'archived' && (
                          <button
                            onClick={() => handleArchive(t.id)}
                            className="p-1.5 text-neutral-muted hover:text-orange"
                            aria-label="Archive"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </BrokerLayout>
  );
}
