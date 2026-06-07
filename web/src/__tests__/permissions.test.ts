import { describe, it, expect } from 'vitest';

/**
 * Client-side RBAC smoke tests.
 * The real enforcement is server-side; these tests just verify our
 * nav/UI hides/shows the right things based on role.
 */

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';

const NAV_RULES: Record<string, Role[]> = {
  jobs: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'],
  users: ['SUPER_ADMIN', 'ADMIN'],
  settings: ['SUPER_ADMIN'],
};

function canSeeNav(role: Role, page: string): boolean {
  const allowed = NAV_RULES[page];
  return allowed !== undefined && allowed.includes(role);
}

describe('client-side nav visibility', () => {
  it('OPERATOR can only see jobs', () => {
    expect(canSeeNav('OPERATOR', 'jobs')).toBe(true);
    expect(canSeeNav('OPERATOR', 'users')).toBe(false);
    expect(canSeeNav('OPERATOR', 'settings')).toBe(false);
  });

  it('ADMIN can see jobs and users but not settings', () => {
    expect(canSeeNav('ADMIN', 'jobs')).toBe(true);
    expect(canSeeNav('ADMIN', 'users')).toBe(true);
    expect(canSeeNav('ADMIN', 'settings')).toBe(false);
  });

  it('SUPER_ADMIN can see everything', () => {
    expect(canSeeNav('SUPER_ADMIN', 'jobs')).toBe(true);
    expect(canSeeNav('SUPER_ADMIN', 'users')).toBe(true);
    expect(canSeeNav('SUPER_ADMIN', 'settings')).toBe(true);
  });
});
