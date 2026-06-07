import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, DEPARTMENT_LABELS, DEPARTMENTS } from '../../api/jobs';
import type { Job } from '../../api/jobs';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

interface JobDetailModalProps {
  job: Job;
  onClose: () => void;
}

export function JobDetailModal({ job, onClose }: JobDetailModalProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const deleteMutation = useMutation({
    mutationFn: () => jobsApi.remove(job.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
    },
  });

  const moveMutation = useMutation({
    mutationFn: (dept: string) => jobsApi.move(job.id, dept as Job['department']),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const dueDate = new Date(job.dueDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[var(--gold)] font-bold">{job.jobNumber}</span>
              {job.priority === 'HIGH' && <Badge variant="red">HIGH</Badge>}
            </div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{job.partName}</h2>
            <p className="text-sm text-[var(--text-muted)]">{job.customer.businessName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Quantity</span>
              <p className="font-medium text-[var(--text)]">{job.quantity}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Due Date</span>
              <p className="font-medium text-[var(--text)]">{dueDate}</p>
            </div>
            {job.partNumber && (
              <div>
                <span className="text-[var(--text-muted)]">Part Number</span>
                <p className="font-medium text-[var(--text)]">{job.partNumber}</p>
              </div>
            )}
            {job.poNumber && (
              <div>
                <span className="text-[var(--text-muted)]">PO Number</span>
                <p className="font-medium text-[var(--text)]">{job.poNumber}</p>
              </div>
            )}
            {job.rfqNumber && (
              <div>
                <span className="text-[var(--text-muted)]">RFQ Number</span>
                <p className="font-medium text-[var(--text)]">{job.rfqNumber}</p>
              </div>
            )}
          </div>

          {/* Current department */}
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-2">Current Department</p>
            <Badge variant="gold">{DEPARTMENT_LABELS[job.department]}</Badge>
          </div>

          {/* Move to department */}
          <div>
            <p className="text-sm text-[var(--text-muted)] mb-2">Move to Department</p>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.filter((d) => d !== job.department).map((dept) => (
                <button
                  key={dept}
                  onClick={() => moveMutation.mutate(dept)}
                  disabled={moveMutation.isPending}
                  className="px-2 py-1 rounded text-xs bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold)]/50 hover:text-[var(--text)] transition-colors disabled:opacity-50"
                >
                  {DEPARTMENT_LABELS[dept]}
                </button>
              ))}
            </div>
          </div>

          {/* Admin notes */}
          {job.adminNotes && (
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-1">Notes</p>
              <p className="text-sm text-[var(--text)] bg-[var(--surface-2)] rounded-lg p-3">
                {job.adminNotes}
              </p>
            </div>
          )}

          {/* Traveler link */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              onClose();
              void navigate(`/jobs/${job.id}/traveler`);
            }}
          >
            📋 Open Job Traveler
          </Button>

          {/* Actions */}
          {canEdit && (
            <div className="pt-2 border-t border-[var(--border)]">
              {!confirmDelete ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full"
                >
                  Delete Job
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--danger)] text-center">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate()}
                      className="flex-1"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
