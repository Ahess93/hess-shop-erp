const BASE = '/api/backup';

export interface BackupConfig {
  backupPath: string;
  autoBackup: boolean;
  retainCount: number;
}

export interface BackupEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupResult {
  filename: string;
  sizeBytes: number;
  durationMs: number;
}

export interface VerifyResult {
  valid: boolean;
  sizeBytes: number;
  message: string;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`GET ${url} — ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${url} — ${res.status}`);
  return res.json() as Promise<T>;
}

async function put<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${url} — ${res.status}`);
  return res.json() as Promise<T>;
}

export const backupApi = {
  getConfig: () => get<BackupConfig>(`${BASE}/config`),
  saveConfig: (dto: Partial<BackupConfig>) => put<BackupConfig>(`${BASE}/config`, dto),
  list: () => get<BackupEntry[]>(`${BASE}/list`),
  create: () => post<BackupResult>(`${BASE}/create`),
  verify: (filename: string) => get<VerifyResult>(`${BASE}/verify/${encodeURIComponent(filename)}`),
};

/** Format bytes as a human-readable string (e.g. "1.4 MB") */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
