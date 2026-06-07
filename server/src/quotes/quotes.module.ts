import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { QuotePdfService } from './pdf/quote-pdf.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PrismaModule, AuditModule, PermissionsModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuotePdfService],
})
export class QuotesModule {}
