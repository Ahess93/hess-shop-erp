import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an immutable audit log entry.
   * Append-only — never updated or deleted through the app.
   */
  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: (entry.oldValue ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        newValue: (entry.newValue ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        ip: entry.ip,
      },
    });
  }
}
