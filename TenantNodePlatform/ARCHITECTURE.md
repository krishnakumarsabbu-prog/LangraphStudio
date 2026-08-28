# Tenant Node Platform — Architecture

> **Status:** Design document only. No implementation yet.
> **Date:** 2026-08-28

---

## 1. Purpose

The **Tenant Node Platform** (TNP) is a "prequel" layer that sits *in front of* the existing LangGraph workflow builder. It lets a platform operator define **Node Blueprints** and **Blueprint Graphs** scoped to a **Tenant**, apply **Business Rules**, and then **materialize** those blueprints into normal LangGraph workflows that the existing canvas can open, edit, and execute without modification.

The existing LangGraph application is untouched. The TNP integrates through clean adapter interfaces — it produces the same graph JSON the existing canvas already consumes.

---

## 2. Existing LangGraph Boundaries

Inspection of the current codebase reveals the following components and their responsibilities:

### 2.1 Frontend (React + React Flow)

| Concern | File(s) | Notes |
|---|---|---|
| App entry / routing | `src/App.tsx` | Routes: `/langgraph` (dashboard), `/langgraph/builder/:workflowId` (canvas) |
| Canvas / React Flow | `src/components/LangGraph/LangGraphBuilder.tsx` | Drag-drop node palette, `ReactFlow` instance, drop handler reads `application/reactflow` dataTransfer key, calls `addXxxNode(position)` from the store |
| Node type registry | `nodeTypes` map in `LangGraphBuilder.tsx` | `serviceNode`, `decisionNode`, `llmNode`, `formNode`, `workflowNode`, `parallelNode`, `mergeNode`, `mapperNode` |
| Zustand store | `src/stores/langGraphStore.ts` | Holds `nodes`, `edges`, `inputs`; provides `addXxxNode`, `exportJSON`, `importJSON`, `updateNodeData`, `updateEdgeCondition` |
| Service layer | `src/services/langGraphService.ts` | Axios calls to `http://localhost:8000/api/flows` — CRUD for workflows |
| Individual node components | `src/components/LangGraph/*Node.tsx` | Visual rendering per node type |

### 2.2 Graph JSON Structure

The store's `exportJSON()` produces:

```json
{
  "graph": {
    "nodes": [
      { "id": "service-1", "type": "service", "data": { "label": "...", "url": "...", "method": "POST", ... } }
    ],
    "edges": [
      { "source": "service-1", "target": "decision-1", "condition": "state['x'] == 'y'" }
    ],
    "inputs": { "message": {} }
  }
}
```

Node `type` values in exported JSON: `service`, `decision`, `form`, `workflow`, `llm`, `parallel`, `merge`, `mapper`.

The store's `importJSON()` accepts the same shape (or a bare `{ nodes, edges, inputs }` object) and reconstructs React Flow nodes/edges with auto-generated positions.

### 2.3 Backend (Python / FastAPI)

| Concern | File | Notes |
|---|---|---|
| FastAPI app | `backend/langraph.py` (imports `db`) | Graph builder + node factories |
| Graph builder | `build_graph_from_json()` in `langraph.py` | Reads graph JSON, creates `StateGraph`, registers nodes via `NODE_FACTORY`, adds edges / conditional edges / parallel fan-out |
| Node factory | `NODE_FACTORY` dict in `langraph.py` | Maps `service` → `make_service_node`, `decision` → `make_decision_node`, `form` → `make_form_node`, `workflow` → `make_subworkflow_node`, `mapper` → `make_mapper_node`; parallel/merge handled separately |
| Persistence | `db` module (imported, not in repo) | `save_workflow_execution`, `save_node_execution`, `get_latest_flow`, etc. |
| API surface | `/api/flows` (GET list, GET by name, POST create/update) | Called by `langGraphService.ts` |

### 2.4 Execution Flow

1. Frontend calls `exportJSON()` → graph JSON string.
2. `WorkflowExecuteModal` / `WorkflowExecutionWithForms` sends graph JSON + input to backend.
3. Backend calls `build_graph_from_json(graph_json, execution_id)` → compiled LangGraph `StateGraph`.
4. `graph.invoke(input_state)` executes the workflow.
5. Node results saved via `save_node_execution`, workflow status via `save_workflow_execution`.

### 2.5 Save / Load Mechanism

- **Save:** Frontend `langGraphService.createWorkflow(name, context, graphData)` → `POST /api/flows` with `{ name, data, context }`.
- **Load:** `langGraphService.getWorkflowByName(name)` → `GET /api/flows/:name` → returns `{ name, version, data, context }`.
- **Dashboard:** `LangGraphDashboard` lists all workflows from `GET /api/flows`.

### 2.6 What We Must NOT Change

- `LangGraphBuilder.tsx` — the canvas, node palette, drop handler, config panel.
- `langGraphStore.ts` — the Zustand store, node/edge model, `exportJSON`/`importJSON`.
- `langraph.py` — the graph builder, node factories, execution engine.
- `langGraphService.ts` — the existing API client.
- All `*Node.tsx` and `*Modal.tsx` components.
- The `/api/flows` FastAPI endpoints.

---

## 3. New TenantNodePlatform Boundaries

The TNP lives entirely in a new top-level folder:

```
TenantNodePlatform/
  ARCHITECTURE.md          ← this file
  backend/                 ← Python FastAPI service (new, separate port or router)
    main.py                ← FastAPI app
    models.py              ← Pydantic models
    repository.py          ← In-memory repository abstraction
    routers/
      tenants.py
      blueprints.py
      rules.py
      materialize.py
    services/
      materializer.py      ← Blueprint → LangGraph graph JSON
  frontend/               ← React components (new, mounted alongside existing)
    components/
      TenantDashboard.tsx
      BlueprintEditor.tsx
      BlueprintPalette.tsx     ← draggable blueprint items
      BusinessRuleEditor.tsx
    services/
      tnpService.ts        ← Axios client for TNP backend
    stores/
      tnpStore.ts          ← Zustand store for TNP state
    adapters/
      canvasAdapter.ts     ← Converts blueprint → graph JSON the canvas accepts
```

### 3.1 What the TNP Owns

- Tenant CRUD.
- Node Blueprint definitions (reusable, pre-configured node templates).
- Blueprint Graph definitions (multi-node sub-graphs with internal wiring).
- Blueprint dependencies (blueprints that reference other blueprints).
- Blueprint versioning.
- Business Rules (conditions that modify blueprint behavior at materialization time).
- Workflow materialization (blueprint + rules → standard LangGraph graph JSON).
- In-memory repository for all of the above, scoped by `tenant_id`.

### 3.2 What the TNP Does NOT Own

- The React Flow canvas (owned by `LangGraphBuilder`).
- Graph execution (owned by `langraph.py`).
- Workflow persistence (owned by `/api/flows`).
- Node rendering (owned by `*Node.tsx` components).

---

## 4. Tenant Model

```
Tenant
  tenant_id    : str   (UUID or slug, immutable)
  name         : str
  metadata     : dict
  created_at   : datetime
  status       : "active" | "suspended"
```

All other TNP entities are scoped to a `tenant_id`. The repository enforces isolation: no cross-tenant reads or writes. A `X-Tenant-ID` header on every TNP API request selects the tenant context.

---

## 5. Node Blueprint Model

A **Node Blueprint** is a pre-configured, reusable single-node template. It captures everything needed to create a fully configured node on the canvas without manual setup.

```
NodeBlueprint
  blueprint_id      : str   (UUID)
  tenant_id         : str
  name              : str   (unique within tenant)
  description       : str
  node_type         : str   ("service" | "decision" | "form" | "workflow" | "llm" | "mapper")
  node_data         : dict  ← the `data` object that the store's addXxxNode would set
                              (url, method, config, script, formConfig, etc.)
  tags              : list[str]
  version           : int
  created_at        : datetime
  updated_at        : datetime
```

`node_data` is structurally identical to the `data` field on a node in the existing graph JSON. This means a blueprint can be materialized by creating a node `{ id: <generated>, type: <node_type>, data: <node_data> }` — the exact shape `importJSON` expects.

---

## 6. Blueprint Graph Model

A **Blueprint Graph** is a reusable multi-node sub-graph — a wired set of nodes and edges that can be dropped onto the canvas as a unit.

```
BlueprintGraph
  graph_id          : str   (UUID)
  tenant_id         : str
  name              : str   (unique within tenant)
  description       : str
  nodes             : list[BlueprintGraphNode]   ← ordered
  edges             : list[BlueprintGraphEdge]
  inputs            : dict  (default input state)
  tags              : list[str]
  version           : int
  created_at        : datetime
  updated_at        : datetime

BlueprintGraphNode
  ref               : str   (local id within the graph, e.g. "n1")
  blueprint_id      : str | null   (if set, pulls node_data from the referenced NodeBlueprint)
  node_type         : str          (required if blueprint_id is null)
  node_data         : dict | null   (required if blueprint_id is null; overrides blueprint if both set)
  position_offset   : { x, y }      (relative to drop point)

BlueprintGraphEdge
  source            : str   (matches a BlueprintGraphNode.ref)
  target            : str
  condition         : str   (edge condition expression, same format as existing)
```

---

## 7. Blueprint Dependency Model

Blueprints can depend on other blueprints, forming a DAG. This allows composition (a graph blueprint that embeds node blueprints, or a graph blueprint that includes another graph blueprint as a sub-workflow node).

```
BlueprintDependency
  dependent_id       : str   (blueprint or graph that depends)
  dependency_id      : str   (blueprint or graph it depends on)
  dependency_type   : "node_blueprint" | "graph_blueprint"
  tenant_id         : str
```

Rules:
- Dependencies are resolved at materialization time, not at definition time.
- Circular dependencies are rejected on save.
- A missing dependency (deleted) causes materialization to fail with a clear error.
- If a referenced NodeBlueprint has its own version, the dependency can pin a version or float to latest.

---

## 8. Blueprint Versioning

Every blueprint and graph blueprint carries a monotonically increasing `version` integer.

- Creating a blueprint → version 1.
- Updating a blueprint → new version (old version remains retrievable).
- Materialization can pin a specific version or use latest.
- The in-memory repository stores all versions; a `current` pointer marks the active one.

```
BlueprintVersion
  blueprint_id      : str
  version           : int
  snapshot          : dict   (full blueprint state at this version)
  created_at        : datetime
  created_by        : str
```

---

## 9. Workflow Materialization Model

**Materialization** is the process of converting a Blueprint Graph (+ Business Rules) into a standard LangGraph graph JSON object that the existing canvas can `importJSON()` and the backend can `build_graph_from_json()`.

```
MaterializationRequest
  tenant_id         : str
  graph_id          : str   (which BlueprintGraph to materialize)
  graph_version     : int | "latest"
  rule_ids          : list[str]   (Business Rules to apply, in order)
  position          : { x, y }    (canvas drop coordinates)
  id_prefix         : str        (to avoid id collisions when multiple instances are dropped)

MaterializationResult
  graph_json        : dict   ← the { graph: { nodes, edges, inputs } } object
  materialization_id : str
  applied_rules     : list[str]
  warnings          : list[str]
```

### Materialization Algorithm

1. Load the BlueprintGraph at the requested version.
2. Resolve all NodeBlueprint references → fill in `node_data` for each node.
3. Check dependencies; fail if any are missing.
4. Apply Business Rules (see §10) — rules may add/remove/modify nodes, edges, or node_data.
5. Generate concrete node IDs using `id_prefix` + ref (e.g., `bp1-n1`, `bp1-n2`) to avoid collisions with existing canvas nodes.
6. Compute absolute positions from `position` + `position_offset`.
7. Assemble the final `{ nodes, edges, inputs }` object in the exact format the store's `importJSON` expects.
8. Return the graph JSON to the frontend.

---

## 10. Business Rule Model

Business Rules are tenant-scoped conditions that transform a blueprint during materialization. They are the "prequel" logic layer — rules that fire *before* the graph hits the canvas.

```
BusinessRule
  rule_id           : str   (UUID)
  tenant_id         : str
  name              : str
  description       : str
  priority          : int   (lower = applied first)
  enabled           : bool

  condition         : str   (expression evaluated against materialization context)
  action            : RuleAction

RuleAction
  type              : "set_node_data" | "add_node" | "remove_node" | "add_edge" | "remove_edge" | "set_input"
  target            : str   (node ref, edge ref, or input key)
  path             : str   (dotted path into node_data, for set_node_data)
  value            : any   (the value to set)
```

### Rule Evaluation

- Rules are evaluated in priority order.
- The `condition` expression has access to a context object: `{ tenant, blueprint_graph, nodes, edges, inputs }`.
- Conditions use the same `simple_eval` engine the existing decision node uses (consistency with the existing codebase).
- A rule whose condition evaluates true applies its action to the in-progress graph.
- Actions are applied to a mutable copy of the graph; the original blueprint is never modified.

---

## 11. In-Memory Repository

The repository is a Python abstraction with dict-backed storage. All data is lost on restart — intentional for this phase.

```
Repository (Protocol / ABC)
  # Tenant
  create_tenant(tenant) -> Tenant
  get_tenant(tenant_id) -> Tenant | None
  list_tenants() -> list[Tenant]

  # Node Blueprints
  create_blueprint(bp) -> NodeBlueprint
  get_blueprint(tenant_id, bp_id, version="latest") -> NodeBlueprint | None
  list_blueprints(tenant_id) -> list[NodeBlueprint]
  update_blueprint(tenant_id, bp_id, updates) -> NodeBlueprint
  delete_blueprint(tenant_id, bp_id) -> None

  # Graph Blueprints
  create_graph_blueprint(gb) -> BlueprintGraph
  get_graph_blueprint(tenant_id, graph_id, version="latest") -> BlueprintGraph | None
  list_graph_blueprints(tenant_id) -> list[BlueprintGraph]
  update_graph_blueprint(tenant_id, graph_id, updates) -> BlueprintGraph
  delete_graph_blueprint(tenant_id, graph_id) -> None

  # Dependencies
  add_dependency(dep) -> None
  get_dependencies(tenant_id, blueprint_id) -> list[BlueprintDependency]
  check_circular(tenant_id, dependent_id, dependency_id) -> bool

  # Business Rules
  create_rule(rule) -> BusinessRule
  get_rule(tenant_id, rule_id) -> BusinessRule | None
  list_rules(tenant_id) -> list[BusinessRule]
  update_rule(tenant_id, rule_id, updates) -> BusinessRule
  delete_rule(tenant_id, rule_id) -> None

  # Materialization log (optional, for audit)
  log_materialization(tenant_id, result) -> None
```

### Design Constraints

- Every method takes `tenant_id`; data is partitioned by tenant. No method can read or write another tenant's data.
- The concrete implementation is `InMemoryRepository` using nested dicts: `{ tenant_id: { blueprints: {}, graphs: {}, rules: {}, deps: [] } }`.
- A future `PostgresRepository` or `SupabaseRepository` can implement the same interface without changing business logic — this is the seam for future persistence.

---

## 12. API Boundaries

The TNP backend is a **separate FastAPI app** (or a separate router mounted on the same app at `/api/tnp/*`). It does NOT touch `/api/flows`.

### 12.1 Tenant Endpoints

```
POST   /api/tnp/tenants                    → create tenant
GET    /api/tnp/tenants                    → list tenants
GET    /api/tnp/tenants/{tenant_id}         → get tenant
PATCH  /api/tnp/tenants/{tenant_id}         → update tenant
DELETE /api/tnp/tenants/{tenant_id}         → delete tenant
```

### 12.2 Node Blueprint Endpoints

```
POST   /api/tnp/blueprints                  → create blueprint       (X-Tenant-ID header)
GET    /api/tnp/blueprints                  → list blueprints        (X-Tenant-ID header)
GET    /api/tnp/blueprints/{bp_id}          → get blueprint          (?version=latest)
PATCH  /api/tnp/blueprints/{bp_id}          → update blueprint       (creates new version)
DELETE /api/tnp/blueprints/{bp_id}          → delete blueprint
GET    /api/tnp/blueprints/{bp_id}/versions → list versions
```

### 12.3 Graph Blueprint Endpoints

```
POST   /api/tnp/graph-blueprints            → create graph blueprint
GET    /api/tnp/graph-blueprints            → list graph blueprints
GET    /api/tnp/graph-blueprints/{graph_id} → get graph blueprint    (?version=latest)
PATCH  /api/tnp/graph-blueprints/{graph_id} → update graph blueprint
DELETE /api/tnp/graph-blueprints/{graph_id} → delete graph blueprint
GET    /api/tnp/graph-blueprints/{graph_id}/dependencies → list deps
```

### 12.4 Business Rule Endpoints

```
POST   /api/tnp/rules                       → create rule
GET    /api/tnp/rules                       → list rules
GET    /api/tnp/rules/{rule_id}             → get rule
PATCH  /api/tnp/rules/{rule_id}             → update rule
DELETE /api/tnp/rules/{rule_id}             → delete rule
```

### 12.5 Materialization Endpoint

```
POST   /api/tnp/materialize                 → materialize a graph blueprint
  Request:  { graph_id, graph_version, rule_ids, position, id_prefix }
  Response: { graph_json, materialization_id, applied_rules, warnings }
```

All endpoints except tenant CRUD require an `X-Tenant-ID` header.

---

## 13. Integration Strategy with Existing LangGraph Canvas

The TNP integrates with the existing canvas through **two clean seams** — no existing files are modified:

### Seam 1: Graph JSON Format Compatibility

The TNP materializer outputs graph JSON in the exact format the store's `importJSON()` accepts:

```json
{
  "graph": {
    "nodes": [ { "id": "...", "type": "service", "data": {...} } ],
    "edges": [ { "source": "...", "target": "...", "condition": "..." } ],
    "inputs": { ... }
  }
}
```

This means any materialized blueprint can be loaded into the canvas by calling the existing `importJSON()` method — the same method the "Load JSON" button already uses.

### Seam 2: Drag-and-Drop Palette Extension

The existing `LangGraphBuilder.tsx` has a drag palette with draggable items that set `application/reactflow` as the dataTransfer key and a node type string as the value. The drop handler reads this and calls `addXxxNode(position)`.

The TNP adds a **new palette panel** (a separate React component, not modifying the existing one) that renders draggable blueprint items. When a user drags a blueprint onto the canvas:

1. The TNP palette item sets a **custom dataTransfer key**: `application/tnp-blueprint` with the blueprint/graph ID as the value.
2. A **new drop overlay** (TNP-owned, mounted as a sibling to the canvas, listening to the same drop target) intercepts drops with the `application/tnp-blueprint` key.
3. The overlay calls `POST /api/tnp/materialize` with the blueprint ID and drop position.
4. The backend returns graph JSON.
5. The overlay calls the existing store's `importJSON()` to merge the materialized nodes/edges into the current canvas.

This approach requires **zero changes** to `LangGraphBuilder.tsx`, `langGraphStore.ts`, or any existing component. The TNP drop overlay is an additive layer.

> **Alternative (if overlay approach has z-index/event issues):** The TNP can expose a "Blueprint Browser" modal accessible from a new button in the `Layout/Sidebar.tsx` (also additive, not modifying existing items). The user selects a blueprint, clicks "Add to Canvas," and the same `importJSON` merge happens. This is the fallback if drag-drop coexistence proves fragile.

### What the TNP Does NOT Modify

- `LangGraphBuilder.tsx` — not touched.
- `langGraphStore.ts` — not touched (TNP calls `importJSON` from the outside).
- `langraph.py` — not touched (materialized graphs are standard graph JSON).
- `langGraphService.ts` — not touched (TNP has its own `tnpService.ts`).
- Any `*Node.tsx` or `*Modal.tsx` — not touched.

---

## 14. How a Blueprint Becomes a Normal LangGraph Graph

End-to-end flow when a user drags a Blueprint Graph onto the canvas:

```
User drags "Customer Onboarding" blueprint from TNP palette
  ↓
TNP drop overlay intercepts (dataTransfer key = "application/tnp-blueprint")
  ↓
Overlay calls POST /api/tnp/materialize
  { graph_id: "graph-uuid", position: { x: 300, y: 200 }, id_prefix: "cob1" }
  ↓
TNP backend:
  1. Load BlueprintGraph (latest version)
  2. For each node, resolve NodeBlueprint references → fill node_data
  3. Check dependencies → all present? proceed
  4. Apply Business Rules (priority order) → modify nodes/edges/inputs
  5. Generate concrete IDs: "cob1-n1", "cob1-n2", ...
  6. Compute positions: drop_point + position_offset
  7. Assemble { graph: { nodes, edges, inputs } }
  ↓
Return graph JSON to frontend
  ↓
Overlay calls existing store.importJSON(JSON.stringify(result))
  ↓
Existing importJSON merges nodes + edges into the canvas
  ↓
User sees the materialized nodes on the canvas — fully editable,
  fully executable, indistinguishable from hand-built nodes
  ↓
User clicks Save → existing langGraphService.createWorkflow()
  → POST /api/flows → stored in existing backend
  → can be executed by existing build_graph_from_json()
```

The materialized graph is **not** a special type. It is a normal LangGraph graph. The TNP's job ends at materialization. After that, the existing application owns it completely.

---

## 15. Summary

| Aspect | Decision |
|---|---|
| Existing code changes | **None.** TNP integrates through graph JSON format + additive UI overlay. |
| Backend | New FastAPI app under `TenantNodePlatform/backend/`, separate from existing `backend/`. |
| Database | In-memory repository abstraction. No Supabase, no external DB. Data lost on restart. |
| Tenant isolation | `tenant_id` on every entity; `X-Tenant-ID` header on every request; repository enforces partition. |
| Blueprint → Canvas | Materialization produces standard graph JSON → existing `importJSON()` → normal nodes. |
| Business Rules | Evaluated at materialization time using existing `simple_eval` engine for consistency. |
| Versioning | Monotonic integer versions; materialization can pin or float. |
| Dependencies | DAG with cycle detection; resolved at materialization time. |
