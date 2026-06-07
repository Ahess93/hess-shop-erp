import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';
import {
  InventoryService,
  CreateItemDto,
  UpdateItemDto,
  AdjustStockDto,
} from './inventory.service';
import type { SessionUser } from '../auth/auth.service';

@Controller('inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  list(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'inventory:read');
    return this.inventory.list(user.tenantId);
  }

  @Get('low-stock')
  lowStock(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'inventory:read');
    return this.inventory.lowStock(user.tenantId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'inventory:read');
    return this.inventory.findOne(user.tenantId, id);
  }

  @Get(':id/movements')
  movements(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'inventory:read');
    return this.inventory.movements(user.tenantId, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateItemDto) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'inventory:create');
    return this.inventory.create(user.tenantId, body, user);
  }

  @Post(':id/adjust')
  adjust(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AdjustStockDto,
  ) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'inventory:update');
    return this.inventory.adjustStock(user.tenantId, id, body, user);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateItemDto,
  ) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'inventory:update');
    return this.inventory.update(user.tenantId, id, body, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'inventory:delete');
    await this.inventory.remove(user.tenantId, id, user);
  }
}
