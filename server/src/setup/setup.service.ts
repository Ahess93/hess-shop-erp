import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as argon2 from 'argon2';

export interface SetupStatusDto {
  needsSetup: boolean;
  tenantId?: string;
}

export interface CompleteSetupDto {
  orgName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getStatus(): Promise<SetupStatusDto> {
    const tenant = await this.prisma.tenant.findFirst();
    if (!tenant) return { needsSetup: true };
    return { needsSetup: false, tenantId: tenant.id };
  }

  async complete(dto: CompleteSetupDto): Promise<{ tenantId: string }> {
    const existing = await this.prisma.tenant.findFirst();
    if (existing) {
      throw new ConflictException('Setup has already been completed');
    }

    const passwordHash = await argon2.hash(dto.adminPassword, {
      type: argon2.argon2id,
    });

    const slug = dto.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const tenant = await this.prisma.tenant.create({
      data: { name: dto.orgName, slug },
    });

    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: dto.adminName,
        email: dto.adminEmail.toLowerCase(),
        role: 'SUPER_ADMIN',
        passwordHash,
      },
    });
    await this.audit.log({
      tenantId: tenant.id,
      userId: user.id,
      action: 'setup:complete',
      entityType: 'Tenant',
      entityId: tenant.id,
      newValue: { orgName: dto.orgName, adminEmail: dto.adminEmail },
    });

    return { tenantId: tenant.id };
  }
}
