import type { Job } from '../../api/jobs';
import { Badge } from '../../components/ui/Badge';

interface JobCardProps {
  job: Job;
  onDragStart: (id: string) => void;
  onClick: (job: Job) => void;
}

function dueDateColor(dueDate: string): string {
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'text-[var(--danger)]';
  if (days <= 3) return 'text-yellow-400';
  return 'text-[var(--text-muted)]';
}

export function JobCard({ job, onDragStart, onClick }: JobCardProps) {
  const dueStr = new Date(job.dueDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      draggable
      onDragStart={() => onDragStart(job.id)}
      onClick={() => onClick(job)}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-[var(--gold)]/50 transition-colors select-none"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-[var(--gold)] font-semibold">{job.jobNumber}</span>
        {job.priority === 'HIGH' && (
          <Badge variant="red">
            <span className="text-[10px]">HIGH</span>
          </Badge>
        )}
      </div>

      {/* Part name */}
      <div className="text-sm font-medium text-[var(--text)] leading-tight mb-1 line-clamp-2">
        {job.partName}
      </div>

      {/* Customer */}
      <div className="text-xs text-[var(--text-muted)] mb-2 truncate">
        {job.customer.businessName}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className={`text-xs ${dueDateColor(job.dueDate)}`}>Due {dueStr}</span>
        <span className="text-xs text-[var(--text-muted)]">Qty: {job.quantity}</span>
      </div>

      {/* Progress bar */}
      {job.progressPct > 0 && (
        <div className="mt-2 h-1 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--gold)] rounded-full transition-all"
            style={{ width: `${job.progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
