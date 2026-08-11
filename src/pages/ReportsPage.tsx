import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Printer, FileText, Eye } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import { fetchReportsReady, type AssessmentWithOrganization } from '../services/assessments';
import { maturityClass } from '../lib/scores';

export default function ReportsPage() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<AssessmentWithOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReportsReady(profile.id);
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <BrokerLayout title="Reports">
      <PageHeader title="Reports" subtitle="Client-ready reports ready to download or share" />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <LoadingState label="Loading reports…" />
      ) : reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No reports ready"
            description="Reports are generated once a client completes their assessment and scores are assigned."
            action={<Button to="/clients">View clients</Button>}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <Link
                    to={`/clients/${r.organization_id}`}
                    className="font-medium text-navy hover:text-navy-mid transition"
                  >
                    {r.organization?.organization_name ?? 'Unknown'}
                  </Link>
                  <p className="text-xs text-neutral-muted mt-0.5">{r.organization?.industry ?? '—'}</p>
                </div>
                <Badge variant="success">Ready</Badge>
              </div>

              {r.assessment_versions?.scoring_method === 'category_weighted' ? (
                <div className="mb-3">
                  <span className="text-xs text-neutral-muted">Category-based result</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-mono text-2xl font-bold text-navy tabular-nums">
                    {Math.round(r.overall_score ?? 0)}
                  </span>
                  <span className="text-xs text-neutral-muted">/100</span>
                  <Badge variant="neutral" className="ml-auto">
                    {maturityClass(r.overall_score ?? 0)}
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-neutral-border-soft">
                <Button to={`/reports/${r.id}`} variant="outline" size="sm" className="flex-1">
                  <Eye className="w-4 h-4" />
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-neutral-muted"
                  onClick={() => window.print()}
                  aria-label="Print report"
                  title="Print report"
                >
                  <Printer className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}


    </BrokerLayout>
  );
}