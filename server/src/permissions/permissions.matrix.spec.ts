import { can } from './permissions.matrix';
import { Role, Action } from './permissions.types';

describe('Permissions Matrix', () => {
  // ── SUPER_ADMIN ────────────────────────────────────────────────────────────
  describe('SUPER_ADMIN', () => {
    const allActions: Action[] = [
      'user:create',
      'user:read',
      'user:update',
      'user:deactivate',
      'job:create',
      'job:read',
      'job:update',
      'job:delete',
      'job:move-department',
      'traveler:read',
      'traveler:update-all',
      'traveler:update-operator-notes',
      'quote:create',
      'quote:read',
      'quote:update',
      'quote:delete',
      'invoice:create',
      'invoice:read',
      'invoice:update',
      'invoice:delete',
      'inventory:create',
      'inventory:read',
      'inventory:update',
      'inventory:delete',
      'customer:create',
      'customer:read',
      'customer:update',
      'customer:delete',
      'time:clock-in-out',
      'time:read-own',
      'time:read-all',
      'settings:read',
      'settings:update',
      'audit:read',
      'file:upload',
      'file:read',
      'file:delete',
      'report:read',
    ];

    test.each(allActions)('can perform %s', (action) => {
      expect(can(Role.SUPER_ADMIN, action)).toBe(true);
    });
  });

  // ── ADMIN ────────��──────────────────────────���──────────────────────────────
  describe('ADMIN', () => {
    const allowed: Action[] = [
      'user:read',
      'job:create',
      'job:read',
      'job:update',
      'job:delete',
      'job:move-department',
      'traveler:read',
      'traveler:update-all',
      'traveler:update-operator-notes',
      'quote:create',
      'quote:read',
      'quote:update',
      'quote:delete',
      'invoice:create',
      'invoice:read',
      'invoice:update',
      'invoice:delete',
      'inventory:create',
      'inventory:read',
      'inventory:update',
      'inventory:delete',
      'customer:create',
      'customer:read',
      'customer:update',
      'customer:delete',
      'time:clock-in-out',
      'time:read-own',
      'time:read-all',
      'settings:read',
      'file:upload',
      'file:read',
      'file:delete',
      'report:read',
    ];

    const denied: Action[] = [
      'user:create',
      'user:update',
      'user:deactivate',
      'settings:update',
      'audit:read',
    ];

    test.each(allowed)('can perform %s', (action) => {
      expect(can(Role.ADMIN, action)).toBe(true);
    });

    test.each(denied)('cannot perform %s', (action) => {
      expect(can(Role.ADMIN, action)).toBe(false);
    });
  });

  // ── OPERATOR ───────────────────────────────────────���───────────────────────
  describe('OPERATOR', () => {
    const allowed: Action[] = [
      'job:read',
      'job:move-department',
      'traveler:read',
      'traveler:update-operator-notes',
      'inventory:read',
      'time:clock-in-out',
      'time:read-own',
      'file:upload',
      'file:read',
    ];

    const denied: Action[] = [
      'user:create',
      'user:read',
      'user:update',
      'user:deactivate',
      'job:create',
      'job:update',
      'job:delete',
      'traveler:update-all',
      'quote:create',
      'quote:read',
      'quote:update',
      'quote:delete',
      'invoice:create',
      'invoice:read',
      'invoice:update',
      'invoice:delete',
      'inventory:create',
      'inventory:update',
      'inventory:delete',
      'customer:create',
      'customer:read',
      'customer:update',
      'customer:delete',
      'time:read-all',
      'settings:read',
      'settings:update',
      'audit:read',
      'file:delete',
      'report:read',
    ];

    test.each(allowed)('can perform %s', (action) => {
      expect(can(Role.OPERATOR, action)).toBe(true);
    });

    test.each(denied)('cannot perform %s', (action) => {
      expect(can(Role.OPERATOR, action)).toBe(false);
    });
  });
});
