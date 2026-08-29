// Types matching the TenantNodePlatform backend models.

export type BlueprintStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
export type SourceType = 'service' | 'decision' | 'form' | 'workflow' | 'llm' | 'mapper' | 'graph';
export type TenantStatus = 'active' | 'suspended' | 'inactive';
export type DependencyType = 'node_blueprint' | 'graph_blueprint';
export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_USER' | 'TENANT_VIEWER';
export type FrameworkNodeStatus = 'ACTIVE' | 'DEPRECATED' | 'DISABLED';
export type ExecutionStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

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

export interface PersonaItem {
  key: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string;
  tenant_name: string;
  title: string;
  avatar: string;
  description: string;
}

export interface LoginRequest {
  email: string;
  password?: string;
  tenant_id?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: UserProfile;
  available_tenants: Tenant[];
}

export interface UserCreate {
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string;
  avatar?: string;
  title?: string;
  password?: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  role?: UserRole;
  tenant_id?: string;
  avatar?: string;
  title?: string;
  password?: string;
}

export interface Tenant {
  tenant_id: string;
  tenant_name: string;
  slug?: string;
  category?: string;
  description?: string;
  status: TenantStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantCreate {
  tenant_name: string;
  slug?: string;
  category?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface TenantUpdate {
  tenant_name?: string;
  slug?: string;
  category?: string;
  description?: string;
  status?: TenantStatus;
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

// --------------------------------------------------------------------------
// Framework Nodes
// --------------------------------------------------------------------------

export interface FrameworkNode {
  id: string;
  node_type: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  status: FrameworkNodeStatus;
  canvas_type: string;
  configuration_schema: Record<string, unknown>;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface TenantNodeAccess {
  tenant_id: string;
  framework_node_id: string;
  node_type: string;
  is_enabled: boolean;
  updated_at: string;
}

export interface TenantNodeAccessItem {
  node_type: string;
  display_name: string;
  category: string;
  icon: string;
  status: FrameworkNodeStatus;
  is_enabled: boolean;
}

export interface CanvasAvailableNodes {
  framework_nodes: FrameworkNode[];
  tenant_nodes: Blueprint[];
}

// --------------------------------------------------------------------------
// Audit Log
// --------------------------------------------------------------------------

export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_user_name: string;
  actor_tenant_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  target_tenant_id?: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  timestamp: string;
}

// --------------------------------------------------------------------------
// Workflow Execution
// --------------------------------------------------------------------------

export interface NodeExecution {
  id: string;
  execution_id: string;
  node_id: string;
  node_label: string;
  node_type: string;
  status: ExecutionStatus;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_data?: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  tenant_id: string;
  workflow_name: string;
  workflow_version: number;
  status: ExecutionStatus;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  triggered_by: string;
  triggered_by_user_id: string;
  triggered_by_user_name: string;
  error_summary?: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  node_executions: NodeExecution[];
}

export interface WorkflowExecutionCreate {
  tenant_id: string;
  workflow_name: string;
  workflow_version?: number;
  triggered_by?: string;
  triggered_by_user_id?: string;
  triggered_by_user_name?: string;
  input_data?: Record<string, unknown>;
}

// --------------------------------------------------------------------------
// Impersonation
// --------------------------------------------------------------------------

export interface ImpersonationContext {
  original_user_id: string;
  original_user_name: string;
  original_tenant_id: string;
  target_tenant_id: string;
  target_tenant_name: string;
  session_id: string;
  started_at: string;
}

// --------------------------------------------------------------------------
// Platform Stats
// --------------------------------------------------------------------------

export interface PlatformStats {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  total_users: number;
  total_blueprints: number;
  total_executions: number;
  framework_nodes: number;
  recent_tenants: Tenant[];
  recent_audit_events: AuditLog[];
}
