import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileText, AlertCircle } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import MetricCard from '../components/ui/MetricCard';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/DataTable';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import { fetchOrganizations, type OrganizationWithAssessment } from '../services/organizations';

import { INDUSTRIES, ASSESSMENT_STATUS_FILTERS } from '../lib/sampleData';
import { maturityClass } from '../lib/scores';
import type { AssessmentInstanceStatus } from '../lib/database.types';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [orgs, setOrgs] = useState<OrganizationWithAssessment[]>([]);
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
      const data = await fetchOrganizations(profile.id);
      setOrgs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return orgs.filter((org) => {
      const matchesSearch = org.organization_name.toLowerCase().includes(search.toLowerCase());
      const matchesIndustry = industryFilter === 'all' || org.industry === industryFilter;
      const latest = org.latest_assessment;
      const matchesStatus =
        statusFilter === 'all' ||
        (latest?.status === statusFilter) ||
        (!latest && statusFilter === 'draft');
      return matchesSearch && matchesStatus && matchesIndustry;
    });
  }, [orgs, search, statusFilter, industryFilter]);

  const metrics = useMemo(() => {
    const total = orgs.length;
    let notOpened = 0;
    let inProgress = 0;
    let completed = 0;
    let reportsReady = 0;

    for (const org of orgs) {
      const s = org.latest_assessment?.status;
      if (s === 'not_opened' || s === 'sent') notOpened++;
      if (s === 'opened' || s === 'in_progress') inProgress++;
      if (s === 'submitted' || s === 'report_ready') completed++;
      if (s === 'submitted' || s === 'report_ready') {
        if (org.latest_assessment?.overall_score !== null && org.latest_assessment?.overall_score !== undefined) reportsReady++;
      }
    }
    return { total, notOpened, inProgress, completed, reportsReady };
  }, [orgs]);

  const columns: Column<OrganizationWithAssessment>[] = [
    {
      key: 'client',
      header: 'Client',
      mobileLabel: 'Client',
      render: (org) => (
        <Link to={`/clients/${org.id}`} className="font-medium text-navy hover:text-navy-mid transition">
          {org.organization_name}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Assessment',
      mobileLabel: 'Status',
      render: (org) =>
        org.latest_assessment ? (
          <StatusBadge status={org.latest_assessment.status} />
        ) : (
          <Badge variant="neutral" dot>Draft</Badge>
        ),
    },
    {
      key: 'score',
      header: 'Overall',
      mobileLabel: 'Score',
      render: (org) =>
        org.latest_assessment?.assessment_versions?.scoring_method === 'category_weighted' ? (
          <span className="text-neutral-muted text-xs">Category-based</span>
        ) : org.latest_assessment?.overall_score !== null &&
          org.latest_assessment?.overall_score !== undefined ? (
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-navy tabular-nums">
              {Math.round(org.latest_assessment.overall_score)}
            </span>
            <Badge variant="neutral" className="text-[10px]">
              {maturityClass(org.latest_assessment.overall_score)}
            </Badge>
          </div>
        ) : (
          <span className="text-neutral-muted">—</span>
        ),
    },
    {
      key: 'sent',
      header: 'Sent',
      hideOnMobile: true,
      render: (org) => (
        <span className="text-neutral-muted text-xs">
          {org.latest_assessment?.sent_at
            ? new Date(org.latest_assessment.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '—'}
        </span>
      ),
    },
    {
      key: 'completed',
      header: 'Completed',
      hideOnMobile: true,
      render: (org) => (
        <span className="text-neutral-muted text-xs">
          {org.latest_assessment?.submitted_at
            ? new Date(org.latest_assessment.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '—'}
        </span>
      ),
    },
    {
      key: 'report',
      header: 'Report',
      mobileLabel: '',
      render: (org) =>
        org.latest_assessment?.overall_score !== null &&
        org.latest_assessment?.overall_score !== undefined ? (
          <Link
            to={`/clients/${org.id}/results`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-navy-mid transition"
          >
            <FileText className="w-4 h-4 text-green-dark" />
            View
          </Link>
        ) : (
          <span className="text-neutral-muted text-xs">—</span>
        ),
    },
  ];

  return (
    <BrokerLayout title="Dashboard">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your client assessments and reports"
        actions={
          <Button to="/clients/new">
            <Plus className="w-4 h-4" />
            Create Assessment
          </Button>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard label="Total Clients" value={metrics.total} color="navy" to="/clients" />
        <MetricCard label="Not Opened" value={metrics.notOpened} color="orange" hint="Awaiting first open" />
        <MetricCard label="In Progress" value={metrics.inProgress} color="blue" />
        <MetricCard label="Completed" value={metrics.completed} color="teal" />
        <MetricCard label="Reports Ready" value={metrics.reportsReady} color="green" to="/reports" />
      </div>

      {/* Filters */}
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
        <LoadingState label="Loading your clients…" />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-neutral-border rounded-lg">
          <EmptyState
            icon={AlertCircle}
            title={orgs.length === 0 ? 'No clients yet' : 'No assessments match your filters'}
            description={orgs.length === 0 ? 'Create your first client to get started.' : 'Try adjusting search or filters.'}
            action={orgs.length === 0 ? <Button to="/clients/new"><Plus className="w-4 h-4" />Create Client</Button> : undefined}
          />
        </div>
      ) : (
        <DataTable columns={columns} rows={filtered} />
      )}
    </BrokerLayout>
  );
}