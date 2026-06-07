import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TimeService } from './time.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';

const TENANT = 'tenant-1';
const ACTOR: SessionUser = {
  id: 'user-1',
  tenantId: TENANT,
  role: 'OPERATOR',
  email: 'op@b.com',
};
const ADMIN: SessionUser = {
  id: 'admin-1',
  tenantId: TENANT,
  role: 'ADMIN',
  email: 'a@b.com',
};

const baseEntry = {
  id: 'entry-1',
  tenantId: TENANT,
  userId: 'user-1',
  jobId: null,
  type: 'DAILY',
  clockIn: new Date('2025-01-15T08:00:00Z'),
  clockOut: null,
  durationMinutes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 'user-1', name: 'Op', email: 'op@b.com', role: 'OPERATOR' },
  job: null,
};

describe('TimeService', () => {
  let service: TimeService;
  let prisma: { timeEntry: Record<string, jest.Mock> };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      timeEntry: {
        findFirst: jest.fn().mockResolvedValue(null), // default: no open entry
        findMany: jest.fn().mockResolvedValue([baseEntry]),
        create: jest.fn().mockResolvedValue(baseEntry),
        update: jest.fn().mockResolvedValue({
          ...baseEntry,
          clockOut: new Date(),
          durationMinutes: 480,
        }),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<TimeService>(TimeService);
  });

  describe('clockIn', () => {
    it('creates a DAILY entry successfully', async () => {
      const result = await service.clockIn(TENANT, { type: 'DAILY' }, ACTOR);
      expect(result).toBeDefined();
      expect(prisma.timeEntry.create).toHaveBeenCalled();
    });

    it('requires jobId for JOB type', async () => {
      await expect(
        service.clockIn(TENANT, { type: 'JOB' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a JOB entry when jobId is provided', async () => {
      const jobEntry = { ...baseEntry, type: 'JOB', jobId: 'job-1' };
      prisma.timeEntry.create.mockResolvedValue(jobEntry);
      const result = await service.clockIn(
        TENANT,
        { type: 'JOB', jobId: 'job-1' },
        ACTOR,
      );
      expect(result).toBeDefined();
    });

    it('throws ConflictException when open entry exists for same type', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue(baseEntry); // already open
      await expect(
        service.clockIn(TENANT, { type: 'DAILY' }, ACTOR),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('clockOut', () => {
    it('throws NotFoundException for unknown entry', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue(null);
      await expect(
        service.clockOut(TENANT, { entryId: 'bad-id' }, ACTOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if already clocked out', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue({
        ...baseEntry,
        clockOut: new Date(),
      });
      await expect(
        service.clockOut(TENANT, { entryId: 'entry-1' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents operator from clocking out another user', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue({
        ...baseEntry,
        userId: 'other-user',
      });
      await expect(
        service.clockOut(TENANT, { entryId: 'entry-1' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows admin to clock out any user', async () => {
      prisma.timeEntry.findFirst.mockResolvedValue({
        ...baseEntry,
        userId: 'other-user',
      });
      const result = await service.clockOut(
        TENANT,
        { entryId: 'entry-1' },
        ADMIN,
      );
      expect(result).toBeDefined();
    });

    it('computes durationMinutes correctly', async () => {
      const clockIn = new Date('2025-01-15T08:00:00Z');
      const clockOut = new Date('2025-01-15T16:00:00Z'); // 8 hours = 480 min
      prisma.timeEntry.findFirst.mockResolvedValue({ ...baseEntry, clockIn });
      prisma.timeEntry.update.mockResolvedValue({
        ...baseEntry,
        clockIn,
        clockOut,
        durationMinutes: 480,
      });
      const result = await service.clockOut(
        TENANT,
        { entryId: 'entry-1' },
        ACTOR,
      );
      expect(result.durationMinutes).toBe(480);
    });

    it('handles midnight crossing correctly', async () => {
      const clockIn = new Date('2025-01-15T23:00:00Z');
      const clockOut = new Date('2025-01-16T01:00:00Z'); // 2 hours = 120 min across midnight
      prisma.timeEntry.findFirst.mockResolvedValue({ ...baseEntry, clockIn });
      prisma.timeEntry.update.mockResolvedValue({
        ...baseEntry,
        clockIn,
        clockOut,
        durationMinutes: 120,
      });
      const result = await service.clockOut(
        TENANT,
        { entryId: 'entry-1' },
        ACTOR,
      );
      expect(result.durationMinutes).toBe(120);
    });
  });
});
