export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
}

// All actions in the system
export type Action =
  // User management
  | 'user:create'
  | 'user:read'
  | 'user:update'
  | 'user:deactivate'
  // Job management
  | 'job:create'
  | 'job:read'
  | 'job:update'
  | 'job:delete'
  | 'job:move-department'
  // Traveler
  | 'traveler:read'
  | 'traveler:update-all'
  | 'traveler:update-operator-notes'
  // Quoting (Admin+ only)
  | 'quote:create'
  | 'quote:read'
  | 'quote:update'
  | 'quote:delete'
  // Invoicing
  | 'invoice:create'
  | 'invoice:read'
  | 'invoice:update'
  | 'invoice:delete'
  // Inventory
  | 'inventory:create'
  | 'inventory:read'
  | 'inventory:update'
  | 'inventory:delete'
  // Customers
  | 'customer:create'
  | 'customer:read'
  | 'customer:update'
  | 'customer:delete'
  // Time tracking
  | 'time:clock-in-out'
  | 'time:read-own'
  | 'time:read-all'
  // System settings
  | 'settings:read'
  | 'settings:update'
  // Audit log
  | 'audit:read'
  // File uploads
  | 'file:upload'
  | 'file:read'
  | 'file:delete'
  // Reports
  | 'report:read';
