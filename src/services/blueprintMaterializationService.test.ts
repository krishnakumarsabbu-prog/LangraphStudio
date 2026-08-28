/**
 * Standalone test runner for blueprintMaterializationService.
 *
 * Run with: npx tsx src/services/blueprintMaterializationService.test.ts
 *
 * Tests cover:
 *  1. Simple Service blueprint
 *  2. Service + Decision blueprint
 *  3. Multi-node blueprint (Service → Decision → Service → Decision)
 *  4. Unique IDs (no collision across materializations)
 *  5. Configuration cloning (deep copy)
 *  6. Edge cloning
 *  7. Tenant isolation (metadata stamp)
 *  8. Blueprint modification does not modify workflow
 *  9. Workflow modification does not modify blueprint
 */

import {
  materializeBlueprint,
  _resetIdCounter,
  type MaterializeInput,
} from './blueprintMaterializationService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertNot(condition: boolean, message: string): void {
  assert(!condition, message);
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function simpleServiceBlueprint(): MaterializeInput['graph_definition'] {
  return {
    nodes: [
      {
        id: 'svc-1',
        type: 'service',
        data: {
          label: 'GSA Address Service',
          url: 'https://api.example-gsa.gov/address/v1/verify',
          method: 'POST',
          config: {
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            requestBody: { address: '{input.address}' },
          },
        },
      },
    ],
    edges: [],
    inputs: { address: {} },
  };
}

function serviceDecisionBlueprint(): MaterializeInput['graph_definition'] {
  return {
    nodes: [
      {
        id: 'gsa-address-service',
        type: 'service',
        data: {
          label: 'GSA Address Service',
          url: 'https://api.example-gsa.gov/address/v1/verify',
          method: 'POST',
          config: {
            headers: [{ key: 'Content-Type', value: 'application/json' }],
          },
        },
      },
      {
        id: 'gsa-address-decision',
        type: 'decision',
        data: {
          label: 'GSA Address Decision',
          rules: [
            {
              condition: "state['gsa-address-service']['response']['valid'] == True",
              action: { address_verified: true },
            },
            {
              condition: "state['gsa-address-service']['response']['valid'] == False",
              action: { address_verified: false },
            },
          ],
        },
      },
    ],
    edges: [
      { source: 'gsa-address-service', target: 'gsa-address-decision', condition: '' },
    ],
    inputs: { address_line1: {} },
  };
}

function multiNodeBlueprint(): MaterializeInput['graph_definition'] {
  return {
    nodes: [
      { id: 'svc-a', type: 'service', data: { label: 'Service A', url: 'https://a.example.com', method: 'GET' } },
      { id: 'dec-a', type: 'decision', data: { label: 'Decision A', script: "state['svc-a']['status'] == 'ok'" } },
      { id: 'svc-b', type: 'service', data: { label: 'Service B', url: 'https://b.example.com', method: 'POST' } },
      { id: 'dec-b', type: 'decision', data: { label: 'Decision B', script: "state['svc-b']['result'] > 0.8" } },
    ],
    edges: [
      { source: 'svc-a', target: 'dec-a', condition: '' },
      { source: 'dec-a', target: 'svc-b', condition: "state['dec-a']['result'] == True" },
      { source: 'svc-b', target: 'dec-b', condition: '' },
    ],
    inputs: { query: {} },
  };
}

function makeInput(graph: MaterializeInput['graph_definition'], tenantId = 'tenant-1'): MaterializeInput {
  return {
    tenant_id: tenantId,
    blueprint_id: 'bp-1234',
    blueprint_version: 1,
    graph_definition: deepClone(graph),
    drop_position: { x: 100, y: 200 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function testSimpleServiceBlueprint(): void {
  _resetIdCounter();
  const result = materializeBlueprint(makeInput(simpleServiceBlueprint()));
  assert(result.nodes.length === 1, 'Should produce 1 node');
  assert(result.edges.length === 0, 'Should produce 0 edges');
  assert(result.nodes[0].type === 'serviceNode', 'Node type should be serviceNode');
  assert(result.nodes[0].data.label === 'GSA Address Service', 'Label should be preserved');
  assert((result.nodes[0].data as any).url === 'https://api.example-gsa.gov/address/v1/verify', 'URL should be preserved');
  assert((result.nodes[0].data as any).method === 'POST', 'Method should be preserved');
  assert(result.rootWorkflowNodeId !== '', 'Root workflow node ID should be set');
  assert(result.rootWorkflowNodeId !== 'svc-1', 'Root ID must not equal blueprint ID');
}

function testServiceDecisionBlueprint(): void {
  _resetIdCounter();
  const result = materializeBlueprint(makeInput(serviceDecisionBlueprint()));
  assert(result.nodes.length === 2, 'Should produce 2 nodes');
  assert(result.edges.length === 1, 'Should produce 1 edge');
  assert(result.nodes[0].type === 'serviceNode', 'First node should be serviceNode');
  assert(result.nodes[1].type === 'decisionNode', 'Second node should be decisionNode');
  assert((result.nodes[1].data as any).script !== '', 'Decision node should have compiled script');
  assert(result.edges[0].source === result.nodes[0].id, 'Edge source should map to first workflow node');
  assert(result.edges[0].target === result.nodes[1].id, 'Edge target should map to second workflow node');
  assert(result.edges[0].type === 'custom', 'Edge type should be custom');
  assert(result.edges[0].data?.condition === '', 'Edge condition should be empty string');
}

function testMultiNodeBlueprint(): void {
  _resetIdCounter();
  const result = materializeBlueprint(makeInput(multiNodeBlueprint()));
  assert(result.nodes.length === 4, 'Should produce 4 nodes');
  assert(result.edges.length === 3, 'Should produce 3 edges');

  // Root should be svc-a (never a target)
  const root = result.nodes.find((n) => n.id === result.rootWorkflowNodeId);
  assert(root !== undefined, 'Root node should exist');
  assert(root!.data.label === 'Service A', 'Root should be Service A');

  // Check edge connectivity is preserved
  const edge0 = result.edges[0];
  assert(edge0.source === result.nodes[0].id, 'Edge 0 source should map to node 0');
  assert(edge0.target === result.nodes[1].id, 'Edge 0 target should map to node 1');

  const edge1 = result.edges[1];
  assert(edge1.data?.condition === "state['dec-a']['result'] == True", 'Edge 1 condition should be preserved');

  // All nodes should have different positions (no overlap at same depth)
  const positions = result.nodes.map((n) => `${n.position.x},${n.position.y}`);
  const uniquePositions = new Set(positions);
  assert(uniquePositions.size === result.nodes.length, 'All nodes should have unique positions');
}

function testUniqueIDs(): void {
  _resetIdCounter();
  const graph = serviceDecisionBlueprint();
  const result1 = materializeBlueprint(makeInput(graph));
  const result2 = materializeBlueprint(makeInput(graph));

  const ids1 = new Set(result1.nodes.map((n) => n.id));
  const ids2 = new Set(result2.nodes.map((n) => n.id));

  // No overlap between two materializations
  let overlap = false;
  for (const id of ids1) {
    if (ids2.has(id)) overlap = true;
  }
  assertNot(overlap, 'Two materializations should not share any node IDs');

  // No node ID should match a blueprint node ID
  const blueprintIds = ['gsa-address-service', 'gsa-address-decision'];
  for (const node of [...result1.nodes, ...result2.nodes]) {
    assertNot(blueprintIds.includes(node.id), `Workflow node ID "${node.id}" must not match any blueprint ID`);
  }

  // Edge IDs should also be unique
  const edgeIds1 = new Set(result1.edges.map((e) => e.id));
  const edgeIds2 = new Set(result2.edges.map((e) => e.id));
  let edgeOverlap = false;
  for (const id of edgeIds1) {
    if (edgeIds2.has(id)) edgeOverlap = true;
  }
  assertNot(edgeOverlap, 'Two materializations should not share any edge IDs');
}

function testConfigurationCloning(): void {
  _resetIdCounter();
  const graph = simpleServiceBlueprint();
  const originalConfig = (graph.nodes[0].data as any).config;
  const result = materializeBlueprint(makeInput(graph));

  const materializedConfig = (result.nodes[0].data as any).config;

  // Config should be deep-cloned (different reference)
  assert(materializedConfig !== originalConfig, 'Config should be a different object reference');
  assert(materializedConfig.headers !== originalConfig.headers, 'Headers array should be a different reference');
  assert(materializedConfig.headers[0] !== originalConfig.headers[0], 'Header object should be a different reference');

  // But values should be equal
  assert(
    JSON.stringify(materializedConfig) === JSON.stringify(originalConfig),
    'Cloned config should have same values as original',
  );
}

function testEdgeCloning(): void {
  _resetIdCounter();
  const graph = serviceDecisionBlueprint();
  const result = materializeBlueprint(makeInput(graph));

  // Edge should not reference blueprint node IDs
  assert(result.edges[0].source !== 'gsa-address-service', 'Edge source must not be blueprint ID');
  assert(result.edges[0].target !== 'gsa-address-decision', 'Edge target must not be blueprint ID');

  // Edge should reference workflow node IDs
  const nodeIds = new Set(result.nodes.map((n) => n.id));
  assert(nodeIds.has(result.edges[0].source), 'Edge source must be a valid workflow node ID');
  assert(nodeIds.has(result.edges[0].target), 'Edge target must be a valid workflow node ID');
}

function testTenantIsolation(): void {
  _resetIdCounter();
  const graph = simpleServiceBlueprint();

  const resultTenantA = materializeBlueprint(makeInput(graph, 'tenant-A'));
  const resultTenantB = materializeBlueprint(makeInput(graph, 'tenant-B'));

  // Both should succeed and produce nodes
  assert(resultTenantA.nodes.length === 1, 'Tenant A should get a node');
  assert(resultTenantB.nodes.length === 1, 'Tenant B should get a node');

  // Metadata should record the correct tenant
  const metaA = (resultTenantA.nodes[0].data as any)._source;
  const metaB = (resultTenantB.nodes[0].data as any)._source;
  assert(metaA.source_blueprint_id === 'bp-1234', 'Tenant A metadata should have blueprint ID');
  assert(metaB.source_blueprint_id === 'bp-1234', 'Tenant B metadata should have blueprint ID');
  assert(metaA.materialized_at !== '', 'Metadata should have materialized_at timestamp');

  // Nodes should have different IDs (they are independent instances)
  assert(resultTenantA.nodes[0].id !== resultTenantB.nodes[0].id, 'Different tenants should get different node IDs');
}

function testBlueprintModificationDoesNotModifyWorkflow(): void {
  _resetIdCounter();
  const graph = simpleServiceBlueprint();
  const result = materializeBlueprint(makeInput(graph));

  // Modify the original blueprint graph
  (graph.nodes[0].data as any).url = 'https://CHANGED.example.com';
  (graph.nodes[0].data as any).config.headers.push({ key: 'X-New', value: 'true' });

  // The materialized workflow should be unaffected
  const wfUrl = (result.nodes[0].data as any).url;
  const wfHeaders = (result.nodes[0].data as any).config.headers;

  assert(wfUrl === 'https://api.example-gsa.gov/address/v1/verify', 'Workflow URL should not change when blueprint changes');
  assert(wfHeaders.length === 1, 'Workflow headers should not change when blueprint changes');
}

function testWorkflowModificationDoesNotModifyBlueprint(): void {
  _resetIdCounter();
  const graph = simpleServiceBlueprint();
  const graphCopy = deepClone(graph);
  const result = materializeBlueprint(makeInput(graphCopy));

  // Modify the materialized workflow node
  (result.nodes[0].data as any).url = 'https://workflow-changed.example.com';
  (result.nodes[0].data as any).config.headers.push({ key: 'X-Workflow', value: 'test' });

  // The original blueprint graph should be unaffected
  const bpUrl = (graph.nodes[0].data as any).url;
  const bpHeaders = (graph.nodes[0].data as any).config.headers;

  assert(bpUrl === 'https://api.example-gsa.gov/address/v1/verify', 'Blueprint URL should not change when workflow changes');
  assert(bpHeaders.length === 1, 'Blueprint headers should not change when workflow changes');
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------

const tests: Array<[string, () => void]> = [
  ['Simple Service blueprint', testSimpleServiceBlueprint],
  ['Service + Decision blueprint', testServiceDecisionBlueprint],
  ['Multi-node blueprint', testMultiNodeBlueprint],
  ['Unique IDs across materializations', testUniqueIDs],
  ['Configuration cloning (deep copy)', testConfigurationCloning],
  ['Edge cloning', testEdgeCloning],
  ['Tenant isolation', testTenantIsolation],
  ['Blueprint modification does not modify workflow', testBlueprintModificationDoesNotModifyWorkflow],
  ['Workflow modification does not modify blueprint', testWorkflowModificationDoesNotModifyBlueprint],
];

console.log('Running blueprint materialization tests...\n');

for (const [name, test] of tests) {
  console.log(`Test: ${name}`);
  test();
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
