import { Module } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
