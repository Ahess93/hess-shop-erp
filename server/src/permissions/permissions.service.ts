import { Injectable, ForbiddenException } from '@nestjs/common';
import { can } from './permissions.matrix';
import { Role, Action } from './permissions.types';

@Injectable()
export class PermissionsService {
  /**
   * Returns true if the role can perform the action.
   */
  can(role: Role, action: Action): boolean {
    return can(role, action);
  }

  /**
   * Throws a 403 ForbiddenException if the role cannot perform the action.
   * Use this in controllers/services to enforce permissions server-side.
   */
  assert(role: Role, action: Action): void {
    if (!can(role, action)) {
      throw new ForbiddenException(
        `Role ${role} does not have permission to perform action: ${action}`,
      );
    }
  }
}
