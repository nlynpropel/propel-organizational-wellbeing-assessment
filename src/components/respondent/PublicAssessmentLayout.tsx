import type { ReactNode } from 'react';

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
          <img src="/Propel_Logo_2020_v4-3.png" alt="Propel" className="h-7 w-auto" />
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
