import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import type { CreateUserDto, UpdateUserDto } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'user:read');
    return this.usersService.list(user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'user:create');
    return this.usersService.create(user.tenantId, dto, user);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'user:update');
    return this.usersService.update(user.tenantId, id, dto, user);
  }
}
