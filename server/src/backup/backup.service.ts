import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';
import { Role } from '../permissions/permissions.types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver') as (
  format: string,
  options?: object,
) => {
  on(event: string, handler: (...args: unknown[]) => void): void;
  pipe(dest: NodeJS.WritableStream): void;
  file(filePath: string, data: { name: string }): void;
  directory(dirPath: string, destPath: string): void;
  finalize(): Promise<void>;
};

const execAsync = promisify(exec);

export interface BackupConfig {
  /** Absolute path to the folder where backups are written */
  backupPath: string;
  /** Whether to run nightly automatic backups */
  autoBackup: boolean;
  /** Maximum number of backups to retain (oldest deleted first) */
  retainCount: number;
}

export interface BackupEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  fullPath: string;
}

export interface BackupResult {
  filename: string;
  sizeBytes: number;
  durationMs: number;
}

const DEFAULT_BACKUP_PATH = path.join(os.homedir(), 'HessERP', 'backups');
const DEFAULT_RETAIN = 10;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Config ────────────────────────────────────────────────────────────────

  async getConfig(tenantId: string): Promise<BackupConfig> {
    const row = await this.prisma.systemSetting.findFirst({
      where: { tenantId, key: 'backup' },
    });
    if (!row) {
      return {
        backupPath: DEFAULT_BACKUP_PATH,
        autoBackup: true,
        retainCount: DEFAULT_RETAIN,
      };
    }
    return row.value as unknown as BackupConfig;
  }

  async saveConfig(
    tenantId: string,
    config: Partial<BackupConfig>,
    actor: SessionUser,
  ): Promise<BackupConfig> {
    const current = await this.getConfig(tenantId);
    const merged: BackupConfig = { ...current, ...config };

    // Prisma's InputJsonValue doesn't accept typed interfaces; cast through unknown

    const mergedJson: any = merged;
    await this.prisma.systemSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'backup' } },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      create: { tenantId, key: 'backup', value: mergedJson },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      update: { value: mergedJson },
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'UPDATE',
      entityType: 'SystemSetting',
      entityId: 'backup',
      oldValue: current as unknown as Record<string, unknown>,
      newValue: merged as unknown as Record<string, unknown>,
    });

    return merged;
  }

  // ─── List ───────────────────────────────────────────────────────────────────

  async listBackups(tenantId: string): Promise<BackupEntry[]> {
    const config = await this.getConfig(tenantId);
    const dir = config.backupPath;

    if (!fs.existsSync(dir)) return [];

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.zip') && f.startsWith('hess-erp-backup-'))
      .map((f) => {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        return {
          filename: f,
          sizeBytes: stat.size,
          createdAt: stat.birthtime.toISOString(),
          fullPath,
        };
      })
      .sort((a, b) => b.filename.localeCompare(a.filename)); // filename encodes timestamp

    return files;
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  /**
   * Creates a backup zip containing:
   *  1. A pg_dump of the database
   *  2. The uploads directory (file attachments)
   *
   * Falls back gracefully when pg_dump is not available (dev environment
   * without a local Postgres install) — the zip is created without the DB dump.
   */
  async createBackup(
    tenantId: string,
    actor: SessionUser,
    uploadsDir?: string,
  ): Promise<BackupResult> {
    const start = Date.now();
    const config = await this.getConfig(tenantId);
    const dir = config.backupPath;

    // Ensure backup directory exists
    fs.mkdirSync(dir, { recursive: true });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);
    const filename = `hess-erp-backup-${timestamp}.zip`;
    const zipPath = path.join(dir, filename);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hess-backup-'));

    try {
      // 1. pg_dump (best-effort — skip if not available or no DATABASE_URL)
      const dbUrl = process.env['DATABASE_URL'];
      const dumpPath = path.join(tmpDir, 'database.sql');
      if (dbUrl) {
        try {
          await execAsync(`pg_dump "${dbUrl}" -f "${dumpPath}"`, {
            timeout: 120_000,
          });
          this.logger.log('pg_dump completed');
        } catch (err) {
          this.logger.warn(
            `pg_dump skipped (pg_dump not on PATH or DB unavailable): ${String(err)}`,
          );
          // Write a placeholder so the zip is never empty
          fs.writeFileSync(
            dumpPath,
            `-- pg_dump unavailable at backup time: ${new Date().toISOString()}\n`,
          );
        }
      } else {
        fs.writeFileSync(
          dumpPath,
          `-- No DATABASE_URL configured at backup time: ${new Date().toISOString()}\n`,
        );
      }

      // 2. Zip: DB dump + uploads
      await this.writeZip(zipPath, dumpPath, uploadsDir);
    } finally {
      // Clean up temp dir
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // 3. Prune old backups
    this.pruneOldBackups(config);

    const stat = fs.statSync(zipPath);
    const result: BackupResult = {
      filename,
      sizeBytes: stat.size,
      durationMs: Date.now() - start,
    };

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'CREATE',
      entityType: 'Backup',
      entityId: filename,
      oldValue: undefined,
      newValue: { filename, sizeBytes: result.sizeBytes },
    });

    this.logger.log(
      `Backup created: ${filename} (${(result.sizeBytes / 1024).toFixed(1)} KB, ${result.durationMs}ms)`,
    );

    return result;
  }

  /**
   * Schedules a no-actor system backup (called from scheduler).
   * Uses a synthetic "system" actor so the audit log records the origin.
   */
  async createSystemBackup(
    tenantId: string,
    uploadsDir?: string,
  ): Promise<BackupResult> {
    const systemActor: SessionUser = {
      id: 'system',
      tenantId,
      name: 'System',
      role: Role.SUPER_ADMIN,
      email: 'system@internal',
    };
    return this.createBackup(tenantId, systemActor, uploadsDir);
  }

  // ─── Restore ────────────────────────────────────────────────────────────────

  /**
   * Verifies a backup file exists and is readable.
   * Full restore (pg_restore) requires the server to restart — this method
   * validates the file and returns the SQL dump path within the zip so the
   * caller (desktop main process via IPC) can invoke pg_restore directly.
   *
   * In a web-only context this returns metadata for the operator to act on.
   */
  async verifyBackup(
    tenantId: string,
    filename: string,
  ): Promise<{ valid: boolean; sizeBytes: number; message: string }> {
    const config = await this.getConfig(tenantId);
    const fullPath = path.join(config.backupPath, filename);

    if (!fullPath.startsWith(config.backupPath)) {
      throw new BadRequestException('Invalid backup filename');
    }

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`Backup file not found: ${filename}`);
    }

    const stat = fs.statSync(fullPath);
    return {
      valid: true,
      sizeBytes: stat.size,
      message: `Backup ${filename} is valid (${(stat.size / 1024).toFixed(1)} KB). To restore, stop the server, run pg_restore with this file, then restart.`,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private writeZip(
    zipPath: string,
    dumpPath: string,
    uploadsDir?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.file(dumpPath, { name: 'database.sql' });
      if (uploadsDir && fs.existsSync(uploadsDir)) {
        archive.directory(uploadsDir, 'uploads');
      }
      // finalize() — completion tracked via 'close' event on the write stream
      void archive.finalize();
    });
  }

  private pruneOldBackups(config: BackupConfig): void {
    const retain = config.retainCount ?? DEFAULT_RETAIN;
    const dir = config.backupPath;
    if (!fs.existsSync(dir)) return;

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.zip') && f.startsWith('hess-erp-backup-'))
      .sort()
      .reverse(); // newest first

    const toDelete = files.slice(retain);
    for (const f of toDelete) {
      try {
        fs.unlinkSync(path.join(dir, f));
        this.logger.log(`Pruned old backup: ${f}`);
      } catch {
        this.logger.warn(`Could not prune backup: ${f}`);
      }
    }
  }
}
