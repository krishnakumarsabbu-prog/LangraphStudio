import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, UserRole, Tenant, PersonaItem, ImpersonationContext } from './types';
import * as api from './tnpService';

interface AuthState {
  currentUser: UserProfile | null;
  currentTenantId: string;
  currentTenantName: string;
  isAuthenticated: boolean;
  token: string | null;
  availableTenants: Tenant[];
  personas: PersonaItem[];
  loading: boolean;
  impersonationContext: ImpersonationContext | null;

  // Actions
  login: (email: string, password?: string, tenantId?: string) => Promise<{ success: boolean; error?: string }>;
  quickLogin: (persona: PersonaItem) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchActiveTenant: (tenantId: string) => void;
  loadPersonas: () => Promise<PersonaItem[]>;
  loadAvailableTenants: () => Promise<Tenant[]>;
  startImpersonation: (tenantId: string, tenantName: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;

  // Permission Selectors
  canCreateBlueprint: () => boolean;
  canPublishBlueprint: () => boolean;
  canManageTenants: () => boolean;
  canManageUsers: () => boolean;
  canEditWorkflow: () => boolean;
  isSuperAdmin: () => boolean;
  isTenantAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      currentTenantId: '',
      currentTenantName: '',
      isAuthenticated: false,
      token: null,
      availableTenants: [],
      personas: [],
      loading: false,
      impersonationContext: null,

      loadPersonas: async () => {
        try {
          const items = await api.listPersonas();
          set({ personas: items });
          return items;
        } catch (err) {
          console.error('Failed to load personas from backend:', err);
          return [];
        }
      },

      loadAvailableTenants: async () => {
        try {
          const tenants = await api.listTenants();
          set({ availableTenants: tenants });
          return tenants;
        } catch (err) {
          console.error('Failed to load tenants from backend:', err);
          return [];
        }
      },

      login: async (email: string, password = '', tenantId?: string) => {
        set({ loading: true });
        try {
          const res = await api.loginApi({ email, password, tenant_id: tenantId });
          if (res.success && res.user) {
            set({
              currentUser: res.user,
              currentTenantId: res.user.tenant_id,
              currentTenantName: res.user.tenant_name,
              isAuthenticated: true,
              token: res.token,
              availableTenants: res.available_tenants || [],
              loading: false,
            });
            // Immediate sync to TNP store for strict tenant data isolation
            const { useTnpStore } = await import('./tnpStore');
            await useTnpStore.getState().selectTenant(res.user.tenant_id);
            return { success: true };
          }
          set({ loading: false });
          return { success: false, error: 'Authentication failed' };
        } catch (err: any) {
          set({ loading: false });
          const message = err.response?.data?.detail || err.message || 'Authentication failed. Please check credentials.';
          return { success: false, error: message };
        }
      },

      quickLogin: async (persona: PersonaItem) => {
        return get().login(persona.email, '', persona.tenant_id);
      },

      logout: async () => {
        set({
          currentUser: null,
          currentTenantId: '',
          currentTenantName: '',
          isAuthenticated: false,
          token: null,
        });
        const { useTnpStore } = await import('./tnpStore');
        useTnpStore.setState({ selectedTenantId: null, blueprints: [], users: [] });
      },

      switchActiveTenant: async (tenantId: string) => {
        const { currentUser, availableTenants } = get();
        if (!currentUser) return;

        // Super admins can switch freely across all tenants
        if (currentUser.role === 'SUPER_ADMIN') {
          if (tenantId === 'all') {
            set({
              currentTenantId: 'all',
              currentTenantName: 'All Tenants (Super Admin)',
              currentUser: {
                ...currentUser,
                tenant_id: 'all',
                tenant_name: 'All Tenants (Super Admin)',
              },
            });
          } else {
            const tenant = availableTenants.find((t) => t.tenant_id === tenantId);
            if (tenant) {
              set({
                currentTenantId: tenant.tenant_id,
                currentTenantName: tenant.tenant_name,
                currentUser: {
                  ...currentUser,
                  tenant_id: tenant.tenant_id,
                  tenant_name: tenant.tenant_name,
                },
              });
            }
          }
          const { useTnpStore } = await import('./tnpStore');
          await useTnpStore.getState().selectTenant(tenantId);
        }
      },

      startImpersonation: async (tenantId: string, tenantName: string) => {
        const { currentUser, token } = get();
        if (!currentUser || currentUser.role !== 'SUPER_ADMIN') return;
        try {
          const ctx = await api.startImpersonation(tenantId);
          set({
            impersonationContext: ctx,
            currentTenantId: tenantId,
            currentTenantName: tenantName,
          });
          const { useTnpStore } = await import('./tnpStore');
          await useTnpStore.getState().selectTenant(tenantId);
        } catch (err) {
          console.error('Failed to start impersonation:', err);
        }
      },

      exitImpersonation: async () => {
        const { currentUser, impersonationContext } = get();
        if (!impersonationContext) return;
        try {
          await api.endImpersonation(
            impersonationContext.target_tenant_id,
            impersonationContext.session_id
          );
        } catch (err) {
          console.error('Failed to end impersonation:', err);
        }
        set({
          impersonationContext: null,
          currentTenantId: impersonationContext.original_tenant_id,
          currentTenantName: 'All Tenants (Super Admin)',
        });
        const { useTnpStore } = await import('./tnpStore');
        await useTnpStore.getState().selectTenant(impersonationContext.original_tenant_id || 'all');
      },

      canCreateBlueprint: () => {
        const { currentUser } = get();
        if (!currentUser) return false;
        return currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'TENANT_ADMIN';
      },

      canPublishBlueprint: () => {
        const { currentUser } = get();
        if (!currentUser) return false;
        return currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'TENANT_ADMIN';
      },

      canManageTenants: () => {
        const { currentUser } = get();
        if (!currentUser) return false;
        return currentUser.role === 'SUPER_ADMIN';
      },

      canManageUsers: () => {
        const { currentUser } = get();
        if (!currentUser) return false;
        return currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'TENANT_ADMIN';
      },

      canEditWorkflow: () => {
        const { currentUser } = get();
        if (!currentUser) return false;
        return currentUser.role !== 'TENANT_VIEWER';
      },

      isSuperAdmin: () => {
        const { currentUser } = get();
        return currentUser?.role === 'SUPER_ADMIN';
      },

      isTenantAdmin: () => {
        const { currentUser } = get();
        return currentUser?.role === 'TENANT_ADMIN';
      },
    }),
    {
      name: 'tnp_auth_session',
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentTenantId: state.currentTenantId,
        currentTenantName: state.currentTenantName,
        isAuthenticated: state.isAuthenticated,
        token: state.token,
      }),
    }
  )
);

export type { UserProfile, UserRole, Tenant, PersonaItem };
