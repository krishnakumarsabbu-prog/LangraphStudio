import { create } from 'zustand';
import type { Tenant, TenantCreate, TenantUpdate, Blueprint, BlueprintStatus, UserProfile, UserCreate, UserUpdate } from './types';
import * as api from './tnpService';
import { useAuthStore } from './authStore';

interface TnpState {
  tenants: Tenant[];
  selectedTenantId: string | null;
  blueprints: Blueprint[];
  users: UserProfile[];
  loading: boolean;
  error: string | null;

  loadTenants: () => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  loadBlueprints: () => Promise<void>;
  refreshBlueprints: () => Promise<void>;
  deleteBlueprint: (blueprintId: string) => Promise<void>;
  createTenant: (data: TenantCreate) => Promise<Tenant>;
  updateTenant: (tenantId: string, data: TenantUpdate) => Promise<Tenant>;
  deleteTenant: (tenantId: string) => Promise<void>;
  loadUsers: (tenantId?: string) => Promise<UserProfile[]>;
  createUser: (data: UserCreate) => Promise<UserProfile>;
  updateUser: (userId: string, data: UserUpdate) => Promise<UserProfile>;
  deleteUser: (userId: string) => Promise<void>;
  clearError: () => void;
}

export const useTnpStore = create<TnpState>((set, get) => ({
  tenants: [],
  selectedTenantId: null,
  blueprints: [],
  users: [],
  loading: false,
  error: null,

  loadTenants: async () => {
    set({ loading: true, error: null });
    const isSuper = useAuthStore.getState().isSuperAdmin();
    const authTenantId = useAuthStore.getState().currentTenantId;

    try {
      const allTenants = await api.listTenants();
      
      const effectiveTenants = isSuper
        ? allTenants
        : (authTenantId ? allTenants.filter((t) => t.tenant_id === authTenantId) : allTenants);

      // Strict tenant scoping: non-superadmins are strictly tied to their tenant
      const targetId = isSuper
        ? (get().selectedTenantId || authTenantId || effectiveTenants[0]?.tenant_id || 'all')
        : (authTenantId || effectiveTenants[0]?.tenant_id || null);

      set({
        tenants: effectiveTenants,
        selectedTenantId: targetId,
      });

      await get().loadBlueprints();
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
      set({ error: err.message || 'Failed to fetch tenants from backend', loading: false });
    }
  },

  selectTenant: async (tenantId: string) => {
    const isSuper = useAuthStore.getState().isSuperAdmin();
    const userTenantId = useAuthStore.getState().currentTenantId;
    const effectiveTenantId = isSuper ? tenantId : (userTenantId || tenantId);

    set({ selectedTenantId: effectiveTenantId, error: null });
    await get().loadBlueprints();
  },

  loadBlueprints: async () => {
    const authTenantId = useAuthStore.getState().currentTenantId;
    const isSuper = useAuthStore.getState().isSuperAdmin();
    
    // Strict isolation: non-superadmins can NEVER load anything outside their assigned tenant
    let targetTenantId = isSuper
      ? (get().selectedTenantId || authTenantId || '')
      : (authTenantId || '');

    if (!targetTenantId) {
      const tenants = get().tenants;
      if (tenants.length > 0) {
        targetTenantId = tenants[0].tenant_id;
        set({ selectedTenantId: targetTenantId });
      } else {
        set({ blueprints: [], loading: false });
        return;
      }
    }

    set({ loading: true, error: null });

    try {
      if (isSuper && targetTenantId === 'all') {
        const tenants = get().tenants.filter((t) => t.tenant_id !== 'all');
        const nested = await Promise.all(
          tenants.map(async (t) => {
            try {
              return await api.listBlueprints(t.tenant_id);
            } catch {
              return [];
            }
          })
        );
        set({ blueprints: nested.flat(), loading: false, selectedTenantId: 'all' });
        return;
      }

      const remoteBlueprints = await api.listBlueprints(targetTenantId);
      set({
        blueprints: remoteBlueprints || [],
        loading: false,
        selectedTenantId: targetTenantId,
      });
    } catch (err: any) {
      console.error(`Failed to load blueprints for tenant ${targetTenantId}:`, err);
      set({
        blueprints: [],
        error: err.response?.data?.detail || err.message || 'Failed to load blueprints from backend',
        loading: false,
      });
    }
  },

  refreshBlueprints: async () => {
    await get().loadBlueprints();
  },

  deleteBlueprint: async (blueprintId: string) => {
    set({ loading: true });
    try {
      await api.deleteBlueprint(blueprintId);
      await get().loadBlueprints();
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || err.message || 'Failed to delete blueprint',
        loading: false,
      });
      throw err;
    }
  },

  createTenant: async (data: TenantCreate) => {
    set({ loading: true, error: null });
    try {
      const created = await api.createTenant(data);
      await get().loadTenants();
      await useAuthStore.getState().loadAvailableTenants();
      return created;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || err.message, loading: false });
      throw err;
    }
  },

  updateTenant: async (tenantId: string, data: TenantUpdate) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.updateTenant(tenantId, data);
      await get().loadTenants();
      await useAuthStore.getState().loadAvailableTenants();
      return updated;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || err.message, loading: false });
      throw err;
    }
  },

  deleteTenant: async (tenantId: string) => {
    set({ loading: true, error: null });
    try {
      await api.deleteTenant(tenantId);
      await get().loadTenants();
      await useAuthStore.getState().loadAvailableTenants();
    } catch (err: any) {
      set({ error: err.response?.data?.detail || err.message, loading: false });
      throw err;
    }
  },

  loadUsers: async (tenantId?: string) => {
    const isSuper = useAuthStore.getState().isSuperAdmin();
    const authTenantId = useAuthStore.getState().currentTenantId;
    const targetTenant = tenantId || (isSuper ? get().selectedTenantId : authTenantId);

    try {
      const items = await api.listUsers(targetTenant || undefined);
      set({ users: items });
      return items;
    } catch (err: any) {
      console.error('Failed to load users:', err);
      return [];
    }
  },

  createUser: async (data: UserCreate) => {
    try {
      const created = await api.createUser(data);
      await get().loadUsers(data.tenant_id);
      await useAuthStore.getState().loadPersonas();
      return created;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || err.message });
      throw err;
    }
  },

  updateUser: async (userId: string, data: UserUpdate) => {
    try {
      const updated = await api.updateUser(userId, data);
      await get().loadUsers();
      await useAuthStore.getState().loadPersonas();
      return updated;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || err.message });
      throw err;
    }
  },

  deleteUser: async (userId: string) => {
    try {
      await api.deleteUser(userId);
      await get().loadUsers();
      await useAuthStore.getState().loadPersonas();
    } catch (err: any) {
      set({ error: err.response?.data?.detail || err.message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

export type { Tenant, Blueprint, BlueprintStatus };
