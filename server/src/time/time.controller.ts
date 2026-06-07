import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';
import { TimeService, ClockInDto, ClockOutDto } from './time.service';
import type { SessionUser } from '../auth/auth.service';

@Controller('time')
@UseGuards(AuthGuard)
export class TimeController {
  constructor(
    private readonly time: TimeService,
    private readonly permissions: PermissionsService,
  ) {}

  /** GET /time/me — open entries for the calling user */
  @Get('me')
  myOpenEntries(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'time:read-own');
    return this.time.myOpenEntries(user.tenantId, user);
  }

  /** GET /time/me/history — all entries for the calling user */
  @Get('me/history')
  myEntries(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'time:read-own');
    return this.time.myEntries(user.tenantId, user);
  }

  /** GET /time/all — all entries, Admin+ only */
  @Get('all')
  allEntries(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'time:read-all');
    return this.time.allEntries(user.tenantId);
  }

  /** GET /time/reports/jobs — per-job time totals, Admin+ only */
  @Get('reports/jobs')
  jobReport(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'time:read-all');
    return this.time.jobReport(user.tenantId);
  }

  /** GET /time/reports/users — per-user time totals, Admin+ only */
  @Get('reports/users')
  userReport(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'time:read-all');
    return this.time.userReport(user.tenantId);
  }

  /** POST /time/clock-in */
  @Post('clock-in')
  clockIn(@Req() req: Request, @Body() body: ClockInDto) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'time:clock-in-out');
    return this.time.clockIn(user.tenantId, body, user);
  }

  /** POST /time/clock-out */
  @Post('clock-out')
  clockOut(@Req() req: Request, @Body() body: ClockOutDto) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'time:clock-in-out');
    return this.time.clockOut(user.tenantId, body, user);
  }
}
