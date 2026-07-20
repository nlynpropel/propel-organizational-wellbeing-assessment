import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Mail, Calendar, Users, ClipboardList } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import AssessmentOwnerBadge from '../components/builder/AssessmentOwnerBadge';
import RecommendationEligibilityBadge from '../components/builder/RecommendationEligibilityBadge';
import { useAuth } from '../context/AuthContext';
import { fetchTemplatesForBroker, fetchQuestionCountForVersion, createAssessmentInstance } from '../services/assessmentBuilder';
import { fetchOrganizations, createOrganization, type CreateOrganizationInput } from '../services/organizations';
import type { AssessmentTemplateWithVersion, OrganizationRow } from '../lib/database.types';

type Step = 0 | 1 | 2 | 3 | 4;

const stepLabels = ['Select client', 'Select assessment', 'Configure invitation', 'Review', 'Create'];

export default function SendAssessmentPage() {
  const { profile } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0: select client
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgContact, setNewOrgContact] = useState('');

  // Step 1: select assessment
  const [templates, setTemplates] = useState<AssessmentTemplateWithVersion[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AssessmentTemplateWithVersion | null>(null);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});

  // Step 2: configure
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [brokerMessage, setBrokerMessage] = useState('');

  // Step 4: result
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [orgs, tmpls] = await Promise.all([
        fetchOrganizations(profile.id, { includeArchived: false }),
        fetchTemplatesForBroker(profile.id),
      ]);
      setOrganizations(orgs);
      setTemplates(tmpls.filter((t) => t.status === 'published' && t.latest_version?.status === 'published'));

      // Load question counts
      const counts: Record<string, number> = {};
      for (const t of tmpls) {
        if (t.latest_version) {
          counts[t.latest_version.id] = await fetchQuestionCountForVersion(t.latest_version.id);
        }
      }
      setQuestionCounts(counts);
    } catch (err) {
      console.error('[SendAssessmentPage.loadData] Failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateOrg = async () => {
    if (!profile || !newOrgName.trim()) return;
    setSubmitting(true);
    try {
      const input: CreateOrganizationInput = {
        organization_name: newOrgName.trim(),
        client_contact_name: newOrgContact.trim() || undefined,
      };
      const org = await createOrganization(profile.id, input);
      setOrganizations([...organizations, org]);
      setSelectedOrgId(org.id);
      setShowNewOrg(false);
      setNewOrgName('');
      setNewOrgContact('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!profile || !selectedOrgId || !selectedTemplate?.latest_version) return;
    setSubmitting(true);
    setError(null);
    try {
      const instance = await createAssessmentInstance({
        organization_id: selectedOrgId,
        broker_id: profile.id,
        assessment_template_id: selectedTemplate.id,
        assessment_version_id: selectedTemplate.latest_version.id,
        respondent_name: respondentName,
        respondent_email: respondentEmail,
        expires_at: dueDate ? new Date(dueDate).toISOString() : null,
        broker_message: brokerMessage || null,
      });
      const link = `${window.location.origin}/assessment/${instance.secure_token}`;
      setCreatedLink(link);
      setStep(4);
    } catch (err) {
      console.error('[SendAssessmentPage.handleCreateInstance] Failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create assessment instance.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <BrokerLayout title="Send Assessment">
        <LoadingState label="Loading…" />
      </BrokerLayout>
    );
  }

  const propelTemplates = templates.filter((t) => t.owner_type === 'propel');
  const myTemplates = templates.filter((t) => t.owner_type === 'broker');

  return (
    <BrokerLayout title="Send Assessment">
      <PageHeader
        title="Send Assessment"
        subtitle="Select a client, choose an assessment, and generate a secure link to send."
        breadcrumbs={[{ label: 'Assessments', to: '/assessments' }, { label: 'Send' }]}
        actions={<Button variant="ghost" size="sm" to="/assessments"><ArrowLeft className="w-4 h-4" /> Cancel</Button>}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
              i === step ? 'bg-navy text-white' : i < step ? 'bg-green-tint text-green-dark' : 'bg-neutral-bg text-neutral-muted'
            }`}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-white/20">
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < stepLabels.length - 1 && <div className="w-4 h-px bg-neutral-border" />}
          </div>
        ))}
      </div>

      {error && <div className="mb-4"><ErrorState message={error} onRetry={() => setError(null)} /></div>}

      {/* Step 0: Select client */}
      {step === 0 && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-navy">Select client</h3>
              <Button variant="outline" size="sm" onClick={() => setShowNewOrg(!showNewOrg)}>
                {showNewOrg ? 'Cancel' : '+ New client'}
              </Button>
            </div>

            {showNewOrg && (
              <div className="rounded-md border border-neutral-border bg-neutral-bg/30 p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-navy mb-1">Organization name *</label>
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy mb-1">Client contact name</label>
                  <input
                    type="text"
                    value={newOrgContact}
                    onChange={(e) => setNewOrgContact(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
                  />
                </div>
                <Button variant="primary" size="sm" onClick={handleCreateOrg} disabled={submitting || !newOrgName.trim()}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create client
                </Button>
              </div>
            )}

            {organizations.length === 0 && !showNewOrg ? (
              <p className="text-sm text-neutral-muted text-center py-8">
                No clients yet. Click "New client" to create one.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => setSelectedOrgId(org.id)}
                    className={`text-left rounded-md border p-4 transition ${
                      selectedOrgId === org.id
                        ? 'border-green bg-green-tint ring-2 ring-green/20'
                        : 'border-neutral-border bg-white hover:border-navy/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-navy" />
                      <span className="text-sm font-semibold text-navy">{org.organization_name}</span>
                    </div>
                    {org.client_contact_name && (
                      <p className="text-xs text-neutral-muted mt-1">{org.client_contact_name}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Step 1: Select assessment */}
      {step === 1 && (
        <div className="space-y-6">
          {propelTemplates.length > 0 && (
            <div>
              <h3 className="font-display text-sm font-semibold text-navy mb-3 eyebrow">Propel Assessments</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {propelTemplates.map((t) => (
                  <AssessmentCard
                    key={t.id}
                    template={t}
                    questionCount={t.latest_version ? questionCounts[t.latest_version.id] ?? 0 : 0}
                    selected={selectedTemplate?.id === t.id}
                    onSelect={() => setSelectedTemplate(t)}
                  />
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="font-display text-sm font-semibold text-navy mb-3 eyebrow">My Assessments</h3>
            {myTemplates.length === 0 ? (
              <Card><p className="text-sm text-neutral-muted text-center py-6">No custom assessments yet. Create one from the Assessments page.</p></Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myTemplates.map((t) => (
                  <AssessmentCard
                    key={t.id}
                    template={t}
                    questionCount={t.latest_version ? questionCounts[t.latest_version.id] ?? 0 : 0}
                    selected={selectedTemplate?.id === t.id}
                    onSelect={() => setSelectedTemplate(t)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Configure invitation */}
      {step === 2 && (
        <Card className="space-y-4 max-w-2xl">
          <h3 className="font-display text-base font-semibold text-navy">Configure invitation</h3>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Respondent name *</label>
            <input
              type="text"
              value={respondentName}
              onChange={(e) => setRespondentName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Respondent email *</label>
            <input
              type="email"
              value={respondentEmail}
              onChange={(e) => setRespondentEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Due date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Broker message (optional)</label>
            <textarea
              value={brokerMessage}
              onChange={(e) => setBrokerMessage(e.target.value)}
              placeholder="Personal message for the respondent"
              rows={3}
              className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
            />
          </div>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <Card className="space-y-4 max-w-2xl">
          <h3 className="font-display text-base font-semibold text-navy">Review</h3>
          <dl className="space-y-3 text-sm">
            <ReviewRow icon={Users} label="Client" value={organizations.find((o) => o.id === selectedOrgId)?.organization_name ?? '—'} />
            <ReviewRow icon={ClipboardList} label="Assessment" value={selectedTemplate?.name ?? '—'} />
            <ReviewRow icon={Check} label="Version" value={selectedTemplate?.latest_version ? `v${selectedTemplate.latest_version.version_number}` : '—'} />
            <ReviewRow icon={Mail} label="Respondent" value={respondentName ? `${respondentName} (${respondentEmail})` : '—'} />
            <ReviewRow icon={Calendar} label="Due date" value={dueDate || 'No due date'} />
            <ReviewRow icon={Check} label="Scoring" value={selectedTemplate?.scoring_enabled ? 'Included' : 'Not included'} />
            <ReviewRow icon={Check} label="Recommendations" value={selectedTemplate?.recommendations_enabled ? 'Included' : 'Not included'} />
          </dl>
          <Button variant="primary" size="lg" onClick={handleCreateInstance} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {submitting ? 'Creating…' : 'Create assessment link'}
          </Button>
        </Card>
      )}

      {/* Step 4: Created */}
      {step === 4 && createdLink && (
        <Card className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-tint flex items-center justify-center">
              <Check className="w-5 h-5 text-green-dark" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-navy">Assessment link created</h3>
              <p className="text-sm text-neutral-secondary">Share this secure link with your respondent.</p>
            </div>
          </div>
          <div className="rounded-md border border-neutral-border bg-neutral-bg/30 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={createdLink}
                readOnly
                className="flex-1 bg-transparent text-sm text-navy font-mono outline-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(createdLink)}
              >
                Copy Link
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const msg = `Hello,\n\nYou've been invited to complete an assessment for ${organizations.find((o) => o.id === selectedOrgId)?.organization_name ?? 'your organization'}.\n\nUse the secure link below to begin:\n${createdLink}\n\nThank you,\nPropel`;
                navigator.clipboard.writeText(msg);
              }}
            >
              Copy Invitation Message
            </Button>
            <a href={createdLink} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Open Assessment
              </Button>
            </a>
          </div>
          {respondentEmail && (
            <p className="text-xs text-neutral-muted">
              Respondent email (reference only): {respondentEmail}
            </p>
          )}
          <div className="rounded-sm bg-orange-tint border border-orange/20 px-3 py-2">
            <p className="text-xs text-orange-dark">
              Email delivery is not enabled. Copy and send this link to the client.
            </p>
          </div>
          <p className="text-xs text-neutral-muted">
            The link is tied to the exact version of the assessment that was selected.
            Editing the assessment later will not affect this link.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="md" to="/assessments">Done</Button>
            <Button variant="outline" size="md" to="/clients">View clients</Button>
          </div>
        </Card>
      )}

      {/* Navigation */}
      {step < 4 && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="ghost" size="md" onClick={() => setStep((s) => Math.max(0, s - 1) as Step)} disabled={step === 0}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setStep((s) => Math.min(4, s + 1) as Step)}
            disabled={
              (step === 0 && !selectedOrgId) ||
              (step === 1 && !selectedTemplate) ||
              (step === 2 && (!respondentName.trim() || !respondentEmail.trim()))
            }
          >
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </BrokerLayout>
  );
}

function AssessmentCard({
  template,
  questionCount,
  selected,
  onSelect,
}: {
  template: AssessmentTemplateWithVersion;
  questionCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border p-5 transition ${
        selected
          ? 'border-green bg-green-tint ring-2 ring-green/20'
          : 'border-neutral-border bg-white hover:border-navy/20 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-display text-base font-semibold text-navy">{template.name}</h4>
        {selected && <Check className="w-5 h-5 text-green-dark shrink-0" />}
      </div>
      {template.short_description && (
        <p className="text-sm text-neutral-secondary mb-3">{template.short_description}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <AssessmentOwnerBadge ownerType={template.owner_type} />
        {template.category && <Badge variant="neutral">{template.category}</Badge>}
        {template.estimated_minutes && <Badge variant="neutral">{template.estimated_minutes} min</Badge>}
        <Badge variant="neutral">{questionCount} questions</Badge>
      </div>
      <div className="flex items-center gap-2">
        {template.scoring_enabled && <Badge variant="progress">Scoring</Badge>}
        <RecommendationEligibilityBadge ownerType={template.owner_type} recommendationsEnabled={template.recommendations_enabled} />
      </div>
    </button>
  );
}

function ReviewRow({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-border-soft pb-2">
      <dt className="flex items-center gap-2 text-neutral-muted">
        <Icon className="w-4 h-4" />
        {label}
      </dt>
      <dd className="text-navy font-medium">{value}</dd>
    </div>
  );
}
