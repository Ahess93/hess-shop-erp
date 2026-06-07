import { Module } from '@nestjs/common';
import { TimeController } from './time.controller';
import { TimeService } from './time.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PrismaModule, AuditModule, PermissionsModule],
  controllers: [TimeController],
  providers: [TimeService],
  exports: [TimeService],
})
export class TimeModule {}
