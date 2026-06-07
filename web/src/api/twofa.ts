const BASE = '/api/2fa';

export interface TwoFaStatus {
  enabled: boolean;
  configured: boolean;
}

export interface TwoFaSetupResult {
  otpauthUrl: string;
  qrDataUri: string;
  secret: string;
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
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string;
    };
    throw new Error(err.message ?? `POST ${url} — ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function del<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string;
    };
    throw new Error(err.message ?? `DELETE ${url} — ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const twoFaApi = {
  getStatus: (userId: string) => get<TwoFaStatus>(`${BASE}/status/${userId}`),

  setup: (userId: string) => post<TwoFaSetupResult>(`${BASE}/setup/${userId}`),

  verify: (userId: string, code: string) =>
    post<{ message: string }>(`${BASE}/verify/${userId}`, { code }),

  disable: (userId: string, code?: string) =>
    del<{ message: string }>(`${BASE}/disable/${userId}`, { code }),
};

/** Complete login 2FA step */
export const authTwoFaApi = {
  complete: (code: string) => post<{ user: object }>('/api/auth/login/2fa', { code }),
};
