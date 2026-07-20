import { useState } from 'react';
import { Link2, Copy, Check, RefreshCw, ExternalLink, Mail } from 'lucide-react';
import { regenerateAssessmentToken } from '../services/assessmentBuilder';
import ConfirmationModal from './ui/ConfirmationModal';

export default function ClientLinkPanel({
  token,
  organization,
  instanceId,
  respondentEmail,
  dateSent,
  dateOpened,
}: {
  token: string;
  organization: string;
  instanceId?: string;
  respondentEmail?: string | null;
  dateSent: string | null;
  dateOpened: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [currentToken, setCurrentToken] = useState(token);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = `${window.location.origin}/assessment/${currentToken}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked; ignore silently
    }
  };

  const invitationMessage = `Hello,\n\nYou've been invited to complete the Propel Well-being Opportunity Index for ${organization}.\n\nUse the secure link below to begin:\n${url}\n\nThis link is tied to your organization and can only be used once.\n\nThank you,\nPropel`;

  const copyInvitation = async () => {
    try {
      await navigator.clipboard.writeText(invitationMessage);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      // clipboard may be blocked; ignore silently
    }
  };

  const handleRegenerate = async () => {
    if (!instanceId) return;
    setShowConfirm(false);
    setRegenerating(true);
    setError(null);
    try {
      const result = await regenerateAssessmentToken(instanceId);
      if ('error' in result) {
        setError(result.error);
      } else {
        setCurrentToken(result.secure_token);
      }
    } catch (err) {
      console.error('[ClientLinkPanel.regenerate] Failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate link.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="rounded-md border border-neutral-border bg-neutral-bg/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-navy" />
        <span className="text-sm font-semibold text-navy">Assessment link created</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <code className="flex-1 min-w-0 truncate font-mono text-xs text-neutral-secondary bg-white border border-neutral-border rounded-sm px-3 py-2">
          {url}
        </code>
        <button
          onClick={copy}
          className="shrink-0 p-2 rounded-sm border border-neutral-border bg-white text-neutral-secondary hover:text-navy hover:border-navy/20 transition"
          aria-label="Copy link"
          title="Copy link"
        >
          {copied ? <Check className="w-4 h-4 text-green-dark" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={copyInvitation}
          className="flex items-center gap-1.5 text-xs font-medium text-navy hover:text-navy-mid transition px-2.5 py-1.5 rounded-sm border border-neutral-border bg-white"
        >
          {copiedInvite ? <Check className="w-3.5 h-3.5 text-green-dark" /> : <Mail className="w-3.5 h-3.5" />}
          {copiedInvite ? 'Copied' : 'Copy invitation message'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-navy hover:text-navy-mid transition px-2.5 py-1.5 rounded-sm border border-neutral-border bg-white"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open assessment
        </a>
      </div>

      {respondentEmail && (
        <p className="text-xs text-neutral-muted mb-2">
          Respondent email (reference only): {respondentEmail}
        </p>
      )}

      <div className="rounded-sm bg-orange-tint border border-orange/20 px-3 py-2 mb-3">
        <p className="text-xs text-orange-dark">
          Email delivery is not enabled. Copy and send this link to the client.
        </p>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-neutral-muted">
        {dateSent && <span>Sent {new Date(dateSent).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
        {dateOpened && <span>Opened {new Date(dateOpened).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
      </div>

      {error && (
        <p className="text-xs text-red mt-2">{error}</p>
      )}

      {instanceId && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-border-soft">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={regenerating}
            className="flex items-center gap-1.5 text-xs font-medium text-navy hover:text-navy-mid transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Regenerating…' : 'Regenerate link'}
          </button>
          <span className="text-neutral-muted text-xs">for {organization}</span>
        </div>
      )}

      {showConfirm && (
        <ConfirmationModal
          open={true}
          title="Regenerate assessment link?"
          message="A new secure link will be generated and the current link will stop working immediately. The assessment, responses, and client are preserved."
          confirmLabel="Regenerate"
          variant="primary"
          onConfirm={handleRegenerate}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
