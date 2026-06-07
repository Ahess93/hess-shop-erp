import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceDto {
  customerId: string;
  jobId?: string;
  lineItems: LineItem[];
  taxRate?: number; // percentage, e.g. 8.5 means 8.5%
  dueDate?: string; // ISO date string
}

export interface UpdateInvoiceDto {
  customerId?: string;
  jobId?: string;
  lineItems?: LineItem[];
  taxRate?: number;
  dueDate?: string;
  status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
}

const INVOICE_SELECT = {
  id: true,
  tenantId: true,
  customerId: true,
  jobId: true,
  invoiceNumber: true,
  lineItems: true,
  subtotal: true,
  tax: true,
  total: true,
  status: true,
  pdfPath: true,
  dueDate: true,
  paidDate: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: { id: true, businessName: true, email: true, phone: true },
  },
  job: {
    select: { id: true, jobNumber: true, partName: true, quantity: true },
  },
};

function calcTotals(
  lineItems: LineItem[],
  taxRate: number,
): { subtotal: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal } {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  return {
    subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
    tax: new Prisma.Decimal(tax.toFixed(2)),
    total: new Prisma.Decimal(total.toFixed(2)),
  };
}

/** Generate next invoice number: INV-YYYYMM-NNNN */
async function nextInvoiceNumber(
  prisma: PrismaService,
  tenantId: string,
): Promise<string> {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;

  const last = await prisma.invoice.findFirst({
    where: { tenantId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  const seq = last
    ? parseInt(last.invoiceNumber.slice(prefix.length), 10) + 1
    : 1;

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      select: INVOICE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      select: INVOICE_SELECT,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(tenantId: string, dto: CreateInvoiceDto, actor: SessionUser) {
    const taxRate = dto.taxRate ?? 0;
    const { subtotal, tax, total } = calcTotals(dto.lineItems, taxRate);
    const invoiceNumber = await nextInvoiceNumber(this.prisma, tenantId);

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        jobId: dto.jobId,
        invoiceNumber,
        lineItems: dto.lineItems as unknown as Prisma.InputJsonValue,
        subtotal,
        tax,
        total,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      select: INVOICE_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'invoice:create',
      entityType: 'Invoice',
      entityId: invoice.id,
      newValue: { invoiceNumber, total: total.toString() },
    });

    return invoice;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateInvoiceDto,
    actor: SessionUser,
  ) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Invoice not found');

    if (existing.status === 'PAID') {
      throw new BadRequestException('Paid invoices cannot be modified');
    }

    type InvoicePatch = {
      customerId?: string;
      jobId?: string | null;
      lineItems?: Prisma.InputJsonValue;
      subtotal?: Prisma.Decimal;
      tax?: Prisma.Decimal;
      total?: Prisma.Decimal;
      status?: string;
      dueDate?: Date | null;
      paidDate?: Date | null;
    };

    const data: InvoicePatch = {};
    if (dto.customerId !== undefined) data.customerId = dto.customerId;
    if (dto.jobId !== undefined) data.jobId = dto.jobId ?? null;
    if (dto.dueDate !== undefined)
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'PAID') data.paidDate = new Date();
    }

    if (dto.lineItems !== undefined) {
      const existingItems = existing.lineItems as unknown as LineItem[];
      const lineItems = dto.lineItems ?? existingItems;
      const taxRate = dto.taxRate ?? 0;
      const totals = calcTotals(lineItems, taxRate);
      data.lineItems = lineItems as unknown as Prisma.InputJsonValue;
      data.subtotal = totals.subtotal;
      data.tax = totals.tax;
      data.total = totals.total;
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data,
      select: INVOICE_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'invoice:update',
      entityType: 'Invoice',
      entityId: id,
      oldValue: { status: existing.status } as Record<string, unknown>,
      newValue: dto as Record<string, unknown>,
    });

    return updated;
  }

  async remove(tenantId: string, id: string, actor: SessionUser) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Invoice not found');
    if (existing.status === 'PAID') {
      throw new BadRequestException('Paid invoices cannot be deleted');
    }

    await this.prisma.invoice.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'invoice:delete',
      entityType: 'Invoice',
      entityId: id,
      oldValue: { invoiceNumber: existing.invoiceNumber } as Record<
        string,
        unknown
      >,
    });
  }

  async savePdfPath(id: string, pdfPath: string) {
    await this.prisma.invoice.update({ where: { id }, data: { pdfPath } });
  }

  /** Mark overdue: called by scheduler. Returns count updated. */
  async markOverdue(tenantId: string): Promise<number> {
    const result = await this.prisma.invoice.updateMany({
      where: {
        tenantId,
        status: 'SENT',
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });
    return result.count;
  }
}
