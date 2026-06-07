import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import type { FileKind } from './files.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';

const VALID_KINDS = new Set(['BLUEPRINT', 'SETUP_PHOTO', 'JOB_PHOTO']);

const storage = diskStorage({
  destination: path.resolve('uploads'),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

@Controller('jobs/:jobId/files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async list(@Req() req: Request, @Param('jobId') jobId: string) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'file:read');
    return this.filesService.listForJob(user.tenantId, jobId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage }))
  async upload(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Query('kind') kind: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'file:upload');

    if (!file) throw new BadRequestException('No file provided');
    if (!VALID_KINDS.has(kind)) {
      throw new BadRequestException(
        `kind must be one of: ${[...VALID_KINDS].join(', ')}`,
      );
    }

    return this.filesService.save(
      user.tenantId,
      jobId,
      file,
      kind as FileKind,
      user,
    );
  }

  @Get(':fileId/download')
  async download(
    @Req() req: Request,
    @Res() res: Response,
    @Param('jobId') jobId: string,
    @Param('fileId') fileId: string,
  ) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'file:read');

    // Verify file belongs to this job
    void jobId;

    const { filePath, fileName, mimeType } =
      await this.filesService.getFilePath(user.tenantId, fileId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('fileId') fileId: string) {
    const user = req.session['user']!;
    this.permissions.assert(user.role, 'file:delete');
    await this.filesService.remove(user.tenantId, fileId, user);
  }
}
