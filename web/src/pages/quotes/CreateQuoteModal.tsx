import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quotesApi, type CreateQuoteDto } from '../../api/quotes';
import { customersApi } from '../../api/customers';
import { Button } from '../../components/ui/Button';

interface Props {
  onClose: () => void;
}

export function CreateQuoteModal({ onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateQuoteDto>({
    customerId: '',
    jobId: undefined,
    laborRate: 0,
    estRunTime: 0,
    materialCost: 0,
    markupPct: 0,
  });
  const [error, setError] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
  });

  // Live price preview
  const base = form.laborRate * form.estRunTime + form.materialCost;
  const preview = base * (1 + form.markupPct / 100);

  const mutation = useMutation({
    mutationFn: (dto: CreateQuoteDto) => quotesApi.create(dto),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['quotes'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.customerId) {
      setError('Please select a customer.');
      return;
    }
    mutation.mutate(form);
  }

  function field(label: string, key: keyof CreateQuoteDto, type = 'number', step = '0.01') {
    return (
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
        <input
          type={type}
          step={step}
          min={0}
          value={form[key] as string | number}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              [key]: type === 'number' ? Number(e.target.value) : e.target.value,
            }))
          }
          className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">New Quote</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer */}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Customer <span className="text-[var(--danger)]">*</span>
            </label>
            <select
              required
              value={form.customerId}
              onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
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

          {/* Pricing fields */}
          <div className="grid grid-cols-2 gap-3">
            {field('Labor Rate ($/hr)', 'laborRate')}
            {field('Est. Run Time (hrs)', 'estRunTime')}
            {field('Material Cost ($)', 'materialCost')}
            {field('Markup (%)', 'markupPct')}
          </div>

          {/* Live price preview */}
          <div className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Calculated Price</span>
            <span className="text-xl font-bold text-[var(--gold)]">${preview.toFixed(2)}</span>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1" type="button">
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} className="flex-1">
              Create Quote
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
