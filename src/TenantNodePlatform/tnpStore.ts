import { create } from 'zustand';
import type { Tenant, Blueprint, BlueprintStatus } from './types';
import * as api from './tnpService';
import { useAuthStore } from './authStore';

export const SEEDED_BLUEPRINTS: Record<string, Blueprint[]> = {
  'tenant-gsa': [
    {
      blueprint_id: 'bp-gsa-address-01',
      tenant_id: 'tenant-gsa',
      name: 'GSA Address & Identity Verification',
      description:
        'Comprehensive federal address verification service with automated business rule classification and high-confidence matching.',
      status: 'PUBLISHED',
      version: 1,
      source_type: 'graph',
      created_by: 'admin@gsa.gov',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      input_contract: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip: { type: 'string' },
        },
      },
      output_contract: {
        type: 'object',
        properties: {
          outcome: { type: 'string' },
          status: { type: 'string' },
          match_score: { type: 'number' },
        },
      },
      graph_definition: {
        nodes: [
          {
            id: 'gsa-address-service',
            type: 'serviceNode',
            data: {
              label: 'GSA Address API Service',
              url: 'https://api.gsa.gov/v2/address/verify',
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-GSA-API-KEY': 'gsa_live_demo_key' },
              timeout: 5000,
              retries: 2,
              mapping: '{\n  "street": "state.street",\n  "city": "state.city",\n  "zip": "state.zip"\n}',
            },
            position: { x: 100, y: 150 },
          },
          {
            id: 'gsa-address-decision',
            type: 'decisionNode',
            data: {
              label: 'GSA Address Approval Rule',
              script:
                "if state.get('status') == 'VERIFIED' and float(state.get('match_score', 0)) >= 80 and state.get('address_match') == True:\n    return 'APPROVE'\nelif float(state.get('match_score', 0)) >= 50:\n    return 'MANUAL_REVIEW'\nelse:\n    return 'REJECT'",
              branches: ['APPROVE', 'MANUAL_REVIEW', 'REJECT'],
            },
            position: { x: 480, y: 150 },
          },
        ],
        edges: [
          {
            id: 'edge_gsa_service_to_decision',
            source: 'gsa-address-service',
            target: 'gsa-address-decision',
            condition: '',
          },
        ],
        inputs: {
          message: {},
        },
      },
    },
    {
      blueprint_id: 'bp-gsa-vendor-02',
      tenant_id: 'tenant-gsa',
      name: 'GSA Federal SAM.gov Vendor Check',
      description: 'Checks vendor exclusion list and active registration status in federal procurement registry.',
      status: 'PUBLISHED',
      version: 1,
      source_type: 'graph',
      created_by: 'admin@gsa.gov',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      input_contract: {
        type: 'object',
        properties: { uei: { type: 'string' }, cage_code: { type: 'string' } },
      },
      output_contract: {
        type: 'object',
        properties: { eligible: { type: 'boolean' } },
      },
      graph_definition: {
        nodes: [
          {
            id: 'gsa-vendor-service',
            type: 'serviceNode',
            data: {
              label: 'SAM.gov Entity Search',
              url: 'https://api.sam.gov/entity-information/v3/entities',
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              timeout: 8000,
            },
            position: { x: 100, y: 150 },
          },
          {
            id: 'gsa-vendor-decision',
            type: 'decisionNode',
            data: {
              label: 'Vendor Eligibility Rule',
              script:
                "if state.get('active_status') == 'ACTIVE' and state.get('excluded') != True:\n    return 'ELIGIBLE'\nelse:\n    return 'INELIGIBLE'",
              branches: ['ELIGIBLE', 'INELIGIBLE'],
            },
            position: { x: 480, y: 150 },
          },
        ],
        edges: [
          {
            id: 'edge_gsa_vendor_svc_to_dec',
            source: 'gsa-vendor-service',
            target: 'gsa-vendor-decision',
            condition: '',
          },
        ],
      },
    },
  ],
  'tenant-usps': [
    {
      blueprint_id: 'bp-usps-dpv-01',
      tenant_id: 'tenant-usps',
      name: 'USPS Delivery Point Validation (DPV)',
      description: 'USPS CASS-certified delivery point validation, ZIP+4 coding and carrier route lookup.',
      status: 'PUBLISHED',
      version: 1,
      source_type: 'graph',
      created_by: 'admin@usps.gov',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      input_contract: {
        type: 'object',
        properties: { address1: { type: 'string' }, zip5: { type: 'string' } },
      },
      output_contract: {
        type: 'object',
        properties: { dpv_status: { type: 'string' }, deliverable: { type: 'boolean' } },
      },
      graph_definition: {
        nodes: [
          {
            id: 'usps-dpv-service',
            type: 'serviceNode',
            data: {
              label: 'USPS DPV Validation API',
              url: 'https://api.usps.com/addresses/v3/address',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              timeout: 4000,
            },
            position: { x: 100, y: 150 },
          },
          {
            id: 'usps-dpv-decision',
            type: 'decisionNode',
            data: {
              label: 'Deliverability Decision',
              script:
                "if state.get('dpv_confirmation') == 'Y':\n    return 'DELIVERABLE'\nelif state.get('dpv_confirmation') == 'D':\n    return 'SECONDARY_MISSING'\nelse:\n    return 'UNDELIVERABLE'",
              branches: ['DELIVERABLE', 'SECONDARY_MISSING', 'UNDELIVERABLE'],
            },
            position: { x: 480, y: 150 },
          },
        ],
        edges: [
          {
            id: 'edge_usps_dpv_to_dec',
            source: 'usps-dpv-service',
            target: 'usps-dpv-decision',
            condition: '',
          },
        ],
      },
    },
  ],
  'tenant-fintech': [
    {
      blueprint_id: 'bp-fintech-fraud-01',
      tenant_id: 'tenant-fintech',
      name: 'Real-Time Fraud Risk Assessment',
      description: 'Calculates fraud risk score, IP reputation, velocity anomalies and AML watchlists.',
      status: 'PUBLISHED',
      version: 1,
      source_type: 'graph',
      created_by: 'admin@fintech.io',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      input_contract: {
        type: 'object',
        properties: { transaction_amount: { type: 'number' }, user_id: { type: 'string' } },
      },
      output_contract: {
        type: 'object',
        properties: { risk_level: { type: 'string' }, score: { type: 'number' } },
      },
      graph_definition: {
        nodes: [
          {
            id: 'fintech-fraud-service',
            type: 'serviceNode',
            data: {
              label: 'Fraud Assessment Engine',
              url: 'https://api.fintechglobal.com/v1/risk/score',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              timeout: 3000,
            },
            position: { x: 100, y: 150 },
          },
          {
            id: 'fintech-fraud-decision',
            type: 'decisionNode',
            data: {
              label: 'Risk Routing Decision',
              script:
                "if float(state.get('risk_score', 0)) < 30:\n    return 'LOW_RISK_APPROVE'\nelif float(state.get('risk_score', 0)) < 70:\n    return 'STEP_UP_2FA'\nelse:\n    return 'BLOCK_DECLINE'",
              branches: ['LOW_RISK_APPROVE', 'STEP_UP_2FA', 'BLOCK_DECLINE'],
            },
            position: { x: 480, y: 150 },
          },
        ],
        edges: [
          {
            id: 'edge_fintech_fraud_to_dec',
            source: 'fintech-fraud-service',
            target: 'fintech-fraud-decision',
            condition: '',
          },
        ],
      },
    },
  ],
};

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
  tenants: [
    {
      tenant_id: 'tenant-gsa',
      tenant_name: 'GSA (General Services Admin)',
      status: 'active',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      tenant_id: 'tenant-usps',
      tenant_name: 'USPS (Postal Service)',
      status: 'active',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      tenant_id: 'tenant-fintech',
      tenant_name: 'Fintech Global Corp',
      status: 'active',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  selectedTenantId: 'tenant-gsa',
  blueprints: SEEDED_BLUEPRINTS['tenant-gsa'],
  loading: false,
  error: null,

  loadTenants: async () => {
    set({ loading: true, error: null });
    const isSuper = useAuthStore.getState().isSuperAdmin();
    const authTenantId = useAuthStore.getState().currentTenantId || 'tenant-gsa';

    try {
      const allTenants = [
        {
          tenant_id: 'tenant-gsa',
          tenant_name: 'GSA (General Services Admin)',
          status: 'active' as const,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          tenant_id: 'tenant-usps',
          tenant_name: 'USPS (Postal Service)',
          status: 'active' as const,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          tenant_id: 'tenant-fintech',
          tenant_name: 'Fintech Global Corp',
          status: 'active' as const,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // For regular tenant users, only show their own tenant
      const effectiveTenants = isSuper
        ? allTenants
        : allTenants.filter((t) => t.tenant_id === authTenantId);

      set({
        tenants: effectiveTenants,
        selectedTenantId: authTenantId,
      });

      await get().loadBlueprints();
    } catch {
      await get().loadBlueprints();
    } finally {
      set({ loading: false });
    }
  },

  selectTenant: async (tenantId: string) => {
    const isSuper = useAuthStore.getState().isSuperAdmin();
    const userTenantId = useAuthStore.getState().currentTenantId;
    const effectiveTenantId = isSuper ? tenantId : userTenantId;

    set({ selectedTenantId: effectiveTenantId, error: null });
    await get().loadBlueprints();
  },

  loadBlueprints: async () => {
    const authTenantId = useAuthStore.getState().currentTenantId;
    const isSuper = useAuthStore.getState().isSuperAdmin();
    
    // Non-superadmin is strictly locked to their own tenant
    let targetTenantId = isSuper
      ? (get().selectedTenantId || authTenantId || 'tenant-gsa')
      : (authTenantId || 'tenant-gsa');

    if (isSuper && targetTenantId === 'all') {
      // Super admin view all
      const allLocal = Object.values(SEEDED_BLUEPRINTS).flat();
      set({ blueprints: allLocal, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      // Try API first
      const remoteBlueprints = await api.listBlueprints(targetTenantId);
      if (remoteBlueprints && remoteBlueprints.length > 0) {
        set({ blueprints: remoteBlueprints, loading: false, selectedTenantId: targetTenantId });
        return;
      }
    } catch {
      // Fallback to local storage & seeded
    }

    const localSaved = localStorage.getItem(`tnp_blueprints_${targetTenantId}`);
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        const seeds = SEEDED_BLUEPRINTS[targetTenantId] || [];
        const merged = [...parsed, ...seeds.filter((s) => !parsed.some((p: Blueprint) => p.blueprint_id === s.blueprint_id))];
        set({ blueprints: merged, loading: false, selectedTenantId: targetTenantId });
        return;
      } catch {}
    }

    const seeded = SEEDED_BLUEPRINTS[targetTenantId] || [];
    set({ blueprints: seeded, loading: false, selectedTenantId: targetTenantId });
  },

  refreshBlueprints: async () => {
    await get().loadBlueprints();
  },

  clearError: () => set({ error: null }),
}));

export type { Tenant, Blueprint, BlueprintStatus };
