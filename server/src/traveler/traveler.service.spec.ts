import { can } from '../permissions/permissions.matrix';
import { Role } from '../permissions/permissions.types';

describe('RBAC: traveler permissions', () => {
  it('OPERATOR can read traveler', () => {
    expect(can(Role.OPERATOR, 'traveler:read')).toBe(true);
  });

  it('OPERATOR can update operator notes', () => {
    expect(can(Role.OPERATOR, 'traveler:update-operator-notes')).toBe(true);
  });

  it('OPERATOR cannot do full traveler update', () => {
    expect(can(Role.OPERATOR, 'traveler:update-all')).toBe(false);
  });

  it('ADMIN can do full traveler update', () => {
    expect(can(Role.ADMIN, 'traveler:update-all')).toBe(true);
  });

  it('SUPER_ADMIN can do full traveler update', () => {
    expect(can(Role.SUPER_ADMIN, 'traveler:update-all')).toBe(true);
  });
});

describe('RBAC: file permissions', () => {
  it('OPERATOR can upload and read files', () => {
    expect(can(Role.OPERATOR, 'file:upload')).toBe(true);
    expect(can(Role.OPERATOR, 'file:read')).toBe(true);
  });

  it('OPERATOR cannot delete files', () => {
    expect(can(Role.OPERATOR, 'file:delete')).toBe(false);
  });

  it('ADMIN can delete files', () => {
    expect(can(Role.ADMIN, 'file:delete')).toBe(true);
  });
});
