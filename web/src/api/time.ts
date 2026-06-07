import { api } from './client';

export type TimeEntryType = 'JOB' | 'DAILY';

export interface TimeEntry {
  id: string;
  tenantId: string;
  userId: string;
  jobId: string | null;
  type: TimeEntryType;
  clockIn: string;
  clockOut: string | null;
  durationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; role: string };
  job: { id: string; jobNumber: string; partName: string } | null;
}

export interface JobTimeReport {
  jobId: string;
  jobNumber: string;
  partName: string;
  totalMinutes: number;
  entryCount: number;
}

export interface UserTimeReport {
  userId: string;
  name: string;
  email: string;
  totalMinutes: number;
  entryCount: number;
}

export const timeApi = {
  myOpenEntries: () => api.get<TimeEntry[]>('/time/me'),
  myHistory: () => api.get<TimeEntry[]>('/time/me/history'),
  allEntries: () => api.get<TimeEntry[]>('/time/all'),
  jobReport: () => api.get<JobTimeReport[]>('/time/reports/jobs'),
  userReport: () => api.get<UserTimeReport[]>('/time/reports/users'),
  clockIn: (type: TimeEntryType, jobId?: string) =>
    api.post<TimeEntry>('/time/clock-in', { type, jobId }),
  clockOut: (entryId: string) => api.post<TimeEntry>('/time/clock-out', { entryId }),
};

/** Format minutes as "Xh Ym" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Elapsed minutes since a clockIn timestamp */
export function elapsedMinutes(clockIn: string): number {
  return Math.floor((Date.now() - new Date(clockIn).getTime()) / 60_000);
}
