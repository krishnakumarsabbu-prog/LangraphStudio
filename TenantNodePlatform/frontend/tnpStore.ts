import { create } from 'zustand';
import type { Tenant, Blueprint, BlueprintStatus } from './types';
import * as api from './tnpService';

interface TnpState {
  tenants: Tenant[];
  selectedTenantId: string | null;
  blueprints: Blueprint[];
  loading: boolean;
  error: string | null;

  loadTenants: () => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  loadBlueprints: () => Promise<void>;
  refreshBlueprints: () => Promise<void>;
  clearError: () => void;
}

export const useTnpStore = create<TnpState>((set, get) => ({
  tenants: [],
  selectedTenantId: null,
  blueprints: [],
  loading: false,
  error: null,

  loadTenants: async () => {
    set({ loading: true, error: null });
    try {
      const tenants = await api.listTenants();
      const selectedTenantId = get().selectedTenantId;
      const firstActive = tenants.find((t) => t.status === 'active');
      const newSelectedId =
        selectedTenantId && tenants.find((t) => t.tenant_id === selectedTenantId)
          ? selectedTenantId
          : firstActive?.tenant_id ?? tenants[0]?.tenant_id ?? null;
      set({ tenants, loading: false, selectedTenantId: newSelectedId });
      if (newSelectedId) {
        await get().loadBlueprints();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load tenants';
      set({ loading: false, error: msg });
    }
  },

  selectTenant: async (tenantId: string) => {
    set({ selectedTenantId: tenantId, error: null });
    await get().loadBlueprints();
  },

  loadBlueprints: async () => {
    const tenantId = get().selectedTenantId;
    if (!tenantId) return;
    set({ loading: true, error: null });
    try {
      const blueprints = await api.listBlueprints(tenantId);
      set({ blueprints, loading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load blueprints';
      set({ loading: false, error: msg });
    }
  },

  refreshBlueprints: async () => {
    await get().loadBlueprints();
  },

  clearError: () => set({ error: null }),
}));

export type { Tenant, Blueprint, BlueprintStatus };
