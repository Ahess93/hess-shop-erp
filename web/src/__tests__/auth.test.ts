import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, logout, getMe } from '../api/auth';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('auth API', () => {
  it('login returns user on success', async () => {
    const user = { id: '1', name: 'Andrew', email: 'a@b.com', role: 'SUPER_ADMIN', tenantId: 't1' };
    mockFetch.mockReturnValueOnce(jsonResponse({ user }));

    const result = await login('a@b.com', 'password123');
    expect(result).toEqual(user);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('login throws on 401', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ message: 'Invalid credentials' }, 401));
    await expect(login('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });

  it('logout calls POST /auth/logout', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ ok: true }));
    await logout();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('getMe returns user when authenticated', async () => {
    const user = { id: '1', name: 'Andrew', email: 'a@b.com', role: 'SUPER_ADMIN', tenantId: 't1' };
    mockFetch.mockReturnValueOnce(jsonResponse({ user }));
    const result = await getMe();
    expect(result).toEqual(user);
  });

  it('getMe returns null when not logged in (catches 401)', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ message: 'Unauthorized' }, 401));
    const result = await getMe();
    expect(result).toBeNull();
  });
});
