import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { BackupModule } from '../backup/backup.module';

@Module({
  imports: [PrismaModule, NotificationsModule, InvoicesModule, BackupModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
