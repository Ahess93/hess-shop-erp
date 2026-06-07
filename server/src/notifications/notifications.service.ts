import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load SMTP config from SystemSettings for the given tenant.
   * Returns null if not configured.
   */
  private async getSmtpConfig(tenantId: string): Promise<SmtpConfig | null> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { tenantId_key: { tenantId, key: 'smtp' } },
    });
    if (!setting) return null;

    const value = setting.value as Record<string, unknown>;
    if (
      !value.host ||
      !value.port ||
      !value.user ||
      !value.pass ||
      !value.fromEmail
    ) {
      return null;
    }

    return {
      host: value.host as string,
      port: Number(value.port),
      secure: Boolean(value.secure ?? false),
      user: value.user as string,
      pass: value.pass as string,
      fromName: (value.fromName as string | undefined) ?? 'Shop ERP',
      fromEmail: value.fromEmail as string,
    };
  }

  /**
   * Send an email using the tenant's configured SMTP.
   * Fails silently (logs error) if SMTP is not configured.
   */
  async sendEmail(tenantId: string, opts: SendEmailOptions): Promise<boolean> {
    const config = await this.getSmtpConfig(tenantId);
    if (!config) {
      this.logger.warn(
        `SMTP not configured for tenant ${tenantId} — email skipped`,
      );
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });

    try {
      await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      this.logger.log(`Email sent to ${opts.to}: ${opts.subject}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${String(err)}`);
      return false;
    }
  }

  /** Create an in-app notification record */
  async createNotification(
    tenantId: string,
    type: string,
    message: string,
    targetUserId?: string,
  ) {
    return this.prisma.notification.create({
      data: { tenantId, type, message, targetUserId },
    });
  }

  /** List unread notifications for a user (or all if no userId given) */
  async list(tenantId: string, userId?: string) {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        ...(userId ? { targetUserId: userId } : {}),
        read: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Mark a notification as read */
  async markRead(tenantId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, tenantId },
      data: { read: true },
    });
  }

  /** Mark all notifications as read for a user */
  async markAllRead(tenantId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { tenantId, targetUserId: userId, read: false },
      data: { read: true },
    });
  }

  /**
   * Send overdue-job email alerts.
   * Called by the nightly scheduler.
   */
  async sendOverdueJobAlerts(tenantId: string): Promise<void> {
    const overdueJobs = await this.prisma.job.findMany({
      where: {
        tenantId,
        dueDate: { lt: new Date() },
        department: { not: 'SHIPPING' },
      },
      select: {
        id: true,
        jobNumber: true,
        partName: true,
        dueDate: true,
        customer: { select: { businessName: true, email: true } },
      },
      take: 100,
    });

    if (overdueJobs.length === 0) return;

    // Get Admin/SuperAdmin users for the tenant
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['SUPER_ADMIN', 'ADMIN'] },
        active: true,
      },
      select: { email: true, name: true },
    });

    const jobList = overdueJobs
      .map(
        (j) =>
          `<tr>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${j.jobNumber}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${j.partName}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${j.customer.businessName}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${new Date(j.dueDate).toLocaleDateString()}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <h2 style="color:#d4a017">Overdue Jobs Alert</h2>
      <p>${overdueJobs.length} job(s) are past their due date:</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:6px 8px;text-align:left">Job #</th>
            <th style="padding:6px 8px;text-align:left">Part</th>
            <th style="padding:6px 8px;text-align:left">Customer</th>
            <th style="padding:6px 8px;text-align:left">Due Date</th>
          </tr>
        </thead>
        <tbody>${jobList}</tbody>
      </table>
    `;

    for (const admin of admins) {
      await this.sendEmail(tenantId, {
        to: admin.email,
        subject: `[Shop ERP] ${overdueJobs.length} overdue job(s) need attention`,
        html,
        text: `${overdueJobs.length} jobs are past due. Log in to the shop ERP to review.`,
      });
    }

    // Also create in-app notifications
    await this.createNotification(
      tenantId,
      'overdue_jobs',
      `${overdueJobs.length} job(s) are overdue.`,
    );
  }

  /**
   * Send low-stock email alerts.
   * Called by the nightly scheduler.
   */
  async sendLowStockAlerts(tenantId: string): Promise<void> {
    const allItems = await this.prisma.inventoryItem.findMany({
      where: { tenantId },
      select: {
        id: true,
        sku: true,
        name: true,
        quantity: true,
        reorderPoint: true,
        unit: true,
      },
    });

    const lowItems = allItems.filter(
      (i) => Number(i.quantity) <= Number(i.reorderPoint),
    );

    if (lowItems.length === 0) return;

    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['SUPER_ADMIN', 'ADMIN'] },
        active: true,
      },
      select: { email: true },
    });

    const itemList = lowItems
      .map(
        (i) =>
          `<tr>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${i.sku}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${i.name}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;color:#dc2626">${Number(i.quantity)} ${i.unit}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${Number(i.reorderPoint)} ${i.unit}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <h2 style="color:#d4a017">Low Stock Alert</h2>
      <p>${lowItems.length} item(s) are at or below reorder point:</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:6px 8px;text-align:left">SKU</th>
            <th style="padding:6px 8px;text-align:left">Name</th>
            <th style="padding:6px 8px;text-align:left">Current Qty</th>
            <th style="padding:6px 8px;text-align:left">Reorder Point</th>
          </tr>
        </thead>
        <tbody>${itemList}</tbody>
      </table>
    `;

    for (const admin of admins) {
      await this.sendEmail(tenantId, {
        to: admin.email,
        subject: `[Shop ERP] ${lowItems.length} inventory item(s) need reordering`,
        html,
      });
    }

    await this.createNotification(
      tenantId,
      'low_stock',
      `${lowItems.length} inventory item(s) are at or below reorder point.`,
    );
  }
}
