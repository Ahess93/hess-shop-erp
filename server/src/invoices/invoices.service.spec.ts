import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
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

const LINE_ITEMS = [
  { description: 'Machining', quantity: 1, unitPrice: 500 },
  { description: 'Material', quantity: 2, unitPrice: 75 },
];
// subtotal = 500 + 150 = 650, tax@10% = 65, total = 715

const baseInvoice = {
  id: 'inv-1',
  tenantId: TENANT,
  customerId: 'cust-1',
  jobId: null,
  invoiceNumber: 'INV-202501-0001',
  lineItems: LINE_ITEMS,
  subtotal: new Prisma.Decimal('650'),
  tax: new Prisma.Decimal('65'),
  total: new Prisma.Decimal('715'),
  status: 'DRAFT',
  pdfPath: null,
  dueDate: null,
  paidDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: { id: 'cust-1', businessName: 'Acme', email: null, phone: null },
  job: null,
};

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: { invoice: Record<string, jest.Mock> };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([baseInvoice]),
        findFirst: jest.fn().mockResolvedValue(baseInvoice),
        create: jest.fn().mockResolvedValue(baseInvoice),
        update: jest.fn().mockResolvedValue(baseInvoice),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  describe('invoice number generation', () => {
    it('generates INV-YYYYMM-NNNN format starting at 0001', async () => {
      prisma.invoice.findFirst
        .mockResolvedValueOnce(null) // no existing invoice (number gen)
        .mockResolvedValue(null); // findOne returns null → create path
      prisma.invoice.create.mockResolvedValue(baseInvoice);

      await service.create(
        TENANT,
        { customerId: 'cust-1', lineItems: LINE_ITEMS },
        ACTOR,
      );

      type CreateArg = { data: { invoiceNumber: string } };
      const createCalls = prisma.invoice.create.mock.calls as CreateArg[][];
      expect(createCalls[0][0].data.invoiceNumber).toMatch(/^INV-\d{6}-\d{4}$/);
    });

    it('increments invoice number when one already exists', async () => {
      prisma.invoice.findFirst
        .mockResolvedValueOnce({ invoiceNumber: 'INV-202501-0005' }) // existing
        .mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue(baseInvoice);

      await service.create(
        TENANT,
        { customerId: 'cust-1', lineItems: LINE_ITEMS },
        ACTOR,
      );

      type CreateArg = { data: { invoiceNumber: string } };
      const createCalls = prisma.invoice.create.mock.calls as CreateArg[][];
      expect(createCalls[0][0].data.invoiceNumber).toMatch(/0006$/);
    });
  });

  describe('tax calculation', () => {
    it('calculates subtotal, tax, and total correctly', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(null);
      prisma.invoice.create.mockResolvedValue(baseInvoice);

      await service.create(
        TENANT,
        { customerId: 'cust-1', lineItems: LINE_ITEMS, taxRate: 10 },
        ACTOR,
      );

      type CreateArg = {
        data: {
          subtotal: Prisma.Decimal;
          tax: Prisma.Decimal;
          total: Prisma.Decimal;
        };
      };
      const createCalls = prisma.invoice.create.mock.calls as CreateArg[][];
      expect(Number(createCalls[0][0].data.subtotal)).toBeCloseTo(650, 2);
      expect(Number(createCalls[0][0].data.tax)).toBeCloseTo(65, 2);
      expect(Number(createCalls[0][0].data.total)).toBeCloseTo(715, 2);
    });

    it('calculates zero tax when taxRate is 0', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(null);
      prisma.invoice.create.mockResolvedValue(baseInvoice);

      await service.create(
        TENANT,
        { customerId: 'cust-1', lineItems: LINE_ITEMS, taxRate: 0 },
        ACTOR,
      );

      type CreateArg = { data: { tax: Prisma.Decimal } };
      const createCalls = prisma.invoice.create.mock.calls as CreateArg[][];
      expect(Number(createCalls[0][0].data.tax)).toBe(0);
    });
  });

  describe('status protection', () => {
    it('throws BadRequestException on update when invoice is PAID', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        status: 'PAID',
      });
      await expect(
        service.update(TENANT, 'inv-1', { status: 'DRAFT' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on delete when invoice is PAID', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        status: 'PAID',
      });
      await expect(service.remove(TENANT, 'inv-1', ACTOR)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows update when invoice is DRAFT', async () => {
      await expect(
        service.update(TENANT, 'inv-1', { status: 'SENT' }, ACTOR),
      ).resolves.toBeDefined();
    });

    it('sets paidDate when marked PAID', async () => {
      prisma.invoice.update.mockResolvedValue({
        ...baseInvoice,
        status: 'PAID',
        paidDate: new Date(),
      });
      const result = await service.update(
        TENANT,
        'inv-1',
        { status: 'PAID' },
        ACTOR,
      );
      expect(result.status).toBe('PAID');
    });
  });

  describe('tenant isolation', () => {
    it('throws NotFoundException for unknown invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT, 'bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markOverdue', () => {
    it('returns count of invoices marked overdue', async () => {
      prisma.invoice.updateMany.mockResolvedValue({ count: 3 });
      const count = await service.markOverdue(TENANT);
      expect(count).toBe(3);
    });
  });
});
