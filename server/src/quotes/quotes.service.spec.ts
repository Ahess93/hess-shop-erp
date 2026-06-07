import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';
import type { SessionUser } from '../auth/auth.service';

const TENANT = 'tenant-1';
const ACTOR: SessionUser = {
  id: 'user-1',
  tenantId: TENANT,
  role: 'ADMIN',
  email: 'a@b.com',
};

const baseQuote = {
  id: 'quote-1',
  tenantId: TENANT,
  customerId: 'cust-1',
  jobId: null,
  laborRate: new Prisma.Decimal('100'),
  estRunTime: new Prisma.Decimal('2'),
  materialCost: new Prisma.Decimal('50'),
  markupPct: new Prisma.Decimal('10'),
  calculatedPrice: new Prisma.Decimal('275'),
  status: 'DRAFT',
  pdfPath: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: 'cust-1', businessName: 'Acme', email: null },
  job: null,
};

describe('QuotesService', () => {
  let service: QuotesService;
  let prisma: { quote: Record<string, jest.Mock> };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      quote: {
        findMany: jest.fn().mockResolvedValue([baseQuote]),
        findFirst: jest.fn().mockResolvedValue(baseQuote),
        create: jest.fn().mockResolvedValue(baseQuote),
        update: jest.fn().mockResolvedValue(baseQuote),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
  });

  // Helper to safely extract the first call arg from a Jest mock
  function firstCallArg<T>(mock: jest.Mock): T {
    const calls = mock.mock.calls as T[][];
    return calls[0][0];
  }

  describe('price calculation', () => {
    it('calculates (laborRate * estRunTime + materialCost) * (1 + markupPct/100)', async () => {
      // $100/hr * 2hr + $50 material = $250 base; $250 * 1.1 = $275
      const created = await service.create(
        TENANT,
        {
          customerId: 'cust-1',
          laborRate: 100,
          estRunTime: 2,
          materialCost: 50,
          markupPct: 10,
        },
        ACTOR,
      );
      const callArgs = firstCallArg<{
        data: { calculatedPrice: Prisma.Decimal };
      }>(prisma.quote.create);
      expect(Number(callArgs.data.calculatedPrice)).toBeCloseTo(275, 2);
      expect(created).toBeDefined();
    });

    it('recalculates price on update when pricing fields change', async () => {
      await service.update(TENANT, 'quote-1', { laborRate: 200 }, ACTOR);
      // $200 * 2 + $50 = $450 base, * 1.1 = $495
      const callArgs = firstCallArg<{
        data: { calculatedPrice: Prisma.Decimal };
      }>(prisma.quote.update);
      expect(Number(callArgs.data.calculatedPrice)).toBeCloseTo(495, 2);
    });

    it('does not recalculate price when only status changes', async () => {
      await service.update(TENANT, 'quote-1', { status: 'SENT' }, ACTOR);
      const callArgs = firstCallArg<{
        data: { calculatedPrice?: Prisma.Decimal };
      }>(prisma.quote.update);
      expect(callArgs.data.calculatedPrice).toBeUndefined();
    });
  });

  describe('status workflow', () => {
    it('allows status transition from DRAFT to SENT', async () => {
      await expect(
        service.update(TENANT, 'quote-1', { status: 'SENT' }, ACTOR),
      ).resolves.toBeDefined();
    });

    it('blocks non-REJECTED transitions from ACCEPTED', async () => {
      prisma.quote.findFirst.mockResolvedValue({
        ...baseQuote,
        status: 'ACCEPTED',
      });
      await expect(
        service.update(TENANT, 'quote-1', { status: 'SENT' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows REJECTED transition from ACCEPTED', async () => {
      prisma.quote.findFirst.mockResolvedValue({
        ...baseQuote,
        status: 'ACCEPTED',
      });
      await expect(
        service.update(TENANT, 'quote-1', { status: 'REJECTED' }, ACTOR),
      ).resolves.toBeDefined();
    });
  });

  describe('tenant isolation', () => {
    it('throws NotFoundException for unknown quote', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT, 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException on update for unknown quote', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);
      await expect(service.update(TENANT, 'bad-id', {}, ACTOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
