import { can } from '../permissions/permissions.matrix';
import { Role } from '../permissions/permissions.types';

describe('RBAC: job permissions', () => {
  it('OPERATOR can read jobs', () => {
    expect(can(Role.OPERATOR, 'job:read')).toBe(true);
  });

  it('OPERATOR can move department', () => {
    expect(can(Role.OPERATOR, 'job:move-department')).toBe(true);
  });

  it('OPERATOR cannot create jobs', () => {
    expect(can(Role.OPERATOR, 'job:create')).toBe(false);
  });

  it('OPERATOR cannot delete jobs', () => {
    expect(can(Role.OPERATOR, 'job:delete')).toBe(false);
  });

  it('OPERATOR cannot update jobs', () => {
    expect(can(Role.OPERATOR, 'job:update')).toBe(false);
  });

  it('ADMIN can create jobs', () => {
    expect(can(Role.ADMIN, 'job:create')).toBe(true);
  });

  it('ADMIN can update jobs', () => {
    expect(can(Role.ADMIN, 'job:update')).toBe(true);
  });

  it('ADMIN can delete jobs', () => {
    expect(can(Role.ADMIN, 'job:delete')).toBe(true);
  });

  it('SUPER_ADMIN has all job permissions', () => {
    expect(can(Role.SUPER_ADMIN, 'job:create')).toBe(true);
    expect(can(Role.SUPER_ADMIN, 'job:read')).toBe(true);
    expect(can(Role.SUPER_ADMIN, 'job:update')).toBe(true);
    expect(can(Role.SUPER_ADMIN, 'job:delete')).toBe(true);
    expect(can(Role.SUPER_ADMIN, 'job:move-department')).toBe(true);
  });
});
