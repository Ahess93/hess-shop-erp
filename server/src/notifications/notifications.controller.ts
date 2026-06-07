import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { NotificationsService } from './notifications.service';
import type { SessionUser } from '../auth/auth.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    return this.notifications.list(user.tenantId, user.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user'] as SessionUser;
    await this.notifications.markRead(user.tenantId, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    await this.notifications.markAllRead(user.tenantId, user.id);
  }
}
