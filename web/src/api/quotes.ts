import { api } from './client';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';

export interface Quote {
  id: string;
  tenantId: string;
  customerId: string;
  jobId: string | null;
  laborRate: string;
  estRunTime: string;
  materialCost: string;
  markupPct: string;
  calculatedPrice: string;
  status: QuoteStatus;
  pdfPath: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; businessName: string; email: string | null };
  job: { id: string; jobNumber: string; partName: string; quantity: number } | null;
}

export interface CreateQuoteDto {
  customerId: string;
  jobId?: string;
  laborRate: number;
  estRunTime: number;
  materialCost: number;
  markupPct: number;
}

export interface UpdateQuoteDto {
  customerId?: string;
  jobId?: string;
  laborRate?: number;
  estRunTime?: number;
  materialCost?: number;
  markupPct?: number;
  status?: QuoteStatus;
}

export const quotesApi = {
  list: () => api.get<Quote[]>('/quotes'),
  get: (id: string) => api.get<Quote>(`/quotes/${id}`),
  create: (dto: CreateQuoteDto) => api.post<Quote>('/quotes', dto),
  update: (id: string, dto: UpdateQuoteDto) => api.patch<Quote>(`/quotes/${id}`, dto),
  remove: (id: string) => api.delete<void>(`/quotes/${id}`),
  pdfUrl: (id: string) => `/api/quotes/${id}/pdf`,
};

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
};

export const STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ['SENT', 'ACCEPTED', 'REJECTED'],
  SENT: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['REJECTED'],
  REJECTED: [],
};
