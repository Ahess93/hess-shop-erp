import { api } from './client';

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password?: string;
  pin?: string;
  role: 'ADMIN' | 'OPERATOR';
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  pin?: string;
  role?: 'ADMIN' | 'OPERATOR';
  active?: boolean;
}

export const usersApi = {
  list: () => api.get<User[]>('/users'),
  create: (dto: CreateUserDto) => api.post<User>('/users', dto),
  update: (id: string, dto: UpdateUserDto) => api.patch<User>(`/users/${id}`, dto),
  deactivate: (id: string) => api.patch<User>(`/users/${id}`, { active: false }),
  reactivate: (id: string) => api.patch<User>(`/users/${id}`, { active: true }),
};
