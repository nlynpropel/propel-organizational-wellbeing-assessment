import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  Globe,
  Users,
  Mail,
  Building2,
  CheckCircle2,
  Loader2,
  UserPlus,
  Send,
  Wrench,
  ChevronDown,
  Ban,
  RotateCcw,
} from 'lucide-react';
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
import { fetchAllUsers, inviteUser, resendInvitation, repairUser, changeUserRole, deactivateUser, reactivateUser, checkUserDeletable, deleteUser } from '../services/admin';
import { fetchBrokerCount } from '../services/profiles';
import type { ApprovedDomainRow, UserDirectoryRow } from '../lib/database.types';

type Tab = 'domains' | 'users';

type CanonicalRole = 'superadmin' | 'propel_csm' | 'propel_sales' | 'broker';

const ROLE_LABELS: Record<CanonicalRole, string> = {
  superadmin: 'Superadmin',
  propel_csm: 'Propel Client Services',
  propel_sales: 'Propel Sales',
  broker: 'Broker',
};

const INVITE_ROLES: CanonicalRole[] = ['broker', 'propel_csm', 'propel_sales'];

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
  const [users, setUsers] = useState<UserDirectoryRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Broker count
  const [brokerCount, setBrokerCount] = useState<number | null>(null);

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CanonicalRole>('broker');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Role-change state
  const [roleChangeUserId, setRoleChangeUserId] = useState<string | null>(null);
  const [roleChangeValue, setRoleChangeValue] = useState<CanonicalRole>('broker');
  const [changingRole, setChangingRole] = useState(false);

  // Deactivate state
  const [userToDeactivate, setUserToDeactivate] = useState<UserDirectoryRow | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Delete state
  const [userToDelete, setUserToDelete] = useState<UserDirectoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteEligibility, setDeleteEligibility] = useState<{ eligible: boolean; reason: string } | null>(null);
  const [checkingDeletable, setCheckingDeletable] = useState(false);

  // Action state
  const [actionUserId, setActionUserId] = useState<string | null>(null);

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
      const [data, count] = await Promise.all([fetchAllUsers(), fetchBrokerCount()]);
      setUsers(data);
      setBrokerCount(count);
      setUsersLoaded(true);
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
    if (tab === 'users' && !usersLoaded && !usersLoading) {
      loadUsers();
    }
  }, [tab, usersLoaded, usersLoading, loadUsers]);

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

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    try {
      await inviteUser({ email: inviteEmail, role: inviteRole });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('broker');
      await loadUsers();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (userId: string) => {
    setActionUserId(userId);
    try {
      await resendInvitation(userId);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to resend invitation.');
    } finally {
      setActionUserId(null);
    }
  };

  const handleRepair = async (userId: string) => {
    setActionUserId(userId);
    try {
      await repairUser(userId);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to repair user.');
    } finally {
      setActionUserId(null);
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeUserId) return;
    setChangingRole(true);
    try {
      await changeUserRole(roleChangeUserId, roleChangeValue);
      setRoleChangeUserId(null);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to change role.');
    } finally {
      setChangingRole(false);
    }
  };

  const handleDeactivateUser = async () => {
    if (!userToDeactivate) return;
    setDeactivating(true);
    try {
      await deactivateUser(userToDeactivate.id);
      setUserToDeactivate(null);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to deactivate user.');
      setUserToDeactivate(null);
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivateUser = async (userId: string) => {
    setActionUserId(userId);
    try {
      await reactivateUser(userId);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to reactivate user.');
    } finally {
      setActionUserId(null);
    }
  };

  const handleCheckDeletable = async (user: UserDirectoryRow) => {
    setUserToDelete(user);
    setDeleteEligibility(null);
    setCheckingDeletable(true);
    try {
      const result = await checkUserDeletable(user.id);
      setDeleteEligibility(result);
    } catch (err) {
      setDeleteEligibility({ eligible: false, reason: err instanceof Error ? err.message : 'Failed to check eligibility.' });
    } finally {
      setCheckingDeletable(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
      setDeleteEligibility(null);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to delete user.');
      setUserToDelete(null);
      setDeleteEligibility(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BrokerLayout title="Propel Admin">
      <PageHeader
        title="Propel Admin"
        subtitle="Manage approved email domains, invite users, and view the user directory"
        breadcrumbs={[{ label: 'Admin' }]}
      />

      <div className="rounded-md border border-orange/25 bg-orange-tint px-4 py-3 mb-6 flex items-start gap-2.5">
        <Shield className="w-5 h-5 text-orange shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-orange">Superadmin</p>
          <p className="text-sm text-orange/80 mt-0.5">
            Only users with an active Superadmin profile can access this page and manage platform settings.
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 border-b border-neutral-border">
        <TabButton active={tab === 'domains'} onClick={() => setTab('domains')} icon={Globe} label="Approved Domains" count={domains.length} />
        <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="Registered Users" count={users.length} />
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
                  Only users with an email address from an approved domain can self-register or be invited.
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
                description="Add a domain above to allow users with that email domain to self-register or be invited."
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
            <SummaryCard label="Total Users" value={usersLoading ? '—' : users.length} icon={Users} />
            <SummaryCard label="Active" value={usersLoading ? '—' : users.filter((p) => p.status === 'active').length} icon={CheckCircle2} />
            <SummaryCard label="Brokers" value={usersLoading ? '—' : brokerCount ?? 0} icon={Building2} />
            <SummaryCard label="Pending Setup" value={usersLoading ? '—' : users.filter((p) => !p.account_setup_complete).length} icon={Mail} />
          </div>

          <Card padding={false}>
            <div className="px-5 py-4 border-b border-neutral-border-soft flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-navy" />
                <h3 className="text-base font-semibold text-navy">All Registered Users</h3>
              </div>
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="w-4 h-4" />
                Invite User
              </Button>
            </div>

            {usersError && <div className="p-5"><ErrorState message={usersError} onRetry={loadUsers} /></div>}

            {usersLoading ? (
              <LoadingState label="Loading users…" />
            ) : users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No registered users yet"
                description="Users who sign in via a magic link from an approved domain will appear here. You can also invite users manually."
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
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden md:table-cell">Organization</th>
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden lg:table-cell">Last Sign In</th>
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide hidden lg:table-cell">Type</th>
                      <th className="px-5 py-3 text-xs font-semibold text-neutral-muted uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-border-soft">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-bg/50 transition">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-xs font-semibold text-navy shrink-0">
                              {getInitials(u)}
                            </div>
                            <span className="text-sm font-medium text-navy">
                              {u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-secondary">{u.email}</td>
                        <td className="px-5 py-3">
                          <Badge variant={roleBadgeVariant(u.role)}>
                            {u.role ? ROLE_LABELS[u.role as CanonicalRole] ?? u.role : '—'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={statusVariant(u.status)} dot>
                            {statusLabel(u.status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-secondary hidden md:table-cell">
                          {u.organization_name ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-secondary hidden lg:table-cell">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleDateString()
                            : <span className="text-neutral-muted">Never</span>}
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell">
                          <Badge variant={u.is_internal ? 'info' : 'neutral'}>
                            {u.is_internal ? 'Internal' : 'External'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            {u.status === 'invited' && (
                              <button
                                onClick={() => handleResend(u.id)}
                                disabled={actionUserId === u.id}
                                className="p-1.5 rounded-md text-neutral-muted hover:text-navy hover:bg-navy/5 transition disabled:opacity-50"
                                aria-label="Resend invitation"
                                title="Resend invitation"
                              >
                                {actionUserId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              onClick={() => handleRepair(u.id)}
                              disabled={actionUserId === u.id}
                              className="p-1.5 rounded-md text-neutral-muted hover:text-green hover:bg-green-tint transition disabled:opacity-50"
                              aria-label="Repair account"
                              title="Repair account"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setRoleChangeUserId(u.id);
                                setRoleChangeValue((u.role as CanonicalRole) ?? 'broker');
                              }}
                              className="p-1.5 rounded-md text-neutral-muted hover:text-navy hover:bg-navy/5 transition"
                              aria-label="Change role"
                              title="Change role"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {u.status === 'active' && (
                              <button
                                onClick={() => setUserToDeactivate(u)}
                                className="p-1.5 rounded-md text-neutral-muted hover:text-orange hover:bg-orange-tint transition"
                                aria-label="Deactivate user"
                                title="Deactivate user"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            {u.status === 'suspended' && (
                              <button
                                onClick={() => handleReactivateUser(u.id)}
                                disabled={actionUserId === u.id}
                                className="p-1.5 rounded-md text-neutral-muted hover:text-green hover:bg-green-tint transition disabled:opacity-50"
                                aria-label="Reactivate user"
                                title="Reactivate user"
                              >
                                {actionUserId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              onClick={() => handleCheckDeletable(u)}
                              className="p-1.5 rounded-md text-neutral-muted hover:text-red hover:bg-red-tint transition"
                              aria-label="Permanently delete user"
                              title="Permanently delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* Invite user modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-navy/5 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-navy" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-navy">Invite User</h2>
                <p className="text-sm text-neutral-secondary">Send a magic-link invitation to a new or existing user.</p>
              </div>
            </div>

            {inviteError && (
              <div className="mb-4 rounded-md border border-red/20 bg-red-tint px-4 py-3">
                <p className="text-sm text-red">{inviteError}</p>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2.5 rounded-sm border border-neutral-border bg-white text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition"
                  autoFocus
                />
                <p className="text-xs text-neutral-muted mt-1">
                  Invitations can only be sent to email domains approved by the Superadmin.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Role</label>
                <div className="grid grid-cols-1 gap-2">
                  {INVITE_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      className={`text-left rounded-md border p-3 transition ${
                        inviteRole === r
                          ? 'border-green bg-green-tint ring-2 ring-green/20'
                          : 'border-neutral-border bg-white hover:border-navy/20'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-navy">{ROLE_LABELS[r]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={inviting} className="flex-1">
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {inviting ? 'Sending…' : 'Send Invitation'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => { setInviteOpen(false); setInviteError(null); }} disabled={inviting}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role change modal */}
      {roleChangeUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-navy mb-4">Change Role</h2>
            <div className="space-y-2 mb-6">
              {(['broker', 'propel_csm', 'propel_sales', 'superadmin'] as CanonicalRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleChangeValue(r)}
                  className={`w-full text-left rounded-md border p-3 transition ${
                    roleChangeValue === r
                      ? 'border-green bg-green-tint ring-2 ring-green/20'
                      : 'border-neutral-border bg-white hover:border-navy/20'
                  }`}
                >
                  <span className="block text-sm font-semibold text-navy">{ROLE_LABELS[r]}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button onClick={handleRoleChange} disabled={changingRole} className="flex-1">
                {changingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {changingRole ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setRoleChangeUserId(null)} disabled={changingRole}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate user confirmation */}
      <ConfirmationModal
        open={!!userToDeactivate}
        title="Deactivate user"
        message={
          <>
            Deactivate <span className="font-semibold">{userToDeactivate?.email}</span>?
            The user will lose access to the platform, but their profile and all created records will be preserved for historical attribution. You can reactivate the account later.
          </>
        }
        confirmLabel={deactivating ? 'Deactivating…' : 'Deactivate'}
        variant="danger"
        onConfirm={handleDeactivateUser}
        onCancel={() => setUserToDeactivate(null)}
      />

      {/* Delete user confirmation with eligibility check */}
      <ConfirmationModal
        open={!!userToDelete}
        title="Permanently delete user"
        message={
          checkingDeletable ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-navy" />
              <span className="text-sm text-neutral-secondary">Checking for associated records…</span>
            </div>
          ) : deleteEligibility ? (
            <div className="space-y-3">
              <p>
                Permanently delete <span className="font-semibold">{userToDelete?.email}</span>?
                This will remove their auth account, profile, and organization memberships. This action cannot be undone.
              </p>
              {deleteEligibility.eligible ? (
                <div className="rounded-md border border-green/25 bg-green-tint px-3 py-2">
                  <p className="text-sm text-green-dark">{deleteEligibility.reason}</p>
                </div>
              ) : (
                <div className="rounded-md border border-red/25 bg-red-tint px-3 py-2">
                  <p className="text-sm text-red">{deleteEligibility.reason}</p>
                </div>
              )}
            </div>
          ) : null
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete permanently'}
        variant="danger"
        onConfirm={handleDeleteUser}
        onCancel={() => { setUserToDelete(null); setDeleteEligibility(null); }}
        confirmDisabled={checkingDeletable || !deleteEligibility?.eligible}
      />

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

function getInitials(u: UserDirectoryRow): string {
  if (u.first_name && u.last_name) return (u.first_name[0] + u.last_name[0]).toUpperCase();
  if (u.first_name) return u.first_name.slice(0, 2).toUpperCase();
  return u.email.slice(0, 2).toUpperCase();
}

function statusVariant(status: string | null): 'success' | 'warning' | 'neutral' | 'danger' {
  switch (status) {
    case 'active':
      return 'success';
    case 'invited':
      return 'warning';
    case 'suspended':
      return 'danger';
    case 'archived':
      return 'neutral';
    case 'setup_incomplete':
      return 'warning';
    default:
      return 'neutral';
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'invited':
      return 'Invited';
    case 'suspended':
      return 'Deactivated';
    case 'archived':
      return 'Archived';
    case 'setup_incomplete':
      return 'Setup Incomplete';
    default:
      return status ?? '—';
  }
}

function roleBadgeVariant(role: string | null): 'warning' | 'info' | 'neutral' {
  switch (role) {
    case 'superadmin':
      return 'warning';
    case 'propel_csm':
    case 'propel_sales':
      return 'info';
    default:
      return 'neutral';
  }
}
