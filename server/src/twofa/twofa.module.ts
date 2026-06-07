import { Module } from '@nestjs/common';
import { TwoFaService } from './twofa.service';
import { TwoFaController } from './twofa.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [TwoFaService],
  controllers: [TwoFaController],
  exports: [TwoFaService],
})
export class TwoFaModule {}
