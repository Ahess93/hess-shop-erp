import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';

export interface CreateQuoteDto {
  customerId: string;
  jobId?: string;
  laborRate: number;
  estRunTime: number;
  materialCost: number;
  markupPct: number;
}

export interface UpdateQuoteDto {
  customerId?: string;
  jobId?: string;
  laborRate?: number;
  estRunTime?: number;
  materialCost?: number;
  markupPct?: number;
  status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
}

const QUOTE_SELECT = {
  id: true,
  tenantId: true,
  customerId: true,
  jobId: true,
  laborRate: true,
  estRunTime: true,
  materialCost: true,
  markupPct: true,
  calculatedPrice: true,
  status: true,
  pdfPath: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, businessName: true, email: true } },
  job: {
    select: { id: true, jobNumber: true, partName: true, quantity: true },
  },
};

/** Price = (laborRate * estRunTime + materialCost) * (1 + markupPct/100) */
function calcPrice(
  laborRate: number,
  estRunTime: number,
  materialCost: number,
  markupPct: number,
): Prisma.Decimal {
  const base = laborRate * estRunTime + materialCost;
  const total = base * (1 + markupPct / 100);
  return new Prisma.Decimal(total.toFixed(2));
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.quote.findMany({
      where: { tenantId },
      select: QUOTE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, tenantId },
      select: QUOTE_SELECT,
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async create(tenantId: string, dto: CreateQuoteDto, actor: SessionUser) {
    const calculatedPrice = calcPrice(
      dto.laborRate,
      dto.estRunTime,
      dto.materialCost,
      dto.markupPct,
    );

    const quote = await this.prisma.quote.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        jobId: dto.jobId,
        laborRate: new Prisma.Decimal(dto.laborRate),
        estRunTime: new Prisma.Decimal(dto.estRunTime),
        materialCost: new Prisma.Decimal(dto.materialCost),
        markupPct: new Prisma.Decimal(dto.markupPct),
        calculatedPrice,
      },
      select: QUOTE_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'quote:create',
      entityType: 'Quote',
      entityId: quote.id,
      newValue: {
        customerId: dto.customerId,
        calculatedPrice: calculatedPrice.toString(),
      },
    });

    return quote;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateQuoteDto,
    actor: SessionUser,
  ) {
    const existing = await this.prisma.quote.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Quote not found');

    if (existing.status === 'ACCEPTED' && dto.status !== 'REJECTED') {
      throw new BadRequestException('Accepted quotes can only be rejected');
    }

    type QuotePatch = {
      customerId?: string;
      jobId?: string | null;
      laborRate?: Prisma.Decimal;
      estRunTime?: Prisma.Decimal;
      materialCost?: Prisma.Decimal;
      markupPct?: Prisma.Decimal;
      calculatedPrice?: Prisma.Decimal;
      status?: string;
    };

    const data: QuotePatch = {};
    if (dto.customerId !== undefined) data.customerId = dto.customerId;
    if (dto.jobId !== undefined) data.jobId = dto.jobId ?? null;
    if (dto.status !== undefined) data.status = dto.status;

    // Recalculate price if any pricing field changed
    const laborRate = dto.laborRate ?? Number(existing.laborRate);
    const estRunTime = dto.estRunTime ?? Number(existing.estRunTime);
    const materialCost = dto.materialCost ?? Number(existing.materialCost);
    const markupPct = dto.markupPct ?? Number(existing.markupPct);

    if (
      dto.laborRate !== undefined ||
      dto.estRunTime !== undefined ||
      dto.materialCost !== undefined ||
      dto.markupPct !== undefined
    ) {
      data.laborRate = new Prisma.Decimal(laborRate);
      data.estRunTime = new Prisma.Decimal(estRunTime);
      data.materialCost = new Prisma.Decimal(materialCost);
      data.markupPct = new Prisma.Decimal(markupPct);
      data.calculatedPrice = calcPrice(
        laborRate,
        estRunTime,
        materialCost,
        markupPct,
      );
    }

    const updated = await this.prisma.quote.update({
      where: { id },
      data: data as Parameters<typeof this.prisma.quote.update>[0]['data'],
      select: QUOTE_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'quote:update',
      entityType: 'Quote',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: dto as Record<string, unknown>,
    });

    return updated;
  }

  async remove(tenantId: string, id: string, actor: SessionUser) {
    const existing = await this.prisma.quote.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Quote not found');

    await this.prisma.quote.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'quote:delete',
      entityType: 'Quote',
      entityId: id,
      oldValue: { status: existing.status },
    });
  }

  async savePdfPath(id: string, pdfPath: string) {
    await this.prisma.quote.update({ where: { id }, data: { pdfPath } });
  }
}
