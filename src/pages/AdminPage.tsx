import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Shield, Plus, Trash2, Globe, Users, Mail, MapPin, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { fetchApprovedDomains, addApprovedDomain, removeApprovedDomain, normalizeDomain } from '../services/domains';
import { fetchAllProfiles } from '../services/admin';
import { fetchBrokerCount } from '../services/profiles';
import type { ApprovedDomainRow, ProfileRow, AverageClientSize } from '../lib/database.types';

type Tab = 'domains' | 'users';

const clientSizeLabel: Record<AverageClientSize, string> = {
  small: 'Small',
  mid: 'Mid-market',
  large: 'Large',
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('domains');

  // Domains state
  const [domains, setDomains] = useState<ApprovedDomainRow[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [domainsError, setDomainsError] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<ApprovedDomainRow | null>(null);

  // Users state
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Broker count
  const [brokerCount, setBrokerCount] = useState<number | null>(null);

  const loadDomains = useCallback(async () => {
    setDomainsLoading(true);
    setDomainsError(null);
    try {
      const data = await fetchApprovedDomains();
      setDomains(data);
    } catch (err) {
      setDomainsError(err instanceof Error ? err.message : 'Failed to load approved domains.');
    } finally {
      setDomainsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const [data, count] = await Promise.all([fetchAllProfiles(), fetchBrokerCount()]);
      setProfiles(data);
      setBrokerCount(count);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    if (tab === 'users' && profiles.length === 0 && !usersLoading) {
      loadUsers();
    }
  }, [tab, profiles.length, usersLoading, loadUsers]);

  const handleAddDomain = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeDomain(newDomain);
    if (!normalized) return;
    setAddingDomain(true);
    setDomainsError(null);
    try {
      await addApprovedDomain(normalized, newOrgName);
      setNewDomain('');
      setNewOrgName('');
      await loadDomains();
    } catch (err) {
      setDomainsError(err instanceof Error ? err.message : 'Failed to add domain.');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleDeleteDomain = async () => {
    if (!domainToDelete) return;
    try {
      await removeApprovedDomain(domainToDelete.id);
      setDomainToDelete(null);
      await loadDomains();
    } catch (err) {
      setDomainsError(err instanceof Error ? err.message : 'Failed to remove domain.');
      setDomainToDelete(null);
    }
  };

  return (
    <BrokerLayout title="Propel Admin">
      <PageHeader
        title="Propel Admin"
        subtitle="Manage approved email domains and view registered users"
        breadcrumbs={[{ label: 'Admin' }]}
      />

      <div className="rounded-md border border-orange/25 bg-orange-tint px-4 py-3 mb-6 flex items-start gap-2.5">
        <Shield className="w-5 h-5 text-orange shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-orange">Super Admin</p>
          <p className="text-sm text-orange/80 mt-0.5">
            Only users with an active admin profile can access this page and manage platform settings.
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 border-b border-neutral-border">
        <TabButton active={tab === 'domains'} onClick={() => setTab('domains')} icon={Globe} label="Approved Domains" count={domains.length} />
        <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="Registered Users" count={profiles.length} />
      </div>

      {/* Domains tab */}
      {tab === 'domains' && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-md bg-navy/5 flex items-center justify-center shrink-0">
                <Globe className="w-4.5 h-4.5 text-navy" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-navy">Approved email domains</h3>
                <p className="text-sm text-neutral-secondary mt-1">
                  Only users with an email address from an approved domain can self-register via the magic-link flow.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddDomain} className="space-y-3 mb-5">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-muted text-sm font-medium">@</span>
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="example.com"
                    className="w-full pl-8 pr-3 py-2 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition text-sm"
                    disabled={addingDomain}
                  />
                </div>
                <Button type="submit" size="md" disabled={addingDomain || !normalizeDomain(newDomain)}>
                  {addingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {addingDomain ? 'Adding…' : 'Add domain'}
                </Button>
              </div>
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Organization name (optional)"
                className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition text-sm"
                disabled={addingDomain}
              />
            </form>

            {domainsError && <ErrorState message={domainsError} onRetry={loadDomains} />}

            {domainsLoading ? (
              <LoadingState label="Loading domains…" />
            ) : domains.length === 0 ? (
              <EmptyState
                icon={Globe}
                title="No approved domains yet"
                description="Add a domain above to allow users with that email domain to self-register."
              />
            ) : (
              <div className="divide-y divide-neutral-border-soft rounded-md border border-neutral-border">
                {domains.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-green-tint flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-green-dark" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy truncate">@{d.domain}</p>
                        {d.organization_name && (
                          <p className="text-xs text-navy/70 truncate">{d.organization_name}</p>
                        )}
                        <p className="text-xs text-neutral-muted">Added {new Date(d.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDomainToDelete(d)}
                      className="p-1.5 rounded-md text-neutral-muted hover:text-red hover:bg-red-tint transition"
                      aria-label={`Remove @${d.domain}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Total Users" value={usersLoading ? '—' : profiles.length} icon={Users} />
            <SummaryCard label="Active" value={usersLoading ? '—' : profiles.filter((p) => p.status === 'active').length} icon={CheckCircle2} />
            <SummaryCard label="Advisors" value={usersLoading ? '—' : brokerCount ?? 0} icon={Building2} />
            <SummaryCard label="Pending Setup" value={usersLoading ? '—' : profiles.filter((p) => !p.account_setup_complete).length} icon={Mail} />
          </div>

          <Card padding={false}>
            <div className="px-5 py-4 border-b border-neutral-border-soft flex items-center gap-3">
              <Users className="w-5 h-5 text-navy" />
              <h3 className="text-base font-semibold text-navy">All Registered Users</h3>
            </div>

            {usersError && <div className="p-5"><ErrorState message={usersError} onRetry={loadUsers} /></div>}

            {usersLoading ? (
              <LoadingState label="Loading users…" />
            ) : profiles.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No registered users yet"
                description="Users who sign in via a magic link from an approved domain will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-border-soft text-left">
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide">Name</th>
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide">Email</th>
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide">Role</th>
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden md:table-cell">Client Size</th>
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden md:table-cell">Territory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-border-soft">
                    {profiles.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-bg/50 transition">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-xs font-semibold text-navy shrink-0">
                              {getInitials(p)}
                            </div>
                            <span className="text-sm font-medium text-navy">
                              {p.first_name || p.last_name ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-secondary">{p.email}</td>
                        <td className="px-5 py-3">
                          <Badge variant={p.role === 'admin' ? 'warning' : 'info'}>{p.role}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={statusVariant(p.status)} dot>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-secondary hidden md:table-cell">
                          {p.average_client_size ? clientSizeLabel[p.average_client_size] : '—'}
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-secondary hidden md:table-cell">
                          {p.territory ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-neutral-muted" />
                              {p.territory}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <ConfirmationModal
        open={!!domainToDelete}
        title="Remove approved domain"
        message={
          <>
            Are you sure you want to remove <span className="font-semibold">@{domainToDelete?.domain}</span>?
            New users from this domain will not be able to self-register. Existing users are unaffected.
          </>
        }
        confirmLabel="Remove domain"
        variant="danger"
        onConfirm={handleDeleteDomain}
        onCancel={() => setDomainToDelete(null)}
      />
    </BrokerLayout>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Globe;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
        active
          ? 'border-green text-navy'
          : 'border-transparent text-neutral-muted hover:text-navy hover:border-neutral-border'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {typeof count === 'number' && (
        <span className={`px-1.5 py-0.5 rounded-full text-xs ${active ? 'bg-navy/10 text-navy' : 'bg-neutral-bg text-neutral-muted'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Users }) {
  return (
    <div className="bg-white border border-neutral-border rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 text-neutral-muted mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-mono text-2xl font-semibold text-navy tabular-nums">{value}</p>
    </div>
  );
}

function getInitials(p: ProfileRow): string {
  if (p.first_name && p.last_name) return (p.first_name[0] + p.last_name[0]).toUpperCase();
  if (p.first_name) return p.first_name.slice(0, 2).toUpperCase();
  return p.email.slice(0, 2).toUpperCase();
}

function statusVariant(status: ProfileRow['status']): 'success' | 'warning' | 'neutral' | 'danger' {
  switch (status) {
    case 'active':
      return 'success';
    case 'invited':
      return 'warning';
    case 'suspended':
      return 'danger';
    case 'archived':
      return 'neutral';
  }
}
