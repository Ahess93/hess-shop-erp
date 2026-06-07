import { PermissionsService } from './permissions.service';
import { Role } from './permissions.types';
import { ForbiddenException } from '@nestjs/common';

describe('PermissionsService', () => {
  const service = new PermissionsService();

  describe('can()', () => {
    it('returns true when role has permission', () => {
      expect(service.can(Role.ADMIN, 'job:create')).toBe(true);
    });

    it('returns false when role lacks permission', () => {
      expect(service.can(Role.OPERATOR, 'job:create')).toBe(false);
    });
  });

  describe('assert()', () => {
    it('does not throw when role has permission', () => {
      expect(() => service.assert(Role.ADMIN, 'job:create')).not.toThrow();
    });

    it('throws ForbiddenException when role lacks permission', () => {
      expect(() => service.assert(Role.OPERATOR, 'job:create')).toThrow(
        ForbiddenException,
      );
    });

    it('throws with a descriptive message', () => {
      expect(() => service.assert(Role.OPERATOR, 'quote:read')).toThrow(
        'OPERATOR does not have permission to perform action: quote:read',
      );
    });
  });
});
