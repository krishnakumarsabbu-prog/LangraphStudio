/**
 * Blueprint API service.
 *
 * Talks to the Tenant Node Platform backend: blueprint CRUD, rule
 * validation, and rule testing. This is separate from the LangGraph
 * service — blueprint data never touches the LangGraph workflow store.
 */

import axios from 'axios';

const API_BASE = '/api/tenant-platform';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export interface BlueprintSavePayload {
  name: string;
  description: string;
  source_type: string;
  graph_definition: {
    nodes: any[];
    edges: any[];
  };
  input_contract: Record<string, any>;
  output_contract: Record<string, any>;
}

export interface BlueprintSaveResponse {
  blueprint_id: string;
  tenant_id: string;
  name: string;
  status: string;
  version: number;
}

export interface RuleValidateResponse {
  valid: boolean;
  errors: string[];
  schema_version: string;
}

export interface RuleTestResponse {
  matched: boolean;
  outcome: string | null;
  evaluation_trace: Array<{ description: string; result: boolean; detail: string }>;
  error: string | null;
}

export const blueprintService = {
  async saveBlueprint(tenantId: string, payload: BlueprintSavePayload): Promise<BlueprintSaveResponse> {
    const resp = await api.post(`/api/tenant-platform/tenants/${tenantId}/blueprints`, payload);
    return resp.data;
  },

  async updateBlueprint(blueprintId: string, payload: Partial<BlueprintSavePayload>): Promise<BlueprintSaveResponse> {
    const resp = await api.put(`/api/tenant-platform/blueprints/${blueprintId}`, payload);
    return resp.data;
  },

  async publishBlueprint(blueprintId: string): Promise<BlueprintSaveResponse> {
    const resp = await api.post(`/api/tenant-platform/blueprints/${blueprintId}/publish`);
    return resp.data;
  },

  async validateRule(ruleDefinition: Record<string, any>): Promise<RuleValidateResponse> {
    const resp = await api.post('/api/tenant-platform/rules/validate', {
      rule_definition: ruleDefinition,
    });
    return resp.data;
  },

  async testRule(
    ruleDefinition: Record<string, any>,
    sampleInput: Record<string, any>
  ): Promise<RuleTestResponse> {
    const resp = await api.post('/api/tenant-platform/rules/test', {
      rule_definition: ruleDefinition,
      sample_input: sampleInput,
    });
    return resp.data;
  },
};
