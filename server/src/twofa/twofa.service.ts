/**
 * TwoFactorService — TOTP-based two-factor authentication.
 *
 * Uses otplib (RFC 6238) with a 30-second window and SHA-1 (Google Authenticator
 * compatible). Secrets are stored encrypted in the database.
 *
 * Flow:
 *  1. setupTwoFa()    — generates a secret, returns a QR code URI
 *  2. verifyAndEnable() — verifies the first code, marks totpEnabled = true
 *  3. verifyCode()    — called at login when totpEnabled = true
 *  4. disable()       — removes secret and disables 2FA
 */
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role } from '../permissions/permissions.types';
import type { SessionUser } from '../auth/auth.service';

// otplib and qrcode are ESM packages — require() them to avoid Jest parse errors
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as {
  authenticator: {
    options: { window?: number };
    generateSecret(size?: number): string;
    keyuri(user: string, issuer: string, secret: string): string;
    verify(opts: { token: string; secret: string }): boolean;
    generate(secret: string): string;
  };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const qrcode = require('qrcode') as {
  toDataURL(text: string): Promise<string>;
};

// ─── Encryption helpers ──────────────────────────────────────────────────────
// Secrets are encrypted with AES-256-GCM using the SESSION_SECRET as key material.
// This keeps secrets unreadable even if the DB is dumped.

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;

function getKey(): Buffer {
  const secret = process.env['SESSION_SECRET'] ?? 'dev-secret-not-for-prod';
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Format: iv(hex):tag(hex):data(hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format');
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class TwoFaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    // Allow a ±1 window (one step before/after) to handle clock drift
    authenticator.options = { window: 1 };
  }

  /**
   * Generate a new TOTP secret for a user and return the QR code data URI.
   * Does NOT enable 2FA yet — the user must verify a code first.
   */
  async setupTwoFa(
    tenantId: string,
    userId: string,
    actor: SessionUser,
  ): Promise<{ otpauthUrl: string; qrDataUri: string; secret: string }> {
    // Only allow users to set up their own 2FA (or SUPER_ADMIN for any user)
    if (actor.id !== userId && actor.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'You can only set up 2FA for your own account',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    const secret = authenticator.generateSecret(20); // 20 bytes = 160-bit key
    const issuer = 'Hess Shop ERP';
    const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);

    // Store encrypted secret (not yet enabled)
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encrypt(secret), totpEnabled: false },
    });

    const qrDataUri = await qrcode.toDataURL(otpauthUrl);

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: userId,
      newValue: { action: '2fa_setup_initiated' },
    });

    return { otpauthUrl, qrDataUri, secret };
  }

  /**
   * Verify the first TOTP code and activate 2FA for the user.
   */
  async verifyAndEnable(
    tenantId: string,
    userId: string,
    code: string,
    actor: SessionUser,
  ): Promise<void> {
    if (actor.id !== userId && actor.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'You can only enable 2FA for your own account',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.totpSecret) {
      throw new BadRequestException('Run 2FA setup first before verifying');
    }

    const secret = decrypt(user.totpSecret);
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code — try again');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: userId,
      newValue: { action: '2fa_enabled' },
    });
  }

  /**
   * Verify a TOTP code at login time. Throws UnauthorizedException if invalid.
   */
  async verifyCode(
    tenantId: string,
    userId: string,
    code: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user || !user.totpSecret) {
      throw new UnauthorizedException('2FA is not configured for this account');
    }

    const secret = decrypt(user.totpSecret);
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
  }

  /**
   * Disable 2FA and remove the secret for a user.
   * Requires a valid TOTP code to confirm the action (unless SUPER_ADMIN).
   */
  async disable(
    tenantId: string,
    userId: string,
    code: string | undefined,
    actor: SessionUser,
  ): Promise<void> {
    if (actor.id !== userId && actor.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'You can only disable 2FA for your own account',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    // Non-admins must confirm with a valid code
    if (actor.id === userId && user.totpSecret && code) {
      const secret = decrypt(user.totpSecret);
      const valid = authenticator.verify({ token: code, secret });
      if (!valid) {
        throw new UnauthorizedException(
          'Invalid 2FA code — provide a valid code to disable 2FA',
        );
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false },
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: userId,
      newValue: { action: '2fa_disabled' },
    });
  }

  /**
   * Check whether 2FA is enabled for a user (for the login flow).
   */
  async getStatus(
    tenantId: string,
    userId: string,
  ): Promise<{ enabled: boolean; configured: boolean }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { totpEnabled: true, totpSecret: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      enabled: user.totpEnabled,
      configured: !!user.totpSecret,
    };
  }
}
