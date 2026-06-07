import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';
import * as argon2 from 'argon2';

export interface CreateUserDto {
  name: string;
  email: string;
  password?: string;
  pin?: string;
  role: 'ADMIN' | 'OPERATOR';
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  pin?: string;
  role?: 'ADMIN' | 'OPERATOR';
  active?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateUserDto, actor: SessionUser) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email.toLowerCase() } },
    });
    if (existing)
      throw new ConflictException('A user with that email already exists');

    const passwordHash = dto.password
      ? await argon2.hash(dto.password, { type: argon2.argon2id })
      : null;
    const pinHash = dto.pin
      ? await argon2.hash(dto.pin, { type: argon2.argon2id })
      : null;

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email.toLowerCase(),
        role: dto.role,
        passwordHash,
        pinHash,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'user:create',
      entityType: 'User',
      entityId: user.id,
      newValue: { name: dto.name, email: dto.email, role: dto.role },
    });

    return user;
  }

  async update(
    tenantId: string,
    userId: string,
    dto: UpdateUserDto,
    actor: SessionUser,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!existing) throw new NotFoundException('User not found');

    type UserPatch = {
      name?: string;
      email?: string;
      role?: 'ADMIN' | 'OPERATOR';
      active?: boolean;
      passwordHash?: string;
      pinHash?: string;
    };
    const data: UserPatch = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password)
      data.passwordHash = await argon2.hash(dto.password, {
        type: argon2.argon2id,
      });
    if (dto.pin)
      data.pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'user:update',
      entityType: 'User',
      entityId: userId,
      oldValue: {
        name: existing.name,
        role: existing.role,
        active: existing.active,
      },
      newValue: dto as Record<string, unknown>,
    });

    return updated;
  }
}
