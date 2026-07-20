import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

export default function PublicAssessmentLayout({
  children,
  organizationName,
}: {
  children: ReactNode;
  organizationName: string | null;
}) {
  return (
    <div className="min-h-screen bg-neutral-bg flex flex-col">
      <header className="bg-white border-b border-neutral-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-green flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-navy-deep" />
          </div>
          <span className="font-display text-lg font-semibold text-navy">Propel</span>
          {organizationName && (
            <span className="text-sm text-neutral-muted ml-auto hidden sm:inline">
              for {organizationName}
            </span>
          )}
        </div>
      </header>
      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">{children}</div>
      </main>
      <footer className="py-6 text-center text-xs text-neutral-muted">
        Secure assessment · Powered by Propel
      </footer>
    </div>
  );
}
