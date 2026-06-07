import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
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

const baseItem = {
  id: 'item-1',
  tenantId: TENANT,
  sku: 'BOLT-10MM',
  name: '10mm Bolt',
  category: 'Fasteners',
  quantity: new Prisma.Decimal('50'),
  unit: 'ea',
  reorderPoint: new Prisma.Decimal('10'),
  unitCost: new Prisma.Decimal('0.25'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: {
    inventoryItem: Record<string, jest.Mock>;
    stockMovement: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([baseItem]),
        findFirst: jest.fn().mockResolvedValue(baseItem),
        create: jest.fn().mockResolvedValue(baseItem),
        update: jest.fn().mockResolvedValue(baseItem),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest
        .fn()
        .mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('create', () => {
    it('throws ConflictException when SKU already exists', async () => {
      // findFirst returns existing item (SKU check)
      await expect(
        service.create(TENANT, { sku: 'BOLT-10MM', name: 'Duplicate' }, ACTOR),
      ).rejects.toThrow(ConflictException);
    });

    it('creates item when SKU is unique', async () => {
      prisma.inventoryItem.findFirst
        .mockResolvedValueOnce(null) // SKU check returns null
        .mockResolvedValue(baseItem);
      prisma.inventoryItem.create.mockResolvedValue(baseItem);
      const result = await service.create(
        TENANT,
        { sku: 'NEW-SKU', name: 'New Item' },
        ACTOR,
      );
      expect(result).toBeDefined();
      expect(prisma.inventoryItem.create).toHaveBeenCalled();
    });
  });

  describe('adjustStock', () => {
    it('throws NotFoundException for unknown item', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      await expect(
        service.adjustStock(
          TENANT,
          'bad-id',
          { delta: 10, reason: 'restock' },
          ACTOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when removal exceeds stock', async () => {
      // baseItem has quantity 50, try to remove 60
      await expect(
        service.adjustStock(
          TENANT,
          'item-1',
          { delta: -60, reason: 'removal' },
          ACTOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows removal up to current stock level', async () => {
      prisma.$transaction.mockResolvedValue([baseItem, {}]);
      const result = await service.adjustStock(
        TENANT,
        'item-1',
        { delta: -50, reason: 'full removal' },
        ACTOR,
      );
      expect(result).toBeDefined();
    });

    it('allows positive adjustment', async () => {
      prisma.$transaction.mockResolvedValue([
        { ...baseItem, quantity: new Prisma.Decimal('60') },
        {},
      ]);
      const result = await service.adjustStock(
        TENANT,
        'item-1',
        { delta: 10, reason: 'restock' },
        ACTOR,
      );
      expect(result).toBeDefined();
    });
  });

  describe('lowStock', () => {
    it('returns items where quantity <= reorderPoint', async () => {
      const lowItem = {
        ...baseItem,
        quantity: new Prisma.Decimal('5'),
        reorderPoint: new Prisma.Decimal('10'),
      };
      const okItem = {
        ...baseItem,
        id: 'item-2',
        quantity: new Prisma.Decimal('20'),
      };
      prisma.inventoryItem.findMany.mockResolvedValue([lowItem, okItem]);
      const result = await service.lowStock(TENANT);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-1');
    });

    it('returns empty array when all items are above reorder point', async () => {
      const okItem = {
        ...baseItem,
        quantity: new Prisma.Decimal('50'),
        reorderPoint: new Prisma.Decimal('10'),
      };
      prisma.inventoryItem.findMany.mockResolvedValue([okItem]);
      const result = await service.lowStock(TENANT);
      expect(result).toHaveLength(0);
    });
  });
});
