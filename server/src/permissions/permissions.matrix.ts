import { Role, Action } from './permissions.types';

/**
 * Central permissions matrix.
 * One source of truth for what each role can do.
 * To add a new role or action, update this file only.
 */
const PERMISSIONS: Record<Role, Set<Action>> = {
  [Role.SUPER_ADMIN]: new Set<Action>([
    // User management
    'user:create',
    'user:read',
    'user:update',
    'user:deactivate',
    // Jobs
    'job:create',
    'job:read',
    'job:update',
    'job:delete',
    'job:move-department',
    // Traveler
    'traveler:read',
    'traveler:update-all',
    'traveler:update-operator-notes',
    // Quotes
    'quote:create',
    'quote:read',
    'quote:update',
    'quote:delete',
    // Invoices
    'invoice:create',
    'invoice:read',
    'invoice:update',
    'invoice:delete',
    // Inventory
    'inventory:create',
    'inventory:read',
    'inventory:update',
    'inventory:delete',
    // Customers
    'customer:create',
    'customer:read',
    'customer:update',
    'customer:delete',
    // Time
    'time:clock-in-out',
    'time:read-own',
    'time:read-all',
    // System
    'settings:read',
    'settings:update',
    'audit:read',
    // Files
    'file:upload',
    'file:read',
    'file:delete',
    // Reports
    'report:read',
  ]),

  [Role.ADMIN]: new Set<Action>([
    // User management (no deactivate — Super Admin only)
    'user:read',
    // Jobs
    'job:create',
    'job:read',
    'job:update',
    'job:delete',
    'job:move-department',
    // Traveler
    'traveler:read',
    'traveler:update-all',
    'traveler:update-operator-notes',
    // Quotes
    'quote:create',
    'quote:read',
    'quote:update',
    'quote:delete',
    // Invoices
    'invoice:create',
    'invoice:read',
    'invoice:update',
    'invoice:delete',
    // Inventory
    'inventory:create',
    'inventory:read',
    'inventory:update',
    'inventory:delete',
    // Customers
    'customer:create',
    'customer:read',
    'customer:update',
    'customer:delete',
    // Time
    'time:clock-in-out',
    'time:read-own',
    'time:read-all',
    // System (read only)
    'settings:read',
    // Files
    'file:upload',
    'file:read',
    'file:delete',
    // Reports
    'report:read',
  ]),

  [Role.OPERATOR]: new Set<Action>([
    // Jobs (read + move department only)
    'job:read',
    'job:move-department',
    // Traveler (read + operator notes only)
    'traveler:read',
    'traveler:update-operator-notes',
    // Inventory (read only)
    'inventory:read',
    // Time (own only)
    'time:clock-in-out',
    'time:read-own',
    // Files (read + upload only)
    'file:upload',
    'file:read',
  ]),
};

/**
 * Check whether a role has permission to perform an action.
 * Always enforce this on the SERVER — never trust the client.
 *
 * @example
 *   can(Role.OPERATOR, 'job:create') // false
 *   can(Role.ADMIN, 'quote:read')    // true
 */
export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[role].has(action);
}
