import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { SetupModule } from './setup/setup.module';
import { UsersModule } from './users/users.module';
import { JobsModule } from './jobs/jobs.module';
import { CustomersModule } from './customers/customers.module';
import { TravelerModule } from './traveler/traveler.module';
import { FilesModule } from './files/files.module';
import { QuotesModule } from './quotes/quotes.module';
import { InventoryModule } from './inventory/inventory.module';
import { TimeModule } from './time/time.module';
import { InvoicesModule } from './invoices/invoices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { BackupModule } from './backup/backup.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Rate limiting — 100 requests per minute by default
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    PermissionsModule,
    AuditModule,
    AuthModule,
    SetupModule,
    UsersModule,
    JobsModule,
    CustomersModule,
    TravelerModule,
    FilesModule,
    QuotesModule,
    InventoryModule,
    TimeModule,
    InvoicesModule,
    NotificationsModule,
    ReportsModule,
    SchedulerModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
