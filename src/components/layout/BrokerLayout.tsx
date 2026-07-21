import type { ReactNode } from 'react';
import BrokerSidebar from './BrokerSidebar';
import BrokerTopbar from './BrokerTopbar';
import MobileNavigation from './MobileNavigation';

export default function BrokerLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-bg">
      <BrokerSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-neutral-border h-16 flex items-center px-4 sm:px-6 gap-3">
          <MobileNavigation />
          <h1 className="text-lg font-semibold text-navy truncate flex-1">{title}</h1>
          <BrokerTopbar />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
