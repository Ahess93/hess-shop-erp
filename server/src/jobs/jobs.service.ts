import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';

export interface CreateJobDto {
  jobNumber: string;
  customerId: string;
  partName: string;
  partNumber?: string;
  quantity: number;
  dueDate: string;
  priority?: 'HIGH' | 'NORMAL';
  rfqNumber?: string;
  poNumber?: string;
  adminNotes?: string;
}

export interface UpdateJobDto {
  jobNumber?: string;
  customerId?: string;
  partName?: string;
  partNumber?: string;
  quantity?: number;
  dueDate?: string;
  department?: string;
  priority?: 'HIGH' | 'NORMAL';
  progressPct?: number;
  rfqNumber?: string;
  poNumber?: string;
  adminNotes?: string;
}

const JOB_SELECT = {
  id: true,
  tenantId: true,
  jobNumber: true,
  partName: true,
  partNumber: true,
  quantity: true,
  dueDate: true,
  createdDate: true,
  department: true,
  priority: true,
  progressPct: true,
  rfqNumber: true,
  poNumber: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: { id: true, businessName: true },
  },
};

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.job.findMany({
      where: { tenantId },
      select: JOB_SELECT,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, tenantId },
      select: JOB_SELECT,
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async create(tenantId: string, dto: CreateJobDto, actor: SessionUser) {
    // Check job number is unique within tenant
    const existing = await this.prisma.job.findUnique({
      where: { tenantId_jobNumber: { tenantId, jobNumber: dto.jobNumber } },
    });
    if (existing)
      throw new BadRequestException(
        `Job number "${dto.jobNumber}" already exists`,
      );

    const job = await this.prisma.job.create({
      data: {
        tenantId,
        jobNumber: dto.jobNumber,
        customerId: dto.customerId,
        partName: dto.partName,
        partNumber: dto.partNumber,
        quantity: dto.quantity,
        dueDate: new Date(dto.dueDate),
        priority: dto.priority ?? 'NORMAL',
        rfqNumber: dto.rfqNumber,
        poNumber: dto.poNumber,
        adminNotes: dto.adminNotes,
      },
      select: JOB_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'job:create',
      entityType: 'Job',
      entityId: job.id,
      newValue: { jobNumber: dto.jobNumber, partName: dto.partName },
    });

    return job;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateJobDto,
    actor: SessionUser,
  ) {
    const existing = await this.prisma.job.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Job not found');

    type JobPatch = {
      jobNumber?: string;
      customerId?: string;
      partName?: string;
      partNumber?: string | null;
      quantity?: number;
      dueDate?: Date;
      department?: string;
      priority?: string;
      progressPct?: number;
      rfqNumber?: string | null;
      poNumber?: string | null;
      adminNotes?: string | null;
    };

    const data: JobPatch = {};
    if (dto.jobNumber !== undefined) data.jobNumber = dto.jobNumber;
    if (dto.customerId !== undefined) data.customerId = dto.customerId;
    if (dto.partName !== undefined) data.partName = dto.partName;
    if (dto.partNumber !== undefined) data.partNumber = dto.partNumber;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.progressPct !== undefined) data.progressPct = dto.progressPct;
    if (dto.rfqNumber !== undefined) data.rfqNumber = dto.rfqNumber;
    if (dto.poNumber !== undefined) data.poNumber = dto.poNumber;
    if (dto.adminNotes !== undefined) data.adminNotes = dto.adminNotes;

    const updated = await this.prisma.job.update({
      where: { id },
      data: data as Prisma.JobUncheckedUpdateInput,
      select: JOB_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action:
        dto.department !== undefined ? 'job:move-department' : 'job:update',
      entityType: 'Job',
      entityId: id,
      oldValue: {
        department: existing.department,
        priority: existing.priority,
      } as Record<string, unknown>,
      newValue: dto as Record<string, unknown>,
    });

    return updated;
  }

  async remove(tenantId: string, id: string, actor: SessionUser) {
    const existing = await this.prisma.job.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Job not found');

    await this.prisma.job.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'job:delete',
      entityType: 'Job',
      entityId: id,
      oldValue: { jobNumber: existing.jobNumber } as Record<string, unknown>,
    });
  }
}
