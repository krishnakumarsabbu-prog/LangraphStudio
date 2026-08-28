/**
 * Type definitions for the Tenant Node Builder.
 *
 * These are independent of the existing LangGraph store types. A Node
 * Blueprint is a reusable composition of framework nodes (Service, Decision,
 * LLM, Form) that a tenant administrator assembles in the Node Builder UI.
 */

export type FrameworkNodeType = 'service' | 'decision' | 'llm' | 'form';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

export interface ServiceNodeConfig {
  name: string;
  apiUrl: string;
  httpMethod: HttpMethod;
  authType: AuthType;
  authConfig: {
    bearerToken?: string;
    basicUsername?: string;
    basicPassword?: string;
    apiKeyHeader?: string;
    apiKeyValue?: string;
  };
  headers: Array<{ key: string; value: string }>;
  requestMapping: string;
  responseMapping: string;
  timeout: number;
  retryEnabled: boolean;
  maxRetries: number;
  retryDelay: number;
  inputSchema: string;
  outputSchema: string;
}

export type RuleOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY'
  | 'IN'
  | 'NOT_IN'
  | 'BETWEEN';

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export interface RuleConditionLeaf {
  field: string;
  operator: RuleOperator;
  value: any;
}

export interface RuleConditionGroup {
  operator: LogicalOperator;
  rules: RuleTreeNode[];
}

export type RuleTreeNode = RuleConditionLeaf | RuleConditionGroup;

export interface DecisionNodeConfig {
  name: string;
  ruleDefinition: {
    ruleSetId: string;
    schemaVersion: string;
    conditions: RuleConditionGroup;
    outcomes: { true: string; false: string };
    defaultOutcome: string;
  };
}

export interface LLMNodeConfig {
  name: string;
  model: string;
  prompt: string;
  temperature: number;
}

export interface FormNodeConfig {
  name: string;
  formSchema: string;
}

export type NodeConfig = ServiceNodeConfig | DecisionNodeConfig | LLMNodeConfig | FormNodeConfig;

export interface BlueprintNode {
  id: string;
  type: FrameworkNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    config: NodeConfig;
  };
}

export interface BlueprintEdge {
  id: string;
  source: string;
  target: string;
}

export interface BlueprintMetadata {
  name: string;
  description: string;
  version: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
}

export interface BlueprintDocument {
  blueprintId: string | null;
  tenantId: string;
  metadata: BlueprintMetadata;
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
  inputContract: Record<string, any>;
  outputContract: Record<string, any>;
  dependencies: string[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
}

export interface TestTraceStep {
  description: string;
  result: boolean;
  detail: string;
}

export interface TestResult {
  matched: boolean;
  outcome: string | null;
  evaluationTrace: TestTraceStep[];
  error: string | null;
}

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  EQUALS: 'Equals',
  NOT_EQUALS: 'Not Equals',
  GREATER_THAN: 'Greater Than',
  LESS_THAN: 'Less Than',
  GREATER_THAN_OR_EQUAL: 'Greater Than or Equal',
  LESS_THAN_OR_EQUAL: 'Less Than or Equal',
  CONTAINS: 'Contains',
  NOT_CONTAINS: 'Not Contains',
  STARTS_WITH: 'Starts With',
  ENDS_WITH: 'Ends With',
  EXISTS: 'Exists',
  NOT_EXISTS: 'Does Not Exist',
  IS_EMPTY: 'Is Empty',
  IS_NOT_EMPTY: 'Is Not Empty',
  IN: 'In',
  NOT_IN: 'Not In',
  BETWEEN: 'Between',
};

export const OPERATORS_REQUIRING_VALUE: RuleOperator[] = [
  'EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN',
  'GREATER_THAN_OR_EQUAL', 'LESS_THAN_OR_EQUAL',
  'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH',
  'IN', 'NOT_IN', 'BETWEEN',
];

export function isRuleGroup(node: RuleTreeNode): node is RuleConditionGroup {
  return (node as RuleConditionGroup).rules !== undefined;
}

export function isRuleLeaf(node: RuleTreeNode): node is RuleConditionLeaf {
  return (node as RuleConditionLeaf).field !== undefined;
}

export function createDefaultServiceConfig(): ServiceNodeConfig {
  return {
    name: '',
    apiUrl: '',
    httpMethod: 'POST',
    authType: 'none',
    authConfig: {},
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    requestMapping: '{}',
    responseMapping: '{}',
    timeout: 30000,
    retryEnabled: false,
    maxRetries: 3,
    retryDelay: 1000,
    inputSchema: '{}',
    outputSchema: '{}',
  };
}

export function createDefaultDecisionConfig(): DecisionNodeConfig {
  return {
    name: '',
    ruleDefinition: {
      ruleSetId: '',
      schemaVersion: '1.0',
      conditions: {
        operator: 'AND',
        rules: [],
      },
      outcomes: { true: 'APPROVE', false: 'REVIEW' },
      defaultOutcome: 'REVIEW',
    },
  };
}

export function createDefaultLLMConfig(): LLMNodeConfig {
  return {
    name: '',
    model: 'gpt-4',
    prompt: '',
    temperature: 0.7,
  };
}

export function createDefaultFormConfig(): FormNodeConfig {
  return {
    name: '',
    formSchema: '{}',
  };
}
