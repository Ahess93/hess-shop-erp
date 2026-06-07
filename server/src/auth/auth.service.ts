import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '../permissions/permissions.types';

export interface SessionUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Hash a plaintext password using argon2id.
   * Never store plaintext passwords.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  /**
   * Hash a numeric PIN using argon2id.
   */
  async hashPin(pin: string): Promise<string> {
    return argon2.hash(pin, { type: argon2.argon2id });
  }

  /**
   * Verify a plaintext value against an argon2 hash.
   */
  async verifyHash(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }

  /**
   * Validate a user by email + password. Returns the session user or throws.
   */
  async validateByPassword(
    tenantId: string,
    email: string,
    password: string,
    ip?: string,
  ): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Password login is not enabled for this account',
      );
    }

    const valid = await this.verifyHash(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ip,
    });

    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role as Role,
    };
  }

  /**
   * Validate a user by username + PIN. Returns the session user or throws.
   */
  async validateByPin(
    tenantId: string,
    email: string,
    pin: string,
    ip?: string,
  ): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.pinHash) {
      throw new UnauthorizedException(
        'PIN login is not enabled for this account',
      );
    }

    const valid = await this.verifyHash(user.pinHash, pin);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      userId: user.id,
      action: 'LOGIN_PIN',
      entityType: 'User',
      entityId: user.id,
      ip,
    });

    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role as Role,
    };
  }

  /**
   * Create the initial Super Admin during first-run setup.
   * Fails if any user already exists for the tenant.
   */
  async createSuperAdmin(
    tenantId: string,
    name: string,
    email: string,
    password: string,
  ): Promise<SessionUser> {
    const existing = await this.prisma.user.findFirst({ where: { tenantId } });
    if (existing) {
      throw new BadRequestException(
        'Super Admin already exists for this tenant',
      );
    }

    const passwordHash = await this.hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name,
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        active: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      newValue: { name, email, role: 'SUPER_ADMIN' },
    });

    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: Role.SUPER_ADMIN,
    };
  }
}
