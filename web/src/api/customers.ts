import { api } from './client';

export interface Customer {
  id: string;
  businessName: string;
  email: string | null;
  phone: string | null;
}

export const customersApi = {
  list: () => api.get<Customer[]>('/customers'),
};
