import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService } from '../permissions/permissions.service';
import {
  QuotesService,
  CreateQuoteDto,
  UpdateQuoteDto,
} from './quotes.service';
import { QuotePdfService } from './pdf/quote-pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from '../auth/auth.service';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'quotes');

@Controller('quotes')
@UseGuards(AuthGuard)
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdfService: QuotePdfService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  list(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'quote:read');
    return this.quotes.list(user.tenantId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'quote:read');
    return this.quotes.findOne(user.tenantId, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateQuoteDto) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'quote:create');
    return this.quotes.create(user.tenantId, body, user);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateQuoteDto,
  ) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'quote:update');
    return this.quotes.update(user.tenantId, id, body, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'quote:delete');
    await this.quotes.remove(user.tenantId, id, user);
  }

  /** Generate (or regenerate) and download the PDF for a quote */
  @Get(':id/pdf')
  async getPdf(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'quote:read');

    const quote = await this.quotes.findOne(user.tenantId, id);

    // Look up org name for the PDF header
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true },
    });

    const pdfPath = await this.pdfService.generate(
      {
        id: quote.id,
        customer: {
          businessName: quote.customer.businessName,
          email: quote.customer.email ?? null,
        },
        job: quote.job
          ? {
              jobNumber: quote.job.jobNumber,
              partName: quote.job.partName,
              quantity: quote.job.quantity,
            }
          : null,
        laborRate: String(quote.laborRate),
        estRunTime: String(quote.estRunTime),
        materialCost: String(quote.materialCost),
        markupPct: String(quote.markupPct),
        calculatedPrice: String(quote.calculatedPrice),
        status: quote.status,
        createdAt: quote.createdAt,
        orgName: tenant?.name ?? 'Shop ERP',
      },
      UPLOADS_DIR,
    );

    // Persist the path back to the DB
    await this.quotes.savePdfPath(quote.id, pdfPath);

    const fileName = `quote-${quote.id.slice(-8).toUpperCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);
  }
}
