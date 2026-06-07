import { api } from './client';

export type Department =
  | 'QUOTING'
  | 'QUOTE_ACCEPTED'
  | 'ORDER_STOCK'
  | 'STOCK_RECEIVED'
  | 'ON_DECK'
  | 'ON_MACHINE'
  | 'FINISHING'
  | 'QUALITY_CONTROL'
  | 'SHIPPING'
  | 'SHIPPED';

export type Priority = 'HIGH' | 'NORMAL';

export interface Job {
  id: string;
  tenantId: string;
  jobNumber: string;
  partName: string;
  partNumber: string | null;
  quantity: number;
  dueDate: string;
  createdDate: string;
  department: Department;
  priority: Priority;
  progressPct: number;
  rfqNumber: string | null;
  poNumber: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; businessName: string };
}

export interface CreateJobDto {
  jobNumber: string;
  customerId: string;
  partName: string;
  partNumber?: string;
  quantity: number;
  dueDate: string;
  priority?: Priority;
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
  department?: Department;
  priority?: Priority;
  progressPct?: number;
  rfqNumber?: string;
  poNumber?: string;
  adminNotes?: string;
}

export const DEPARTMENT_LABELS: Record<Department, string> = {
  QUOTING: 'Quoting',
  QUOTE_ACCEPTED: 'Quote Accepted',
  ORDER_STOCK: 'Order Stock',
  STOCK_RECEIVED: 'Stock Received',
  ON_DECK: 'On Deck',
  ON_MACHINE: 'On Machine',
  FINISHING: 'Finishing',
  QUALITY_CONTROL: 'QC',
  SHIPPING: 'Shipping',
  SHIPPED: 'Shipped',
};

export const DEPARTMENTS: Department[] = [
  'QUOTING',
  'QUOTE_ACCEPTED',
  'ORDER_STOCK',
  'STOCK_RECEIVED',
  'ON_DECK',
  'ON_MACHINE',
  'FINISHING',
  'QUALITY_CONTROL',
  'SHIPPING',
  'SHIPPED',
];

export const jobsApi = {
  list: () => api.get<Job[]>('/jobs'),
  get: (id: string) => api.get<Job>(`/jobs/${id}`),
  create: (dto: CreateJobDto) => api.post<Job>('/jobs', dto),
  update: (id: string, dto: UpdateJobDto) => api.patch<Job>(`/jobs/${id}`, dto),
  move: (id: string, department: Department) => api.patch<Job>(`/jobs/${id}`, { department }),
  remove: (id: string) => api.delete(`/jobs/${id}`),
};
