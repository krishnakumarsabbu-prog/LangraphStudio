# Multi-Tenant Workflow Platform — Implementation Status & Detailed Plan

> **Purpose**: This document audits the current codebase against the intended architecture, flags what is already implemented, what is partially implemented, and what is still missing. It is written so another engineering team (or AI coding platform) can pick it up and execute.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current Tech Stack](#2-current-tech-stack)
3. [Implementation Status Summary](#3-implementation-status-summary)
4. [Detailed Audit by Area](#4-detailed-audit-by-area)
   - 4.1 [LangGraph Studio / Canvas — Node Types](#41-langgraph-studio--canvas--node-types)
   - 4.2 [Framework / Super Admin View](#42-framework--super-admin-view)
   - 4.3 [Tenant View](#43-tenant-view)
   - 4.4 [Auth & Role-Based Access Control](#44-auth--role-based-access-control)
   - 4.5 [Node Library (Tenant Admin)](#45-node-library-tenant-admin)
   - 4.6 [Backend API](#46-backend-api)
   - 4.7 [Database / Persistence](#47-database--persistence)
   - 4.8 [Rule Engine](#48-rule-engine)
5. [What Is Already Implemented (Complete)](#5-what-is-already-implemented-complete)
6. [What Is Partially Implemented (Needs Completion)](#6-what-is-partially-implemented-needs-completion)
7. [What Is Missing (Must Build)](#7-what-is-missing-must-build)
8. [Security Concerns](#8-security-concerns)
9. [Recommended Implementation Order](#9-recommended-implementation-order)
10. [Migration Strategy: In-Memory → Supabase](#10-migration-strategy-in-memory--supabase)

---

## 1. Architecture Overview

The platform converts an existing **LangGraph Studio** (a visual workflow builder) into a **multi-tenant product-as-a-service** with two primary surfaces:

```
┌─────────────────────────────────────────────────────┐
│                   FRAMEWORK (Super Admin)             │
│  • Impersonate any tenant                             │
│  • Introduce new framework nodes (available to all)   │
│  • Create tenants & share details                     │
│  • Control which nodes each tenant can access         │
│  • Full platform permissions                          │
└──────────────────────┬──────────────────────────────┘
                         │ creates tenant + admin user
                         ▼
┌─────────────────────────────────────────────────────┐
│                    TENANT VIEW                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  TENANT ADMIN                                     │  │
│  │  • Add users, assign roles & permissions          │  │
│  │  • Node Library tab: create defined nodes         │  │
│  │    from framework nodes (e.g. service node →      │  │
│  │    "ECPR Validate User" node)                     │  │
│  │  • Import Postman collections → auto-create nodes │  │
│  │  • Create decision nodes from service responses   │  │
│  │  • Full control within their tenant               │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │  TENANT USER                                      │  │
│  │  • No access to Node Library                      │  │
│  │  • View Workflow Dashboard (existing workflows)   │  │
│  │  • Create new workflow → canvas with framework     │  │
│  │    nodes + tenant nodes                            │  │
│  │  • Drag, drop, connect, configure, run             │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Node Types (8 framework nodes)

| # | Node Type | Purpose |
|---|-----------|---------|
| 1 | **Service Node** | Call an external REST API |
| 2 | **Decision Node** | Evaluate rules to determine next node |
| 3 | **LLM Node** | Call a language model with a prompt |
| 4 | **Form Node** | Render a form for user input |
| 5 | **Parallel Node** | Fan out to multiple branches simultaneously |
| 6 | **Merge Node** | Fan in / merge results from parallel branches |
| 7 | **Mapper Node** | Transform/map data between nodes |
| 8 | **Workflow Node** | Embed/reference another workflow as a subgraph |

---

## 2. Current Tech Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | React 18 + TypeScript + Vite | ✅ Working |
| Canvas | React Flow (`react-flow-renderer`) | ✅ Working |
| State | Zustand (stores for auth, LangGraph, TNP) | ✅ Working |
| Styling | Tailwind CSS + Radix UI primitives | ✅ Working |
| Backend | Python FastAPI (`backend/TenantNodePlatform/`) | ✅ Working (in-memory) |
| API Client | Axios (`tnpService.ts`) | ✅ Working |
| Auth | Fake JWT (unsigned, no password check) | ⚠️ Stub |
| Database | **None** — 100% in-memory Python dicts | ❌ Missing |
| Supabase | Client file exists but unused (dead code) | ❌ Not wired |

---

## 3. Implementation Status Summary

| Area | Status | Completeness |
|------|--------|-------------|
| Canvas — 8 node components render | ✅ Done | 100% |
| Canvas — 5 of 8 have config modals | ⚠️ Partial | 62% |
| Canvas — node execution (real HTTP calls) | ❌ Missing | 0% |
| Framework Dashboard | ✅ Done | 100% |
| Tenant Management (CRUD) | ✅ Done | 95% |
| Per-tenant node access control | ✅ Done | 100% |
| Impersonation | ⚠️ Partial | 70% |
| Super Admin — introduce new framework nodes | ❌ Missing | 0% |
| Tenant Login | ✅ Done | 100% |
| Role-based auth (client-side) | ✅ Done | 100% |
| Role-based auth (server-side enforcement) | ❌ Missing | 0% |
| Node Library (tenant admin) | ✅ Done | 100% |
| Postman import → auto-create nodes | ✅ Done | 100% |
| Decision node creation from responses | ✅ Done | 100% |
| Blueprint authoring wizard | ✅ Done | 100% |
| Visual rule builder | ✅ Done | 100% |
| Blueprint versioning | ✅ Done | 100% |
| Blueprint materialization (drag to canvas) | ✅ Done | 100% |
| Workflow dashboard (tenant) | ✅ Done | 100% |
| User management (tenant admin) | ✅ Done | 100% |
| Audit logging | ✅ Done | 90% |
| Backend API — all endpoints | ✅ Done | 100% |
| Database / persistence | ❌ Missing | 0% |
| Real auth (password hashing, signed JWT) | ❌ Missing | 0% |
| Real workflow execution engine | ❌ Missing | 0% |
| LLM node config modal | ❌ Missing | 0% |
| Parallel node config + execution | ❌ Missing | 0% |
| Merge node config + execution | ❌ Missing | 0% |

---

## 4. Detailed Audit by Area

### 4.1 LangGraph Studio / Canvas — Node Types

**Main file**: `src/components/LangGraph/LangGraphBuilder.tsx` (~1712 lines)
**Store**: `src/stores/langGraphStore.ts`
**Service**: `src/services/langGraphService.ts`

All 8 node types are registered in the `nodeTypes` map and all 8 `add*Node` actions exist in the store. The canvas supports drag-and-drop, node selection, edge creation, deletion, and a top toolbar.

#### Per-Node Status

| Node | Component | Config Modal | Execution | Details |
|------|-----------|-------------|-----------|---------|
| **Service** | `ServiceNode.tsx` ✅ | `ServiceConfigModal.tsx` ✅ | ⚠️ Simulated | Config: URL, method, headers, body. `handleRun` sets status to `'running'` but **does not make a real HTTP call**. |
| **Decision** | `DecisionNode.tsx` ✅ | `DecisionConfigModal.tsx` ✅ | ⚠️ Simulated | Config: rule conditions, outcomes. `handleRun` sets status but **does not evaluate rules**. |
| **LLM** | `LLMNode.tsx` ✅ | ❌ **Missing** | ⚠️ Simulated | Node has `model` and `prompt` props but **no config modal exists** — users cannot edit the model or prompt. No `LLMConfigModal.tsx` file found anywhere. |
| **Form** | `FormNode.tsx` ✅ | `FormBuilderModal.tsx` ✅ | ⚠️ Simulated | Config: form schema builder + live preview (`FormPreviewModal.tsx`). Execution: sets status only. |
| **Parallel** | `ParallelNode.tsx` ✅ | ❌ **Missing** | ❌ **No execution** | Raw React Flow node — does NOT use `CompactNodeDisplay`, has no `onRun`, no `onConfig`, no store interaction. Purely a visual fan-out shape. |
| **Merge** | `MergeNode.tsx` ✅ | ❌ **Missing** | ❌ **No execution** | Same as Parallel — raw visual node, no config, no execution logic. |
| **Mapper** | `MapperNode.tsx` ✅ | `ObjectMapperModal.tsx` ✅ | ⚠️ Simulated | Config: output format, sample response, template. Execution: status flip only. |
| **Workflow** | `WorkflowNode.tsx` ✅ | `WorkflowConfigModal.tsx` ✅ | ⚠️ Simulated | Config: reference another workflow by name. Loads available workflows from backend. Execution: status flip only. |

#### Additional Canvas Features

| Feature | File | Status |
|---------|------|--------|
| Node Config Panel | `NodeConfigPanel.tsx` ✅ | Works — shows selected node's properties |
| State Context Panel | `StateContextPanel.tsx` ✅ | Works — shows workflow state |
| Custom Edge | `CustomEdge.tsx` ✅ | Works — styled edges with labels |
| Compact Node Display | `CompactNodeDisplay.tsx` ✅ | Shared wrapper used by 6 of 8 nodes |
| Workflow Execute Modal | `WorkflowExecuteModal.tsx` ✅ | Exists — triggers "execution" (simulated) |
| Workflow Execution with Forms | `WorkflowExecutionWithForms.tsx` ✅ | Exists — form interaction during execution |
| What-If Scenario Studio | `WhatIfScenarioStudio.tsx` ✅ | Exists — scenario testing |
| Programmatic Generator | `ProgrammaticGeneratorModal.tsx` ✅ | Exists — import JSON graph definitions |
| Workflow View Modal | `WorkflowViewModal.tsx` ✅ | Exists — view workflow details |
| Blueprint Materialization | `blueprintMaterializationService.ts` ✅ | **Fully implemented** — drag a published blueprint onto canvas → expands into nodes with prefixed IDs |

#### Gaps in Canvas

1. **LLM Node has no config modal** — cannot edit model name, temperature, system prompt, or user prompt. Need to create `LLMConfigModal.tsx`.
2. **Parallel Node has no config and no execution** — need config modal (branch count, wait strategy) and execution logic (fan-out + fan-in).
3. **Merge Node has no config and no execution** — need config modal (merge strategy: first-wins, all, concat) and execution logic.
4. **No node truly executes** — every `handleRun` function only sets `status: 'running'` and logs a message. Need a real execution engine that:
   - Service Node: makes an actual HTTP call to the configured URL
   - Decision Node: evaluates the configured rules against incoming data
   - LLM Node: calls an actual LLM API (OpenAI, Anthropic, etc.)
   - Form Node: renders the form and waits for user input
   - Parallel Node: spawns concurrent branches
   - Merge Node: collects results from parallel branches
   - Mapper Node: transforms data per the configured template
   - Workflow Node: triggers the referenced sub-workflow

---

### 4.2 Framework / Super Admin View

**Files**: `src/framework/`

| File | Lines | Status | What It Does |
|------|-------|--------|-------------|
| `FrameworkDashboard.tsx` | ~385 | ✅ Complete | Platform overview: 8 stat cards (tenants, users, workflows, blueprints, executions, framework nodes, active/suspended tenants), recent tenants list, recent audit events, quick-action navigation cards. Fetches `getPlatformStats()` from backend. |
| `FrameworkNodeLibrary.tsx` | ~309 | ✅ Complete | Lists all 8 framework nodes grouped by category with search. **Per-tenant node access configurator**: click a tenant → modal with toggle switches for each node type → save enabled/disabled. Calls `getTenantNodeAccess` / `updateTenantNodeAccess`. |
| `TenantManagementPage.tsx` | ~311 | ⚠️ 95% | Tenant CRUD: list, search, suspend, activate, delete, impersonate. Card grid with status badges, category colors, action menus. **Bug**: "New Tenant" button navigates to `/my-nodes` (tenant admin page) instead of opening a tenant creation form. |
| `AuditLogPage.tsx` | — | ✅ Exists | Audit log viewer with filtering by tenant, user, action. |
| `ImpersonationBanner.tsx` | ~60 | ✅ Complete | Amber striped banner shown when super admin is impersonating a tenant. Shows target tenant name, session start time, exit button. Located in `src/components/`. |

#### Super Admin Capabilities Checklist

| Requirement | Status | Notes |
|-----------|--------|-------|
| Impersonate any tenant | ✅ Done | `POST /impersonate/{tenant_id}/start` → navigates to canvas as that tenant. Banner shows with exit button. |
| Introduce new framework nodes | ❌ **Missing** | The 8 framework nodes are seeded in backend at startup. `FrameworkNodeLibrary` is **read-only** for node definitions — it only configures tenant access, not the nodes themselves. No "create framework node" UI exists. Backend has `POST /framework-nodes` endpoint but no frontend calls it. |
| Create new tenant & share details | ⚠️ Partial | Backend has full tenant CRUD. Frontend `TenantManagementPage` has suspend/activate/delete but the "New Tenant" button is broken (navigates to wrong page). No tenant creation form/modal exists. |
| Control which nodes available to tenant | ✅ Done | `FrameworkNodeLibrary` page → click tenant → toggle node types on/off. Backend stores `TenantNodeAccess` per tenant. |
| Full permissions to entire portal | ⚠️ Partial | Client-side role checks allow super admin to see all pages. **Backend does not enforce roles** on most endpoints. |

#### Gaps in Super Admin

1. **No "Create Framework Node" UI** — the backend endpoint `POST /framework-nodes` exists but the frontend has no form to create a new framework node type. Need a modal/form in `FrameworkNodeLibrary` that lets the super admin define a new node type (name, category, description, default config schema, icon).
2. **No tenant creation form** — the "New Tenant" button on `TenantManagementPage` is broken. Need a "Create Tenant" modal with fields: name, slug, description, category, status, and an option to create the first admin user simultaneously.
3. **No backend authorization enforcement** — see Section 4.4.

---

### 4.3 Tenant View

**Files**: `src/tenant/` and `src/TenantNodePlatform/`

| File | Status | What It Does |
|------|--------|-------------|
| `TenantDashboard.tsx` | ✅ Exists | Tenant-scoped dashboard: execution stats, audit trail, workflow counts. |
| `ExecutionHistoryPage.tsx` | ✅ Exists | View execution history for the tenant's workflows. |
| `TenantLoginPage.tsx` | ✅ Exists | Login page with persona picker (dev convenience — lists pre-seeded users for quick login). |
| `authStore.ts` | ✅ Complete | Zustand store with `persist` middleware. Stores `currentUser`, `token`, `impersonationContext`. Role helpers: `isSuperAdmin`, `isTenantAdmin`, `canCreateBlueprint`, `canPublishBlueprint`. Login calls backend `/auth/login`. |
| `tnpStore.ts` | ✅ Exists | Zustand store for tenant state: tenants list, selected tenant, blueprints, loading states. |
| `tnpService.ts` | ~358 lines | ✅ Complete | Axios API client covering **every** backend endpoint: auth, tenants, users, blueprints, rules, framework nodes, node access, canvas nodes, audit, executions, impersonation, platform stats. |
| `types.ts` | ✅ Complete | Full TypeScript type definitions for all entities (Tenant, User, Blueprint, FrameworkNode, etc.). |
| `shared.tsx` | ✅ Complete | Shared UI components: `StatusBadge`, `TableSkeleton`, `ErrorBanner`, `ConfirmDialog`. |

#### Tenant View Capabilities Checklist

| Requirement | Status | Notes |
|-----------|--------|-------|
| Role-based authentication | ⚠️ Partial | Client-side role checks work. Backend does not enforce roles. |
| Admin: add users & assign roles | ✅ Done | `TenantUserManagementModal` — create users, assign roles (ADMIN/USER/VIEWER), edit, delete. |
| Admin: Node Library tab | ✅ Done | `MyNodesPage.tsx` — blueprint CRUD, search, status filter, create wizard, Postman import, duplicate, publish, deprecate, test, version history. |
| Admin: create defined nodes from framework nodes | ✅ Done | `BlueprintAuthoringWizard` — multi-step wizard to author a blueprint from a framework node (e.g., Service Node → "ECPR Validate User" with pre-filled config). |
| Admin: import Postman collection → auto-create nodes | ✅ Done | `PostmanImportModal` — accepts Postman v2.1/v2.0 JSON, parses requests + saved responses, batch-creates blueprints via `/blueprints/batch`. |
| Admin: create decision nodes from service responses | ✅ Done | `VisualRuleBuilder` + `DecisionConfigModal` — build rule conditions from service response fields, define outcomes. |
| Admin: full control within tenant | ✅ Done | Admins can create, edit, publish, deprecate, delete, test, version blueprints. |
| User: no access to Node Library | ✅ Done | `MyNodesPage` shows "Catalog Mode (Admin Required to Author)" with lock icon for non-admins. Route is gated. |
| User: view Workflow Dashboard | ✅ Done | `TenantDashboard` and `LangGraphDashboard` accessible to all roles. |
| User: create new workflow → canvas | ✅ Done | "New Workflow" button navigates to `LangGraphBuilder` canvas. |
| User: canvas shows framework + tenant nodes | ✅ Done | `GET /canvas/available-nodes` combines framework nodes + tenant's published blueprints. Canvas renders both. |
| User: drag, drop, configure, run | ⚠️ Partial | Drag/drop/configure works. **Run is simulated** — no real execution. |

---

### 4.4 Auth & Role-Based Access Control

**Current state**: Auth exists but is a **stub** with critical security gaps.

#### Frontend Auth

| Component | File | Status |
|-----------|------|--------|
| Login page | `TenantLoginPage.tsx` | ✅ Works — email/password form + persona picker |
| Auth store | `authStore.ts` | ✅ Works — Zustand + persist, stores user/token/impersonation |
| Route guard | `PrivateRoute.tsx` | ✅ Works — checks `isAuthenticated` + optional `requiredRole` |
| Role helpers | `authStore.ts` | ✅ Works — `isSuperAdmin`, `isTenantAdmin`, `canCreateBlueprint`, `canPublishBlueprint` |
| API interceptor | `tnpService.ts` | ✅ Works — attaches token to all requests |

#### Backend Auth

| Endpoint | File | Status |
|----------|------|--------|
| `POST /auth/login` | `routers/auth.py` | ⚠️ **No password verification** — `AuthService.login()` looks up user by email and returns a token regardless of the password entered. The `password` field in `LoginRequest` is ignored. |
| `GET /auth/personas` | `routers/auth.py` | ✅ Works — returns pre-seeded login personas for dev |
| `GET /auth/me` | `routers/auth.py` | ✅ Works — resolves token → user profile |
| Token format | — | ❌ **Fake JWT**: `tnp-jwt-{user_id}-{timestamp}`. No signature, no expiry, no secret. Parsed by string splitting. Anyone who knows a user_id can forge a token. |
| Password storage | — | ❌ **Plain text**: `password_hash` defaults to `"password123"`. No hashing (bcrypt, argon2, etc.). |
| Authorization on endpoints | — | ❌ **Not enforced**: Most endpoints (tenants, users, blueprints, rules, flows) have **zero auth checks**. Any caller with any token can create/delete tenants, change user roles to SUPER_ADMIN, modify any blueprint. Only `framework_nodes` mutations check for super admin, and `audit` does partial tenant scoping. |

#### Role Hierarchy (defined in `models.py`)

```python
class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    TENANT_ADMIN = "TENANT_ADMIN"
    TENANT_USER = "TENANT_USER"
    TENANT_VIEWER = "TENANT_VIEWER"
```

#### What Must Be Built

1. **Real password hashing** — use bcrypt or argon2 via `passlib`.
2. **Signed JWT tokens** — use `python-jose` or `PyJWT` with a secret key, expiry, and proper claims (sub, role, tenant_id, exp).
3. **Token verification middleware** — a FastAPI dependency that decodes the JWT on every protected route and injects the current user.
4. **Role-based authorization on every endpoint**:
   - `SUPER_ADMIN`: all endpoints
   - `TENANT_ADMIN`: scoped to own tenant — users CRUD, blueprints CRUD, flows CRUD, executions
   - `TENANT_USER`: read blueprints, create/edit flows, execute flows
   - `TENANT_VIEWER`: read-only
5. **Tenant scoping** — every query must filter by the caller's `tenant_id` (except super admin). Currently, the `tenant_id` is passed as a query parameter and can be spoofed.
6. **Impersonation session validation** — server must track active impersonation sessions and validate the impersonation token, not just trust the client.

---

### 4.5 Node Library (Tenant Admin)

**Main file**: `src/TenantNodePlatform/MyNodesPage.tsx` (~649 lines)

This is the **most complete feature area** of the platform.

| Feature | File | Status | Details |
|---------|------|--------|---------|
| Blueprint list with search & filter | `MyNodesPage.tsx` | ✅ | Table with search by name, filter by status (DRAFT/PUBLISHED/DEPRECATED) |
| Create blueprint (wizard) | `BlueprintAuthoringWizard.tsx` | ✅ | Multi-step wizard: select framework node → configure → define metadata → save |
| Create blueprint (simple) | `CreateNodeModal.tsx` | ✅ | Quick create form |
| Import Postman collection | `PostmanImportModal.tsx` | ✅ | Accepts Postman v2.1/v2.0 JSON, parses requests + saved responses, batch-creates blueprints |
| Postman parser | `postmanParser.ts` | ✅ | Parses Postman collection JSON into blueprint definitions |
| View blueprint details | `NodeDetailModal.tsx` | ✅ | Shows full blueprint config, graph definition, dependencies |
| Test blueprint | `TestNodeModal.tsx` | ✅ | Execute a test against the blueprint's configured service |
| Publish blueprint | `MyNodesPage.tsx` | ✅ | Change status DRAFT → PUBLISHED (creates immutable version) |
| Deprecate blueprint | `MyNodesPage.tsx` | ✅ | Change status PUBLISHED → DEPRECATED |
| Duplicate blueprint | `MyNodesPage.tsx` | ✅ | Clone an existing blueprint |
| Version history | `VersionHistoryModal.tsx` | ✅ | View all versions of a blueprint, compare configs |
| Visual rule builder | `VisualRuleBuilder.tsx` | ✅ | Build decision rules: conditions (field, operator, value), outcomes (true/false branches) |
| Blueprint dependencies | backend `blueprints.py` | ✅ | Track which blueprints depend on which, with circular dependency detection (DFS) |
| User management | `TenantUserManagementModal.tsx` | ✅ | Create users, assign roles, edit, delete |
| Role gating | `MyNodesPage.tsx` | ✅ | Non-admins see "Catalog Mode" with lock icon — cannot create/edit |
| Blueprint materialization | `blueprintMaterializationService.ts` | ✅ | Drag a published blueprint onto canvas → expands into nodes with prefixed IDs |

#### What Is Complete

Everything in the Node Library is functional. The admin can:
- Create defined nodes from framework nodes (e.g., Service Node → "ECPR Validate User" with pre-configured URL, headers, body)
- Import Postman collections and auto-create nodes for each request
- Create decision nodes with visual rule conditions based on service response fields
- Publish, deprecate, duplicate, version, and test blueprints
- Manage users and roles within the tenant

#### Gaps

1. **Field catalog not wired** — `rules/field_catalog.py` has a `FieldCatalogRegistry` that can auto-derive fields from a service response, but it is **not exposed via any API endpoint** and not integrated with the visual rule builder. The rule builder currently uses manually entered field paths. Should auto-populate field options from the service node's sample response.
2. **Test execution is partially simulated** — `TestNodeModal` may make a real HTTP call to the configured service URL (needs verification), but the canvas `handleRun` does not.

---

### 4.6 Backend API

**Main file**: `backend/TenantNodePlatform/main.py`

The backend is a **fully functional FastAPI app** with 10 routers. All endpoints are wired and return correct responses. Data is seeded on startup.

#### Registered Routers

| Router | Prefix | Key Endpoints | Auth |
|-------|--------|---------------|------|
| `auth` | `/auth` | `POST /login`, `GET /personas`, `GET /me` | Token parsed, no password check |
| `tenants` | `/tenants` | `GET`, `GET/{id}`, `POST`, `PATCH/{id}`, `DELETE/{id}`, `POST/{id}/suspend`, `POST/{id}/activate` | None (audit logged) |
| `users` | `/users` | `GET`, `GET/{id}`, `POST`, `PATCH/{id}`, `DELETE/{id}` | None |
| `blueprints` | (root) | `GET/POST /tenants/{tid}/blueprints`, `POST .../batch`, `GET/PUT/DELETE /blueprints/{id}`, `POST /blueprints/{id}/publish`, `GET /blueprints/{id}/versions`, `GET/POST /blueprints/{id}/dependencies` | None |
| `rules` | `/rules` | `POST /validate`, `POST /test` | None |
| `flows` | `/api/flows` | `GET`, `GET/{name}`, `POST`, `DELETE/{name}`, `GET/{name}/versions` | None |
| `framework_nodes` | (platform) | `GET/POST /framework-nodes`, `PUT/DELETE /framework-nodes/{id}`, `GET/PUT /tenants/{tid}/node-access`, `GET /canvas/available-nodes`, `GET /stats` | Super admin on mutations only |
| `executions` | `/executions` | `GET`, `GET/{id}`, `POST`, `PUT/{id}` | Partial (bypassable) |
| `audit` | `/audit` | `GET`, `POST` | Partial (unauthenticated sees all) |
| `impersonate` | `/impersonate` | `POST /{tid}/start`, `POST /end` | Super admin required |

Plus 2 inline endpoints in `main.py`: `POST /blueprints/{id}/materialize` and `GET /health`.

#### Services Layer (`services/services.py`)

| Service | Methods | Notes |
|---------|---------|-------|
| `TenantService` | create, get, list, update, delete | Auto-generates tenant_id from slug |
| `BlueprintService` | create, get, list, update, publish, delete | Published versions are immutable — updates create new DRAFT + version snapshot |
| `BlueprintVersionService` | list_versions, get_version | Read-only |
| `BlueprintMaterializationService` | materialize | Converts blueprint graph_definition → LangGraph JSON with prefixed IDs |
| `AuthService` | login, get_personas, get_user_by_id | **No password verification** |
| `UserService` | list, get, create, update, delete | Email uniqueness + tenant validation |

#### Repositories (`repositories/in_memory.py`)

All 9 repositories use Python dicts/lists with `threading.RLock` for thread safety. All return deep copies to prevent mutation. **No database connection exists.**

| Repository | Storage |
|-----------|---------|
| `InMemoryTenantRepository` | `{tenant_id: Tenant}` |
| `InMemoryBlueprintRepository` | `{tenant_id: {blueprint_id: Blueprint}}` |
| `InMemoryBlueprintVersionRepository` | `{tenant_id: {blueprint_id: [versions]}}` |
| `InMemoryDependencyRepository` | `{tenant_id: [BlueprintDependency]}` with DFS cycle detection |
| `InMemoryUserRepository` | `{user_id: User}` + email index + persona store |
| `InMemoryFrameworkNodeRepository` | `{node_id: FrameworkNode}` + `{node_type: node_id}` index |
| `InMemoryTenantNodeAccessRepository` | `{tenant_id: {node_type: TenantNodeAccess}}` |
| `InMemoryAuditRepository` | Append-only list, filters by tenant/actor/action |
| `InMemoryExecutionRepository` | `{tenant_id: {execution_id: WorkflowExecution}}` |

#### Seed Data (`seed.py` + `main.py`)

On startup, the backend seeds:
- 3 tenants (Acme Corp, Globex, Initech)
- Users per tenant (admin + user personas)
- 8 framework nodes (Service, Decision, LLM, Form, Parallel, Merge, Mapper, Workflow)
- Sample blueprints per tenant
- Sample workflow
- Audit log entries

#### Backend Gaps

1. **No database persistence** — all data is lost on restart.
2. **No real auth** — see Section 4.4.
3. **No real workflow execution engine** — the execution router only stores records; nothing actually runs a workflow graph.
4. **Field catalog not wired** — `FieldCatalogRegistry` exists but has no REST endpoint.
5. **`_resolve_tenant_for_blueprint` in `blueprints.py`** — calls `_blueprint_service.list_tenants()` which doesn't exist (dead code branch).
6. **Hardcoded API keys in seed data** — e.g., `"X-GSA-API-KEY": "gsa_live_demo_key"` in blueprint graph definitions.

---

### 4.7 Database / Persistence

**Current state**: **No database.** 100% in-memory.

| Aspect | Status |
|--------|--------|
| `src/lib/supabaseClient.ts` | ✅ File exists — creates a Supabase client from env vars |
| Supabase env vars | ✅ Pre-populated in `.env` |
| Supabase migrations | ❌ None — no `supabase/migrations/` directory |
| Supabase tables | ❌ None — no schema defined |
| Supabase RLS policies | ❌ None |
| App uses Supabase | ❌ No — the frontend talks exclusively to the FastAPI backend via axios. The Supabase client is dead code. |

#### What Must Be Built

A complete database schema in Supabase with the following tables (see Section 10 for the full migration plan):

1. `tenants` — tenant entities
2. `users` — user entities (or use Supabase Auth)
3. `blueprints` — tenant-scoped blueprint definitions
4. `blueprint_versions` — version history for blueprints
5. `blueprint_dependencies` — dependency graph between blueprints
6. `framework_nodes` — the 8 framework node definitions
7. `tenant_node_access` — which framework nodes each tenant can use
8. `flows` — workflow definitions (LangGraph JSON)
9. `flow_versions` — version history for flows
10. `executions` — workflow execution records
11. `node_executions` — per-node execution records within a workflow execution
12. `audit_logs` — audit trail
13. `impersonation_sessions` — active impersonation sessions

Each table needs:
- RLS policies (4 per table: SELECT, INSERT, UPDATE, DELETE)
- Proper indexes
- Foreign key constraints
- Tenant-scoping (every table except `framework_nodes` and `tenants` has a `tenant_id`)

---

### 4.8 Rule Engine

**Files**: `backend/TenantNodePlatform/rules/`

| File | Status | What It Does |
|------|--------|-------------|
| `engine.py` | ✅ Complete | Rule validation, evaluation, and decision engine. 17 operators (EQUALS, NOT_EQUALS, GT, LT, GTE, LTE, CONTAINS, NOT_CONTAINS, STARTS_WITH, ENDS_WITH, EXISTS, NOT_EXISTS, IS_EMPTY, IS_NOT_EMPTY, IN, NOT_IN, BETWEEN). Recursive AND/OR/NOT evaluation with trace steps. No `eval()` — fully defensive. |
| `models.py` | ✅ Complete | Pydantic models: `RuleDefinition`, `RuleCondition`, `RuleConditionGroup`, `RuleOutcome`, `Operator` enum, `FieldCatalogEntry`, `FieldCatalog`. All use `extra="forbid"` for strict validation. |
| `field_catalog.py` | ⚠️ Stub | `derive_field_catalog()` flattens a sample service output into field paths. `FieldCatalogRegistry` is a thread-safe in-memory registry. **Not wired to any REST endpoint** — no API exposes this. |

#### Rule Engine Gaps

1. **Field catalog not exposed** — need a `GET /rules/field-catalog/{blueprint_id}` endpoint that returns auto-derived fields from a blueprint's sample response.
2. **Rule engine not integrated with decision node execution** — the engine can evaluate rules, but the canvas `DecisionNode` does not call it during "execution."
3. **Rule definitions not persisted** — rules are stored as part of the blueprint's `graph_definition` JSON, but there's no dedicated rules table or CRUD.

---

## 5. What Is Already Implemented (Complete)

These features are fully built and functional (assuming the backend is running):

### Canvas & Nodes
- ✅ All 8 node type components render on the canvas
- ✅ Drag-and-drop node creation, edge creation, node deletion
- ✅ Node selection and config panel
- ✅ State context panel showing workflow state
- ✅ Custom styled edges with labels
- ✅ Service Node config modal (URL, method, headers, body)
- ✅ Decision Node config modal (rule conditions, outcomes)
- ✅ Form Node config modal (form schema builder + live preview)
- ✅ Mapper Node config modal (output format, sample response, template)
- ✅ Workflow Node config modal (reference another workflow)
- ✅ Blueprint materialization (drag published blueprint → expands into nodes)
- ✅ Programmatic generator (import JSON graph definitions)
- ✅ What-If Scenario Studio
- ✅ Workflow execute modal (simulated)
- ✅ Workflow execution with forms (simulated)

### Framework / Super Admin
- ✅ Framework dashboard with platform-wide stats (8 stat cards)
- ✅ Framework node library (list all 8 nodes, grouped by category, search)
- ✅ Per-tenant node access control (toggle each node type on/off per tenant)
- ✅ Tenant management — list, search, suspend, activate, delete
- ✅ Impersonation (start/exit with audit logging + visual banner)
- ✅ Audit log viewer

### Tenant Admin
- ✅ Node Library tab (blueprint CRUD, search, status filter)
- ✅ Blueprint authoring wizard (multi-step: select framework node → configure → metadata → save)
- ✅ Postman collection import → batch-create blueprints
- ✅ Visual rule builder for decision nodes
- ✅ Blueprint publish / deprecate / duplicate
- ✅ Blueprint version history
- ✅ Blueprint dependency tracking with circular dependency detection
- ✅ Test blueprint node
- ✅ User management (create users, assign roles, edit, delete)
- ✅ Role gating (non-admins see catalog mode with lock icon)

### Tenant User
- ✅ Workflow dashboard (view existing workflows)
- ✅ Create new workflow → navigate to canvas
- ✅ Canvas shows framework nodes + tenant's published blueprints
- ✅ Drag, drop, connect, configure nodes

### Backend
- ✅ All 10 routers functional with correct responses
- ✅ Complete Pydantic models for all entities
- ✅ Service layer with business logic (immutability of published blueprints, version snapshots, dependency cycle detection)
- ✅ Rule engine (17 operators, recursive evaluation, trace steps)
- ✅ Seed data (3 tenants, users, 8 framework nodes, sample blueprints, sample workflow, audit logs)
- ✅ CORS configured
- ✅ Health endpoint

### Auth (Client-Side)
- ✅ Login page with email/password form + persona picker
- ✅ Zustand auth store with localStorage persistence
- ✅ Route guards (PrivateRoute with requiredRole)
- ✅ Role helpers (isSuperAdmin, isTenantAdmin, canCreateBlueprint, canPublishBlueprint)
- ✅ API token interceptor (attaches token to all requests)
- ✅ Impersonation context tracking

---

## 6. What Is Partially Implemented (Needs Completion)

### 6.1 Canvas — Node Execution (Simulated → Real)

**Current**: Every node's `handleRun` function only sets `status: 'running'` and logs a message. No real work happens.

**Needed**: A real execution engine that:
- **Service Node**: Makes an actual HTTP call (fetch/axios) to the configured URL with the configured method, headers, and body. Stores the response in the workflow state.
- **Decision Node**: Calls the backend rule engine (`POST /rules/test`) with the configured rule definition and the incoming data. Routes to the true/false outcome branch.
- **LLM Node**: Calls an actual LLM API (OpenAI, Anthropic, etc.) with the configured model and prompt. Stores the response in the workflow state.
- **Form Node**: Renders the configured form schema and waits for user input (already partially handled by `WorkflowExecutionWithForms`).
- **Mapper Node**: Applies the configured template/transformation to the incoming data and stores the result.
- **Workflow Node**: Triggers the referenced sub-workflow execution and waits for completion.

**Files to modify**:
- `src/components/LangGraph/ServiceNode.tsx` — add real HTTP call in `handleRun`
- `src/components/LangGraph/DecisionNode.tsx` — call rule engine in `handleRun`
- `src/components/LangGraph/LLMNode.tsx` — call LLM API in `handleRun`
- `src/components/LangGraph/FormNode.tsx` — integrate with form execution flow
- `src/components/LangGraph/MapperNode.tsx` — apply transformation in `handleRun`
- `src/components/LangGraph/WorkflowNode.tsx` — trigger sub-workflow in `handleRun`
- `src/stores/langGraphStore.ts` — add execution state management
- Backend: may need an execution endpoint that runs the workflow server-side

### 6.2 Impersonation (Client-Side → Server-Side)

**Current**: Impersonation is tracked client-side only. The backend creates an audit log entry but does not validate the impersonation session on subsequent requests.

**Needed**:
- Server-side impersonation session store (in-memory → database)
- Impersonation token that is distinct from the regular token
- Validation of impersonation token on every request
- Auto-expiry of impersonation sessions
- Prevention of privilege escalation through impersonation (impersonated user cannot perform admin actions)

**Files to modify**:
- `backend/.../routers/impersonate.py` — add session tracking
- `backend/.../services/services.py` — add session validation
- `src/.../authStore.ts` — already tracks impersonation context, may need token refresh

### 6.3 Tenant Management — Create Tenant Form

**Current**: The "New Tenant" button on `TenantManagementPage` navigates to `/my-nodes` (wrong page). No tenant creation form exists.

**Needed**: A "Create Tenant" modal with:
- Tenant name, slug, description, category
- Initial admin user (name, email, password)
- Node access defaults (which framework nodes to enable)
- Status (active by default)

**Files to modify**:
- `src/framework/TenantManagementPage.tsx` — replace navigation with modal
- May need a new `CreateTenantModal.tsx` component

### 6.4 Audit Log Tenant Scoping

**Current**: Unauthenticated callers to `GET /audit` can see all events. Tenant scoping only works when a user is resolved from the token.

**Needed**: Deny access when no token is present. Always filter by the caller's tenant_id unless they are SUPER_ADMIN.

**Files to modify**:
- `backend/.../routers/audit.py` — add auth dependency, enforce tenant scoping

### 6.5 Field Catalog Integration

**Current**: `FieldCatalogRegistry` exists in the backend but has no REST endpoint and is not integrated with the frontend visual rule builder.

**Needed**:
- `GET /rules/field-catalog/{blueprint_id}` endpoint — returns auto-derived fields from a blueprint's sample response
- Frontend `VisualRuleBuilder` calls this endpoint to populate field dropdown options instead of requiring manual entry

**Files to modify**:
- `backend/.../routers/rules.py` — add field catalog endpoint
- `src/.../VisualRuleBuilder.tsx` — call the new endpoint

---

## 7. What Is Missing (Must Build)

### 7.1 Database / Supabase Integration

**This is the #1 priority.** Everything currently lives in Python in-memory dicts and is lost on restart.

**Needed**: Complete Supabase schema with tables, RLS policies, indexes, and foreign keys. The backend should be refactored to use Supabase as its data store instead of in-memory repositories.

See [Section 10](#10-migration-strategy-in-memory--supabase) for the full migration plan.

### 7.2 Real Authentication

**Needed**:
- Password hashing with bcrypt or argon2 (via `passlib`)
- Signed JWT tokens with `python-jose` or `PyJWT` (secret key, expiry, claims: sub, role, tenant_id, exp)
- Token verification middleware (FastAPI dependency)
- Password change endpoint
- Token refresh endpoint
- Logout endpoint (invalidate token — requires server-side token store or short expiry + refresh)

**Files to create/modify**:
- `backend/.../routers/auth.py` — add password verification, real JWT
- `backend/.../services/services.py` — `AuthService.login()` must verify password
- New: `backend/.../auth/jwt.py` — JWT creation and verification
- New: `backend/.../auth/dependencies.py` — FastAPI dependencies for auth and role checks
- All routers — add auth dependency

### 7.3 Server-Side Authorization Enforcement

**Needed**: Every endpoint must verify the caller's role and tenant scope.

| Endpoint Group | SUPER_ADMIN | TENANT_ADMIN | TENANT_USER | TENANT_VIEWER |
|---------------|-------------|--------------|-------------|---------------|
| Tenants CRUD | All | Read own | Read own | Read own |
| Users CRUD | All | CRUD own tenant | Read own tenant | Read own tenant |
| Blueprints CRUD | All | CRUD own tenant | Read own tenant | Read own tenant |
| Flows CRUD | All | CRUD own tenant | Create/Edit own | Read own |
| Executions | All | Read/write own | Read/write own | Read own |
| Framework Nodes | CRUD all | Read all | Read all | Read all |
| Node Access | All | Read own | — | — |
| Audit | All | Read own tenant | Read own tenant | Read own tenant |
| Impersonate | Start/End | — | — | — |
| Rules | All | CRUD own tenant | Read own tenant | Read own tenant |
| Canvas Nodes | All | Read own | Read own | Read own |
| Platform Stats | All | — | — | — |

**Files to create/modify**:
- New: `backend/.../auth/dependencies.py` — `require_role()`, `require_tenant_access()` dependencies
- All 10 routers — add dependencies to each endpoint

### 7.4 LLM Node Config Modal

**Needed**: A config modal for the LLM node that allows editing:
- Model name (dropdown: GPT-4, GPT-3.5, Claude, etc.)
- Temperature (slider)
- System prompt (textarea)
- User prompt (textarea with variable interpolation from workflow state)
- Max tokens
- API key (stored securely, not in the graph definition)

**Files to create**:
- `src/components/LangGraph/LLMConfigModal.tsx`
- Modify `src/components/LangGraph/LLMNode.tsx` — wire up `onConfig` to open the modal
- Modify `src/components/LangGraph/LangGraphBuilder.tsx` — render the modal

### 7.5 Parallel Node Config & Execution

**Needed**: A config modal for the Parallel node:
- Branch count (or auto-detect from outgoing edges)
- Wait strategy: "wait for all" vs "wait for first"
- Timeout per branch

Execution logic:
- Fan out: trigger all outgoing branches concurrently
- Fan in: wait for all (or first) branches to complete
- Store results from each branch in the workflow state

**Files to create/modify**:
- New: `src/components/LangGraph/ParallelConfigModal.tsx`
- Modify `src/components/LangGraph/ParallelNode.tsx` — add `CompactNodeDisplay`, `onRun`, `onConfig`
- Modify `src/components/LangGraph/LangGraphBuilder.tsx` — render the modal

### 7.6 Merge Node Config & Execution

**Needed**: A config modal for the Merge node:
- Merge strategy: "first wins", "concatenate all", "merge objects", "custom script"
- Field mapping (which fields from which branches)

Execution logic:
- Collect results from all incoming branches
- Apply the configured merge strategy
- Store the merged result in the workflow state

**Files to create/modify**:
- New: `src/components/LangGraph/MergeConfigModal.tsx`
- Modify `src/components/LangGraph/MergeNode.tsx` — add `CompactNodeDisplay`, `onRun`, `onConfig`
- Modify `src/components/LangGraph/LangGraphBuilder.tsx` — render the modal

### 7.7 Super Admin — Create Framework Node UI

**Needed**: A form in `FrameworkNodeLibrary` that lets the super admin create a new framework node type:
- Node name, category, description
- Default icon (from lucide-react)
- Default configuration schema (JSON schema for the node's config)
- Default graph definition template
- Status (active/inactive)

**Files to create/modify**:
- New: `src/framework/CreateFrameworkNodeModal.tsx`
- Modify `src/framework/FrameworkNodeLibrary.tsx` — add "Create Node" button, render modal
- Backend `POST /framework-nodes` already exists

### 7.8 Real Workflow Execution Engine

**Needed**: A backend service that takes a workflow graph definition and executes it:
- Parse the graph (nodes + edges)
- Topological sort to determine execution order
- Execute each node based on its type:
  - Service: HTTP call
  - Decision: Rule engine evaluation
  - LLM: LLM API call
  - Form: Pause and wait for user input (human-in-the-loop)
  - Parallel: Spawn concurrent branches
  - Merge: Collect and merge results
  - Mapper: Apply transformation
  - Workflow: Recursively execute sub-workflow
- Track execution state, node results, errors, retries
- Store execution results in the database
- Support streaming updates (WebSocket or SSE) for real-time progress

**Files to create**:
- New: `backend/.../services/execution_engine.py`
- Modify: `backend/.../routers/executions.py` — add `POST /executions/{id}/run` endpoint
- Modify: `src/.../WorkflowExecuteModal.tsx` — call the real execution endpoint
- Optionally: WebSocket/SSE support for real-time execution updates

### 7.9 Secret Management for API Keys

**Needed**: Service nodes and LLM nodes require API keys. These should not be stored in plain text in the graph definition.

- Store API keys as encrypted secrets (Supabase Vault or environment variables)
- Reference secrets by name in the graph definition
- Resolve secrets at execution time

**Files to create/modify**:
- New: `backend/.../services/secret_service.py`
- Modify: blueprint/flow storage to reference secret names instead of inline keys
- Modify: execution engine to resolve secrets at runtime

---

## 8. Security Concerns

These are **critical** and should be addressed before any production use:

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **No password verification** — any password authenticates any email | 🔴 Critical | Use bcrypt/argon2 via `passlib` in `AuthService.login()` |
| 2 | **Fake unsigned JWT** — `tnp-jwt-{user_id}-{timestamp}` can be forged by anyone | 🔴 Critical | Use `python-jose` or `PyJWT` with a secret key, expiry, and proper claims |
| 3 | **No backend authorization** — most endpoints have zero role checks | 🔴 Critical | Add FastAPI auth dependencies to every router |
| 4 | **Tenant ID spoofing** — `tenant_id` passed as query param can be overridden | 🔴 Critical | Derive `tenant_id` from the authenticated token, never from the request |
| 5 | **CORS wide open** — `allow_origins=["*"]` | 🟡 High | Restrict to known frontend origins |
| 6 | **Audit log bypass** — unauthenticated callers see all audit events | 🟡 High | Require auth, enforce tenant scoping |
| 7 | **Plain text passwords** — default `"password123"` | 🟡 High | Hash all passwords, enforce password policies |
| 8 | **Hardcoded API keys in seed data** — e.g., `"gsa_live_demo_key"` | 🟡 High | Move to environment variables / secrets |
| 9 | **Impersonation is client-side only** — no server-side session validation | 🟡 High | Server-side session store with validation |
| 10 | **Execution tenant bypass** — `tenant_id` query param overrides token | 🟡 High | Always use token-derived `tenant_id` |

---

## 9. Recommended Implementation Order

### Phase 1: Foundation (Critical)

1. **Set up Supabase database schema** — create all tables, RLS policies, indexes (see Section 10)
2. **Migrate backend from in-memory to Supabase** — replace `InMemory*Repository` classes with Supabase-backed implementations
3. **Implement real authentication** — password hashing, signed JWTs, token verification middleware
4. **Implement server-side authorization** — role-based access on every endpoint, tenant scoping

### Phase 2: Complete the Canvas (High)

5. **Create LLM Node config modal** — model, temperature, prompts, API key
6. **Create Parallel Node config modal + execution** — branch management, fan-out/fan-in
7. **Create Merge Node config modal + execution** — merge strategies
8. **Implement real node execution** — Service (HTTP), Decision (rule engine), LLM (API), Mapper (transform), Workflow (sub-workflow)

### Phase 3: Complete Super Admin (Medium)

9. **Create tenant creation form** — modal with tenant + initial admin user
10. **Create framework node creation UI** — form for super admin to add new node types
11. **Fix audit log tenant scoping** — deny unauthenticated access

### Phase 4: Execution Engine (Medium)

12. **Build workflow execution engine** — server-side graph execution with state tracking
13. **Wire execution to canvas** — real "Run" button that triggers server-side execution
14. **Add real-time execution updates** — WebSocket or SSE for progress
15. **Secret management** — encrypted storage for API keys

### Phase 5: Polish (Low)

16. **Wire field catalog to rule builder** — auto-populate field options
17. **Fix `_resolve_tenant_for_blueprint` dead code** in `blueprints.py`
18. **Remove hardcoded API keys from seed data**
19. **Restrict CORS** to known origins
20. **Add token refresh and logout** endpoints

---

## 10. Migration Strategy: In-Memory → Supabase

### 10.1 Database Schema

The following tables need to be created in Supabase. Each tenant-scoped table includes a `tenant_id` foreign key.

#### Table: `tenants`

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, DELETED
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Table: `users`

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- SUPER_ADMIN, TENANT_ADMIN, TENANT_USER, TENANT_VIEWER
  tenant_id TEXT REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Note**: Consider using Supabase Auth instead of a custom `users` table. Supabase Auth handles password hashing, email verification, and JWT tokens. The `users` table would then store only profile data (name, role, tenant_id) and link to `auth.users.id`. This is the recommended approach.

#### Table: `framework_nodes`

```sql
CREATE TABLE framework_nodes (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  default_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Table: `tenant_node_access`

```sql
CREATE TABLE tenant_node_access (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL REFERENCES framework_nodes(node_type),
  enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, node_type)
);
```

#### Table: `blueprints`

```sql
CREATE TABLE blueprints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, DEPRECATED
  source_type TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL, POSTMAN
  framework_node_type TEXT REFERENCES framework_nodes(node_type),
  graph_definition JSONB NOT NULL,
  metadata JSONB,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blueprints_tenant ON blueprints(tenant_id);
CREATE INDEX idx_blueprints_status ON blueprints(status);
```

#### Table: `blueprint_versions`

```sql
CREATE TABLE blueprint_versions (
  id TEXT PRIMARY KEY,
  blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  graph_definition JSONB NOT NULL,
  metadata JSONB,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, version_number)
);
CREATE INDEX idx_blueprint_versions_blueprint ON blueprint_versions(blueprint_id);
```

#### Table: `blueprint_dependencies`

```sql
CREATE TABLE blueprint_dependencies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  depends_on_blueprint_id TEXT NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, depends_on_blueprint_id)
);
```

#### Table: `flows`

```sql
CREATE TABLE flows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  graph_definition JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX idx_flows_tenant ON flows(tenant_id);
```

#### Table: `flow_versions`

```sql
CREATE TABLE flow_versions (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  graph_definition JSONB NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flow_id, version_number)
);
```

#### Table: `executions`

```sql
CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flow_id TEXT REFERENCES flows(id),
  flow_name TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  input JSONB,
  output JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_executions_tenant ON executions(tenant_id);
CREATE INDEX idx_executions_status ON executions(status);
```

#### Table: `node_executions`

```sql
CREATE TABLE node_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_node_executions_execution ON node_executions(execution_id);
```

#### Table: `audit_logs`

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id),
  actor_id TEXT REFERENCES users(id),
  actor_name TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

#### Table: `impersonation_sessions`

```sql
CREATE TABLE impersonation_sessions (
  id TEXT PRIMARY KEY,
  super_admin_id TEXT NOT NULL REFERENCES users(id),
  target_tenant_id TEXT NOT NULL REFERENCES tenants(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
);
```

### 10.2 RLS Policies

Every tenant-scoped table needs 4 policies (SELECT, INSERT, UPDATE, DELETE) scoped to `auth.uid()` or a custom claims check. Example for `blueprints`:

```sql
ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_blueprints" ON blueprints FOR SELECT
  TO authenticated USING (auth.uid()::text IN (
    SELECT id FROM users WHERE tenant_id = blueprints.tenant_id
  ));

CREATE POLICY "insert_own_blueprints" ON blueprints FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text IN (
    SELECT id FROM users WHERE tenant_id = blueprints.tenant_id
  ));

CREATE POLICY "update_own_blueprints" ON blueprints FOR UPDATE
  TO authenticated USING (auth.uid()::text IN (
    SELECT id FROM users WHERE tenant_id = blueprints.tenant_id
  ));

CREATE POLICY "delete_own_blueprints" ON blueprints FOR DELETE
  TO authenticated USING (auth.uid()::text IN (
    SELECT id FROM users WHERE tenant_id = blueprints.tenant_id
  ));
```

> **Note**: The exact RLS policy approach depends on whether you use Supabase Auth or a custom auth system. If using Supabase Auth, `auth.uid()` returns the Supabase Auth user ID. If using custom JWTs, you may need a custom claims function or a join through the `users` table. Consider using a `SECURITY DEFINER` function to check the user's role and tenant_id from custom JWT claims.

### 10.3 Backend Migration Steps

1. **Create all migrations** using the Supabase MCP `apply_migration` tool
2. **Replace `InMemory*Repository` classes** with Supabase-backed implementations:
   - Each repository method becomes a Supabase query (using the `supabase-py` library or direct Postgres via `psycopg2`/`asyncpg`)
   - The repository interface stays the same — only the implementation changes
3. **Seed framework nodes** via a migration (insert the 8 framework node definitions)
4. **Move auth to Supabase Auth** (recommended) or implement real JWT auth with database-backed user lookup
5. **Update `seed.py`** to seed demo tenants/users into Supabase instead of in-memory dicts
6. **Update CORS** to restrict origins

### 10.4 Frontend Migration Steps

1. **Replace `tnpService.ts` (axios → FastAPI)** with direct Supabase client calls where possible (or keep the FastAPI backend as a BFF and have it talk to Supabase)
2. **Update `authStore.ts`** to use Supabase Auth session management (`supabase.auth.onAuthStateChange`)
3. **Update `supabaseClient.ts`** — it's already there, just needs to be actually used
4. **Remove dead code** — any in-memory references

### 10.5 Architecture Decision: Keep FastAPI or Go Direct to Supabase?

**Option A: Keep FastAPI as Backend-for-Frontend (BFF)**
- Frontend → FastAPI → Supabase
- FastAPI handles auth, authorization, business logic, rule engine, execution engine
- Supabase is the data store only
- **Pros**: Complex logic (rule engine, execution, materialization) stays in Python; frontend doesn't need to change much
- **Cons**: Extra hop, more infrastructure to maintain

**Option B: Frontend → Supabase Directly**
- Frontend uses Supabase client for CRUD (with RLS enforcing access control)
- FastAPI only for complex operations (execution engine, rule evaluation, materialization)
- **Pros**: Simpler architecture, less infrastructure, leverages Supabase RLS
- **Cons**: RLS policies must be very carefully written; complex queries harder; business logic split between frontend and database

**Recommendation**: **Option A** for now — the backend already has significant business logic (rule engine, materialization, dependency cycle detection, version management) that is better kept in Python. Migrate the data store to Supabase, keep FastAPI as the API layer.

---

## Appendix A: File Inventory

### Frontend — Canvas (`src/components/LangGraph/`)

| File | Purpose |
|------|---------|
| `LangGraphBuilder.tsx` | Main canvas — node registration, toolbar, drag/drop, edge creation |
| `LangGraphDashboard.tsx` | Workflow list dashboard |
| `ServiceNode.tsx` | Service node component |
| `DecisionNode.tsx` | Decision node component |
| `LLMNode.tsx` | LLM node component (no config modal) |
| `FormNode.tsx` | Form node component |
| `ParallelNode.tsx` | Parallel node component (no config, no execution) |
| `MergeNode.tsx` | Merge node component (no config, no execution) |
| `MapperNode.tsx` | Mapper node component |
| `WorkflowNode.tsx` | Workflow node component |
| `CompactNodeDisplay.tsx` | Shared node wrapper (status, config, run buttons) |
| `CustomEdge.tsx` | Custom styled edge |
| `NodeConfigPanel.tsx` | Selected node properties panel |
| `StateContextPanel.tsx` | Workflow state viewer |
| `ServiceConfigModal.tsx` | Service node config |
| `DecisionConfigModal.tsx` | Decision node config |
| `FormBuilderModal.tsx` | Form node config |
| `FormPreviewModal.tsx` | Form live preview |
| `ObjectMapperModal.tsx` | Mapper node config |
| `WorkflowConfigModal.tsx` | Workflow node config |
| `WorkflowExecuteModal.tsx` | Workflow execution (simulated) |
| `WorkflowExecutionWithForms.tsx` | Form interaction during execution |
| `WorkflowViewModal.tsx` | Workflow detail viewer |
| `WhatIfScenarioStudio.tsx` | Scenario testing |
| `ProgrammaticGeneratorModal.tsx` | JSON graph import |
| `BusinessRuleBuilder.tsx` | Rule builder (LangGraph variant) |
| `VisualRuleBuilder.tsx` | Visual rule builder (LangGraph variant) |
| `VisualPayloadMapper.tsx` | Payload mapping UI |

### Frontend — Framework (`src/framework/`)

| File | Purpose |
|------|---------|
| `FrameworkDashboard.tsx` | Super admin dashboard with platform stats |
| `FrameworkNodeLibrary.tsx` | Framework node list + per-tenant access control |
| `TenantManagementPage.tsx` | Tenant CRUD (create form missing) |
| `AuditLogPage.tsx` | Audit log viewer |

### Frontend — Tenant (`src/TenantNodePlatform/`)

| File | Purpose |
|------|---------|
| `TenantDashboard.tsx` | Tenant dashboard |
| `TenantLoginPage.tsx` | Login page with persona picker |
| `MyNodesPage.tsx` | Node Library (blueprint CRUD) |
| `BlueprintAuthoringWizard.tsx` | Multi-step blueprint creation wizard |
| `CreateNodeModal.tsx` | Quick blueprint creation |
| `PostmanImportModal.tsx` | Postman collection import |
| `postmanParser.ts` | Postman JSON parser |
| `NodeDetailModal.tsx` | Blueprint detail viewer |
| `TestNodeModal.tsx` | Blueprint test runner |
| `VersionHistoryModal.tsx` | Blueprint version history |
| `VisualRuleBuilder.tsx` | Visual rule builder (TNP variant) |
| `TenantUserManagementModal.tsx` | User management within tenant |
| `types.ts` | TypeScript type definitions |
| `shared.tsx` | Shared UI components |
| `authStore.ts` | Auth Zustand store |
| `tnpStore.ts` | Tenant state Zustand store |
| `tnpService.ts` | Axios API client |

### Frontend — Other

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app with routing |
| `src/lib/supabaseClient.ts` | Supabase client (unused) |
| `src/lib/utils.ts` | Utility functions |
| `src/components/guards/PrivateRoute.tsx` | Route guard |
| `src/components/ImpersonationBanner.tsx` | Impersonation banner |
| `src/stores/langGraphStore.ts` | Canvas state Zustand store |
| `src/services/langGraphService.ts` | LangGraph API service |
| `src/services/blueprintMaterializationService.ts` | Blueprint → canvas nodes |
| `src/services/metricsService.ts` | Metrics service |

### Backend (`backend/TenantNodePlatform/`)

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app bootstrap, CORS, seeding, router registration |
| `models.py` | All Pydantic models (15KB) |
| `seed.py` | Seed data generation |
| `routers/auth.py` | Auth endpoints |
| `routers/tenants.py` | Tenant CRUD |
| `routers/users.py` | User CRUD |
| `routers/blueprints.py` | Blueprint CRUD + versions + dependencies |
| `routers/flows.py` | Workflow/flow CRUD + versioning |
| `routers/executions.py` | Execution history |
| `routers/framework_nodes.py` | Framework nodes + tenant access + canvas nodes + stats |
| `routers/impersonate.py` | Impersonation |
| `routers/audit.py` | Audit log |
| `routers/rules.py` | Rule validation + testing |
| `services/services.py` | Business logic (6 services) |
| `repositories/in_memory.py` | In-memory data storage (9 repositories) |
| `rules/engine.py` | Rule evaluation engine |
| `rules/models.py` | Rule models |
| `rules/field_catalog.py` | Field catalog registry (not wired) |

---

## Appendix B: Backend API Endpoint Reference

### Auth (`/api/tenant-platform/auth`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/login` | Login with email + password | None (no password check) |
| GET | `/personas` | List login personas (dev) | None |
| GET | `/me` | Get current user from token | Token parsed |

### Tenants (`/api/tenant-platform/tenants`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/` | List all tenants | None |
| GET | `/{tenant_id}` | Get tenant by ID | None |
| POST | `/` | Create tenant | None |
| PATCH | `/{tenant_id}` | Update tenant | None |
| DELETE | `/{tenant_id}` | Delete tenant | None |
| POST | `/{tenant_id}/suspend` | Suspend tenant | None |
| POST | `/{tenant_id}/activate` | Activate tenant | None |

### Users (`/api/tenant-platform/users`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/` | List users (optional tenant filter) | None |
| GET | `/{user_id}` | Get user by ID | None |
| POST | `/` | Create user | None |
| PATCH | `/{user_id}` | Update user | None |
| DELETE | `/{user_id}` | Delete user | None |

### Blueprints (`/api/tenant-platform`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/tenants/{tenant_id}/blueprints` | List tenant blueprints | None |
| POST | `/tenants/{tenant_id}/blueprints` | Create blueprint | None |
| POST | `/tenants/{tenant_id}/blueprints/batch` | Batch create (Postman import) | None |
| GET | `/blueprints/{blueprint_id}` | Get blueprint | None |
| PUT | `/blueprints/{blueprint_id}` | Update blueprint | None |
| DELETE | `/blueprints/{blueprint_id}` | Delete blueprint | None |
| POST | `/blueprints/{blueprint_id}/publish` | Publish blueprint | None |
| GET | `/blueprints/{blueprint_id}/versions` | List versions | None |
| GET | `/blueprints/{blueprint_id}/dependencies` | List dependencies | None |
| POST | `/blueprints/{blueprint_id}/dependencies` | Add dependency | None |
| POST | `/blueprints/{blueprint_id}/materialize` | Materialize to LangGraph JSON | None |

### Rules (`/api/tenant-platform/rules`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/validate` | Validate rule definition | None |
| POST | `/test` | Test rule against input | None |

### Flows (`/api/flows`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/` | List flows (optional tenant filter) | None |
| GET | `/{name}` | Get flow by name | None |
| POST | `/` | Create/update flow | None |
| DELETE | `/{name}` | Delete flow | None |
| GET | `/{name}/versions` | List flow versions | None |

### Framework Nodes (`/api/tenant-platform`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/framework-nodes` | List all framework nodes | None |
| POST | `/framework-nodes` | Create framework node | Super admin |
| PUT | `/framework-nodes/{node_id}` | Update framework node | Super admin |
| DELETE | `/framework-nodes/{node_id}` | Delete framework node | Super admin |
| GET | `/tenants/{tenant_id}/node-access` | Get tenant node access | None |
| PUT | `/tenants/{tenant_id}/node-access` | Update tenant node access | None |
| GET | `/canvas/available-nodes` | Get canvas nodes (framework + tenant blueprints) | None |
| GET | `/stats` | Platform stats | None |

### Executions (`/api/tenant-platform/executions`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/` | List executions (tenant-scoped) | Partial (bypassable) |
| GET | `/{execution_id}` | Get execution by ID | Partial |
| POST | `/` | Create execution | Partial |
| PUT | `/{execution_id}` | Update execution | Partial |

### Audit (`/api/tenant-platform/audit`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/` | List audit logs (filtered) | Partial (unauthenticated sees all) |
| POST | `/` | Create audit log | None |

### Impersonate (`/api/tenant-platform/impersonate`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/{tenant_id}/start` | Start impersonation | Super admin |
| POST | `/end` | End impersonation | Super admin |

### Health (`/api`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/health` | Health check | None |

---

*End of document.*
