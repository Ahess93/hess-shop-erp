import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsService } from '../permissions/permissions.service';
import { Role } from '../permissions/permissions.types';
import { can } from '../permissions/permissions.matrix';

describe('RBAC: user:create permission', () => {
  let permissions: PermissionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PermissionsService],
    }).compile();

    permissions = module.get(PermissionsService);
  });

  it('SUPER_ADMIN can create users', () => {
    expect(can(Role.SUPER_ADMIN, 'user:create')).toBe(true);
  });

  it('ADMIN cannot create users', () => {
    expect(can(Role.ADMIN, 'user:create')).toBe(false);
  });

  it('OPERATOR cannot create users', () => {
    expect(can(Role.OPERATOR, 'user:create')).toBe(false);
  });

  it('OPERATOR assert user:create throws ForbiddenException', () => {
    expect(() => permissions.assert(Role.OPERATOR, 'user:create')).toThrow(
      ForbiddenException,
    );
  });

  it('ADMIN assert user:create throws ForbiddenException', () => {
    expect(() => permissions.assert(Role.ADMIN, 'user:create')).toThrow(
      ForbiddenException,
    );
  });

  it('SUPER_ADMIN assert user:create does not throw', () => {
    expect(() =>
      permissions.assert(Role.SUPER_ADMIN, 'user:create'),
    ).not.toThrow();
  });

  it('OPERATOR can read jobs', () => {
    expect(can(Role.OPERATOR, 'job:read')).toBe(true);
  });

  it('OPERATOR cannot delete jobs', () => {
    expect(can(Role.OPERATOR, 'job:delete')).toBe(false);
  });
});
