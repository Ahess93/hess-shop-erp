import { api } from './client';

export interface SessionUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const tenantId = localStorage.getItem('tenantId') ?? '';
  const res = await api.post<{ user: SessionUser }>('/auth/login', {
    tenantId,
    email,
    password,
  });
  return res.user;
}

export async function loginPin(pin: string): Promise<SessionUser> {
  const tenantId = localStorage.getItem('tenantId') ?? '';
  const res = await api.post<{ user: SessionUser }>('/auth/login/pin', {
    tenantId,
    pin,
  });
  return res.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function getMe(): Promise<SessionUser | null> {
  try {
    const res = await api.post<{ user: SessionUser }>('/auth/me');
    return res.user;
  } catch {
    return null;
  }
}
