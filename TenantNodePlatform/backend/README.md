# Tenant Node Platform — Backend

In-memory FastAPI backend for the Tenant Node Platform. No database, no
external persistence — all data is lost on restart (intentional for this
phase).

## Running

```bash
cd TenantNodePlatform/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

The API is served at `http://localhost:8001/api/tenant-platform/`.

The Vite dev server proxies `/api/tenant-platform` to port 8001.

## Running Tests

```bash
cd TenantNodePlatform/backend
python -m pytest tests/ -v
```

## Architecture

```
backend/
  main.py              FastAPI app, wires repos + services + routers, seeds data
  models.py            Pydantic models (Tenant, Blueprint, BlueprintVersion, ...)
  seed.py              Seed data: GSA + Demo Tenant, GSA Address Verification blueprint
  repositories/
    __init__.py        Repository Protocol interfaces (the persistence seam)
    in_memory.py       Dict-backed implementations, partitioned by tenant_id
  services/
    services.py        Business logic: TenantService, BlueprintService,
                       BlueprintVersionService, BlueprintMaterializationService
  routers/
    tenants.py         GET/POST/PATCH/DELETE /api/tenant-platform/tenants
    blueprints.py      Blueprint CRUD + publish + versions + dependencies + materialize
  tests/
    conftest.py        Pytest fixtures (fresh repos + services per test)
    test_tenant.py     Tenant CRUD + isolation
    test_blueprint.py  Blueprint creation, retrieval, versioning, publishing, cross-tenant
    test_repository.py Repository behavior + dependency cycle detection
    test_materialization.py  Blueprint -> graph JSON conversion
```

## Key Design Decisions

- **In-memory only.** Dict-backed repositories with a Protocol interface so a
  future database implementation can drop in without changing business logic.
- **Tenant isolation.** Every repository method takes `tenant_id`; data is
  partitioned by tenant. No cross-tenant reads or writes are possible.
- **Immutable published versions.** Updating a PUBLISHED blueprint creates a
  new DRAFT version rather than modifying the published snapshot.
- **No existing code touched.** The TNP backend is entirely self-contained
  under `TenantNodePlatform/backend/`. The only change outside this folder is
  a Vite proxy entry for `/api/tenant-platform`.
