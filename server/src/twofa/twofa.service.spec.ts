import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { TwoFaService } from './twofa.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';
import { Role } from '../permissions/permissions.types';

// ─── Mock ESM packages ───────────────────────────────────────────────────────
// otplib and qrcode are ESM-only; Jest (CJS) can't parse them — mock both.
// jest.mock() is hoisted, so the factory must not reference block-scoped vars.
jest.mock('otplib', () => ({
  authenticator: {
    options: {},
    generateSecret: jest.fn(() => 'JBSWY3DPEHPK3PXP'),
    keyuri: jest.fn(
      (_user: string, _issuer: string, secret: string) =>
        `otpauth://totp/HessShopERP:test@example.com?secret=${secret}&issuer=HessShopERP`,
    ),
    verify: jest.fn(
      ({ token }: { token: string; secret: string }) => token === '123456',
    ),
    generate: jest.fn(() => '123456'),
  },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake'),
}));

// Convenience reference — resolved after mocks are set up
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticator } = require('otplib') as {
  authenticator: {
    options: { window?: number };
    generateSecret: jest.Mock;
    keyuri: jest.Mock;
    verify: jest.Mock;
    generate: jest.Mock;
  };
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT = 'tenant-1';
const USER_ID = 'user-1';

const ADMIN_ACTOR: SessionUser = {
  id: 'admin-1',
  tenantId: TENANT,
  role: Role.SUPER_ADMIN,
  email: 'admin@example.com',
};

const SELF_ACTOR: SessionUser = {
  id: USER_ID,
  tenantId: TENANT,
  role: Role.OPERATOR,
  email: 'op@example.com',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TwoFaService', () => {
  let service: TwoFaService;
  let prisma: { user: Record<string, jest.Mock> };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFaService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<TwoFaService>(TwoFaService);

    // Set SESSION_SECRET so encryption works in tests
    process.env['SESSION_SECRET'] = 'test-secret-for-totp-encryption';
  });

  // ─── setupTwoFa ─────────────────────────────────────────────────────────────

  describe('setupTwoFa', () => {
    it('returns otpauthUrl and qrDataUri', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: USER_ID,
        email: 'op@example.com',
        totpSecret: null,
        totpEnabled: false,
      });

      const result = await service.setupTwoFa(TENANT, USER_ID, ADMIN_ACTOR);
      expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
      expect(result.qrDataUri).toMatch(/^data:image\/png/);
      expect(result.secret).toBeTruthy();
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.setupTwoFa(TENANT, USER_ID, ADMIN_ACTOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when non-admin tries to set up for another user', async () => {
      const otherActor: SessionUser = {
        ...SELF_ACTOR,
        id: 'other-user',
      };
      await expect(
        service.setupTwoFa(TENANT, USER_ID, otherActor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── verifyAndEnable ────────────────────────────────────────────────────────

  describe('verifyAndEnable', () => {
    it('enables 2FA when code is valid', async () => {
      // Encrypt the secret the same way the service does (via setup)
      prisma.user.findFirst.mockResolvedValue({
        id: USER_ID,
        email: 'op@example.com',
        totpEnabled: false,
        totpSecret: null, // will be populated via setup
      });

      // Setup first to store encrypted secret
      const setup = await service.setupTwoFa(TENANT, USER_ID, SELF_ACTOR);
      const realCode = authenticator.generate(setup.secret) as string;

      // findFirst for verifyAndEnable returns user with stored encrypted secret
      const updateCall = prisma.user.update.mock.calls as {
        data: { totpSecret?: string; totpEnabled?: boolean };
      }[][];
      const encryptedSecret = (
        updateCall[0]?.[0] as { data: { totpSecret: string } }
      )?.data?.totpSecret;

      prisma.user.findFirst.mockResolvedValue({
        id: USER_ID,
        totpSecret: encryptedSecret,
        totpEnabled: false,
      });

      await service.verifyAndEnable(TENANT, USER_ID, realCode, SELF_ACTOR);

      // Last update call should set totpEnabled = true
      const lastCall = prisma.user.update.mock.calls as {
        data: { totpEnabled?: boolean };
      }[][];
      expect(lastCall[lastCall.length - 1]?.[0]?.data?.totpEnabled).toBe(true);
    });

    it('throws UnauthorizedException for invalid code', async () => {
      // Setup first
      prisma.user.findFirst.mockResolvedValue({
        id: USER_ID,
        email: 'op@example.com',
        totpSecret: null,
        totpEnabled: false,
      });
      const setup = await service.setupTwoFa(TENANT, USER_ID, SELF_ACTOR);

      const updateCall = prisma.user.update.mock.calls as {
        data: { totpSecret?: string };
      }[][];
      const encryptedSecret = (
        updateCall[0]?.[0] as { data: { totpSecret: string } }
      )?.data?.totpSecret;

      prisma.user.findFirst.mockResolvedValue({
        id: USER_ID,
        totpSecret: encryptedSecret,
        totpEnabled: false,
      });

      // Use obviously wrong code
      await expect(
        service.verifyAndEnable(TENANT, USER_ID, '000000', SELF_ACTOR),
      ).rejects.toThrow(UnauthorizedException);

      // Suppress unused variable warning
      expect(setup.secret).toBeTruthy();
    });

    it('throws BadRequestException when no secret configured', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: USER_ID,
        totpSecret: null,
        totpEnabled: false,
      });
      await expect(
        service.verifyAndEnable(TENANT, USER_ID, '123456', SELF_ACTOR),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getStatus ──────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('returns enabled=false configured=false for user with no 2FA', async () => {
      prisma.user.findFirst.mockResolvedValue({
        totpEnabled: false,
        totpSecret: null,
      });
      const status = await service.getStatus(TENANT, USER_ID);
      expect(status.enabled).toBe(false);
      expect(status.configured).toBe(false);
    });

    it('returns enabled=true when 2FA is active', async () => {
      prisma.user.findFirst.mockResolvedValue({
        totpEnabled: true,
        totpSecret: 'encrypted-secret',
      });
      const status = await service.getStatus(TENANT, USER_ID);
      expect(status.enabled).toBe(true);
      expect(status.configured).toBe(true);
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getStatus(TENANT, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── disable ────────────────────────────────────────────────────────────────

  describe('disable', () => {
    it('allows SUPER_ADMIN to disable without code', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: USER_ID,
        totpSecret: 'some-secret',
        totpEnabled: true,
      });
      await expect(
        service.disable(TENANT, USER_ID, undefined, ADMIN_ACTOR),
      ).resolves.toBeUndefined();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totpSecret: null, totpEnabled: false },
        }),
      );
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.disable(TENANT, USER_ID, undefined, ADMIN_ACTOR),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
