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
  InvoicesService,
  CreateInvoiceDto,
  UpdateInvoiceDto,
} from './invoices.service';
import { InvoicePdfService } from './pdf/invoice-pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from '../auth/auth.service';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'invoices');

@Controller('invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly pdfService: InvoicePdfService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  list(@Req() req: Request) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'invoice:read');
    return this.invoices.list(user.tenantId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'invoice:read');
    return this.invoices.findOne(user.tenantId, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateInvoiceDto) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'invoice:create');
    return this.invoices.create(user.tenantId, body, user);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateInvoiceDto,
  ) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'invoice:update');
    return this.invoices.update(user.tenantId, id, body, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'invoice:delete');
    await this.invoices.remove(user.tenantId, id, user);
  }

  @Get(':id/pdf')
  async getPdf(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const user = req.session['user'] as SessionUser;
    this.permissions.assert(user.role, 'invoice:read');

    const invoice = await this.invoices.findOne(user.tenantId, id);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true },
    });

    const pdfPath = await this.pdfService.generate(
      {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customer: {
          businessName: invoice.customer.businessName,
          email: invoice.customer.email ?? null,
          phone: invoice.customer.phone ?? null,
        },
        job: invoice.job
          ? { jobNumber: invoice.job.jobNumber, partName: invoice.job.partName }
          : null,
        lineItems: invoice.lineItems as unknown as {
          description: string;
          quantity: number;
          unitPrice: number;
        }[],
        subtotal: String(invoice.subtotal),
        tax: String(invoice.tax),
        total: String(invoice.total),
        status: invoice.status,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        orgName: tenant?.name ?? 'Shop ERP',
      },
      UPLOADS_DIR,
    );

    await this.invoices.savePdfPath(invoice.id, pdfPath);

    const fileName = `${invoice.invoiceNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(pdfPath).pipe(res);
  }
}
