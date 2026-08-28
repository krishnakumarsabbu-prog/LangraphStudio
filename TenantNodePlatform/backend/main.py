"""FastAPI application for the Tenant Node Platform.

This is a separate app that runs alongside the existing LangGraph backend.
It does NOT touch /api/flows or any existing code. All TNP endpoints live
under /api/tenant-platform/.

Run with:
    cd TenantNodePlatform/backend
    uvicorn main:app --reload --port 8001
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .repositories.in_memory import (
    InMemoryBlueprintRepository,
    InMemoryBlueprintVersionRepository,
    InMemoryDependencyRepository,
    InMemoryTenantRepository,
)
from .services.services import (
    BlueprintMaterializationService,
    BlueprintService,
    BlueprintVersionService,
    TenantService,
)
from .seed import seed_data

logger = logging.getLogger("tnp")

# --------------------------------------------------------------------------- #
# Repository singletons (in-memory)
# --------------------------------------------------------------------------- #

_tenant_repo = InMemoryTenantRepository()
_blueprint_repo = InMemoryBlueprintRepository()
_version_repo = InMemoryBlueprintVersionRepository()
_dependency_repo = InMemoryDependencyRepository()

# --------------------------------------------------------------------------- #
# Service singletons
# --------------------------------------------------------------------------- #

_tenant_service = TenantService(_tenant_repo)
_blueprint_service = BlueprintService(_blueprint_repo, _version_repo)
_version_service = BlueprintVersionService(_version_repo)
_materialization_service = BlueprintMaterializationService(_blueprint_repo)

# --------------------------------------------------------------------------- #
# Seed data
# --------------------------------------------------------------------------- #

seed_data(_tenant_repo, _blueprint_repo, _version_repo)

# --------------------------------------------------------------------------- #
# FastAPI app
# --------------------------------------------------------------------------- #

app = FastAPI(
    title="Tenant Node Platform API",
    description="Blueprint management and materialization for tenant-scoped LangGraph workflows.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from .routers import tenants as tenants_router  # noqa: E402
from .routers import blueprints as blueprints_router  # noqa: E402

app.include_router(tenants_router.router)
app.include_router(blueprints_router.router)


# --------------------------------------------------------------------------- #
# Materialization endpoint
# --------------------------------------------------------------------------- #

@app.post("/api/tenant-platform/blueprints/{blueprint_id}/materialize")
def materialize_blueprint(blueprint_id: str, body: dict | None = None):
    tenant_id = _resolve_tenant_for_blueprint(blueprint_id)
    id_prefix = (body or {}).get("id_prefix")
    try:
        result = _materialization_service.materialize(tenant_id, blueprint_id, id_prefix=id_prefix)
    except ValueError as e:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return result


def _resolve_tenant_for_blueprint(blueprint_id: str) -> str:
    for t in _tenant_service.list_tenants():
        bp = _blueprint_service.get_blueprint(t.tenant_id, blueprint_id)
        if bp is not None:
            return t.tenant_id
    from fastapi import HTTPException, status
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")


@app.get("/api/tenant-platform/health")
def health():
    return {"status": "ok"}
