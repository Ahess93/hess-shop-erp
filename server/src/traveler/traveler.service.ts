import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/auth.service';
import { Role } from '../permissions/permissions.types';

export interface UpsertTravelerDto {
  runTimePerPiece?: number;
  laborTime?: number;
  shippedDate?: string;
  partsScrapped?: number;
  shippingMethod?: string;
  jobCost?: number;
  quotedMaterialCostPerPart?: number;
  actualMaterialCostPerPart?: number;
  materialCertRequired?: boolean;
  shopLocation?: string;
  operatorNotes?: string;
}

export interface AddToolDto {
  description: string;
  position?: number;
}

const TRAVELER_SELECT = {
  id: true,
  tenantId: true,
  jobId: true,
  runTimePerPiece: true,
  laborTime: true,
  shippedDate: true,
  partsScrapped: true,
  shippingMethod: true,
  jobCost: true,
  quotedMaterialCostPerPart: true,
  actualMaterialCostPerPart: true,
  materialCertRequired: true,
  shopLocation: true,
  operatorNotes: true,
  createdAt: true,
  updatedAt: true,
  tools: {
    select: { id: true, description: true, position: true },
    orderBy: { position: 'asc' as const },
  },
};

@Injectable()
export class TravelerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Get (or create) the traveler for a job */
  async getOrCreate(tenantId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found');

    const existing = await this.prisma.traveler.findUnique({
      where: { jobId },
      select: TRAVELER_SELECT,
    });
    if (existing) return existing;

    return this.prisma.traveler.create({
      data: { tenantId, jobId },
      select: TRAVELER_SELECT,
    });
  }

  async update(
    tenantId: string,
    jobId: string,
    dto: UpsertTravelerDto,
    actor: SessionUser,
  ) {
    const traveler = await this.prisma.traveler.findFirst({
      where: { jobId, tenantId },
    });
    if (!traveler) throw new NotFoundException('Traveler not found');

    // Operators can only update operatorNotes
    if (actor.role === Role.OPERATOR) {
      const allowedKeys = new Set(['operatorNotes']);
      const forbidden = Object.keys(dto).filter(
        (k) =>
          !allowedKeys.has(k) &&
          dto[k as keyof UpsertTravelerDto] !== undefined,
      );
      if (forbidden.length > 0) {
        throw new ForbiddenException(
          'Operators may only update operator notes',
        );
      }
    }

    type TravelerPatch = {
      runTimePerPiece?: number | null;
      laborTime?: number | null;
      shippedDate?: Date | null;
      partsScrapped?: number;
      shippingMethod?: string | null;
      jobCost?: number | null;
      quotedMaterialCostPerPart?: number | null;
      actualMaterialCostPerPart?: number | null;
      materialCertRequired?: boolean;
      shopLocation?: string | null;
      operatorNotes?: string | null;
    };

    const data: TravelerPatch = {};
    if (dto.runTimePerPiece !== undefined)
      data.runTimePerPiece = dto.runTimePerPiece;
    if (dto.laborTime !== undefined) data.laborTime = dto.laborTime;
    if (dto.shippedDate !== undefined)
      data.shippedDate = dto.shippedDate ? new Date(dto.shippedDate) : null;
    if (dto.partsScrapped !== undefined) data.partsScrapped = dto.partsScrapped;
    if (dto.shippingMethod !== undefined)
      data.shippingMethod = dto.shippingMethod;
    if (dto.jobCost !== undefined) data.jobCost = dto.jobCost;
    if (dto.quotedMaterialCostPerPart !== undefined)
      data.quotedMaterialCostPerPart = dto.quotedMaterialCostPerPart;
    if (dto.actualMaterialCostPerPart !== undefined)
      data.actualMaterialCostPerPart = dto.actualMaterialCostPerPart;
    if (dto.materialCertRequired !== undefined)
      data.materialCertRequired = dto.materialCertRequired;
    if (dto.shopLocation !== undefined) data.shopLocation = dto.shopLocation;
    if (dto.operatorNotes !== undefined) data.operatorNotes = dto.operatorNotes;

    const updated = await this.prisma.traveler.update({
      where: { jobId },
      data,
      select: TRAVELER_SELECT,
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action:
        actor.role === Role.OPERATOR
          ? 'traveler:update-operator-notes'
          : 'traveler:update-all',
      entityType: 'Traveler',
      entityId: traveler.id,
      newValue: dto as Record<string, unknown>,
    });

    return updated;
  }

  async addTool(
    tenantId: string,
    jobId: string,
    dto: AddToolDto,
    actor: SessionUser,
  ) {
    const traveler = await this.prisma.traveler.findFirst({
      where: { jobId, tenantId },
      include: { tools: true },
    });
    if (!traveler) throw new NotFoundException('Traveler not found');

    const nextPosition = dto.position ?? traveler.tools.length + 1;

    const tool = await this.prisma.travelerTool.create({
      data: {
        tenantId,
        travelerId: traveler.id,
        description: dto.description,
        position: nextPosition,
      },
      select: { id: true, description: true, position: true },
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'traveler:update-all',
      entityType: 'TravelerTool',
      entityId: tool.id,
      newValue: { description: dto.description, position: nextPosition },
    });

    return tool;
  }

  async removeTool(tenantId: string, toolId: string, actor: SessionUser) {
    const tool = await this.prisma.travelerTool.findFirst({
      where: { id: toolId, tenantId },
    });
    if (!tool) throw new NotFoundException('Tool not found');

    await this.prisma.travelerTool.delete({ where: { id: toolId } });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'traveler:update-all',
      entityType: 'TravelerTool',
      entityId: toolId,
      oldValue: { description: tool.description } as Record<string, unknown>,
    });
  }
}
