import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { TravelerService } from './traveler.service';
import type { UpsertTravelerDto, AddToolDto } from './traveler.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';

@Controller('jobs/:jobId/traveler')
@UseGuards(AuthGuard)
export class TravelerController {
  constructor(
    private readonly travelerService: TravelerService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async get(@Req() req: Request, @Param('jobId') jobId: string) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'traveler:read');
    return this.travelerService.getOrCreate(user.tenantId, jobId);
  }

  @Patch()
  async update(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Body() dto: UpsertTravelerDto,
  ) {
    const user = req.session['user']!;
    // Operators are allowed but service enforces field restrictions
    this.permissions.assert(user.role, 'traveler:read');
    return this.travelerService.update(user.tenantId, jobId, dto, user);
  }

  @Post('tools')
  @HttpCode(HttpStatus.CREATED)
  async addTool(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Body() dto: AddToolDto,
  ) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'traveler:update-all');
    return this.travelerService.addTool(user.tenantId, jobId, dto, user);
  }

  @Delete('tools/:toolId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTool(@Req() req: Request, @Param('toolId') toolId: string) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'traveler:update-all');
    await this.travelerService.removeTool(user.tenantId, toolId, user);
  }
}
