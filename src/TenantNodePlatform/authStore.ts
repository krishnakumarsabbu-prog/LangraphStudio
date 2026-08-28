import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_USER' | 'TENANT_VIEWER';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string;
  tenant_name: string;
  avatar?: string;
  title?: string;
}

export interface TenantInfo {
  tenant_id: string;
  tenant_name: string;
  slug: string;
  description: string;
  category: string;
  status: 'active' | 'suspended';
  icon?: string;
}

export const PRESET_TENANTS: TenantInfo[] = [
  {
    tenant_id: 'tenant-gsa',
    tenant_name: 'GSA (General Services Admin)',
    slug: 'gsa',
    description: 'Government identity, verification & procurement workflows',
    category: 'Federal Agency',
    status: 'active',
    icon: 'Building2',
  },
  {
    tenant_id: 'tenant-usps',
    tenant_name: 'USPS (Postal Service)',
    slug: 'usps',
    description: 'Delivery Point Validation (DPV) & address verification services',
    category: 'Logistics & Postal',
    status: 'active',
    icon: 'Truck',
  },
  {
    tenant_id: 'tenant-fintech',
    tenant_name: 'Fintech Global Corp',
    slug: 'fintech',
    description: 'KYC, AML & real-time fraud assessment workflows',
    category: 'Financial Services',
    status: 'active',
    icon: 'ShieldCheck',
  },
];

export const PRESET_USERS: Record<string, UserProfile & { passwordHint: string }> = {
  superadmin: {
    id: 'usr-superadmin',
    name: 'Eleanor Vance',
    email: 'superadmin@flowforge.internal',
    role: 'SUPER_ADMIN',
    tenant_id: 'all',
    tenant_name: 'All Tenants (Super Admin)',
    title: 'Principal Platform Operator',
    passwordHint: 'admin123',
    avatar: '👑',
  },
  gsa_admin: {
    id: 'usr-gsa-admin',
    name: 'Marcus Holloway',
    email: 'admin@gsa.gov',
    role: 'TENANT_ADMIN',
    tenant_id: 'tenant-gsa',
    tenant_name: 'GSA (General Services Admin)',
    title: 'GSA Lead Systems Architect',
    passwordHint: 'gsa123',
    avatar: '🛡️',
  },
  gsa_analyst: {
    id: 'usr-gsa-analyst',
    name: 'Sarah Chen',
    email: 'analyst@gsa.gov',
    role: 'TENANT_USER',
    tenant_id: 'tenant-gsa',
    tenant_name: 'GSA (General Services Admin)',
    title: 'GSA Business Workflow Analyst',
    passwordHint: 'gsa123',
    avatar: '📊',
  },
  usps_admin: {
    id: 'usr-usps-admin',
    name: 'David Reynolds',
    email: 'admin@usps.gov',
    role: 'TENANT_ADMIN',
    tenant_id: 'tenant-usps',
    tenant_name: 'USPS (Postal Service)',
    title: 'USPS Solutions Engineer',
    passwordHint: 'usps123',
    avatar: '📦',
  },
  fintech_admin: {
    id: 'usr-fintech-admin',
    name: 'Elena Rostova',
    email: 'admin@fintech.io',
    role: 'TENANT_ADMIN',
    tenant_id: 'tenant-fintech',
    tenant_name: 'Fintech Global Corp',
    title: 'Fintech Head of Compliance',
    passwordHint: 'fintech123',
    avatar: '💳',
  },
};

interface AuthState {
  currentUser: UserProfile | null;
  currentTenantId: string;
  currentTenantName: string;
  isAuthenticated: boolean;
  token: string | null;
  availableTenants: TenantInfo[];

  // Actions
  login: (email: string, password?: string, tenantId?: string) => Promise<{ success: boolean; error?: string }>;
  quickLogin: (personaKey: keyof typeof PRESET_USERS) => void;
  logout: () => void;
  switchActiveTenant: (tenantId: string) => void;

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
      currentUser: PRESET_USERS.gsa_admin, // default logged-in as GSA Admin
      currentTenantId: 'tenant-gsa',
      currentTenantName: 'GSA (General Services Admin)',
      isAuthenticated: true,
      token: 'mock-jwt-token-gsa-admin',
      availableTenants: PRESET_TENANTS,

      login: async (email: string, _password?: string, tenantId?: string) => {
        const found = Object.values(PRESET_USERS).find(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase()
        );

        if (!found) {
          return { success: false, error: 'User not found. Use one of the demo accounts or quick-login buttons.' };
        }

        const effectiveTenantId =
          found.role === 'SUPER_ADMIN'
            ? tenantId || 'all'
            : found.tenant_id;

        const effectiveTenant = PRESET_TENANTS.find((t) => t.tenant_id === effectiveTenantId);

        const updatedUser: UserProfile = {
          ...found,
          tenant_id: effectiveTenantId,
          tenant_name:
            effectiveTenantId === 'all'
              ? 'All Tenants (Super Admin)'
              : effectiveTenant?.tenant_name || found.tenant_name,
        };

        set({
          currentUser: updatedUser,
          currentTenantId: effectiveTenantId,
          currentTenantName: updatedUser.tenant_name,
          isAuthenticated: true,
          token: `mock-token-${found.id}-${Date.now()}`,
        });

        return { success: true };
      },

      quickLogin: (personaKey) => {
        const user = PRESET_USERS[personaKey];
        if (!user) return;
        const tenant = PRESET_TENANTS.find((t) => t.tenant_id === user.tenant_id);
        const tenantName = user.role === 'SUPER_ADMIN' ? 'All Tenants (Super Admin)' : (tenant?.tenant_name || user.tenant_name);

        set({
          currentUser: {
            ...user,
            tenant_name: tenantName,
          },
          currentTenantId: user.tenant_id,
          currentTenantName: tenantName,
          isAuthenticated: true,
          token: `mock-token-${user.id}-${Date.now()}`,
        });
      },

      logout: () => {
        set({
          currentUser: null,
          currentTenantId: '',
          currentTenantName: '',
          isAuthenticated: false,
          token: null,
        });
      },

      switchActiveTenant: (tenantId: string) => {
        const { currentUser } = get();
        if (!currentUser) return;

        // Super admins can switch freely; tenant admins/users stay in their own tenant
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
            const tenant = PRESET_TENANTS.find((t) => t.tenant_id === tenantId);
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
        }
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
    }
  )
);
