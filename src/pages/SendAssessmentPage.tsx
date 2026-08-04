import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Mail, Calendar, Users, ClipboardList, Copy, ExternalLink } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import AssessmentOwnerBadge from '../components/builder/AssessmentOwnerBadge';
import { useAuth } from '../context/AuthContext';
import { createAssessmentInstance } from '../services/assessmentBuilder';
import { fetchAccessibleAssessments, type AccessibleAssessment } from '../services/assessments';
import { fetchOrganizations, createOrganization, type CreateOrganizationInput } from '../services/organizations';
import { logDbError } from '../lib/logger';
import type { OrganizationRow } from '../lib/database.types';

type Step = 0 | 1 | 2 | 3;

export default function SendAssessmentPage() {
  const { profile } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgContact, setNewOrgContact] = useState('');

  const [assessments, setAssessments] = useState<AccessibleAssessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [brokerMessage, setBrokerMessage] = useState('');

  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const selectedAssessment = assessments.find((a) => a.template.id === selectedAssessmentId) ?? null;

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [orgs, accessibleAssessments] = await Promise.all([
        fetchOrganizations(profile.id, { includeArchived: false }),
        fetchAccessibleAssessments(profile.role),
      ]);
      setOrganizations(orgs);
      setAssessments(accessibleAssessments);

      if (accessibleAssessments.length === 1) {
        setSelectedAssessmentId(accessibleAssessments[0].template.id);
      }
    } catch (err) {
      logDbError({ fn: 'SendAssessmentPage.loadData', error: err });
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
    if (!profile || !selectedOrgId || !selectedAssessment) return;
    setSubmitting(true);
    setError(null);
    try {
      const instance = await createAssessmentInstance({
        organization_id: selectedOrgId,
        broker_id: profile.id,
        assessment_template_id: selectedAssessment.template.id,
        assessment_version_id: selectedAssessment.version.id,
        respondent_name: respondentName,
        respondent_email: respondentEmail,
        expires_at: dueDate ? new Date(dueDate).toISOString() : null,
        broker_message: brokerMessage || null,
      });
      const link = `${window.location.origin}/assessment/${instance.secure_token}`;
      setCreatedLink(link);
      setStep(3);
    } catch (err) {
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

  const stepLabels = ['Select assessment', 'Configure invitation', 'Review', 'Create'];

  const canProceedFromStep0 = selectedOrgId && selectedAssessmentId;

  return (
    <BrokerLayout title="Send Assessment">
      <PageHeader
        title="Send Assessment"
        subtitle="Generate a secure link for a well-being assessment."
        breadcrumbs={[{ label: 'Assessments', to: '/assessments' }, { label: 'Send' }]}
        actions={<Button variant="ghost" size="sm" to="/assessments"><ArrowLeft className="w-4 h-4" /> Cancel</Button>}
      />

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

      {assessments.length === 0 && step < 3 && (
        <Card>
          <div className="text-center py-8">
            <ClipboardList className="w-10 h-10 text-neutral-muted mx-auto mb-3" />
            <h3 className="text-base font-semibold text-navy">No assessments available</h3>
            <p className="text-sm text-neutral-secondary mt-1">
              You don&apos;t have access to any published assessments yet. Contact a Superadmin.
            </p>
          </div>
        </Card>
      )}

      {/* Selected assessment summary (shown after step 0) */}
      {selectedAssessment && step > 0 && step < 3 && (
        <Card className="mb-6 bg-green-tint/30 border-green/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-tint flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-green-dark" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-navy">{selectedAssessment.template.name}</h3>
                <AssessmentOwnerBadge ownerType={selectedAssessment.template.owner_type} />
                <Badge variant="neutral">v{selectedAssessment.version.version_number}</Badge>
              </div>
              <p className="text-sm text-neutral-secondary mt-0.5">
                Latest published version will be used.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Step 0: Select assessment + client */}
      {step === 0 && assessments.length > 0 && (
        <div className="space-y-4">
          {/* Assessment selector — only shown when more than one accessible assessment */}
          {assessments.length > 1 && (
            <Card>
              <h3 className="text-base font-semibold text-navy mb-4">Select assessment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assessments.map((a) => (
                  <button
                    key={a.template.id}
                    type="button"
                    onClick={() => setSelectedAssessmentId(a.template.id)}
                    className={`text-left rounded-md border p-4 transition ${
                      selectedAssessmentId === a.template.id
                        ? 'border-green bg-green-tint ring-2 ring-green/20'
                        : 'border-neutral-border bg-white hover:border-navy/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ClipboardList className="w-4 h-4 text-navy" />
                      <span className="text-sm font-semibold text-navy">{a.template.name}</span>
                    </div>
                    {a.template.short_description && (
                      <p className="text-xs text-neutral-muted mt-1">{a.template.short_description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <AssessmentOwnerBadge ownerType={a.template.owner_type} />
                      <Badge variant="neutral">v{a.version.version_number}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Client selector */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-navy">Select client</h3>
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
                No clients yet. Click &quot;New client&quot; to create one.
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

      {/* Step 1: Configure invitation */}
      {step === 1 && (
        <Card className="space-y-4 max-w-2xl">
          <h3 className="text-base font-semibold text-navy">Configure invitation</h3>
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
            <label className="block text-sm font-medium text-navy mb-1.5">Reviewer message (optional)</label>
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

      {/* Step 2: Review */}
      {step === 2 && (
        <Card className="space-y-4 max-w-2xl">
          <h3 className="text-base font-semibold text-navy">Review</h3>
          <dl className="space-y-3 text-sm">
            <ReviewRow icon={Users} label="Client" value={organizations.find((o) => o.id === selectedOrgId)?.organization_name ?? '—'} />
            <ReviewRow icon={ClipboardList} label="Assessment" value={selectedAssessment?.template.name ?? '—'} />
            <ReviewRow icon={Check} label="Version" value={selectedAssessment ? `v${selectedAssessment.version.version_number} (latest published)` : '—'} />
            <ReviewRow icon={Mail} label="Respondent" value={respondentName ? `${respondentName} (${respondentEmail})` : '—'} />
            <ReviewRow icon={Calendar} label="Due date" value={dueDate || 'No due date'} />
            <ReviewRow icon={Check} label="Scoring" value={selectedAssessment?.template.scoring_enabled ? 'Included' : 'Not included'} />
            <ReviewRow icon={Check} label="Recommendations" value={selectedAssessment?.template.recommendations_enabled ? 'Included' : 'Not included'} />
          </dl>
          <Button variant="primary" size="lg" onClick={handleCreateInstance} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {submitting ? 'Creating…' : 'Create assessment link'}
          </Button>
        </Card>
      )}

      {/* Step 3: Created */}
      {step === 3 && createdLink && (
        <Card className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-tint flex items-center justify-center">
              <Check className="w-5 h-5 text-green-dark" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy">Assessment link created</h3>
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
                <Copy className="w-3.5 h-3.5" /> Copy Link
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const msg = `Hello,\n\nYou've been invited to complete the ${selectedAssessment?.template.name ?? 'assessment'} for ${organizations.find((o) => o.id === selectedOrgId)?.organization_name ?? 'your organization'}.\n\nUse the secure link below to begin:\n${createdLink}\n\nThank you,\nPropel`;
                navigator.clipboard.writeText(msg);
              }}
            >
              <Copy className="w-3.5 h-3.5" /> Copy Invitation Message
            </Button>
            <a href={createdLink} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-3.5 h-3.5" /> Open Assessment
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
              Email delivery is not enabled. Copy and send this assessment link to the client.
            </p>
          </div>
          <p className="text-xs text-neutral-muted">
            The link is tied to the exact published version of the assessment.
            Editing the assessment later will not affect this link.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="md" to={selectedOrgId ? `/clients/${selectedOrgId}` : '/clients'}>
              Return to Client
            </Button>
            <Button variant="outline" size="md" to="/assessments">Done</Button>
          </div>
        </Card>
      )}

      {/* Navigation */}
      {step < 3 && assessments.length > 0 && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="ghost" size="md" onClick={() => setStep((s) => Math.max(0, s - 1) as Step)} disabled={step === 0}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setStep((s) => Math.min(3, s + 1) as Step)}
            disabled={
              (step === 0 && !canProceedFromStep0) ||
              (step === 1 && (!respondentName.trim() || !respondentEmail.trim()))
            }
          >
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </BrokerLayout>
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
