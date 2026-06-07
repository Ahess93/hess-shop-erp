import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CustomersService } from './customers.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';

@Controller('customers')
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'customer:read');
    return this.customersService.list(user.tenantId);
  }
}
