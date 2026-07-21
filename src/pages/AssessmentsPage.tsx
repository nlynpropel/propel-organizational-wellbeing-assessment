import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, CheckCircle2, Clock, FileText, Layers, ListChecks, Sparkles } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FEATURE_FLAGS } from '../lib/featureFlags';
import { logDbError } from '../lib/logger';
import type { AssessmentTemplateRow, AssessmentVersionRow } from '../lib/database.types';

type PropelAssessment = {
  template: AssessmentTemplateRow;
  version: AssessmentVersionRow;
  sectionCount: number;
  questionCount: number;
  scoredQuestionCount: number;
};

export default function AssessmentsPage() {
  const location = useLocation();
  const { profile } = useAuth();
  const [assessments, setAssessments] = useState<PropelAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: templates, error: tErr } = await supabase
        .from('assessment_templates')
        .select('*, versions:assessment_versions!inner(id, version_number, status, recommendation_framework_id, show_overall_score)')
        .eq('owner_type', 'propel')
        .eq('versions.status', 'published')
        .order('name')
        .order('version_number', { ascending: false, referencedTable: 'assessment_versions' });

      if (tErr) {
        logDbError({ fn: 'AssessmentsPage.load', error: tErr });
        throw tErr;
      }

      const results: PropelAssessment[] = [];
      for (const t of (templates ?? []) as unknown as Array<AssessmentTemplateRow & { versions: AssessmentVersionRow[] }>) {
        const latestVersion = t.versions[0];
        if (!latestVersion) continue;
        const versionId = latestVersion.id;
        const [{ count: sectionCount }, { count: questionCount }, { count: scoredQuestionCount }] = await Promise.all([
          supabase.from('assessment_sections').select('id', { count: 'exact', head: true }).eq('assessment_version_id', versionId),
          supabase.from('assessment_questions').select('id', { count: 'exact', head: true }).eq('assessment_version_id', versionId),
          supabase.from('assessment_questions').select('id', { count: 'exact', head: true }).eq('assessment_version_id', versionId).eq('is_scored', true),
        ]);
        results.push({
          template: t,
          version: latestVersion,
          sectionCount: sectionCount ?? 0,
          questionCount: questionCount ?? 0,
          scoredQuestionCount: scoredQuestionCount ?? 0,
        });
      }

      setAssessments(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessments.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  void profile;

  return (
    <BrokerLayout title="Assessments">
      <PageHeader
        title="Assessment Library"
        subtitle="Propel-published assessments available for your clients."
        breadcrumbs={[{ label: 'Assessments' }]}
        actions={
          <Button variant="primary" size="sm" to="/assessments/send">
            <Send className="w-4 h-4" /> Send assessment
          </Button>
        }
      />

      {justPublished && (
        <div className="mb-4 rounded-md border border-green/30 bg-green-tint px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-dark" />
          <p className="text-sm text-green-dark font-medium">Assessment published successfully.</p>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <LoadingState label="Loading assessments…" />
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No published assessments"
          description="No Propel-published assessments are currently available."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assessments.map((a) => (
            <Card key={a.template.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-display text-base font-semibold text-navy">{a.template.name}</h3>
                <Badge variant="progress">Propel</Badge>
              </div>
              {a.template.short_description && (
                <p className="text-sm text-neutral-secondary mb-3 line-clamp-2">{a.template.short_description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {a.template.category && <Badge variant="neutral">{a.template.category}</Badge>}
                {a.template.estimated_minutes && (
                  <Badge variant="neutral">
                    <Clock className="w-3 h-3 mr-1" />
                    {a.template.estimated_minutes} min
                  </Badge>
                )}
                <Badge variant="neutral">
                  <Layers className="w-3 h-3 mr-1" />
                  {a.sectionCount} sections
                </Badge>
                <Badge variant="neutral">
                  <ListChecks className="w-3 h-3 mr-1" />
                  {a.questionCount} questions
                </Badge>
                <Badge variant="neutral">v{a.version.version_number}</Badge>
              </div>
              <div className="flex items-center gap-2 mb-4">
                {a.template.scoring_enabled && <Badge variant="progress">Scoring</Badge>}
                {a.template.recommendations_enabled && (
                  <Badge variant="success">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Recommendations
                  </Badge>
                )}
              </div>
              <div className="text-xs text-neutral-muted mb-4">
                {a.scoredQuestionCount} scored questions · {a.questionCount - a.scoredQuestionCount} contextual questions
              </div>
              <div className="flex items-center gap-1 mt-auto pt-3 border-t border-neutral-border-soft">
                <Button variant="primary" size="sm" to="/assessments/send">
                  <Send className="w-3.5 h-3.5" /> Send to client
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Custom assessment controls — hidden behind feature flag */}
      {FEATURE_FLAGS.ENABLE_CUSTOM_ASSESSMENTS && (
        <div className="mt-8 pt-8 border-t border-neutral-border-soft">
          <p className="text-sm text-neutral-muted">Custom assessment builder is available.</p>
        </div>
      )}
    </BrokerLayout>
  );
}
