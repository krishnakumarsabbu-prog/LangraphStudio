import axios, { AxiosInstance } from 'axios';
import type {
  Tenant,
  TenantCreate,
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
} from './types';

const API_BASE = '/api/tenant-platform';

const client: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

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
