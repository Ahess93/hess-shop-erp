import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  quotesApi,
  type Quote,
  type QuoteStatus,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
} from '../../api/quotes';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CreateQuoteModal } from './CreateQuoteModal';

const BADGE_VARIANT: Record<QuoteStatus, 'gold' | 'blue' | 'green' | 'red' | 'gray'> = {
  DRAFT: 'gray',
  SENT: 'blue',
  ACCEPTED: 'green',
  REJECTED: 'red',
};

export function QuotesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const canWrite = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => quotesApi.list(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) =>
      quotesApi.update(id, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotesApi.remove(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['quotes'] });
      setExpanded(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Quotes</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canWrite && <Button onClick={() => setShowCreate(true)}>+ New Quote</Button>}
      </div>

      {/* Table */}
      {quotes.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No quotes yet</p>
          {canWrite && (
            <p className="text-sm mt-1">Click "New Quote" to create your first quote.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                  Customer
                </th>
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Job</th>
                <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">Price</th>
                <th className="text-center px-4 py-3 text-[var(--text-muted)] font-medium">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <QuoteRow
                  key={quote.id}
                  quote={quote}
                  expanded={expanded === quote.id}
                  canWrite={canWrite}
                  onToggle={() => setExpanded(expanded === quote.id ? null : quote.id)}
                  onStatusChange={(status) => statusMutation.mutate({ id: quote.id, status })}
                  onDelete={() => deleteMutation.mutate(quote.id)}
                  statusPending={statusMutation.isPending}
                  deletePending={deleteMutation.isPending && expanded === quote.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateQuoteModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

interface RowProps {
  quote: Quote;
  expanded: boolean;
  canWrite: boolean;
  onToggle: () => void;
  onStatusChange: (status: QuoteStatus) => void;
  onDelete: () => void;
  statusPending: boolean;
  deletePending: boolean;
}

function QuoteRow({
  quote,
  expanded,
  canWrite,
  onToggle,
  onStatusChange,
  onDelete,
  statusPending,
  deletePending,
}: RowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const date = new Date(quote.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const transitions = STATUS_TRANSITIONS[quote.status];

  return (
    <>
      <tr
        className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-medium text-[var(--text)]">{quote.customer.businessName}</td>
        <td className="px-4 py-3 text-[var(--text-muted)]">
          {quote.job ? (
            <span className="font-mono text-xs text-[var(--gold)]">{quote.job.jobNumber}</span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]/50">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-bold text-[var(--text)]">
          ${Number(quote.calculatedPrice).toFixed(2)}
        </td>
        <td className="px-4 py-3 text-center">
          <Badge variant={BADGE_VARIANT[quote.status]}>{STATUS_LABELS[quote.status]}</Badge>
        </td>
        <td className="px-4 py-3 text-right text-[var(--text-muted)] text-xs">{date}</td>
        <td className="px-4 py-3 text-right">
          <span className="text-[var(--text-muted)] text-xs">{expanded ? '▲' : '▼'}</span>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
          <td colSpan={6} className="px-6 py-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-5">
              <div>
                <p className="text-[var(--text-muted)] text-xs mb-0.5">Labor Rate</p>
                <p className="font-medium text-[var(--text)]">
                  ${Number(quote.laborRate).toFixed(2)}/hr
                </p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-xs mb-0.5">Est. Run Time</p>
                <p className="font-medium text-[var(--text)]">
                  {Number(quote.estRunTime).toFixed(2)} hrs
                </p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-xs mb-0.5">Material Cost</p>
                <p className="font-medium text-[var(--text)]">
                  ${Number(quote.materialCost).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-xs mb-0.5">Markup</p>
                <p className="font-medium text-[var(--text)]">
                  {Number(quote.markupPct).toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* PDF download */}
              <a
                href={quotesApi.pdfUrl(quote.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--gold)]/50 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                📄 Download PDF
              </a>

              {/* Status transitions */}
              {canWrite && transitions.length > 0 && (
                <div className="flex gap-2">
                  {transitions.map((status) => (
                    <button
                      key={status}
                      disabled={statusPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(status);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold)]/50 hover:text-[var(--text)] transition-colors disabled:opacity-50"
                    >
                      Mark {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              )}

              {/* Delete */}
              {canWrite && (
                <div className="ml-auto flex gap-2">
                  {!confirmDelete ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/10 transition-colors"
                    >
                      Delete
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(false);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--gold)]/50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={deletePending}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--danger)] hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {deletePending ? 'Deleting…' : 'Confirm Delete'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
