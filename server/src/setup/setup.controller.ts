import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SetupService } from './setup.service';
import type { CompleteSetupDto } from './setup.service';

@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  async getStatus() {
    return this.setupService.getStatus();
  }

  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  async complete(@Body() dto: CompleteSetupDto) {
    return this.setupService.complete(dto);
  }
}
