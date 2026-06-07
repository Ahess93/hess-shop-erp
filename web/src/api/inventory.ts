import { api } from './client';

export interface InventoryItem {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  category: string | null;
  quantity: string;
  unit: string;
  reorderPoint: string;
  unitCost: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  itemId: string;
  delta: string;
  reason: string;
  userId: string;
  createdAt: string;
}

export interface CreateItemDto {
  sku: string;
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  reorderPoint?: number;
  unitCost?: number;
}

export interface UpdateItemDto {
  name?: string;
  category?: string;
  unit?: string;
  reorderPoint?: number;
  unitCost?: number;
}

export interface AdjustStockDto {
  delta: number;
  reason: string;
}

export const inventoryApi = {
  list: () => api.get<InventoryItem[]>('/inventory'),
  get: (id: string) => api.get<InventoryItem>(`/inventory/${id}`),
  lowStock: () => api.get<InventoryItem[]>('/inventory/low-stock'),
  movements: (id: string) => api.get<StockMovement[]>(`/inventory/${id}/movements`),
  create: (dto: CreateItemDto) => api.post<InventoryItem>('/inventory', dto),
  update: (id: string, dto: UpdateItemDto) => api.patch<InventoryItem>(`/inventory/${id}`, dto),
  adjust: (id: string, dto: AdjustStockDto) =>
    api.post<InventoryItem>(`/inventory/${id}/adjust`, dto),
  remove: (id: string) => api.delete<void>(`/inventory/${id}`),
};
