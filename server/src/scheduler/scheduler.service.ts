import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cron from 'node-cron';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly invoices: InvoicesService,
  ) {}

  onModuleInit() {
    // Nightly at 01:00 — mark overdue invoices + send alerts
    cron.schedule('0 1 * * *', () => {
      void this.runNightlyScan();
    });

    this.logger.log('Scheduler initialized — nightly scan at 01:00');
  }

  async runNightlyScan(): Promise<void> {
    this.logger.log('Running nightly scan…');

    try {
      // Get all tenant IDs
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true, name: true },
      });

      for (const tenant of tenants) {
        await this.runForTenant(tenant.id, tenant.name);
      }

      this.logger.log(`Nightly scan complete for ${tenants.length} tenant(s)`);
    } catch (err) {
      this.logger.error(`Nightly scan failed: ${String(err)}`);
    }
  }

  private async runForTenant(
    tenantId: string,
    tenantName: string,
  ): Promise<void> {
    try {
      // 1. Mark overdue invoices
      const overdueCount = await this.invoices.markOverdue(tenantId);
      if (overdueCount > 0) {
        this.logger.log(
          `${tenantName}: marked ${overdueCount} invoice(s) as OVERDUE`,
        );
      }

      // 2. Send overdue job alerts
      await this.notifications.sendOverdueJobAlerts(tenantId);

      // 3. Send low-stock alerts
      await this.notifications.sendLowStockAlerts(tenantId);
    } catch (err) {
      this.logger.error(`Scan failed for tenant ${tenantName}: ${String(err)}`);
    }
  }
}
