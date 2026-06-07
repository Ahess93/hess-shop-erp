import { create } from 'zustand';
import type { SessionUser } from '../api/auth';

interface AuthState {
  user: SessionUser | null;
  tenantId: string | null;
  setUser: (user: SessionUser | null) => void;
  setTenantId: (id: string) => void;
  clear: () => void;
}

// We need zustand — install it
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenantId: localStorage.getItem('tenantId'),
  setUser: (user) => set({ user }),
  setTenantId: (tenantId) => {
    localStorage.setItem('tenantId', tenantId);
    set({ tenantId });
  },
  clear: () => {
    localStorage.removeItem('tenantId');
    set({ user: null, tenantId: null });
  },
}));
