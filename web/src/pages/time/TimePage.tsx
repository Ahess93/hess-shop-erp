import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  timeApi,
  type TimeEntry,
  type TimeEntryType,
  formatDuration,
  elapsedMinutes,
} from '../../api/time';
import { jobsApi } from '../../api/jobs';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export function TimePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [tab, setTab] = useState<'clock' | 'history' | 'reports'>('clock');

  const { data: openEntries = [], refetch: refetchOpen } = useQuery({
    queryKey: ['time', 'me-open'],
    queryFn: () => timeApi.myOpenEntries(),
    refetchInterval: 30_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['time', 'me-history'],
    queryFn: () => timeApi.myHistory(),
    enabled: tab === 'history',
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['time', 'all'],
    queryFn: () => timeApi.allEntries(),
    enabled: tab === 'history' && isAdmin,
  });

  const { data: jobReport = [] } = useQuery({
    queryKey: ['time', 'report-jobs'],
    queryFn: () => timeApi.jobReport(),
    enabled: tab === 'reports' && isAdmin,
  });

  const { data: userReport = [] } = useQuery({
    queryKey: ['time', 'report-users'],
    queryFn: () => timeApi.userReport(),
    enabled: tab === 'reports' && isAdmin,
  });

  const clockOutMutation = useMutation({
    mutationFn: (entryId: string) => timeApi.clockOut(entryId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['time'] });
    },
  });

  const openDailyEntry = openEntries.find((e) => e.type === 'DAILY');
  const openJobEntry = openEntries.find((e) => e.type === 'JOB');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">Time Tracking</h1>
        <div className="flex gap-1 bg-[var(--surface-2)] rounded-lg p-1">
          {(['clock', 'history', ...(isAdmin ? ['reports'] : [])] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-[var(--gold)] text-black'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'clock' && (
        <ClockTab
          openDailyEntry={openDailyEntry}
          openJobEntry={openJobEntry}
          onClockOut={(id) => clockOutMutation.mutate(id)}
          clockOutPending={clockOutMutation.isPending}
          onClockIn={async () => {
            await qc.invalidateQueries({ queryKey: ['time'] });
            void refetchOpen();
          }}
        />
      )}

      {tab === 'history' && (
        <HistoryTab entries={isAdmin ? allEntries : history} isAdmin={isAdmin} />
      )}

      {tab === 'reports' && isAdmin && <ReportsTab jobReport={jobReport} userReport={userReport} />}
    </div>
  );
}

// ─── Clock Tab ─────────────────────────────────────────────────────────────────

function ClockTab({
  openDailyEntry,
  openJobEntry,
  onClockOut,
  clockOutPending,
  onClockIn,
}: {
  openDailyEntry: TimeEntry | undefined;
  openJobEntry: TimeEntry | undefined;
  onClockOut: (id: string) => void;
  clockOutPending: boolean;
  onClockIn: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const [showJobSelect, setShowJobSelect] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [, setTick] = useState(0);

  // Tick every minute to update elapsed time display
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list(),
    enabled: showJobSelect,
  });

  const clockInMutation = useMutation({
    mutationFn: ({ type, jobId }: { type: TimeEntryType; jobId?: string }) =>
      timeApi.clockIn(type, jobId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['time'] });
      await onClockIn();
      setShowJobSelect(false);
      setSelectedJobId('');
    },
  });

  return (
    <div className="space-y-4">
      {/* Daily clock */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text)] mb-1">Daily Clock</h2>
            <p className="text-sm text-[var(--text-muted)]">Track your overall time in the shop</p>
          </div>
          {openDailyEntry ? (
            <div className="text-right">
              <ElapsedBadge clockIn={openDailyEntry.clockIn} />
              <Button
                variant="danger"
                size="sm"
                className="mt-2"
                loading={clockOutPending}
                onClick={() => onClockOut(openDailyEntry.id)}
              >
                Clock Out
              </Button>
            </div>
          ) : (
            <Button
              loading={clockInMutation.isPending}
              onClick={() => clockInMutation.mutate({ type: 'DAILY' })}
            >
              Clock In
            </Button>
          )}
        </div>
      </div>

      {/* Job clock */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text)] mb-1">Job Clock</h2>
            <p className="text-sm text-[var(--text-muted)]">Track time on a specific job</p>
          </div>
          {openJobEntry ? (
            <div className="text-right">
              <p className="text-xs text-[var(--text-muted)] mb-0.5">
                {openJobEntry.job?.jobNumber ?? '—'} · {openJobEntry.job?.partName ?? '—'}
              </p>
              <ElapsedBadge clockIn={openJobEntry.clockIn} />
              <Button
                variant="danger"
                size="sm"
                className="mt-2"
                loading={clockOutPending}
                onClick={() => onClockOut(openJobEntry.id)}
              >
                Clock Out Job
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowJobSelect((s) => !s)}>Start Job Clock</Button>
          )}
        </div>

        {showJobSelect && !openJobEntry && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Select a Job</label>
            <div className="flex gap-2">
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--gold)]"
              >
                <option value="">Select a job…</option>
                {jobs?.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobNumber} — {j.partName}
                  </option>
                ))}
              </select>
              <Button
                disabled={!selectedJobId}
                loading={clockInMutation.isPending}
                onClick={() => clockInMutation.mutate({ type: 'JOB', jobId: selectedJobId })}
              >
                Start
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Elapsed Badge ─────────────────────────────────────────────────────────────

function ElapsedBadge({ clockIn }: { clockIn: string }) {
  const [mins, setMins] = useState(() => elapsedMinutes(clockIn));
  useEffect(() => {
    const interval = setInterval(() => setMins(elapsedMinutes(clockIn)), 30_000);
    return () => clearInterval(interval);
  }, [clockIn]);

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--gold)]/20 text-[var(--gold)] text-sm font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
      {formatDuration(mins)}
    </span>
  );
}

// ─── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ entries, isAdmin }: { entries: TimeEntry[]; isAdmin: boolean }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--text-muted)]">
        <p className="text-4xl mb-3">⏱️</p>
        <p className="font-medium">No time entries yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
            {isAdmin && (
              <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">User</th>
            )}
            <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Type</th>
            <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Job</th>
            <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Clock In</th>
            <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Clock Out</th>
            <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
            >
              {isAdmin && (
                <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{entry.user.name}</td>
              )}
              <td className="px-4 py-3">
                <Badge variant={entry.type === 'JOB' ? 'gold' : 'gray'}>{entry.type}</Badge>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[var(--gold)]">
                {entry.job?.jobNumber ?? '—'}
              </td>
              <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                {formatDateTime(entry.clockIn)}
              </td>
              <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                {entry.clockOut ? (
                  formatDateTime(entry.clockOut)
                ) : (
                  <span className="text-[var(--gold)] font-medium">In progress</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-medium text-[var(--text)]">
                {entry.durationMinutes != null ? (
                  formatDuration(entry.durationMinutes)
                ) : (
                  <ElapsedBadge clockIn={entry.clockIn} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Reports Tab ───────────────────────────────────────────────────────────────

function ReportsTab({
  jobReport,
  userReport,
}: {
  jobReport: {
    jobId: string;
    jobNumber: string;
    partName: string;
    totalMinutes: number;
    entryCount: number;
  }[];
  userReport: {
    userId: string;
    name: string;
    email: string;
    totalMinutes: number;
    entryCount: number;
  }[];
}) {
  return (
    <div className="space-y-6">
      {/* Per-job report */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3">Time by Job</h2>
        {jobReport.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No completed job time entries.</p>
        ) : (
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Job</th>
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">Part</th>
                  <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                    Entries
                  </th>
                  <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                    Total Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobReport.map((row) => (
                  <tr
                    key={row.jobId}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--gold)]">
                      {row.jobNumber}
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">{row.partName}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                      {row.entryCount}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--text)]">
                      {formatDuration(row.totalMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-user report */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3">Time by User</h2>
        {userReport.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No completed time entries.</p>
        ) : (
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-[var(--text-muted)] font-medium">User</th>
                  <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                    Entries
                  </th>
                  <th className="text-right px-4 py-3 text-[var(--text-muted)] font-medium">
                    Total Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {userReport.map((row) => (
                  <tr
                    key={row.userId}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text)]">{row.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{row.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                      {row.entryCount}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--text)]">
                      {formatDuration(row.totalMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
