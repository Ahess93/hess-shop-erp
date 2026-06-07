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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 attempts per minute
  async login(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ user: object }> {
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

    // Store user in session
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
