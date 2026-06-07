import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/reports';

type ReportTab = 'revenue' | 'profitability' | 'ontime';

export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('revenue');

  const { data: revenue = [], isLoading: revLoading } = useQuery({
    queryKey: ['reports', 'revenue'],
    queryFn: () => reportsApi.revenueByCustomer(),
    enabled: tab === 'revenue',
  });

  const { data: profitability = [], isLoading: profLoading } = useQuery({
    queryKey: ['reports', 'profitability'],
    queryFn: () => reportsApi.jobProfitability(),
    enabled: tab === 'profitability',
  });

  const { data: ontime, isLoading: ontimeLoading } = useQuery({
    queryKey: ['reports', 'ontime'],
    queryFn: () => reportsApi.onTimeDelivery(),
    enabled: tab === 'ontime',
  });

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'revenue', label: 'Revenue by Customer' },
    { key: 'profitability', label: 'Job Profitability' },
    { key: 'ontime', label: 'On-Time Delivery' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text)] mb-6">Reports</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--surface-2)] rounded-lg p-1 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--gold)] text-black'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Revenue by customer */}
      {tab === 'revenue' && (
        <section>
          {revLoading ? (
            <Spinner />
          ) : revenue.length === 0 ? (
            <Empty message="No invoice data yet." />
          ) : (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                      Customer
                    </th>
                    <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                      Invoices
                    </th>
                    <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                      Invoiced
                    </th>
                    <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                      Collected
                    </th>
                    <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                      Outstanding
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.map((row) => (
                    <tr
                      key={row.customerId}
                      className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--text)]">{row.businessName}</p>
                        {row.email && (
                          <p className="text-xs text-[var(--text-muted)]">{row.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                        {row.invoiceCount}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--text)]">
                        ${row.totalInvoiced.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-500 font-medium">
                        ${row.totalPaid.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--gold)]">
                        ${(row.totalInvoiced - row.totalPaid).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--gold)]/30 bg-[var(--surface-2)]">
                    <td className="px-4 py-3 font-bold text-[var(--text)]">Total</td>
                    <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                      {revenue.reduce((s, r) => s + r.invoiceCount, 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--text)]">
                      ${revenue.reduce((s, r) => s + r.totalInvoiced, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-500 font-bold">
                      ${revenue.reduce((s, r) => s + r.totalPaid, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--gold)]">
                      ${revenue.reduce((s, r) => s + r.totalInvoiced - r.totalPaid, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Job profitability */}
      {tab === 'profitability' && (
        <section>
          {profLoading ? (
            <Spinner />
          ) : profitability.length === 0 ? (
            <Empty message="No job profitability data yet. Jobs need quotes and traveler cost data." />
          ) : (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                      Job
                    </th>
                    <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                      Customer
                    </th>
                    <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                      Quoted
                    </th>
                    <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                      Actual Cost
                    </th>
                    <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                      Margin
                    </th>
                    <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                      Margin %
                    </th>
                    <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                      Scrapped
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profitability.map((row) => {
                    const marginColor =
                      row.margin === null
                        ? 'text-[var(--text-muted)]'
                        : row.margin >= 0
                          ? 'text-emerald-500'
                          : 'text-[var(--danger)]';

                    return (
                      <tr
                        key={row.jobId}
                        className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]"
                      >
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-[var(--gold)]">{row.jobNumber}</p>
                          <p className="text-[var(--text)]">{row.partName}</p>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{row.customer}</td>
                        <td className="px-4 py-3 text-right text-[var(--text)]">
                          {row.quotedPrice !== null ? `$${row.quotedPrice.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--text)]">
                          {row.actualTotal !== null ? `$${row.actualTotal.toFixed(2)}` : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${marginColor}`}>
                          {row.margin !== null ? `$${row.margin.toFixed(2)}` : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${marginColor}`}>
                          {row.marginPct !== null ? `${row.marginPct}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                          {row.partsScrapped > 0 ? (
                            <span className="text-[var(--danger)]">{row.partsScrapped}</span>
                          ) : (
                            0
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* On-time delivery */}
      {tab === 'ontime' && (
        <section>
          {ontimeLoading ? (
            <Spinner />
          ) : !ontime ? (
            <Empty message="No delivery data yet." />
          ) : (
            <div className="space-y-6">
              {/* Big KPI */}
              <div className="grid grid-cols-4 gap-4">
                <KpiCard label="Total Jobs" value={String(ontime.totalJobs)} />
                <KpiCard label="Shipped" value={String(ontime.shippedJobs)} />
                <KpiCard label="On Time" value={String(ontime.onTimeJobs)} accent="green" />
                <KpiCard
                  label="On-Time Rate"
                  value={ontime.onTimePct !== null ? `${ontime.onTimePct}%` : '—'}
                  accent={
                    ontime.onTimePct === null
                      ? undefined
                      : ontime.onTimePct >= 90
                        ? 'green'
                        : ontime.onTimePct >= 70
                          ? 'gold'
                          : 'red'
                  }
                />
              </div>

              {ontime.shippedJobs > 0 && (
                <div>
                  <div className="w-full h-4 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{
                        width: `${ontime.onTimePct ?? 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-[var(--text-muted)]">
      <p className="text-3xl mb-3">📊</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'green' | 'gold' | 'red';
}) {
  const valueColor =
    accent === 'green'
      ? 'text-emerald-400'
      : accent === 'gold'
        ? 'text-[var(--gold)]'
        : accent === 'red'
          ? 'text-[var(--danger)]'
          : 'text-[var(--text)]';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
