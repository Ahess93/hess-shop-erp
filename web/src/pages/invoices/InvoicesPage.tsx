import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invoicesApi,
  type Invoice,
  type InvoiceStatus,
  type LineItem,
  type CreateInvoiceDto,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TRANSITIONS,
} from '../../api/invoices';
import { customersApi } from '../../api/customers';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const STATUS_BADGE: Record<InvoiceStatus, 'gold' | 'blue' | 'green' | 'red' | 'gray'> = {
  DRAFT: 'gray',
  SENT: 'blue',
  PAID: 'green',
  OVERDUE: 'red',
};

export function InvoicesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const canWrite = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      invoicesApi.update(id, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.remove(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoices'] });
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

  const totalOutstanding = invoices
    .filter((i) => i.status === 'SENT' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Invoices</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            {totalOutstanding > 0 && (
              <span className="ml-2 text-[var(--gold)]">
                · ${totalOutstanding.toFixed(2)} outstanding
              </span>
            )}
          </p>
        </div>
        {canWrite && <Button onClick={() => setShowCreate(true)}>+ New Invoice</Button>}
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p className="text-4xl mb-3">🧾</p>
          <p className="font-medium">No invoices yet</p>
          {canWrite && (
            <p className="text-sm mt-1">Click "New Invoice" to create your first invoice.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">#</th>
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                  Customer
                </th>
                <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">Total</th>
                <th className="text-center px-4 py-3 text-[var(--text-muted)] font-medium">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">Due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  expanded={expanded === inv.id}
                  canWrite={canWrite}
                  onToggle={() => setExpanded(expanded === inv.id ? null : inv.id)}
                  onStatusChange={(status) => statusMutation.mutate({ id: inv.id, status })}
                  onDelete={() => deleteMutation.mutate(inv.id)}
                  statusPending={statusMutation.isPending}
                  deletePending={deleteMutation.isPending && expanded === inv.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

interface RowProps {
  invoice: Invoice;
  expanded: boolean;
  canWrite: boolean;
  onToggle: () => void;
  onStatusChange: (status: InvoiceStatus) => void;
  onDelete: () => void;
  statusPending: boolean;
  deletePending: boolean;
}

function InvoiceRow({
  invoice,
  expanded,
  canWrite,
  onToggle,
  onStatusChange,
  onDelete,
  statusPending,
  deletePending,
}: RowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const transitions = INVOICE_STATUS_TRANSITIONS[invoice.status];

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  return (
    <>
      <tr
        className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-mono text-xs text-[var(--gold)]">{invoice.invoiceNumber}</td>
        <td className="px-4 py-3 font-medium text-[var(--text)]">
          {invoice.customer.businessName}
        </td>
        <td className="px-4 py-3 text-right font-bold text-[var(--text)]">
          ${Number(invoice.total).toFixed(2)}
        </td>
        <td className="px-4 py-3 text-center">
          <Badge variant={STATUS_BADGE[invoice.status]}>
            {INVOICE_STATUS_LABELS[invoice.status]}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right text-[var(--text-muted)] text-xs">{dueDate}</td>
        <td className="px-4 py-3 text-right">
          <span className="text-[var(--text-muted)] text-xs">{expanded ? '▲' : '▼'}</span>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
          <td colSpan={6} className="px-6 py-5">
            {/* Line items */}
            <div className="mb-4">
              <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide mb-2">
                Line Items
              </p>
              <div className="rounded-lg border border-[var(--border)] overflow-hidden text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                      <th className="text-left px-3 py-2 text-xs text-[var(--text-muted)]">
                        Description
                      </th>
                      <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Qty</th>
                      <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">
                        Unit Price
                      </th>
                      <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map((item, i) => (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-3 py-2 text-[var(--text)]">{item.description}</td>
                        <td className="px-3 py-2 text-right text-[var(--text-muted)]">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2 text-right text-[var(--text-muted)]">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-[var(--text)]">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-4">
              <div className="w-48 text-sm space-y-1">
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Subtotal</span>
                  <span>${Number(invoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Tax</span>
                  <span>${Number(invoice.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-[var(--gold)] border-t border-[var(--border)] pt-1 mt-1">
                  <span>Total</span>
                  <span>${Number(invoice.total).toFixed(2)}</span>
                </div>
                {invoice.paidDate && (
                  <div className="flex justify-between text-emerald-500 text-xs">
                    <span>Paid</span>
                    <span>
                      {new Date(invoice.paidDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={invoicesApi.pdfUrl(invoice.id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--gold)]/50 transition-colors"
              >
                📄 Download PDF
              </a>

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
                      Mark {INVOICE_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              )}

              {canWrite && invoice.status !== 'PAID' && (
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
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--danger)] hover:opacity-90 disabled:opacity-50 transition-opacity"
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

// ─── Create Invoice Modal ───────────────────────────────────────────────────────

function CreateInvoiceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [error, setError] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
  });

  const subtotal = lineItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const mutation = useMutation({
    mutationFn: (dto: CreateInvoiceDto) => invoicesApi.create(dto),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function addLine() {
    setLineItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeLine(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (lineItems.some((i) => !i.description.trim())) {
      setError('All line items must have a description.');
      return;
    }
    mutation.mutate({
      customerId,
      lineItems,
      taxRate: taxRate || undefined,
      dueDate: dueDate || undefined,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">New Invoice</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer + due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Customer <span className="text-[var(--danger)]">*</span>
              </label>
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">
                Line Items
              </label>
              <button
                type="button"
                onClick={addLine}
                className="text-xs text-[var(--gold)] hover:underline"
              >
                + Add Line
              </button>
            </div>
            <div className="space-y-2">
              {lineItems.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-start">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
                  />
                  <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                    className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)] text-right"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Unit Price"
                    value={item.unitPrice}
                    onChange={(e) => updateLine(i, 'unitPrice', Number(e.target.value))}
                    className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)] text-right"
                  />
                  {lineItems.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-[var(--danger)] hover:opacity-70 text-lg leading-none pt-2"
                    >
                      ×
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tax rate */}
          <div className="w-48">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Tax Rate (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
            />
          </div>

          {/* Totals preview */}
          <div className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3">
            <div className="flex justify-between text-sm text-[var(--text-muted)] mb-1">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-[var(--text-muted)] mb-2">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-[var(--gold)]">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1" type="button">
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} className="flex-1">
              Create Invoice
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
