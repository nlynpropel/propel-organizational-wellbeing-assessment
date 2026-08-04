import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Archive,
  FileText,
  LayoutGrid,
  ClipboardList,
  StickyNote,
  Plus,
  Copy,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import BrokerNotesPanel from '../components/BrokerNotesPanel';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import {
  fetchOrganizationById,
  archiveOrganization,
  unarchiveOrganization,
  fetchInstancesForOrganization,
} from '../services/organizations';
import type { OrganizationWithAssessment, InstanceWithTemplate } from '../services/organizations';
import { getFundingTypeLabel } from '../lib/sampleData';

type TabKey = 'overview' | 'assessments' | 'notes';

const tabs: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'assessments', label: 'Assessments', icon: ClipboardList },
  { key: 'notes', label: 'Notes', icon: StickyNote },
];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const location = useLocation();
  const [org, setOrg] = useState<OrganizationWithAssessment | null>(null);
  const [instances, setInstances] = useState<InstanceWithTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [regenTarget, setRegenTarget] = useState<InstanceWithTemplate | null>(null);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [data, instData] = await Promise.all([
        fetchOrganizationById(profile.id, id),
        fetchInstancesForOrganization(profile.id, id),
      ]);
      setOrg(data);
      setInstances(instData);
      if (!data) setError('Organization not found or you do not have access.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client.');
    } finally {
      setLoading(false);
    }
  }, [profile, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (location.state && (location.state as { justCreated?: boolean }).justCreated) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    }
  }, [location.state]);

  const handleArchiveToggle = async () => {
    if (!profile || !org) return;
    setArchiveOpen(false);
    try {
      if (org.archived_at) {
        await unarchiveOrganization(profile.id, org.id);
      } else {
        await archiveOrganization(profile.id, org.id);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update archive status.');
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/assessment/${token}`;
    navigator.clipboard.writeText(url);
  };

  if (loading) {
    return (
      <BrokerLayout title="Loading…">
        <LoadingState label="Loading client…" />
      </BrokerLayout>
    );
  }

  if (error || !org) {
    return (
      <BrokerLayout title="Client not found">
        <ErrorState message={error ?? 'Organization not found or you do not have access.'} onRetry={load} />
      </BrokerLayout>
    );
  }

  return (
    <BrokerLayout title={org.organization_name}>
      <div className="mb-2">
        <Link to="/clients" className="inline-flex items-center gap-1.5 text-xs text-neutral-muted hover:text-navy transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          Clients
        </Link>
      </div>

      {showSuccess && (
        <div className="mb-4 rounded-md border border-green/30 bg-green-tint px-4 py-3 flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-green-dark" />
          <p className="text-sm text-green-dark font-medium">Client created successfully.</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-semibold text-navy">{org.organization_name}</h1>
            {org.archived_at && <Badge variant="neutral">Archived</Badge>}
          </div>
          <p className="text-sm text-neutral-secondary mt-1">
            {org.industry ?? 'No industry'} · {org.employee_count_range ?? 'Unknown size'}
            {org.number_of_locations !== null && ` · ${org.number_of_locations} locations`}
            {' · '}{getFundingTypeLabel(org.funding_type)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="primary" size="sm" to={`/assessments/send?org=${org.id}`}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Send another assessment</span>
            <span className="sm:hidden">New</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setArchiveOpen(true)}>
            <Archive className="w-4 h-4" />
            <span className="hidden sm:inline">{org.archived_at ? 'Unarchive' : 'Archive'}</span>
          </Button>
        </div>
      </div>

      <div className="border-b border-neutral-border mb-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-green text-navy'
                  : 'border-transparent text-neutral-muted hover:text-navy hover:border-neutral-border'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <OverviewTab org={org} instances={instances} />}
      {activeTab === 'assessments' && (
        <AssessmentsTab
          org={org}
          instances={instances}
          onCopyLink={copyLink}
          onRegenerate={(inst) => setRegenTarget(inst)}
          onReload={load}
        />
      )}
      {activeTab === 'notes' && (
        <Card>
          <BrokerNotesPanel organizationId={org.id} />
        </Card>
      )}

      <ConfirmationModal
        open={archiveOpen}
        title={org.archived_at ? 'Unarchive this client?' : 'Archive this client?'}
        message={
          <>
            <strong>{org.organization_name}</strong> {org.archived_at ? 'will return to your active client list.' : 'will be hidden from your active client list.'} You can change this at any time.
          </>
        }
        confirmLabel={org.archived_at ? 'Unarchive' : 'Archive'}
        variant="primary"
        onCancel={() => setArchiveOpen(false)}
        onConfirm={handleArchiveToggle}
      />

      <ConfirmationModal
        open={!!regenTarget}
        title="Regenerate assessment link?"
        message={
          <>
            This will create a new secure link for <strong>{regenTarget?.template?.name ?? 'this assessment'}</strong>. The old link will no longer work.
          </>
        }
        confirmLabel="Regenerate"
        variant="primary"
        onCancel={() => setRegenTarget(null)}
        onConfirm={async () => {
          if (!regenTarget) return;
          try {
            const { regenerateAssessmentToken } = await import('../services/assessmentBuilder');
            await regenerateAssessmentToken(regenTarget.id);
            setRegenTarget(null);
            load();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to regenerate link.');
            setRegenTarget(null);
          }
        }}
      />
    </BrokerLayout>
  );
}

function OverviewTab({ org, instances }: { org: OrganizationWithAssessment; instances: InstanceWithTemplate[] }) {
  const completedCount = instances.filter((i) => i.status === 'submitted' || i.status === 'report_ready').length;
  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <span className="eyebrow">Organization profile</span>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-neutral-muted">Industry</dt><dd className="text-navy font-medium">{org.industry ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Employees</dt><dd className="text-navy font-medium">{org.employee_count_range ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Locations</dt><dd className="text-navy font-medium">{org.number_of_locations ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Funding</dt><dd className="text-navy font-medium">{getFundingTypeLabel(org.funding_type)}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Contact</dt><dd className="text-navy font-medium">{org.client_contact_name ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Contact email</dt><dd className="text-navy font-medium text-right">{org.client_contact_email ?? '—'}</dd></div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <span className="eyebrow">Assessments</span>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-3 text-sm">
            <div className="flex justify-between"><dt className="text-neutral-muted">Total assessments</dt><dd className="text-navy font-medium">{instances.length}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Completed</dt><dd className="text-navy font-medium">{completedCount}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">In progress</dt><dd className="text-navy font-medium">{instances.filter((i) => i.status === 'in_progress').length}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Draft / link created</dt><dd className="text-navy font-medium">{instances.filter((i) => i.status === 'draft' || i.status === 'sent').length}</dd></div>
          </div>
        </Card>
      </div>

      <Card>
        <BrokerNotesPanel organizationId={org.id} />
      </Card>
    </div>
  );
}

function AssessmentsTab({
  org,
  instances,
  onCopyLink,
  onRegenerate,
  onReload,
}: {
  org: OrganizationWithAssessment;
  instances: InstanceWithTemplate[];
  onCopyLink: (token: string) => void;
  onRegenerate: (inst: InstanceWithTemplate) => void;
  onReload: () => void;
}) {
  void onReload;
  if (instances.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="No assessments yet"
          description="Send the first assessment to this client to get started."
          action={<Button to={`/assessments/send?org=${org.id}`} size="sm"><Plus className="w-4 h-4" /> Send assessment</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button to={`/assessments/send?org=${org.id}`} size="sm">
          <Plus className="w-4 h-4" /> Send another assessment
        </Button>
      </div>
      {instances.map((inst) => (
        <AssessmentInstanceCard key={inst.id} inst={inst} onCopyLink={onCopyLink} onRegenerate={onRegenerate} />
      ))}
    </div>
  );
}

function AssessmentInstanceCard({
  inst,
  onCopyLink,
  onRegenerate,
}: {
  inst: InstanceWithTemplate;
  onCopyLink: (token: string) => void;
  onRegenerate: (inst: InstanceWithTemplate) => void;
}) {
  const templateName = inst.template?.name ?? 'Assessment';
  const versionLabel = inst.version ? `v${inst.version.version_number}` : '';
  const hasScore = inst.overall_score !== null && inst.overall_score !== undefined;
  const isDraft = inst.status === 'draft';
  const isLinkCreated = inst.status === 'sent' || inst.status === 'not_opened';
  const isInProgress = inst.status === 'in_progress' || inst.status === 'opened';
  const isSubmitted = inst.status === 'submitted' || inst.status === 'report_ready';
  const isExpiredOrRevoked = inst.status === 'expired' || inst.status === 'revoked';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-semibold text-navy">{templateName}</h3>
            {versionLabel && <Badge variant="neutral">{versionLabel}</Badge>}
            <StatusBadge status={inst.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm mt-3">
            <div>
              <span className="text-xs text-neutral-muted uppercase tracking-wide">Respondent</span>
              <p className="text-navy font-medium">{inst.respondent_name ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs text-neutral-muted uppercase tracking-wide">Created</span>
              <p className="text-navy font-medium">{new Date(inst.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div>
              <span className="text-xs text-neutral-muted uppercase tracking-wide">Due date</span>
              <p className="text-navy font-medium">{inst.expires_at ? new Date(inst.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
            </div>
            <div>
              <span className="text-xs text-neutral-muted uppercase tracking-wide">Completed</span>
              <p className="text-navy font-medium">{inst.submitted_at ? new Date(inst.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
            </div>
          </div>
          {hasScore && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-neutral-border-soft">
              <div>
                <span className="text-xs text-neutral-muted uppercase tracking-wide">Overall score</span>
                <p className="font-mono text-lg font-bold text-navy tabular-nums">{Math.round(inst.overall_score!)}<span className="text-sm font-normal text-neutral-muted">/100</span></p>
              </div>
              {inst.primary_opportunity && (
                <div>
                  <span className="text-xs text-neutral-muted uppercase tracking-wide">Classification</span>
                  <p className="text-navy font-medium">{inst.primary_opportunity}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {(isDraft || isLinkCreated) && (
            <>
              <Button variant="outline" size="sm" onClick={() => onCopyLink(inst.secure_token)}>
                <Copy className="w-3.5 h-3.5" /> Copy link
              </Button>
              <Button variant="ghost" size="sm" to={`/assessment/${inst.secure_token}`}>
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onRegenerate(inst)}>
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Button>
            </>
          )}
          {isInProgress && (
            <>
              <Button variant="outline" size="sm" onClick={() => onCopyLink(inst.secure_token)}>
                <Copy className="w-3.5 h-3.5" /> Copy link
              </Button>
              <Button variant="ghost" size="sm" to={`/assessment/${inst.secure_token}`}>
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onRegenerate(inst)}>
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Button>
            </>
          )}
          {isSubmitted && (
            <Button variant="primary" size="sm" to={`/reports/${inst.id}`}>
              <FileText className="w-3.5 h-3.5" /> View report
            </Button>
          )}
          {isExpiredOrRevoked && (
            <>
              <Button variant="ghost" size="sm" to={`/reports/${inst.id}`}>
                <FileText className="w-3.5 h-3.5" /> View details
              </Button>
              <Button variant="outline" size="sm" to={`/assessments/send?org=${inst.organization_id}`}>
                <Plus className="w-3.5 h-3.5" /> New assessment
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
