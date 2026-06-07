import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { JobsService } from './jobs.service';
import type { CreateJobDto, UpdateJobDto } from './jobs.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';

@Controller('jobs')
@UseGuards(AuthGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'job:read');
    return this.jobsService.list(user.tenantId);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'job:read');
    return this.jobsService.findOne(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateJobDto) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'job:create');
    return this.jobsService.create(user.tenantId, dto, user);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
  ) {
    const user = req.session['user']!;
    // Operators can only move departments, not full edit
    if (dto.department !== undefined && Object.keys(dto).length === 1) {
      this.permissions.assert(user.role, 'job:move-department');
    } else {
      this.permissions.assert(user.role, 'job:update');
    }
    return this.jobsService.update(user.tenantId, id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'job:delete');
    await this.jobsService.remove(user.tenantId, id, user);
  }
}
