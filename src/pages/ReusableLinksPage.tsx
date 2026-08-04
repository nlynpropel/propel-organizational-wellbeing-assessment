import { useState, useEffect, useCallback } from 'react';
import { Link, Copy, Plus, Power, PowerOff, ExternalLink, Calendar, Tag, Loader2 } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import {
  generateReusableLink,
  fetchReusableLinks,
  updateReusableLink,
  type GenerateLinkInput,
} from '../services/reusableLinks';
import { fetchAccessibleAssessments, type AccessibleAssessment } from '../services/assessments';
import type { ReusableAssessmentLinkRow } from '../lib/database.types';

type LinkWithTemplate = ReusableAssessmentLinkRow & {
  template_name?: string;
};

export default function ReusableLinksPage() {
  const { profile } = useAuth();
  const [links, setLinks] = useState<LinkWithTemplate[]>([]);
  const [assessments, setAssessments] = useState<AccessibleAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState<{ label: string; expires_at: string; assessmentId: string }>({
    label: '',
    expires_at: '',
    assessmentId: '',
  });
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isSuperadmin = profile?.role === 'superadmin';
  // Non-superadmins only see their own links (enforced in fetchReusableLinks service)

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [linkData, assessData] = await Promise.all([
        fetchReusableLinks(profile.id, isSuperadmin),
        fetchAccessibleAssessments(profile.role),
      ]);
      setAssessments(assessData);

      const enriched: LinkWithTemplate[] = linkData.map((link) => {
        const assess = assessData.find((a) => a.template.id === link.assessment_template_id);
        return { ...link, template_name: assess?.template.name ?? 'Unknown' };
      });
      setLinks(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load links.');
    } finally {
      setLoading(false);
    }
  }, [profile, isSuperadmin]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    if (!profile || !genForm.assessmentId) return;
    const assess = assessments.find((a) => a.template.id === genForm.assessmentId);
    if (!assess) return;

    setGenerating(true);
    setError(null);
    try {
      const input: GenerateLinkInput = {
        assessment_template_id: assess.template.id,
        assessment_version_id: assess.version.id,
        label: genForm.label.trim() || null,
        expires_at: genForm.expires_at ? new Date(genForm.expires_at).toISOString() : null,
      };
      await generateReusableLink(input);
      setShowGenerate(false);
      setGenForm({ label: '', expires_at: '', assessmentId: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleActive = async (link: LinkWithTemplate) => {
    try {
      await updateReusableLink(link.id, { is_active: !link.is_active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update link.');
    }
  };

  const handleCopy = (link: LinkWithTemplate) => {
    const url = `${window.location.origin}/intake/${link.opaque_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'No expiration';
    const d = new Date(date);
    const expired = d < new Date();
    return `${d.toLocaleDateString()}${expired ? ' (expired)' : ''}`;
  };

  return (
    <BrokerLayout title="Reusable Intake Links">
      <PageHeader
        title="Reusable Intake Links"
        subtitle="Generate open links that let respondents fill an intake form and complete an assessment."
        breadcrumbs={[{ label: 'Assessments', to: '/assessments' }, { label: 'Intake Links' }]}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowGenerate(!showGenerate)}>
            <Plus className="w-4 h-4" /> Generate Link
          </Button>
        }
      />

      {error && <div className="mb-4"><ErrorState message={error} onRetry={() => setError(null)} /></div>}

      {showGenerate && (
        <Card className="mb-6">
          <h3 className="text-base font-semibold text-navy mb-4">Generate a new reusable link</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Assessment *</label>
              <select
                value={genForm.assessmentId}
                onChange={(e) => setGenForm({ ...genForm, assessmentId: e.target.value })}
                className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
              >
                <option value="">Select an assessment</option>
                {assessments.map((a) => (
                  <option key={a.template.id} value={a.template.id}>
                    {a.template.name} (v{a.version.version_number})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Internal label (optional)</label>
                <input
                  type="text"
                  value={genForm.label}
                  onChange={(e) => setGenForm({ ...genForm, label: e.target.value })}
                  placeholder="e.g. Q3 outreach campaign"
                  className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Expiration date (optional)</label>
                <input
                  type="date"
                  value={genForm.expires_at}
                  onChange={(e) => setGenForm({ ...genForm, expires_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-navy text-sm focus:outline-none focus:border-green focus:ring-1 focus:ring-green/20"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={handleGenerate} disabled={generating || !genForm.assessmentId}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                Generate Link
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowGenerate(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingState label="Loading links…" />
      ) : links.length === 0 ? (
        <EmptyState
          icon={Link}
          title="No reusable links yet"
          description="Generate a link to let respondents fill an intake form and complete an assessment on their own."
        />
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const isExpired = link.expires_at !== null && new Date(link.expires_at) < new Date();
            const status = !link.is_active ? 'Inactive' : isExpired ? 'Expired' : 'Active';
            const statusVariant = !link.is_active || isExpired ? 'neutral' : 'success';

            return (
              <Card key={link.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-base font-semibold text-navy">{link.template_name}</h3>
                    <Badge variant={statusVariant as 'neutral' | 'success'}>{status}</Badge>
                    {link.submission_count > 0 && (
                      <Badge variant="info">{link.submission_count} submission{link.submission_count !== 1 ? 's' : ''}</Badge>
                    )}
                  </div>
                  {link.label && (
                    <p className="text-sm text-neutral-muted flex items-center gap-1 mt-0.5">
                      <Tag className="w-3.5 h-3.5" /> {link.label}
                    </p>
                  )}
                  <p className="text-xs text-neutral-muted flex items-center gap-1 mt-1">
                    <Calendar className="w-3.5 h-3.5" /> {formatDate(link.expires_at)}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <code className="text-xs text-neutral-secondary bg-neutral-bg px-2 py-1 rounded font-mono truncate max-w-xs">
                      {window.location.origin}/intake/{link.opaque_token.slice(0, 8)}…
                    </code>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(link)}>
                    {copiedId === link.id ? <Checkmark /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === link.id ? 'Copied' : 'Copy'}
                  </Button>
                  <a href={`${window.location.origin}/intake/${link.opaque_token}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                  {link.is_active ? (
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(link)} title="Deactivate">
                      <PowerOff className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(link)} title="Activate">
                      <Power className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </BrokerLayout>
  );
}

function Checkmark() {
  return <span className="text-xs text-green-dark">✓</span>;
}
