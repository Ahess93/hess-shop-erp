import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, type InventoryItem, type CreateItemDto } from '../../api/inventory';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export function InventoryPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  const canWrite = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['inventory'] });
      setSelected(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const lowStockItems = items.filter((i) => Number(i.quantity) <= Number(i.reorderPoint));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Inventory</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {items.length} item{items.length !== 1 ? 's' : ''}
            {lowStockItems.length > 0 && (
              <span className="ml-2 text-[var(--danger)]">· {lowStockItems.length} low stock</span>
            )}
          </p>
        </div>
        {canWrite && <Button onClick={() => setShowCreate(true)}>+ Add Item</Button>}
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium">No inventory items yet</p>
          {canWrite && <p className="text-sm mt-1">Click "Add Item" to get started.</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">SKU</th>
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Name</th>
                <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                  Category
                </th>
                <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                  Quantity
                </th>
                <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                  Reorder At
                </th>
                <th className="text-center px-4 py-3 text-[var(--text-muted)] font-medium">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                  Unit Cost
                </th>
                {canWrite && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const qty = Number(item.quantity);
                const reorder = Number(item.reorderPoint);
                const isLow = qty <= reorder;
                const stockPct = reorder > 0 ? Math.min(100, (qty / (reorder * 3)) * 100) : 100;

                return (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--gold)]">{item.sku}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text)]">{item.name}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                      {item.category ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Mini stock bar */}
                        <div className="w-16 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isLow ? 'bg-[var(--danger)]' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${stockPct}%` }}
                          />
                        </div>
                        <span className="font-medium text-[var(--text)]">
                          {qty} {item.unit}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                      {reorder} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isLow ? (
                        <Badge variant="red">Low Stock</Badge>
                      ) : (
                        <Badge variant="green">OK</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                      ${Number(item.unitCost).toFixed(2)}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setAdjustItem(item)}
                            className="px-2 py-1 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] border border-transparent hover:border-[var(--border)] transition-colors"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => setSelected(item)}
                            className="px-2 py-1 rounded text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateItemModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            await qc.invalidateQueries({ queryKey: ['inventory'] });
            setShowCreate(false);
          }}
        />
      )}

      {/* Adjust modal */}
      {adjustItem && (
        <AdjustModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onAdjusted={async () => {
            await qc.invalidateQueries({ queryKey: ['inventory'] });
            setAdjustItem(null);
          }}
        />
      )}

      {/* Delete confirm */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Delete Item</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Delete <strong>{selected.name}</strong> ({selected.sku})? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setSelected(null)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(selected.id)}
                className="flex-1"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Modal ──────────────────────────────────────────────────────────────

function CreateItemModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState<CreateItemDto>({
    sku: '',
    name: '',
    category: '',
    quantity: 0,
    unit: 'ea',
    reorderPoint: 0,
    unitCost: 0,
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (dto: CreateItemDto) => inventoryApi.create(dto),
    onSuccess: async () => {
      await onCreated();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.sku.trim() || !form.name.trim()) {
      setError('SKU and Name are required.');
      return;
    }
    mutation.mutate({
      ...form,
      category: form.category || undefined,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Add Inventory Item</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                SKU <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                required
                value={form.sku}
                onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Name <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Category</label>
              <input
                type="text"
                value={form.category ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Unit</label>
              <input
                type="text"
                value={form.unit ?? 'ea'}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                Initial Quantity
              </label>
              <input
                type="number"
                min={0}
                step="0.001"
                value={form.quantity ?? 0}
                onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Reorder Point</label>
              <input
                type="number"
                min={0}
                step="0.001"
                value={form.reorderPoint ?? 0}
                onChange={(e) => setForm((p) => ({ ...p, reorderPoint: Number(e.target.value) }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Unit Cost ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.unitCost ?? 0}
                onChange={(e) => setForm((p) => ({ ...p, unitCost: Number(e.target.value) }))}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              />
            </div>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1" type="button">
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} className="flex-1">
              Add Item
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Adjust Modal ──────────────────────────────────────────────────────────────

function AdjustModal({
  item,
  onClose,
  onAdjusted,
}: {
  item: InventoryItem;
  onClose: () => void;
  onAdjusted: () => Promise<void>;
}) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => inventoryApi.adjust(item.id, { delta, reason }),
    onSuccess: async () => {
      await onAdjusted();
    },
    onError: (err: Error) => setError(err.message),
  });

  const newQty = Number(item.quantity) + delta;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (delta === 0) {
      setError('Delta cannot be zero.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">Adjust Stock</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-lg bg-[var(--surface-2)] px-4 py-3 text-sm">
            <p className="text-[var(--text-muted)] text-xs mb-0.5">{item.sku}</p>
            <p className="font-medium text-[var(--text)]">{item.name}</p>
            <p className="text-[var(--text-muted)] mt-1">
              Current stock:{' '}
              <strong>
                {Number(item.quantity)} {item.unit}
              </strong>
            </p>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Adjustment (use negative to remove)
            </label>
            <input
              type="number"
              step="0.001"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
            />
            {delta !== 0 && (
              <p
                className={`text-xs mt-1 ${newQty < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}
              >
                New quantity: {newQty} {item.unit}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Reason <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Restock from supplier, Used in Job #1234"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
            />
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1" type="button">
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} className="flex-1">
              Apply
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
