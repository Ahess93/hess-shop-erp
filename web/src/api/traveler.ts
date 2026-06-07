import { api } from './client';

export interface TravelerTool {
  id: string;
  description: string;
  position: number;
}

export interface Traveler {
  id: string;
  tenantId: string;
  jobId: string;
  runTimePerPiece: string | null;
  laborTime: string | null;
  shippedDate: string | null;
  partsScrapped: number;
  shippingMethod: string | null;
  jobCost: string | null;
  quotedMaterialCostPerPart: string | null;
  actualMaterialCostPerPart: string | null;
  materialCertRequired: boolean;
  shopLocation: string | null;
  operatorNotes: string | null;
  createdAt: string;
  updatedAt: string;
  tools: TravelerTool[];
}

export interface UpdateTravelerDto {
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

export const travelerApi = {
  get: (jobId: string) => api.get<Traveler>(`/jobs/${jobId}/traveler`),
  update: (jobId: string, dto: UpdateTravelerDto) =>
    api.patch<Traveler>(`/jobs/${jobId}/traveler`, dto),
  addTool: (jobId: string, description: string) =>
    api.post<TravelerTool>(`/jobs/${jobId}/traveler/tools`, { description }),
  removeTool: (jobId: string, toolId: string) =>
    api.delete(`/jobs/${jobId}/traveler/tools/${toolId}`),
};
