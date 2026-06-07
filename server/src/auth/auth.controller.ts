import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { TwoFaService } from '../twofa/twofa.service';
import { Throttle } from '@nestjs/throttler';

const LoginSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

const PinLoginSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  pin: z.string().min(4).max(8),
});

const TwoFaSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFaService: TwoFaService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute (WAN hardened)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ user?: object; requiresTwoFa?: boolean }> {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid request');
    }

    const ip = req.ip;
    const user = await this.authService.validateByPassword(
      parsed.data.tenantId,
      parsed.data.email,
      parsed.data.password,
      ip,
    );

    // Check if 2FA is required
    const twoFaStatus = await this.twoFaService.getStatus(
      user.tenantId,
      user.id,
    );

    if (twoFaStatus.enabled) {
      // Store a pending-2FA marker in session — NOT a full login yet
      req.session['pending2fa'] = { userId: user.id, tenantId: user.tenantId };
      return { requiresTwoFa: true };
    }

    req.session['user'] = user;
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /** Second step: verify TOTP code to complete login when 2FA is required. */
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async loginTwoFa(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ user: object }> {
    const pending = req.session['pending2fa'];

    if (!pending) {
      throw new UnauthorizedException(
        'No pending 2FA session — complete password login first',
      );
    }

    const parsed = TwoFaSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid 2FA code format');
    }

    // Verify the TOTP code
    await this.twoFaService.verifyCode(
      pending.tenantId,
      pending.userId,
      parsed.data.code,
    );

    // Code valid — create the full session
    const user = await this.authService.getUserById(
      pending.tenantId,
      pending.userId,
    );
    delete req.session['pending2fa'];
    req.session['user'] = user;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  @Post('login/pin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async loginPin(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ user: object }> {
    const parsed = PinLoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnauthorizedException('Invalid request');
    }

    const ip = req.ip;
    const user = await this.authService.validateByPin(
      parsed.data.tenantId,
      parsed.data.email,
      parsed.data.pin,
      ip,
    );

    req.session['user'] = user;

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request, @Res() res: Response): void {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  }

  @Post('me')
  @HttpCode(HttpStatus.OK)
  me(@Req() req: Request): { user: unknown } {
    if (!req.session['user']) {
      throw new UnauthorizedException('Not authenticated');
    }
    return { user: req.session['user'] };
  }
}
