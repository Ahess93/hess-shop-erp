import { api } from './client';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  customerId: string;
  jobId: string | null;
  invoiceNumber: string;
  lineItems: LineItem[];
  subtotal: string;
  tax: string;
  total: string;
  status: InvoiceStatus;
  pdfPath: string | null;
  dueDate: string | null;
  paidDate: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; businessName: string; email: string | null; phone: string | null };
  job: { id: string; jobNumber: string; partName: string; quantity: number } | null;
}

export interface CreateInvoiceDto {
  customerId: string;
  jobId?: string;
  lineItems: LineItem[];
  taxRate?: number;
  dueDate?: string;
}

export interface UpdateInvoiceDto {
  customerId?: string;
  jobId?: string;
  lineItems?: LineItem[];
  taxRate?: number;
  dueDate?: string;
  status?: InvoiceStatus;
}

export const invoicesApi = {
  list: () => api.get<Invoice[]>('/invoices'),
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  create: (dto: CreateInvoiceDto) => api.post<Invoice>('/invoices', dto),
  update: (id: string, dto: UpdateInvoiceDto) => api.patch<Invoice>(`/invoices/${id}`, dto),
  remove: (id: string) => api.delete<void>(`/invoices/${id}`),
  pdfUrl: (id: string) => `/api/invoices/${id}/pdf`,
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};

export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['SENT'],
  SENT: ['PAID', 'OVERDUE'],
  PAID: [],
  OVERDUE: ['PAID'],
};
