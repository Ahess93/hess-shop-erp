import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, DEPARTMENTS, DEPARTMENT_LABELS } from '../../api/jobs';
import type { Job, Department } from '../../api/jobs';
import { useAuthStore } from '../../store/auth';
import { JobCard } from './JobCard';
import { CreateJobModal } from './CreateJobModal';
import { JobDetailModal } from './JobDetailModal';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';

export function JobBoardPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Department | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  const {
    data: jobs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['jobs'],
    queryFn: jobsApi.list,
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, department }: { id: string; department: Department }) =>
      jobsApi.move(id, department),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const canCreate = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  function handleDrop(department: Department) {
    if (!draggingId || !department) return;
    const job = jobs?.find((j) => j.id === draggingId);
    if (job && job.department !== department) {
      moveMutation.mutate({ id: draggingId, department });
    }
    setDraggingId(null);
    setDragOverCol(null);
  }

  const jobsByDept = DEPARTMENTS.reduce<Record<Department, Job[]>>(
    (acc, dept) => {
      acc[dept] = jobs?.filter((j) => j.department === dept) ?? [];
      return acc;
    },
    {} as Record<Department, Job[]>,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-[var(--danger)]">Failed to load jobs: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-[var(--text)]">Job Board</h1>
          <span className="text-sm text-[var(--text-muted)]">{jobs?.length ?? 0} jobs</span>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-[var(--surface-2)] rounded-lg p-1">
            {(['board', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                  viewMode === mode
                    ? 'bg-[var(--gold)] text-black font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          {canCreate && <Button onClick={() => setShowCreate(true)}>+ New Job</Button>}
        </div>
      </div>

      {viewMode === 'board' ? (
        /* ── BOARD VIEW ── */
        <div className="flex-1 overflow-x-auto">
          <div
            className="flex gap-3 p-4 h-full"
            style={{ minWidth: `${DEPARTMENTS.length * 220}px` }}
          >
            {DEPARTMENTS.map((dept) => {
              const colJobs = jobsByDept[dept];
              const isOver = dragOverCol === dept;
              return (
                <div
                  key={dept}
                  className="flex flex-col flex-shrink-0 w-52"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverCol(dept);
                  }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => handleDrop(dept)}
                >
                  {/* Column header */}
                  <div
                    className={`flex items-center justify-between px-3 py-2 rounded-t-lg border border-b-0 transition-colors ${
                      isOver
                        ? 'bg-[var(--gold)]/15 border-[var(--gold)]/50'
                        : 'bg-[var(--surface)] border-[var(--border)]'
                    }`}
                  >
                    <span className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">
                      {DEPARTMENT_LABELS[dept]}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-2)] rounded-full px-1.5 py-0.5">
                      {colJobs.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div
                    className={`flex-1 flex flex-col gap-2 p-2 rounded-b-lg border min-h-24 transition-colors overflow-y-auto max-h-[calc(100vh-160px)] ${
                      isOver
                        ? 'bg-[var(--gold)]/5 border-[var(--gold)]/50 border-dashed'
                        : 'bg-[var(--surface-2)] border-[var(--border)]'
                    }`}
                  >
                    {colJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onDragStart={setDraggingId}
                        onClick={setSelectedJob}
                      />
                    ))}
                    {colJobs.length === 0 && !isOver && (
                      <div className="text-xs text-[var(--text-muted)] text-center py-4 opacity-50">
                        Empty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                    Job #
                  </th>
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Part</th>
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Qty</th>
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                    Department
                  </th>
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                    Due Date
                  </th>
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody>
                {(jobs ?? []).map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/50 cursor-pointer"
                    onClick={() => setSelectedJob(job)}
                  >
                    <td className="px-4 py-3 font-mono text-[var(--gold)] font-semibold">
                      {job.jobNumber}
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">{job.partName}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {job.customer.businessName}
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">{job.quantity}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {DEPARTMENT_LABELS[job.department]}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {new Date(job.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {job.priority === 'HIGH' ? (
                        <span className="text-xs text-[var(--danger)] font-semibold">HIGH</span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(jobs ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-[var(--text-muted)] text-sm"
                    >
                      No jobs yet. Create your first job to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <CreateJobModal onClose={() => setShowCreate(false)} />}
      {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  );
}
