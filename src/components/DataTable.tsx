import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  mobileLabel?: string;
  hideOnMobile?: boolean;
  className?: string;
};

export default function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) {
    return <div className="bg-white border border-neutral-border rounded-lg">{empty}</div>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-neutral-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-border bg-neutral-bg/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left font-semibold text-neutral-secondary text-xs uppercase tracking-wider px-4 py-3 ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-neutral-border-soft last:border-0 hover:bg-neutral-bg/30 transition"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3.5 align-middle ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="bg-white border border-neutral-border rounded-lg p-4">
            {columns
              .filter((c) => !c.hideOnMobile)
              .map((col) => (
                <div key={col.key} className="flex justify-between items-start gap-3 py-1.5 first:pt-0 last:pb-0 border-b border-neutral-border-soft last:border-0">
                  {col.mobileLabel && (
                    <span className="text-xs text-neutral-muted font-medium shrink-0 mt-0.5">
                      {col.mobileLabel}
                    </span>
                  )}
                  <span className="text-sm text-navy text-right min-w-0">{col.render(row)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
