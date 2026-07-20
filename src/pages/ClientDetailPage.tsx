import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Archive,
  FileText,
  LayoutGrid,
  ClipboardList,
  Lightbulb,
  StickyNote,
  Target,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import OpportunitySpectrum from '../components/ui/OpportunitySpectrum';
import StrategyDimensionList from '../components/StrategyDimensionList';
import BehavioralReadinessList from '../components/BehavioralReadinessList';
import RecommendationCard from '../components/RecommendationCard';
import ClientLinkPanel from '../components/ClientLinkPanel';
import BrokerNotesPanel from '../components/BrokerNotesPanel';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import { fetchOrganizationById, archiveOrganization, unarchiveOrganization } from '../services/organizations';
import type { OrganizationWithAssessment } from '../services/organizations';
import {
  getFundingTypeLabel,
  getMonthLabel,
  PLACEHOLDER_STRATEGY_DIMENSIONS,
  PLACEHOLDER_BEHAVIORAL_DRIVERS,
} from '../lib/sampleData';
import { maturityClass } from '../lib/scores';

type TabKey = 'overview' | 'assessment' | 'recommendations' | 'reports' | 'notes';

const tabs: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'assessment', label: 'Assessment', icon: ClipboardList },
  { key: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'notes', label: 'Notes', icon: StickyNote },
];

// Placeholder recommendations — real recommendation engine is a future phase.
const PLACEHOLDER_RECS = [
  {
    id: 'ph-qw-1',
    title: 'Add a leadership video kickoff message to next open enrollment',
    dimension: 'Strategy and Leadership',
    tier: 'Quick Win' as const,
    kind: 'flag' as const,
    effort: 'Low effort' as const,
    impact: 'High visibility' as const,
  },
  {
    id: 'ph-qw-2',
    title: 'Publish a simple one-page "where to start" guide for new hires',
    dimension: 'Employee Relevance',
    tier: 'Quick Win' as const,
    kind: 'star' as const,
    effort: 'Low effort' as const,
    impact: 'Medium impact' as const,
  },
  {
    id: 'ph-hi-1',
    title: 'Build a 12-month measurement plan tied to 3 outcome metrics',
    dimension: 'Measurement and Improvement',
    tier: 'High-Impact Move' as const,
    kind: 'target' as const,
    effort: 'High effort' as const,
    impact: 'High impact' as const,
  },
];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const location = useLocation();
  const [org, setOrg] = useState<OrganizationWithAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrganizationById(profile.id, id);
      setOrg(data);
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
        <ErrorState
          message={error ?? 'Organization not found or you do not have access.'}
          onRetry={load}
        />
      </BrokerLayout>
    );
  }

  const assessment = org.latest_assessment;
  const hasScore = assessment?.overall_score !== null && assessment?.overall_score !== undefined;

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
          <p className="text-sm text-green-dark font-medium">
            Client created. A draft assessment instance was also created.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-semibold text-navy">{org.organization_name}</h1>
            {assessment ? (
              <StatusBadge status={assessment.status} />
            ) : (
              <Badge variant="neutral" dot>Draft</Badge>
            )}
            {org.archived_at && <Badge variant="neutral">Archived</Badge>}
          </div>
          <p className="text-sm text-neutral-secondary mt-1">
            {org.industry ?? 'No industry'} · {org.employee_count_range ?? 'Unknown size'}
            {org.number_of_locations !== null && ` · ${org.number_of_locations} locations`}
            {' · '}{getFundingTypeLabel(org.funding_type)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="text-neutral-muted">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download PDF</span>
          </Button>
          <Button variant="outline" size="sm" className="text-neutral-muted">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Regenerate Report</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setArchiveOpen(true)}>
            <Archive className="w-4 h-4" />
            <span className="hidden sm:inline">{org.archived_at ? 'Unarchive' : 'Archive'}</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
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

      {activeTab === 'overview' && <OverviewTab org={org} assessment={assessment} hasScore={hasScore} />}
      {activeTab === 'assessment' && <AssessmentTab org={org} assessment={assessment} />}
      {activeTab === 'recommendations' && <RecommendationsTab hasScore={hasScore} />}
      {activeTab === 'reports' && <ReportsTab org={org} hasScore={hasScore} />}
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
    </BrokerLayout>
  );
}

function OverviewTab({
  org,
  assessment,
  hasScore,
}: {
  org: OrganizationWithAssessment;
  assessment: OrganizationWithAssessment['latest_assessment'];
  hasScore: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Profile + status */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <span className="eyebrow">Organization profile</span>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-neutral-muted">Industry</dt><dd className="text-navy font-medium">{org.industry ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Employees</dt><dd className="text-navy font-medium">{org.employee_count_range ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Locations</dt><dd className="text-navy font-medium">{org.number_of_locations ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Funding</dt><dd className="text-navy font-medium">{getFundingTypeLabel(org.funding_type)}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Renewal</dt><dd className="text-navy font-medium">{getMonthLabel(org.renewal_month)}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Contact</dt><dd className="text-navy font-medium">{org.client_contact_name ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Contact email</dt><dd className="text-navy font-medium text-right">{org.client_contact_email ?? '—'}</dd></div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <span className="eyebrow">Assessment status</span>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-3 text-sm">
            <div className="flex justify-between items-center">
              <dt className="text-neutral-muted">Status</dt>
              <dd>{assessment ? <StatusBadge status={assessment.status} /> : <Badge variant="neutral" dot>Draft</Badge>}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-neutral-muted">Overall score</dt>
              <dd className="font-mono font-bold text-navy">
                {hasScore ? Math.round(assessment!.overall_score!) : '—'}
                {hasScore && <span className="text-neutral-muted font-normal text-xs">/100</span>}
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Date sent</dt><dd className="text-navy">{assessment?.sent_at ? new Date(assessment.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Date opened</dt><dd className="text-navy">{assessment?.opened_at ? new Date(assessment.opened_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-neutral-muted">Date completed</dt><dd className="text-navy">{assessment?.submitted_at ? new Date(assessment.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</dd></div>
            {hasScore && (
              <div className="flex justify-between items-center"><dt className="text-neutral-muted">Classification</dt><dd><Badge variant="neutral">{maturityClass(assessment!.overall_score!)}</Badge></dd></div>
            )}
          </div>
          {assessment && (
            <div className="mt-4 pt-4 border-t border-neutral-border-soft">
              <ClientLinkPanel
                token={assessment.secure_token}
                organization={org.organization_name}
                instanceId={assessment.id}
                respondentEmail={assessment.respondent_email}
                dateSent={assessment.sent_at}
                dateOpened={assessment.opened_at}
              />
            </div>
          )}
        </Card>
      </div>

      {hasScore ? (
        <>
          <Card>
            <OpportunitySpectrum score={Math.round(assessment!.overall_score!)} />
          </Card>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card>
              <h3 className="font-display text-base font-semibold text-navy mb-1">Strategy dimensions</h3>
              <p className="text-xs text-neutral-muted mb-4">Placeholder data — scoring engine not yet implemented</p>
              <StrategyDimensionList dimensions={PLACEHOLDER_STRATEGY_DIMENSIONS} />
            </Card>
            <Card>
              <h3 className="font-display text-base font-semibold text-navy mb-1">Behavioral readiness</h3>
              <p className="text-xs text-neutral-muted mb-4">Placeholder data — scoring engine not yet implemented</p>
              <BehavioralReadinessList drivers={PLACEHOLDER_BEHAVIORAL_DRIVERS} />
            </Card>
          </div>

          <Card>
            <h3 className="font-display text-base font-semibold text-navy mb-1 flex items-center gap-2">
              <Target className="w-4 h-4 text-orange" />
              Priority recommendations
            </h3>
            <p className="text-xs text-neutral-muted mb-4">Placeholder data — recommendation engine not yet implemented</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {PLACEHOLDER_RECS.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="No results yet"
            description="Once the client completes the assessment, scores and recommendations will appear here."
          />
        </Card>
      )}

      <Card>
        <BrokerNotesPanel organizationId={org.id} />
      </Card>
    </div>
  );
}

function AssessmentTab({
  org,
  assessment,
}: {
  org: OrganizationWithAssessment;
  assessment: OrganizationWithAssessment['latest_assessment'];
}) {
  return (
    <div className="space-y-5">
      <Card>
        {assessment ? (
          <ClientLinkPanel
            token={assessment.secure_token}
            organization={org.organization_name}
            instanceId={assessment.id}
            respondentEmail={assessment.respondent_email}
            dateSent={assessment.sent_at}
            dateOpened={assessment.opened_at}
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No assessment instance"
            description="A draft assessment was created with this client. It will appear here once loaded."
          />
        )}
      </Card>
      {assessment && (
        <Card>
          <span className="eyebrow">Assessment timeline</span>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Assessment created', date: assessment.created_at, done: true },
              { label: 'Assessment link created', date: assessment.sent_at, done: !!assessment.sent_at },
              { label: 'Client opened assessment', date: assessment.opened_at, done: !!assessment.opened_at },
              { label: 'Assessment submitted', date: assessment.submitted_at, done: !!assessment.submitted_at },
              { label: 'Report generated', date: assessment.status === 'report_ready' ? assessment.submitted_at : null, done: assessment.status === 'report_ready' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${step.done ? 'bg-green' : 'bg-neutral-border'}`} />
                <span className={`text-sm flex-1 ${step.done ? 'text-navy' : 'text-neutral-muted'}`}>{step.label}</span>
                <span className="text-xs text-neutral-muted">
                  {step.date ? new Date(step.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <p className="text-xs text-neutral-muted px-1">
        The full assessment questionnaire will be built in a later phase.
      </p>
    </div>
  );
}

function RecommendationsTab({ hasScore }: { hasScore: boolean }) {
  if (!hasScore) {
    return (
      <Card>
        <EmptyState
          icon={Lightbulb}
          title="No recommendations yet"
          description="Recommendations are generated after the client completes the assessment."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-xs text-neutral-muted px-1">
        Placeholder data — recommendation engine not yet implemented.
      </p>
      <div>
        <h3 className="font-display text-base font-semibold text-navy mb-3">Quick wins</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {PLACEHOLDER_RECS.filter((r) => r.tier === 'Quick Win').map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-display text-base font-semibold text-navy mb-3">High-impact moves</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {PLACEHOLDER_RECS.filter((r) => r.tier === 'High-Impact Move').map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ org, hasScore }: { org: OrganizationWithAssessment; hasScore: boolean }) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="eyebrow">Client-ready report</span>
            <h3 className="font-display text-lg font-semibold text-navy mt-1">Propel Well-being Opportunity Report</h3>
            <p className="text-sm text-neutral-secondary mt-1.5 max-w-md">
              A polished, client-shareable report with maturity scoring, priority opportunities, and recommendations.
            </p>
          </div>
          {hasScore && (
            <Button to={`/clients/${org.id}/results`} size="sm">
              <FileText className="w-4 h-4" />
              View results
            </Button>
          )}
        </div>
      </Card>

      <Card padding={false}>
        <div className="p-5 border-b border-neutral-border-soft">
          <h3 className="font-display text-base font-semibold text-navy">Report versions</h3>
        </div>
        {hasScore ? (
          <div className="divide-y divide-neutral-border-soft">
            <div className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-sm font-medium text-navy">Version 1.0</p>
                <p className="text-xs text-neutral-muted">
                  Generated {org.latest_assessment?.submitted_at
                    ? new Date(org.latest_assessment.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </p>
              </div>
              <Button variant="outline" size="sm" className="text-neutral-muted">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState icon={FileText} title="No reports yet" description="Reports become available once the assessment is complete." />
        )}
      </Card>

      <p className="text-xs text-neutral-muted px-1">
        PDF generation will be implemented in a later phase. Download is a placeholder.
      </p>
    </div>
  );
}
