import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BackupService } from './backup.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';
import { Role } from '../permissions/permissions.types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT = 'tenant-1';
const ACTOR: SessionUser = {
  id: 'user-1',
  tenantId: TENANT,
  role: Role.SUPER_ADMIN,
  email: 'admin@example.com',
};

// ─── Mocks ──────────────────────────────────────────────────────────────────

// archiver 8.x is ESM-only — mock it so Jest (CommonJS) can load the service
jest.mock('archiver', () => {
  const mockArchive = {
    on: jest.fn(),
    pipe: jest.fn(),
    file: jest.fn(),
    directory: jest.fn(),
    finalize: jest.fn().mockResolvedValue(undefined),
  };
  return jest.fn(() => mockArchive);
});

jest.mock('child_process', () => ({
  exec: jest.fn(
    (
      _cmd: string,
      _opts: unknown,
      cb: (err: null, result: { stdout: string; stderr: string }) => void,
    ) => {
      cb(null, { stdout: '', stderr: '' });
    },
  ),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BackupService', () => {
  let service: BackupService;
  let prisma: {
    systemSetting: Record<string, jest.Mock>;
  };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      systemSetting: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
  });

  // ─── getConfig ─────────────────────────────────────────────────────────────

  describe('getConfig', () => {
    it('returns defaults when no config stored', async () => {
      const cfg = await service.getConfig(TENANT);
      expect(cfg.autoBackup).toBe(true);
      expect(cfg.retainCount).toBe(10);
      expect(cfg.backupPath).toContain('backups');
    });

    it('returns stored config when present', async () => {
      const stored = {
        backupPath: 'C:\\Backups',
        autoBackup: false,
        retainCount: 5,
      };
      prisma.systemSetting.findFirst.mockResolvedValue({
        tenantId: TENANT,
        key: 'backup',
        value: stored,
      });
      const cfg = await service.getConfig(TENANT);
      expect(cfg.backupPath).toBe('C:\\Backups');
      expect(cfg.autoBackup).toBe(false);
      expect(cfg.retainCount).toBe(5);
    });
  });

  // ─── saveConfig ────────────────────────────────────────────────────────────

  describe('saveConfig', () => {
    it('merges partial config with defaults and upserts', async () => {
      const result = await service.saveConfig(
        TENANT,
        { autoBackup: false },
        ACTOR,
      );
      expect(result.autoBackup).toBe(false);
      expect(result.retainCount).toBe(10); // default preserved
      expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(1);
    });

    it('logs the change to audit', async () => {
      await service.saveConfig(TENANT, { retainCount: 7 }, ACTOR);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          entityType: 'SystemSetting',
        }),
      );
    });
  });

  // ─── listBackups ───────────────────────────────────────────────────────────

  describe('listBackups', () => {
    it('returns empty array when backup directory does not exist', async () => {
      const list = await service.listBackups(TENANT);
      expect(list).toEqual([]);
    });

    it('lists zip files sorted newest-first', async () => {
      // Create a temporary directory with fake backup zips
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hess-test-'));
      const files = [
        'hess-erp-backup-2025-01-01_12-00-00.zip',
        'hess-erp-backup-2025-01-03_12-00-00.zip',
        'hess-erp-backup-2025-01-02_12-00-00.zip',
      ];
      for (const f of files) {
        fs.writeFileSync(path.join(tmpDir, f), 'fake');
      }

      prisma.systemSetting.findFirst.mockResolvedValue({
        tenantId: TENANT,
        key: 'backup',
        value: { backupPath: tmpDir, autoBackup: true, retainCount: 10 },
      });

      const list = await service.listBackups(TENANT);
      expect(list).toHaveLength(3);
      // Newest first
      expect(list[0].filename).toBe('hess-erp-backup-2025-01-03_12-00-00.zip');

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  // ─── verifyBackup ──────────────────────────────────────────────────────────

  describe('verifyBackup', () => {
    it('throws NotFoundException for missing file', async () => {
      await expect(
        service.verifyBackup(TENANT, 'hess-erp-backup-nonexistent.zip'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns valid=true for an existing backup file', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hess-test-'));
      const filename = 'hess-erp-backup-2025-01-01_12-00-00.zip';
      fs.writeFileSync(path.join(tmpDir, filename), 'fake zip content');

      prisma.systemSetting.findFirst.mockResolvedValue({
        tenantId: TENANT,
        key: 'backup',
        value: { backupPath: tmpDir, autoBackup: true, retainCount: 10 },
      });

      const result = await service.verifyBackup(TENANT, filename);
      expect(result.valid).toBe(true);
      expect(result.sizeBytes).toBeGreaterThan(0);

      fs.rmSync(tmpDir, { recursive: true });
    });

    it('throws BadRequestException for path traversal attempt', async () => {
      await expect(
        service.verifyBackup(TENANT, '../../../etc/passwd'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
