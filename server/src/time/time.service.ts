import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Role } from '../permissions/permissions.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';

export type TimeEntryType = 'JOB' | 'DAILY';

export interface ClockInDto {
  type: TimeEntryType;
  jobId?: string; // required when type === 'JOB'
}

export interface ClockOutDto {
  entryId: string;
}

const ENTRY_SELECT = {
  id: true,
  tenantId: true,
  userId: true,
  jobId: true,
  type: true,
  clockIn: true,
  clockOut: true,
  durationMinutes: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true, role: true } },
  job: { select: { id: true, jobNumber: true, partName: true } },
};

/** Compute duration in minutes, handling midnight crossings. */
function durationMins(clockIn: Date, clockOut: Date): number {
  return Math.round((clockOut.getTime() - clockIn.getTime()) / 60_000);
}

@Injectable()
export class TimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Clock in — creates an open TimeEntry.
   * Enforces: user may not have two open entries of the same type simultaneously.
   */
  async clockIn(tenantId: string, dto: ClockInDto, actor: SessionUser) {
    if (dto.type === 'JOB' && !dto.jobId) {
      throw new BadRequestException('jobId is required for JOB time entries');
    }

    // Check for existing open entry of same type for this user
    const openEntry = await this.prisma.timeEntry.findFirst({
      where: {
        tenantId,
        userId: actor.id,
        type: dto.type,
        clockOut: null,
      },
    });
    if (openEntry) {
      throw new ConflictException(
        `You already have an open ${dto.type} time entry. Clock out first.`,
      );
    }

    const entry = await this.prisma.timeEntry.create({
      data: {
        tenantId,
        userId: actor.id,
        jobId: dto.jobId ?? null,
        type: dto.type,
        clockIn: new Date(),
      },
      select: ENTRY_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'time:clock-in',
      entityType: 'TimeEntry',
      entityId: entry.id,
      newValue: { type: dto.type, jobId: dto.jobId ?? null },
    });

    return entry;
  }

  /**
   * Clock out — closes an open TimeEntry, computes durationMinutes.
   * Only the owning user (or Admin+) may clock out an entry.
   */
  async clockOut(tenantId: string, dto: ClockOutDto, actor: SessionUser) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: dto.entryId, tenantId },
    });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.clockOut)
      throw new BadRequestException('Entry is already clocked out');

    // Operators may only clock out their own entries
    if (actor.role === Role.OPERATOR && entry.userId !== actor.id) {
      throw new BadRequestException('You can only clock out your own entries');
    }

    const clockOut = new Date();
    const mins = durationMins(entry.clockIn, clockOut);

    const updated = await this.prisma.timeEntry.update({
      where: { id: dto.entryId },
      data: {
        clockOut,
        durationMinutes: mins,
      },
      select: ENTRY_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'time:clock-out',
      entityType: 'TimeEntry',
      entityId: dto.entryId,
      newValue: { durationMinutes: mins },
    });

    return updated;
  }

  /** Current open entries for the calling user */
  async myOpenEntries(tenantId: string, actor: SessionUser) {
    return this.prisma.timeEntry.findMany({
      where: { tenantId, userId: actor.id, clockOut: null },
      select: ENTRY_SELECT,
      orderBy: { clockIn: 'desc' },
    });
  }

  /** All entries for the calling user (own history) */
  async myEntries(tenantId: string, actor: SessionUser) {
    return this.prisma.timeEntry.findMany({
      where: { tenantId, userId: actor.id },
      select: ENTRY_SELECT,
      orderBy: { clockIn: 'desc' },
      take: 200,
    });
  }

  /** All entries for all users — Admin+ only */
  async allEntries(tenantId: string) {
    return this.prisma.timeEntry.findMany({
      where: { tenantId },
      select: ENTRY_SELECT,
      orderBy: { clockIn: 'desc' },
      take: 500,
    });
  }

  /** Per-job time report: total minutes and entry count grouped by job */
  async jobReport(tenantId: string) {
    const entries = await this.prisma.timeEntry.findMany({
      where: { tenantId, type: 'JOB', clockOut: { not: null } },
      select: {
        jobId: true,
        durationMinutes: true,
        job: { select: { id: true, jobNumber: true, partName: true } },
      },
    });

    const map = new Map<
      string,
      {
        jobId: string;
        jobNumber: string;
        partName: string;
        totalMinutes: number;
        entryCount: number;
      }
    >();

    for (const e of entries) {
      if (!e.jobId || !e.job) continue;
      const key = e.jobId;
      const existing = map.get(key);
      if (existing) {
        existing.totalMinutes += e.durationMinutes ?? 0;
        existing.entryCount += 1;
      } else {
        map.set(key, {
          jobId: e.jobId,
          jobNumber: e.job.jobNumber,
          partName: e.job.partName,
          totalMinutes: e.durationMinutes ?? 0,
          entryCount: 1,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalMinutes - a.totalMinutes,
    );
  }

  /** Per-user time report: total minutes grouped by user */
  async userReport(tenantId: string) {
    const entries = await this.prisma.timeEntry.findMany({
      where: { tenantId, clockOut: { not: null } },
      select: {
        userId: true,
        durationMinutes: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const map = new Map<
      string,
      {
        userId: string;
        name: string;
        email: string;
        totalMinutes: number;
        entryCount: number;
      }
    >();

    for (const e of entries) {
      const key = e.userId;
      const existing = map.get(key);
      if (existing) {
        existing.totalMinutes += e.durationMinutes ?? 0;
        existing.entryCount += 1;
      } else {
        map.set(key, {
          userId: e.userId,
          name: e.user.name,
          email: e.user.email,
          totalMinutes: e.durationMinutes ?? 0,
          entryCount: 1,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalMinutes - a.totalMinutes,
    );
  }
}
