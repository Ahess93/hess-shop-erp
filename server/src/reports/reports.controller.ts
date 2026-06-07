import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';
import { ReportsService } from './reports.service';
import type { SessionUser } from '../auth/auth.service';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get('revenue-by-customer')
  revenueByCustomer(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'report:read');
    return this.reports.revenueByCustomer(user.tenantId);
  }

  @Get('job-profitability')
  jobProfitability(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'report:read');
    return this.reports.jobProfitability(user.tenantId);
  }

  @Get('on-time-delivery')
  onTimeDelivery(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'report:read');
    return this.reports.onTimeDelivery(user.tenantId);
  }
}
