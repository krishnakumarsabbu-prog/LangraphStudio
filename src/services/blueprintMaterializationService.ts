/**
 * BlueprintMaterializationService
 *
 * Converts a Tenant Node Platform blueprint (a reusable template) into a
 * self-contained graph fragment that the EXISTING LangGraph canvas can render
 * and the EXISTING execution engine can execute — without any reference back
 * to the blueprint.
 *
 * Key invariants:
 *  - Every materialized node gets a brand-new unique workflow node ID.
 *    Blueprint node IDs are NEVER reused as workflow node IDs.
 *  - All node data (config, rules, mappings, metadata) is DEEP-CLONED so that
 *    mutating the workflow never mutates the blueprint, and vice-versa.
 *  - A metadata block (source_blueprint_id, source_blueprint_version,
 *    materialized_at) is attached to every node for traceability only.
 *  - The root/entry node is placed at the drop position; dependent nodes are
 *    laid out relative to the root with no overlap.
 *  - Output shapes match what the existing LangGraph store expects:
 *      node.type  → 'serviceNode' | 'decisionNode' | 'llmNode' | 'formNode'
 *      node.data  → flat LangGraph data (label, url, method, script, etc.)
 *      edge       → LangGraphEdge with data.condition
 */

import type { Node, Edge } from 'react-flow-renderer';
import type {
  ServiceNodeData,
  DecisionNodeData,
  LLMNodeData,
  FormNodeData,
  LangGraphEdge,
  NodeData,
} from '../stores/langGraphStore';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MaterializeInput {
  tenant_id: string;
  blueprint_id: string;
  blueprint_version: number;
  /** Full blueprint graph_definition as returned by the TNP API. */
  graph_definition: {
    nodes: BlueprintGraphNode[];
    edges: BlueprintGraphEdge[];
    inputs?: Record<string, unknown>;
  };
  /** Canvas coordinates where the root node should appear. */
  drop_position: { x: number; y: number };
}

export interface MaterializeOutput {
  nodes: Node<NodeData>[];
  edges: LangGraphEdge[];
  /** The root (entry) workflow node ID, for selection / focus. */
  rootWorkflowNodeId: string;
}

// ---------------------------------------------------------------------------
// Blueprint graph node/edge shapes (what the TNP backend stores)
// ---------------------------------------------------------------------------

export interface BlueprintGraphNode {
  id: string;
  type: string; // 'service' | 'decision' | 'llm' | 'form' | ...
  data: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface BlueprintGraphEdge {
  id?: string;
  source: string;
  target: string;
  condition?: string | Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Metadata stamp
// ---------------------------------------------------------------------------

export interface SourceBlueprintMetadata {
  source_blueprint_id: string;
  source_blueprint_version: number;
  materialized_at: string;
}

function makeMetadata(input: MaterializeInput): SourceBlueprintMetadata {
  return {
    source_blueprint_id: input.blueprint_id,
    source_blueprint_version: input.blueprint_version,
    materialized_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// ID generation — guaranteed unique, never reuses blueprint IDs
// ---------------------------------------------------------------------------

let _idCounter = 0;

function uniqueId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now()}-${_idCounter}`;
}

/**
 * Reset the internal counter. Intended for tests so that IDs are
 * deterministic when needed.
 */
export function _resetIdCounter(): void {
  _idCounter = 0;
}

// ---------------------------------------------------------------------------
// Type mapping: blueprint type → LangGraph canvas type
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, string> = {
  service: 'serviceNode',
  decision: 'decisionNode',
  llm: 'llmNode',
  form: 'formNode',
  workflow: 'workflowNode',
  parallel: 'parallelNode',
  merge: 'mergeNode',
  mapper: 'mapperNode',
};

function toCanvasType(bpType: string): string {
  return TYPE_MAP[bpType] ?? 'serviceNode';
}

// ---------------------------------------------------------------------------
// Data adaptation: blueprint node data → flat LangGraph node data
// ---------------------------------------------------------------------------

/**
 * Converts a blueprint node's data object into the flat shape the existing
 * LangGraph canvas reads. The blueprint may store data in either:
 *  (a) the "flat" LangGraph format already (label, url, method, script, …),
 *  (b) the NodeBuilder structured format (label + config: ServiceNodeConfig),
 *  (c) the TNP seed format (label, url, method, config, rules, mappings).
 *
 * We normalise all three into the flat format the canvas expects, then attach
 * the source-blueprint metadata stamp.
 */
function adaptNodeData(
  bpNode: BlueprintGraphNode,
  metadata: SourceBlueprintMetadata,
): NodeData {
  const raw = bpNode.data ?? {};
  const label = (raw.label as string) ?? bpNode.id;
  const type = bpNode.type;

  // ---- Structured NodeBuilder config (data.config is a typed object) ----
  const config = raw.config as Record<string, unknown> | undefined;

  if (type === 'service') {
    const serviceData: ServiceNodeData = {
      label,
      url: (raw.url as string) ?? (config?.apiUrl as string) ?? '',
      method: (raw.method as ServiceNodeData['method']) ??
        (config?.httpMethod as ServiceNodeData['method']) ?? 'GET',
      request: (raw.request as string) ??
        (config?.requestMapping as string) ?? '',
    };
    return { ...serviceData, config: deepClone(config ?? raw), _source: metadata } as unknown as NodeData;
  }

  if (type === 'decision') {
    // Decision nodes in the canvas use a `script` string (Python expression).
    // The blueprint may store either a `script` string directly, or a
    // `rules` array (TNP seed format), or a `config.ruleDefinition` object
    // (NodeBuilder format). We preserve all of them and also derive a
    // `script` string for the canvas.
    let script = (raw.script as string) ?? '';

    if (!script && Array.isArray(raw.rules)) {
      // Compile the seed-format rules array into a Python script string.
      script = compileRulesArrayToScript(raw.rules as RuleSeedEntry[]);
    }

    if (!script && config && typeof config === 'object') {
      const ruleDef = (config as Record<string, unknown>).ruleDefinition;
      if (ruleDef && typeof ruleDef === 'object') {
        script = compileRuleDefinitionToScript(
          ruleDef as Record<string, unknown>,
        );
      }
    }

    const decisionData: DecisionNodeData = {
      label,
      script: script ?? '',
    };
    return { ...decisionData, config: deepClone(config ?? raw), _source: metadata } as unknown as NodeData;
  }

  if (type === 'llm') {
    const llmData: LLMNodeData = {
      label,
      model: (raw.model as string) ?? (config?.model as string) ?? '',
      prompt: (raw.prompt as string) ?? (config?.prompt as string) ?? '',
    };
    return { ...llmData, config: deepClone(config ?? raw), _source: metadata } as unknown as NodeData;
  }

  if (type === 'form') {
    const formData: FormNodeData = {
      label,
      formConfig: (raw.formConfig as unknown) ?? null,
    };
    return { ...formData, config: deepClone(config ?? raw), _source: metadata } as unknown as NodeData;
  }

  // Fallback: pass through whatever data exists, stamped with metadata.
  return { ...deepClone(raw), _source: metadata } as unknown as NodeData;
}

// ---------------------------------------------------------------------------
// Rule compilation helpers (seed format → Python script string)
// ---------------------------------------------------------------------------

interface RuleSeedEntry {
  condition: string;
  action: Record<string, unknown>;
}

function compileRulesArrayToScript(rules: RuleSeedEntry[]): string {
  if (!rules || rules.length === 0) return 'result = True\n';
  const lines: string[] = ['# Materialized from blueprint rules array'];
  for (const rule of rules) {
    lines.push(`if ${rule.condition}:`);
    const actionKeys = Object.keys(rule.action);
    for (const key of actionKeys) {
      const val = JSON.stringify(rule.action[key]);
      lines.push(`    state['${key}'] = ${val}`);
    }
    lines.push('    result = True');
  }
  lines.push('else: result = False');
  return lines.join('\n') + '\n';
}

function compileRuleDefinitionToScript(
  ruleDef: Record<string, unknown>,
): string {
  // NodeBuilder format: { conditions: { operator, rules: [...] }, outcomes, defaultOutcome }
  const conditions = ruleDef.conditions as Record<string, unknown> | undefined;
  if (!conditions) return 'result = True\n';
  const op = (conditions.operator as string) ?? 'AND';
  const rules = (conditions.rules as unknown[]) ?? [];
  if (rules.length === 0) return 'result = True\n';

  const parts: string[] = [];
  for (const r of rules) {
    const leaf = r as Record<string, unknown>;
    if (leaf && typeof leaf.field === 'string') {
      const field = leaf.field;
      const operator = (leaf.operator as string) ?? 'EQUALS';
      const value = leaf.value;
      const pyOp = operatorToPython(operator);
      const pyVal = valueToPython(value);
      parts.push(`state.get('${field}', None) ${pyOp} ${pyVal}`);
    }
  }

  const joiner = op === 'OR' ? ' or ' : ' and ';
  return `result = ${parts.join(joiner)}\n`;
}

function operatorToPython(op: string): string {
  const map: Record<string, string> = {
    EQUALS: '==',
    NOT_EQUALS: '!=',
    GREATER_THAN: '>',
    LESS_THAN: '<',
    GREATER_THAN_OR_EQUAL: '>=',
    LESS_THAN_OR_EQUAL: '<=',
    CONTAINS: 'in',
    NOT_CONTAINS: 'not in',
  };
  return map[op] ?? '==';
}

function valueToPython(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return String(value);
  return `'${String(value)}'`;
}

// ---------------------------------------------------------------------------
// Deep clone helper
// ---------------------------------------------------------------------------

function deepClone<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Root node detection
// ---------------------------------------------------------------------------

/**
 * Finds the root/entry node of a blueprint graph.
 * The root is the node that is never a target of any edge.
 * If multiple such nodes exist, the first one in node order is returned.
 * If all nodes are targets (cycle), the first node is returned as fallback.
 */
function findRootNode(
  bpNodes: BlueprintGraphNode[],
  bpEdges: BlueprintGraphEdge[],
): BlueprintGraphNode {
  const targetIds = new Set(bpEdges.map((e) => e.target));
  const roots = bpNodes.filter((n) => !targetIds.has(n.id));
  if (roots.length > 0) return roots[0];
  return bpNodes[0];
}

// ---------------------------------------------------------------------------
// Layout: position nodes relative to drop position, no overlap
// ---------------------------------------------------------------------------

const NODE_SPACING_X = 300;
const NODE_SPACING_Y = 150;

/**
 * Computes positions for all materialized nodes.
 * The root node is placed at drop_position. Other nodes are positioned
 * relative to the root using a simple top-to-bottom, left-to-right layout
 * based on their depth in the edge graph (BFS from root).
 */
function computePositions(
  bpNodes: BlueprintGraphNode[],
  bpEdges: BlueprintGraphEdge[],
  rootBpId: string,
  dropPosition: { x: number; y: number },
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(rootBpId, { x: dropPosition.x, y: dropPosition.y });

  // Build adjacency list (source → [targets])
  const adjacency = new Map<string, string[]>();
  for (const edge of bpEdges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  // BFS from root to assign depths
  const depthMap = new Map<string, number>();
  depthMap.set(rootBpId, 0);
  const queue: string[] = [rootBpId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depthMap.get(current) ?? 0;
    const targets = adjacency.get(current) ?? [];
    for (const target of targets) {
      if (!depthMap.has(target)) {
        depthMap.set(target, currentDepth + 1);
        queue.push(target);
      }
    }
  }

  // Assign any unreachable nodes to max depth + 1
  let maxDepth = 0;
  for (const [, d] of depthMap) maxDepth = Math.max(maxDepth, d);
  for (const node of bpNodes) {
    if (!depthMap.has(node.id)) {
      maxDepth += 1;
      depthMap.set(node.id, maxDepth);
    }
  }

  // Group nodes by depth, position left-to-right within each depth level
  const byDepth = new Map<number, string[]>();
  for (const node of bpNodes) {
    const d = depthMap.get(node.id) ?? 0;
    const list = byDepth.get(d) ?? [];
    list.push(node.id);
    byDepth.set(d, list);
  }

  const sortedDepths = [...byDepth.keys()].sort((a, b) => a - b);
  for (const depth of sortedDepths) {
    const nodesAtDepth = byDepth.get(depth)!;
    nodesAtDepth.forEach((bpId, index) => {
      if (bpId === rootBpId) return; // root already positioned
      positions.set(bpId, {
        x: dropPosition.x + index * NODE_SPACING_X,
        y: dropPosition.y + depth * NODE_SPACING_Y,
      });
    });
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Edge adaptation
// ---------------------------------------------------------------------------

function adaptEdge(
  bpEdge: BlueprintGraphEdge,
  idMap: Map<string, string>,
): LangGraphEdge | null {
  const sourceWfId = idMap.get(bpEdge.source);
  const targetWfId = idMap.get(bpEdge.target);
  if (!sourceWfId || !targetWfId) return null;

  let condition = '';
  if (typeof bpEdge.condition === 'string') {
    condition = bpEdge.condition;
  } else if (bpEdge.condition && typeof bpEdge.condition === 'object') {
    condition = JSON.stringify(bpEdge.condition);
  }

  return {
    id: uniqueId('edge'),
    source: sourceWfId,
    target: targetWfId,
    type: 'custom',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 4 },
    data: { condition },
  };
}

// ---------------------------------------------------------------------------
// Main materialization function
// ---------------------------------------------------------------------------

export function materializeBlueprint(input: MaterializeInput): MaterializeOutput {
  const { graph_definition, drop_position } = input;
  const bpNodes = graph_definition.nodes ?? [];
  const bpEdges = graph_definition.edges ?? [];

  if (bpNodes.length === 0) {
    return { nodes: [], edges: [], rootWorkflowNodeId: '' };
  }

  const metadata = makeMetadata(input);

  // 1. Find root node
  const rootBpNode = findRootNode(bpNodes, bpEdges);

  // 2. Compute positions relative to drop position
  const bpPositions = computePositions(bpNodes, bpEdges, rootBpNode.id, drop_position);

  // 3. Generate unique workflow node IDs and build ID mapping
  const idMap = new Map<string, string>(); // blueprintId → workflowId
  const wfNodes: Node<NodeData>[] = [];

  for (const bpNode of bpNodes) {
    const wfId = uniqueId(bpNode.type);
    idMap.set(bpNode.id, wfId);

    const pos = bpPositions.get(bpNode.id) ?? drop_position;
    const data = adaptNodeData(bpNode, metadata);

    wfNodes.push({
      id: wfId,
      type: toCanvasType(bpNode.type),
      position: pos,
      data,
    });
  }

  // 4. Adapt edges using the ID mapping
  const wfEdges: LangGraphEdge[] = [];
  for (const bpEdge of bpEdges) {
    const edge = adaptEdge(bpEdge, idMap);
    if (edge) wfEdges.push(edge);
  }

  const rootWorkflowNodeId = idMap.get(rootBpNode.id) ?? '';

  return {
    nodes: wfNodes,
    edges: wfEdges,
    rootWorkflowNodeId,
  };
}
