import { api } from './client';

export interface SetupStatus {
  needsSetup: boolean;
  tenantId?: string;
}

export interface SetupDto {
  orgName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export const setupApi = {
  status: () => api.get<SetupStatus>('/setup/status'),
  complete: (dto: SetupDto) => api.post<{ tenantId: string }>('/setup/complete', dto),
};
