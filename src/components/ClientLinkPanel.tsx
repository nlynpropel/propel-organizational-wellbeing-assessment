import { useState } from 'react';
import { Link2, Copy, Check, RefreshCw } from 'lucide-react';

export default function ClientLinkPanel({
  token,
  organization,
  dateSent,
  dateOpened,
}: {
  token: string;
  organization: string;
  dateSent: string | null;
  dateOpened: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/assessment/${token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked; ignore silently
    }
  };

  return (
    <div className="rounded-md border border-neutral-border bg-neutral-bg/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-navy" />
        <span className="text-sm font-semibold text-navy">Secure assessment link</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <code className="flex-1 min-w-0 truncate font-mono text-xs text-neutral-secondary bg-white border border-neutral-border rounded-sm px-3 py-2">
          {url}
        </code>
        <button
          onClick={copy}
          className="shrink-0 p-2 rounded-sm border border-neutral-border bg-white text-neutral-secondary hover:text-navy hover:border-navy/20 transition"
          aria-label="Copy link"
        >
          {copied ? <Check className="w-4 h-4 text-green-dark" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-neutral-muted">
        {dateSent && <span>Sent {new Date(dateSent).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
        {dateOpened && <span>Opened {new Date(dateOpened).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
        {!dateSent && <span className="text-orange">Not yet sent — placeholder link</span>}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-border-soft">
        <button className="flex items-center gap-1.5 text-xs font-medium text-navy hover:text-navy-mid transition">
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerate link
        </button>
        <span className="text-neutral-muted text-xs">for {organization}</span>
      </div>
    </div>
  );
}
