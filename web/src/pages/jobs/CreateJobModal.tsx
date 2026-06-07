import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '../../api/jobs';
import type { CreateJobDto } from '../../api/jobs';
import { customersApi } from '../../api/customers';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';

interface CreateJobModalProps {
  onClose: () => void;
}

export function CreateJobModal({ onClose }: CreateJobModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateJobDto>({
    jobNumber: '',
    customerId: '',
    partName: '',
    quantity: 1,
    dueDate: '',
    priority: 'NORMAL',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: customersApi.list,
  });

  const mutation = useMutation({
    mutationFn: (dto: CreateJobDto) => jobsApi.create(dto),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
    },
    onError: (err: Error) => setErrors({ submit: err.message }),
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.jobNumber.trim()) e['jobNumber'] = 'Job number is required';
    if (!form.customerId) e['customerId'] = 'Customer is required';
    if (!form.partName.trim()) e['partName'] = 'Part name is required';
    if (form.quantity < 1) e['quantity'] = 'Quantity must be at least 1';
    if (!form.dueDate) e['dueDate'] = 'Due date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    mutation.mutate(form);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-lg space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">New Job</h2>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Job Number"
            placeholder="e.g. J-1001"
            value={form.jobNumber}
            onChange={(e) => setForm({ ...form, jobNumber: e.target.value })}
            error={errors['jobNumber']}
            autoFocus
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[var(--text)]">Priority</label>
            <select
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value as CreateJobDto['priority'] })
              }
              className="px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)]"
            >
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

        {/* Customer */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text)]">Customer</label>
          {loadingCustomers ? (
            <Spinner size="sm" />
          ) : (
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className={`px-3 py-2 rounded-md bg-[var(--surface-2)] border text-[var(--text)] text-sm outline-none focus:border-[var(--gold)] ${errors['customerId'] ? 'border-[var(--danger)]' : 'border-[var(--border)]'}`}
            >
              <option value="">Select customer…</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
          )}
          {errors['customerId'] && (
            <p className="text-xs text-[var(--danger)]">{errors['customerId']}</p>
          )}
        </div>

        <Input
          label="Part Name"
          placeholder="Describe the part"
          value={form.partName}
          onChange={(e) => setForm({ ...form, partName: e.target.value })}
          error={errors['partName']}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Part Number (optional)"
            placeholder="e.g. PN-4421"
            value={form.partNumber ?? ''}
            onChange={(e) => setForm({ ...form, partNumber: e.target.value || undefined })}
          />
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
            error={errors['quantity']}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Due Date"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            error={errors['dueDate']}
          />
          <Input
            label="PO Number (optional)"
            placeholder="e.g. PO-2024-001"
            value={form.poNumber ?? ''}
            onChange={(e) => setForm({ ...form, poNumber: e.target.value || undefined })}
          />
        </div>

        {errors['submit'] && <p className="text-sm text-[var(--danger)]">{errors['submit']}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending} className="flex-1">
            Create Job
          </Button>
        </div>
      </div>
    </div>
  );
}
