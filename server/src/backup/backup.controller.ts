import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Session,
} from '@nestjs/common';
import { BackupService, BackupConfig } from './backup.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';
import type { SessionUser } from '../auth/auth.service';

@Controller('backup')
@UseGuards(AuthGuard)
export class BackupController {
  constructor(
    private readonly backup: BackupService,
    private readonly permissions: PermissionsService,
  ) {}

  /** GET /backup/config — fetch current backup configuration */
  @Get('config')
  async getConfig(@Session() session: { user: SessionUser }) {
    const user = session.user;
    this.permissions.assert(user.role, 'settings:update'); // SUPER_ADMIN only
    return this.backup.getConfig(user.tenantId);
  }

  /** PUT /backup/config — save backup configuration */
  @Put('config')
  async saveConfig(
    @Session() session: { user: SessionUser },
    @Body() dto: Partial<BackupConfig>,
  ) {
    const user = session.user;
    this.permissions.assert(user.role, 'settings:update');
    return this.backup.saveConfig(user.tenantId, dto, user);
  }

  /** GET /backup/list — list available backup files */
  @Get('list')
  async list(@Session() session: { user: SessionUser }) {
    const user = session.user;
    this.permissions.assert(user.role, 'settings:update');
    return this.backup.listBackups(user.tenantId);
  }

  /** POST /backup/create — trigger a manual backup */
  @Post('create')
  async create(@Session() session: { user: SessionUser }) {
    const user = session.user;
    this.permissions.assert(user.role, 'settings:update');
    return this.backup.createBackup(user.tenantId, user);
  }

  /** GET /backup/verify/:filename — verify a backup file is intact */
  @Get('verify/:filename')
  async verify(
    @Session() session: { user: SessionUser },
    @Param('filename') filename: string,
  ) {
    const user = session.user;
    this.permissions.assert(user.role, 'settings:update');
    return this.backup.verifyBackup(user.tenantId, filename);
  }
}
