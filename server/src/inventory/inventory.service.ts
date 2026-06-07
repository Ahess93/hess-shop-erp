import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';

export interface CreateItemDto {
  sku: string;
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  reorderPoint?: number;
  unitCost?: number;
}

export interface UpdateItemDto {
  name?: string;
  category?: string;
  unit?: string;
  reorderPoint?: number;
  unitCost?: number;
}

export interface AdjustStockDto {
  delta: number; // positive = add, negative = remove
  reason: string;
}

const ITEM_SELECT = {
  id: true,
  tenantId: true,
  sku: true,
  name: true,
  category: true,
  quantity: true,
  unit: true,
  reorderPoint: true,
  unitCost: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { tenantId },
      select: ITEM_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      select: ITEM_SELECT,
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async create(tenantId: string, dto: CreateItemDto, actor: SessionUser) {
    // Enforce unique SKU per tenant
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { tenantId, sku: dto.sku },
    });
    if (existing)
      throw new ConflictException(`SKU "${dto.sku}" already exists`);

    const item = await this.prisma.inventoryItem.create({
      data: {
        tenantId,
        sku: dto.sku,
        name: dto.name,
        category: dto.category,
        quantity:
          dto.quantity !== undefined
            ? new Prisma.Decimal(dto.quantity)
            : undefined,
        unit: dto.unit,
        reorderPoint:
          dto.reorderPoint !== undefined
            ? new Prisma.Decimal(dto.reorderPoint)
            : undefined,
        unitCost:
          dto.unitCost !== undefined
            ? new Prisma.Decimal(dto.unitCost)
            : undefined,
      },
      select: ITEM_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'inventory:create',
      entityType: 'InventoryItem',
      entityId: item.id,
      newValue: { sku: dto.sku, quantity: dto.quantity ?? 0 },
    });

    return item;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateItemDto,
    actor: SessionUser,
  ) {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Inventory item not found');

    type ItemPatch = {
      name?: string;
      category?: string;
      unit?: string;
      reorderPoint?: Prisma.Decimal;
      unitCost?: Prisma.Decimal;
    };

    const data: ItemPatch = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.reorderPoint !== undefined)
      data.reorderPoint = new Prisma.Decimal(dto.reorderPoint);
    if (dto.unitCost !== undefined)
      data.unitCost = new Prisma.Decimal(dto.unitCost);

    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data,
      select: ITEM_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'inventory:update',
      entityType: 'InventoryItem',
      entityId: id,
      oldValue: { name: existing.name },
      newValue: dto as Record<string, unknown>,
    });

    return updated;
  }

  async remove(tenantId: string, id: string, actor: SessionUser) {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Inventory item not found');

    await this.prisma.inventoryItem.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'inventory:delete',
      entityType: 'InventoryItem',
      entityId: id,
      oldValue: { sku: existing.sku, quantity: existing.quantity },
    });
  }

  /**
   * Adjust stock level by delta (positive = add, negative = remove).
   * Records a StockMovement and re-checks low-stock status.
   * Returns the updated item.
   */
  async adjustStock(
    tenantId: string,
    id: string,
    dto: AdjustStockDto,
    actor: SessionUser,
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const newQty = Number(item.quantity) + dto.delta;
    if (newQty < 0) {
      throw new BadRequestException(
        `Insufficient stock. Current: ${Number(item.quantity)}, requested removal: ${Math.abs(dto.delta)}`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryItem.update({
        where: { id },
        data: { quantity: new Prisma.Decimal(newQty) },
        select: ITEM_SELECT,
      }),
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          itemId: id,
          delta: new Prisma.Decimal(dto.delta),
          reason: dto.reason,
          userId: actor.id,
        },
      }),
    ]);

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'inventory:adjust',
      entityType: 'InventoryItem',
      entityId: id,
      oldValue: { quantity: Number(item.quantity) },
      newValue: { quantity: newQty, delta: dto.delta, reason: dto.reason },
    });

    return updated;
  }

  async movements(tenantId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    return this.prisma.stockMovement.findMany({
      where: { tenantId, itemId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Returns all items where quantity <= reorderPoint */
  async lowStock(tenantId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId },
      select: ITEM_SELECT,
    });
    return items.filter((i) => Number(i.quantity) <= Number(i.reorderPoint));
  }
}
