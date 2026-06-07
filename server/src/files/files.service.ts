import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';

export type FileKind = 'BLUEPRINT' | 'SETUP_PHOTO' | 'JOB_PHOTO';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForJob(tenantId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found');

    return this.prisma.fileAttachment.findMany({
      where: { jobId, tenantId },
      select: {
        id: true,
        fileName: true,
        kind: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async save(
    tenantId: string,
    jobId: string,
    file: Express.Multer.File,
    kind: FileKind,
    actor: SessionUser,
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found');

    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'File type not allowed. Upload JPEG, PNG, WebP, or PDF.',
      );
    }

    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File too large. Maximum size is 25 MB.');
    }

    const attachment = await this.prisma.fileAttachment.create({
      data: {
        tenantId,
        jobId,
        kind,
        fileName: file.originalname,
        storagePath: file.path,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: actor.id,
      },
      select: {
        id: true,
        fileName: true,
        kind: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedByUser: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'file:upload',
      entityType: 'FileAttachment',
      entityId: attachment.id,
      newValue: { fileName: file.originalname, kind, sizeBytes: file.size },
    });

    return attachment;
  }

  async getFilePath(
    tenantId: string,
    fileId: string,
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const attachment = await this.prisma.fileAttachment.findFirst({
      where: { id: fileId, tenantId },
    });
    if (!attachment) throw new NotFoundException('File not found');

    const resolved = path.resolve(attachment.storagePath);
    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('File not found on disk');
    }

    return {
      filePath: resolved,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  async remove(tenantId: string, fileId: string, actor: SessionUser) {
    const attachment = await this.prisma.fileAttachment.findFirst({
      where: { id: fileId, tenantId },
    });
    if (!attachment) throw new NotFoundException('File not found');

    // Delete from disk
    if (fs.existsSync(attachment.storagePath)) {
      fs.unlinkSync(attachment.storagePath);
    }

    await this.prisma.fileAttachment.delete({ where: { id: fileId } });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'file:delete',
      entityType: 'FileAttachment',
      entityId: fileId,
      oldValue: { fileName: attachment.fileName },
    });
  }
}
