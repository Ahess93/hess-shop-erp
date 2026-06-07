import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Revenue per customer: total invoiced (paid + sent) grouped by customer.
   */
  async revenueByCustomer(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ['PAID', 'SENT', 'OVERDUE'] },
      },
      select: {
        customerId: true,
        total: true,
        status: true,
        paidDate: true,
        customer: { select: { id: true, businessName: true, email: true } },
      },
    });

    const map = new Map<
      string,
      {
        customerId: string;
        businessName: string;
        email: string | null;
        totalInvoiced: number;
        totalPaid: number;
        invoiceCount: number;
      }
    >();

    for (const inv of invoices) {
      const key = inv.customerId;
      const existing = map.get(key);
      const total = Number(inv.total);
      if (existing) {
        existing.totalInvoiced += total;
        if (inv.status === 'PAID') existing.totalPaid += total;
        existing.invoiceCount += 1;
      } else {
        map.set(key, {
          customerId: inv.customerId,
          businessName: inv.customer.businessName,
          email: inv.customer.email,
          totalInvoiced: total,
          totalPaid: inv.status === 'PAID' ? total : 0,
          invoiceCount: 1,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalInvoiced - a.totalInvoiced,
    );
  }

  /**
   * Job profitability: quoted price vs actual material + labor cost.
   * Only jobs that have both a Quote and a Traveler with cost data.
   */
  async jobProfitability(tenantId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { tenantId },
      select: {
        id: true,
        jobNumber: true,
        partName: true,
        quantity: true,
        dueDate: true,
        createdAt: true,
        customer: { select: { businessName: true } },
        quotes: {
          select: {
            calculatedPrice: true,
            status: true,
          },
          where: { status: { in: ['ACCEPTED', 'SENT'] } },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        traveler: {
          select: {
            actualMaterialCostPerPart: true,
            jobCost: true,
            laborTime: true,
            partsScrapped: true,
          },
        },
      },
    });

    return jobs
      .filter((j) => j.quotes.length > 0 || j.traveler)
      .map((j) => {
        const quotedPrice = j.quotes[0]
          ? Number(j.quotes[0].calculatedPrice)
          : null;
        const actualMaterial = j.traveler?.actualMaterialCostPerPart
          ? Number(j.traveler.actualMaterialCostPerPart) * j.quantity
          : null;
        const laborCost = j.traveler?.jobCost
          ? Number(j.traveler.jobCost)
          : null;
        const actualTotal =
          actualMaterial !== null || laborCost !== null
            ? (actualMaterial ?? 0) + (laborCost ?? 0)
            : null;
        const margin =
          quotedPrice !== null && actualTotal !== null
            ? quotedPrice - actualTotal
            : null;
        const marginPct =
          quotedPrice !== null && actualTotal !== null && quotedPrice > 0
            ? ((quotedPrice - actualTotal) / quotedPrice) * 100
            : null;

        return {
          jobId: j.id,
          jobNumber: j.jobNumber,
          partName: j.partName,
          quantity: j.quantity,
          customer: j.customer.businessName,
          quotedPrice,
          actualTotal,
          margin,
          marginPct:
            marginPct !== null ? Math.round(marginPct * 10) / 10 : null,
          partsScrapped: j.traveler?.partsScrapped ?? 0,
        };
      })
      .sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));
  }

  /**
   * On-time delivery percentage.
   * A job is "on time" if it was shipped (has shippedDate) on or before dueDate.
   */
  async onTimeDelivery(tenantId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { tenantId },
      select: {
        id: true,
        jobNumber: true,
        partName: true,
        dueDate: true,
        customer: { select: { businessName: true } },
        traveler: { select: { shippedDate: true } },
      },
    });

    const shipped = jobs.filter((j) => j.traveler?.shippedDate);
    const onTime = shipped.filter(
      (j) => new Date(j.traveler!.shippedDate!) <= new Date(j.dueDate),
    );

    const pct =
      shipped.length > 0
        ? Math.round((onTime.length / shipped.length) * 1000) / 10
        : null;

    return {
      totalJobs: jobs.length,
      shippedJobs: shipped.length,
      onTimeJobs: onTime.length,
      onTimePct: pct,
    };
  }
}
