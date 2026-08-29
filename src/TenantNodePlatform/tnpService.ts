import axios, { AxiosInstance } from 'axios';
import type {
  Tenant,
  TenantCreate,
  TenantUpdate,
  Blueprint,
  BlueprintCreate,
  BlueprintUpdate,
  BlueprintVersion,
  BlueprintDependency,
  PaginatedResponse,
  MaterializationResult,
  RuleDefinition,
  RuleTestResponse,
  RuleValidateResponse,
  LoginRequest,
  LoginResponse,
  PersonaItem,
  UserProfile,
  UserCreate,
  UserUpdate,
} from './types';

const API_BASE = '/api/tenant-platform';

const client: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Interceptor to add auth token if present
client.interceptors.request.use((config) => {
  const sessionStr = localStorage.getItem('tnp_auth_session');
  if (sessionStr) {
    try {
      const parsed = JSON.parse(sessionStr);
      if (parsed?.state?.token) {
        config.headers.Authorization = `Bearer ${parsed.state.token}`;
      }
    } catch {}
  }
  return config;
});

// --------------------------------------------------------------------------- //
// Auth & Personas
// --------------------------------------------------------------------------- //

export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
  const res = await client.post<LoginResponse>('/auth/login', data);
  return res.data;
}

export async function listPersonas(): Promise<PersonaItem[]> {
  const res = await client.get<PaginatedResponse<PersonaItem>>('/auth/personas');
  return res.data.items;
}

export async function getMe(): Promise<UserProfile> {
  const res = await client.get<UserProfile>('/auth/me');
  return res.data;
}

// --------------------------------------------------------------------------- //
// Tenants
// --------------------------------------------------------------------------- //

export async function listTenants(): Promise<Tenant[]> {
  const res = await client.get<PaginatedResponse<Tenant>>('/tenants');
  return res.data.items;
}

export async function getTenant(tenantId: string): Promise<Tenant> {
  const res = await client.get<Tenant>(`/tenants/${tenantId}`);
  return res.data;
}

export async function createTenant(data: TenantCreate): Promise<Tenant> {
  const res = await client.post<Tenant>('/tenants', data);
  return res.data;
}

export async function updateTenant(tenantId: string, data: TenantUpdate): Promise<Tenant> {
  const res = await client.patch<Tenant>(`/tenants/${tenantId}`, data);
  return res.data;
}

export async function deleteTenant(tenantId: string): Promise<void> {
  await client.delete(`/tenants/${tenantId}`);
}

// --------------------------------------------------------------------------- //
// Users
// --------------------------------------------------------------------------- //

export async function listUsers(tenantId?: string): Promise<UserProfile[]> {
  const params = tenantId && tenantId !== 'all' ? { tenant_id: tenantId } : {};
  const res = await client.get<PaginatedResponse<UserProfile>>('/users', { params });
  return res.data.items;
}

export async function createUser(data: UserCreate): Promise<UserProfile> {
  const res = await client.post<UserProfile>('/users', data);
  return res.data;
}

export async function updateUser(userId: string, data: UserUpdate): Promise<UserProfile> {
  const res = await client.patch<UserProfile>(`/users/${userId}`, data);
  return res.data;
}

export async function deleteUser(userId: string): Promise<void> {
  await client.delete(`/users/${userId}`);
}

// --------------------------------------------------------------------------- //
// Blueprints
// --------------------------------------------------------------------------- //

export async function listBlueprints(tenantId: string): Promise<Blueprint[]> {
  const res = await client.get<PaginatedResponse<Blueprint>>(
    `/tenants/${tenantId}/blueprints`
  );
  return res.data.items;
}

export async function createBlueprint(
  tenantId: string,
  data: BlueprintCreate
): Promise<Blueprint> {
  const res = await client.post<Blueprint>(
    `/tenants/${tenantId}/blueprints`,
    data
  );
  return res.data;
}

export async function batchCreateBlueprints(
  tenantId: string,
  data: BlueprintCreate[]
): Promise<Blueprint[]> {
  const res = await client.post<PaginatedResponse<Blueprint>>(
    `/tenants/${tenantId}/blueprints/batch`,
    data
  );
  return res.data.items;
}

export async function getBlueprint(
  blueprintId: string,
  version?: number
): Promise<Blueprint> {
  const params = version !== undefined ? { version } : {};
  const res = await client.get<Blueprint>(`/blueprints/${blueprintId}`, { params });
  return res.data;
}

export async function updateBlueprint(
  blueprintId: string,
  updates: BlueprintUpdate
): Promise<Blueprint> {
  const res = await client.put<Blueprint>(`/blueprints/${blueprintId}`, updates);
  return res.data;
}

export async function publishBlueprint(blueprintId: string): Promise<Blueprint> {
  const res = await client.post<Blueprint>(`/blueprints/${blueprintId}/publish`);
  return res.data;
}

export async function deleteBlueprint(blueprintId: string): Promise<void> {
  await client.delete(`/blueprints/${blueprintId}`);
}

export async function listBlueprintVersions(
  blueprintId: string
): Promise<BlueprintVersion[]> {
  const res = await client.get<PaginatedResponse<BlueprintVersion>>(
    `/blueprints/${blueprintId}/versions`
  );
  return res.data.items;
}

export async function listBlueprintDependencies(
  blueprintId: string
): Promise<BlueprintDependency[]> {
  const res = await client.get<PaginatedResponse<BlueprintDependency>>(
    `/blueprints/${blueprintId}/dependencies`
  );
  return res.data.items;
}

export async function addBlueprintDependency(
  blueprintId: string,
  dependencyId: string,
  dependencyType: string = 'graph_blueprint'
): Promise<BlueprintDependency> {
  const res = await client.post<BlueprintDependency>(
    `/blueprints/${blueprintId}/dependencies`,
    { dependency_id: dependencyId, dependency_type: dependencyType }
  );
  return res.data;
}

export async function materializeBlueprint(
  blueprintId: string,
  idPrefix?: string
): Promise<MaterializationResult> {
  const res = await client.post<MaterializationResult>(
    `/blueprints/${blueprintId}/materialize`,
    idPrefix ? { id_prefix: idPrefix } : {}
  );
  return res.data;
}

// --------------------------------------------------------------------------- //
// Rules
// --------------------------------------------------------------------------- //

export async function validateRule(
  rule: RuleDefinition
): Promise<RuleValidateResponse> {
  const res = await client.post<RuleValidateResponse>('/rules/validate', rule);
  return res.data;
}

export async function testRule(
  rule: RuleDefinition,
  input: Record<string, unknown>
): Promise<RuleTestResponse> {
  const res = await client.post<RuleTestResponse>('/rules/test', {
    rule,
    input,
  });
  return res.data;
}

// --------------------------------------------------------------------------- //
// Framework Nodes
// --------------------------------------------------------------------------- //

export async function listFrameworkNodes() {
  const res = await client.get<{ items: any[]; total: number }>('/framework-nodes');
  return res.data.items;
}

export async function createFrameworkNode(data: Record<string, unknown>) {
  const res = await client.post('/framework-nodes', data);
  return res.data;
}

export async function updateFrameworkNode(nodeId: string, updates: Record<string, unknown>) {
  const res = await client.put(`/framework-nodes/${nodeId}`, updates);
  return res.data;
}

// --------------------------------------------------------------------------- //
// Tenant Node Access
// --------------------------------------------------------------------------- //

export async function getTenantNodeAccess(tenantId: string) {
  const res = await client.get<{ items: any[]; total: number }>(`/tenants/${tenantId}/node-access`);
  return res.data.items;
}

export async function updateTenantNodeAccess(tenantId: string, enabledNodeTypes: string[]) {
  const res = await client.put(`/tenants/${tenantId}/node-access`, { enabled_node_types: enabledNodeTypes });
  return res.data;
}

export async function getCanvasAvailableNodes(tenantId: string) {
  const res = await client.get<{ framework_nodes: any[]; tenant_nodes: any[] }>(
    `/canvas/available-nodes?tenant_id=${tenantId}`
  );
  return res.data;
}

// --------------------------------------------------------------------------- //
// Audit Log
// --------------------------------------------------------------------------- //

export async function listAuditLogs(params?: {
  tenant_id?: string;
  actor_user_id?: string;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await client.get<{ items: any[]; total: number }>('/audit', { params });
  return res.data;
}

// --------------------------------------------------------------------------- //
// Workflow Executions
// --------------------------------------------------------------------------- //

export async function listExecutions(params: {
  tenant_id: string;
  workflow_name?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await client.get<{ items: any[]; total: number }>('/executions', { params });
  return res.data;
}

export async function getExecution(executionId: string, tenantId: string) {
  const res = await client.get(`/executions/${executionId}?tenant_id=${tenantId}`);
  return res.data;
}

export async function createExecution(data: {
  tenant_id: string;
  workflow_name: string;
  workflow_version?: number;
  triggered_by?: string;
  triggered_by_user_id?: string;
  triggered_by_user_name?: string;
  input_data?: Record<string, unknown>;
}) {
  const res = await client.post('/executions', data);
  return res.data;
}

// --------------------------------------------------------------------------- //
// Impersonation
// --------------------------------------------------------------------------- //

export async function startImpersonation(tenantId: string) {
  const res = await client.post(`/impersonate/${tenantId}/start`);
  return res.data;
}

export async function endImpersonation(targetTenantId: string, sessionId: string) {
  const res = await client.post('/impersonate/end', { target_tenant_id: targetTenantId, session_id: sessionId });
  return res.data;
}

// --------------------------------------------------------------------------- //
// Tenant Actions (suspend/activate)
// --------------------------------------------------------------------------- //

export async function suspendTenant(tenantId: string) {
  const res = await client.post(`/tenants/${tenantId}/suspend`);
  return res.data;
}

export async function activateTenant(tenantId: string) {
  const res = await client.post(`/tenants/${tenantId}/activate`);
  return res.data;
}

// --------------------------------------------------------------------------- //
// Platform Stats
// --------------------------------------------------------------------------- //

export async function getPlatformStats() {
  const res = await client.get('/stats');
  return res.data;
}
