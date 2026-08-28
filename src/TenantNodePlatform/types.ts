// Types matching the TenantNodePlatform backend models.

export type BlueprintStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
export type SourceType = 'service' | 'decision' | 'form' | 'workflow' | 'llm' | 'mapper' | 'graph';
export type TenantStatus = 'active' | 'suspended';
export type DependencyType = 'node_blueprint' | 'graph_blueprint';

export interface Tenant {
  tenant_id: string;
  tenant_name: string;
  status: TenantStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantCreate {
  tenant_name: string;
  metadata?: Record<string, unknown>;
}

export interface Blueprint {
  blueprint_id: string;
  tenant_id: string;
  name: string;
  description: string;
  status: BlueprintStatus;
  version: number;
  source_type: SourceType;
  graph_definition: GraphDefinition;
  input_contract: Record<string, unknown>;
  output_contract: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BlueprintCreate {
  name: string;
  description?: string;
  source_type?: SourceType;
  graph_definition?: Record<string, unknown>;
  input_contract?: Record<string, unknown>;
  output_contract?: Record<string, unknown>;
  created_by?: string;
}

export interface BlueprintUpdate {
  name?: string;
  description?: string;
  source_type?: SourceType;
  graph_definition?: Record<string, unknown>;
  input_contract?: Record<string, unknown>;
  output_contract?: Record<string, unknown>;
  status?: BlueprintStatus;
}

export interface GraphDefinition {
  nodes: GraphNode[];
  edges: GraphEdge[];
  inputs?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  condition?: Record<string, unknown>;
}

export interface BlueprintVersion {
  blueprint_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface BlueprintDependency {
  dependent_id: string;
  dependency_id: string;
  dependency_type: DependencyType;
  tenant_id: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface MaterializationResult {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    inputs: Record<string, unknown>;
  };
  blueprint_id: string;
  blueprint_name: string;
  version: number;
}

// Rule engine types
export interface RuleCondition {
  field: string;
  operator: string;
  value?: unknown;
}

export interface RuleConditionGroup {
  operator: 'AND' | 'OR' | 'NOT';
  rules: (RuleCondition | RuleConditionGroup)[];
}

export interface RuleDefinition {
  ruleSetId: string;
  schemaVersion: string;
  conditions: RuleCondition | RuleConditionGroup;
  outcomes: {
    true?: string;
    false?: string;
  };
  defaultOutcome?: string;
}

export interface RuleTestResponse {
  matched: boolean;
  outcome: string;
  evaluation_trace: string[];
}

export interface RuleValidateResponse {
  valid: boolean;
  errors: string[];
  schema_version: string;
}
