import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.customer.findMany({
      where: { tenantId },
      select: { id: true, businessName: true, email: true, phone: true },
      orderBy: { businessName: 'asc' },
    });
  }
}
