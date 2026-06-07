import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Session,
  HttpCode,
} from '@nestjs/common';
import { TwoFaService } from './twofa.service';
import { AuthGuard } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.service';

@Controller('2fa')
@UseGuards(AuthGuard)
export class TwoFaController {
  constructor(private readonly twoFa: TwoFaService) {}

  /** GET /2fa/status/:userId — check 2FA status for a user */
  @Get('status/:userId')
  async getStatus(
    @Session() session: { user: SessionUser },
    @Param('userId') userId: string,
  ) {
    return this.twoFa.getStatus(session.user.tenantId, userId);
  }

  /** POST /2fa/setup/:userId — generate secret + QR code */
  @Post('setup/:userId')
  async setup(
    @Session() session: { user: SessionUser },
    @Param('userId') userId: string,
  ) {
    return this.twoFa.setupTwoFa(session.user.tenantId, userId, session.user);
  }

  /** POST /2fa/verify/:userId — verify code and activate 2FA */
  @Post('verify/:userId')
  @HttpCode(200)
  async verify(
    @Session() session: { user: SessionUser },
    @Param('userId') userId: string,
    @Body() dto: { code: string },
  ) {
    await this.twoFa.verifyAndEnable(
      session.user.tenantId,
      userId,
      dto.code,
      session.user,
    );
    return { message: '2FA enabled successfully' };
  }

  /** DELETE /2fa/disable/:userId — disable 2FA (requires current code or SUPER_ADMIN) */
  @Delete('disable/:userId')
  @HttpCode(200)
  async disable(
    @Session() session: { user: SessionUser },
    @Param('userId') userId: string,
    @Body() dto: { code?: string },
  ) {
    await this.twoFa.disable(
      session.user.tenantId,
      userId,
      dto.code,
      session.user,
    );
    return { message: '2FA disabled' };
  }
}
