import { api } from './client';

export interface RevenueByCustomer {
  customerId: string;
  businessName: string;
  email: string | null;
  totalInvoiced: number;
  totalPaid: number;
  invoiceCount: number;
}

export interface JobProfitability {
  jobId: string;
  jobNumber: string;
  partName: string;
  quantity: number;
  customer: string;
  quotedPrice: number | null;
  actualTotal: number | null;
  margin: number | null;
  marginPct: number | null;
  partsScrapped: number;
}

export interface OnTimeDelivery {
  totalJobs: number;
  shippedJobs: number;
  onTimeJobs: number;
  onTimePct: number | null;
}

export const reportsApi = {
  revenueByCustomer: () => api.get<RevenueByCustomer[]>('/reports/revenue-by-customer'),
  jobProfitability: () => api.get<JobProfitability[]>('/reports/job-profitability'),
  onTimeDelivery: () => api.get<OnTimeDelivery>('/reports/on-time-delivery'),
};
