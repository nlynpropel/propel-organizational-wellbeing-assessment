import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ClipboardList } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import DataTable, { type Column } from '../components/DataTable';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import { fetchAssessmentsForBroker, type AssessmentWithOrganization } from '../services/assessments';
import { INDUSTRIES, ASSESSMENT_STATUS_FILTERS } from '../lib/sampleData';
import type { AssessmentInstanceStatus } from '../lib/database.types';

export default function AssessmentsPage() {
  const { profile } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentWithOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssessmentInstanceStatus | 'all'>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssessmentsForBroker(profile.id);
      setAssessments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessments.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      assessments.filter((a) => {
        const matchSearch =
          a.organization?.organization_name?.toLowerCase().includes(search.toLowerCase()) ?? false;
        const matchStatus = statusFilter === 'all' || a.status === statusFilter;
        const matchIndustry = industryFilter === 'all' || a.organization?.industry === industryFilter;
        return matchSearch && matchStatus && matchIndustry;
      }),
    [assessments, search, statusFilter, industryFilter]
  );

  const columns: Column<AssessmentWithOrganization>[] = [
    {
      key: 'client',
      header: 'Client',
      mobileLabel: 'Client',
      render: (a) => (
        <Link
          to={`/clients/${a.organization_id}`}
          className="font-medium text-navy hover:text-navy-mid transition"
        >
          {a.organization?.organization_name ?? 'Unknown'}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      mobileLabel: 'Status',
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: 'industry',
      header: 'Industry',
      hideOnMobile: true,
      render: (a) => <span className="text-neutral-secondary">{a.organization?.industry ?? '—'}</span>,
    },
    {
      key: 'sent',
      header: 'Sent',
      hideOnMobile: true,
      render: (a) => (
        <span className="text-neutral-muted text-xs">
          {a.sent_at ? new Date(a.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      key: 'opened',
      header: 'Opened',
      hideOnMobile: true,
      render: (a) => (
        <span className="text-neutral-muted text-xs">
          {a.opened_at ? new Date(a.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      mobileLabel: 'Submitted',
      render: (a) => (
        <span className="text-neutral-muted text-xs">
          {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      key: 'manage',
      header: 'Manage',
      mobileLabel: '',
      render: (a) => (
        <Link
          to={`/clients/${a.organization_id}`}
          className="text-sm font-medium text-navy hover:text-navy-mid transition"
        >
          Open
        </Link>
      ),
    },
  ];

  return (
    <BrokerLayout title="Assessments">
      <PageHeader
        title="Assessments"
        subtitle="Track assessment status across all clients"
        actions={
          <Button to="/clients/new">
            <Plus className="w-4 h-4" />
            Create Assessment
          </Button>
        }
      />

      <div className="bg-white border border-neutral-border rounded-lg p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by organization name…"
            className="w-full pl-10 pr-3 py-2 text-sm rounded-sm border border-neutral-border bg-white focus:outline-none focus:border-green transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AssessmentInstanceStatus | 'all')}
          className="text-sm rounded-sm border border-neutral-border bg-white px-3 py-2 text-navy focus:outline-none focus:border-green transition"
        >
          {ASSESSMENT_STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="text-sm rounded-sm border border-neutral-border bg-white px-3 py-2 text-navy focus:outline-none focus:border-green transition"
        >
          <option value="all">All industries</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <LoadingState label="Loading assessments…" />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-neutral-border rounded-lg">
          <EmptyState
            icon={ClipboardList}
            title={assessments.length === 0 ? 'No assessments yet' : 'No assessments match your filters'}
            description={assessments.length === 0 ? 'Create a client to start an assessment.' : 'Try adjusting search or filters.'}
            action={assessments.length === 0 ? <Button to="/clients/new"><Plus className="w-4 h-4" />Create Assessment</Button> : undefined}
          />
        </div>
      ) : (
        <DataTable columns={columns} rows={filtered} />
      )}
    </BrokerLayout>
  );
}
