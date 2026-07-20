import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MoreVertical, Archive, Users } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/DataTable';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import {
  fetchOrganizations,
  archiveOrganization,
  unarchiveOrganization,
  type OrganizationWithAssessment,
} from '../services/organizations';
import { INDUSTRIES, ASSESSMENT_STATUS_FILTERS, getFundingTypeLabel } from '../lib/sampleData';
import { maturityClass } from '../lib/scores';
import type { AssessmentInstanceStatus } from '../lib/database.types';

export default function ClientsPage() {
  const { profile } = useAuth();
  const [orgs, setOrgs] = useState<OrganizationWithAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssessmentInstanceStatus | 'all'>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrganizations(profile.id, { includeArchived: showArchived });
      setOrgs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients.');
    } finally {
      setLoading(false);
    }
  }, [profile, showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  const handleArchiveToggle = async (org: OrganizationWithAssessment) => {
    try {
      if (org.archived_at) {
        await unarchiveOrganization(profile!.id, org.id);
      } else {
        await archiveOrganization(profile!.id, org.id);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update archive status.');
    }
  };

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

  const columns: Column<OrganizationWithAssessment>[] = [
    {
      key: 'org',
      header: 'Organization',
      mobileLabel: 'Organization',
      render: (org) => (
        <div>
          <Link to={`/clients/${org.id}`} className="font-medium text-navy hover:text-navy-mid transition">
            {org.organization_name}
          </Link>
          {org.archived_at && (
            <Badge variant="neutral" className="ml-2 text-[10px]">Archived</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'industry',
      header: 'Industry',
      hideOnMobile: true,
      render: (org) => <span className="text-neutral-secondary">{org.industry ?? '—'}</span>,
    },
    {
      key: 'employees',
      header: 'Employees',
      hideOnMobile: true,
      render: (org) => (
        <span className="text-neutral-secondary">{org.employee_count_range ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
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
      header: 'Score',
      mobileLabel: 'Score',
      render: (org) =>
        org.latest_assessment?.overall_score !== null &&
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
      key: 'funding',
      header: 'Funding',
      hideOnMobile: true,
      render: (org) => <span className="text-neutral-secondary">{getFundingTypeLabel(org.funding_type)}</span>,
    },
    {
      key: 'activity',
      header: 'Created',
      mobileLabel: 'Created',
      render: (org) => (
        <span className="text-neutral-muted text-xs">
          {new Date(org.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      mobileLabel: '',
      render: (org) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleArchiveToggle(org)}
            className="p-1.5 rounded-sm text-neutral-muted hover:text-orange hover:bg-orange-tint transition"
            aria-label={org.archived_at ? 'Unarchive' : 'Archive'}
            title={org.archived_at ? 'Unarchive' : 'Archive'}
          >
            <Archive className="w-4 h-4" />
          </button>
          <Link
            to={`/clients/${org.id}`}
            className="inline-flex p-1.5 rounded-sm text-neutral-muted hover:text-navy hover:bg-navy/5 transition"
            aria-label={`View ${org.organization_name}`}
          >
            <MoreVertical className="w-4 h-4" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <BrokerLayout title="Clients">
      <PageHeader
        title="Clients"
        subtitle="All employer clients in your book of business"
        actions={
          <Button to="/clients/new">
            <Plus className="w-4 h-4" />
            Create Client
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
        <label className="flex items-center gap-2 text-sm text-neutral-secondary whitespace-nowrap">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-neutral-border text-green focus:ring-green/20"
          />
          Show archived
        </label>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <LoadingState label="Loading clients…" />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-neutral-border rounded-lg">
          <EmptyState
            icon={Users}
            title={orgs.length === 0 ? 'No clients yet' : 'No clients match your filters'}
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
