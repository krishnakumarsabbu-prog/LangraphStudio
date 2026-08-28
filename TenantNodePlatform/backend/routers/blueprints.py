"""Blueprint REST endpoints.

All endpoints enforce tenant ownership. A tenant can never retrieve or
modify another tenant's blueprint.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..models import BlueprintCreate, BlueprintUpdate
from ..services.services import BlueprintService, BlueprintVersionService

router = APIRouter(tags=["blueprints"])


def get_blueprint_service() -> BlueprintService:
    from ..main import _blueprint_service
    return _blueprint_service


def get_version_service() -> BlueprintVersionService:
    from ..main import _version_service
    return _version_service


# --------------------------------------------------------------------------- #
# Tenant-scoped blueprint routes
# --------------------------------------------------------------------------- #

@router.get("/api/tenant-platform/tenants/{tenant_id}/blueprints")
def list_tenant_blueprints(tenant_id: str):
    service = get_blueprint_service()
    bps = service.list_blueprints(tenant_id)
    return {"items": [bp.model_dump(mode="json") for bp in bps], "total": len(bps)}


@router.post("/api/tenant-platform/tenants/{tenant_id}/blueprints", status_code=status.HTTP_201_CREATED)
def create_blueprint(tenant_id: str, create: BlueprintCreate):
    service = get_blueprint_service()
    bp = service.create_blueprint(tenant_id, create)
    return bp.model_dump(mode="json")


# --------------------------------------------------------------------------- #
# Blueprint-level routes (tenant_id resolved from blueprint ownership)
# --------------------------------------------------------------------------- #

def _resolve_tenant_for_blueprint(blueprint_id: str) -> str:
    """Find which tenant owns a blueprint. Used for tenant enforcement."""
    from ..main import _blueprint_service
    tenants = _blueprint_service.list_tenants() if hasattr(_blueprint_service, "list_tenants") else []
    for t in tenants:
        bp = _blueprint_service.get_blueprint(t.tenant_id, blueprint_id)
        if bp is not None:
            return t.tenant_id
    from ..main import _tenant_service
    for t in _tenant_service.list_tenants():
        bp = _blueprint_service.get_blueprint(t.tenant_id, blueprint_id)
        if bp is not None:
            return t.tenant_id
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")


@router.get("/api/tenant-platform/blueprints/{blueprint_id}")
def get_blueprint(blueprint_id: str, version: int | None = None):
    service = get_blueprint_service()
    tenant_id = _resolve_tenant_for_blueprint(blueprint_id)
    bp = service.get_blueprint(tenant_id, blueprint_id, version=version)
    if bp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    return bp.model_dump(mode="json")


@router.put("/api/tenant-platform/blueprints/{blueprint_id}")
def update_blueprint(blueprint_id: str, updates: BlueprintUpdate):
    service = get_blueprint_service()
    tenant_id = _resolve_tenant_for_blueprint(blueprint_id)
    bp = service.update_blueprint(tenant_id, blueprint_id, updates)
    if bp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    return bp.model_dump(mode="json")


@router.post("/api/tenant-platform/blueprints/{blueprint_id}/publish")
def publish_blueprint(blueprint_id: str):
    service = get_blueprint_service()
    tenant_id = _resolve_tenant_for_blueprint(blueprint_id)
    bp = service.publish_blueprint(tenant_id, blueprint_id)
    if bp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    return bp.model_dump(mode="json")


@router.get("/api/tenant-platform/blueprints/{blueprint_id}/versions")
def list_blueprint_versions(blueprint_id: str):
    version_service = get_version_service()
    tenant_id = _resolve_tenant_for_blueprint(blueprint_id)
    versions = version_service.list_versions(tenant_id, blueprint_id)
    return {"items": [v.model_dump(mode="json") for v in versions], "total": len(versions)}


@router.get("/api/tenant-platform/blueprints/{blueprint_id}/dependencies")
def list_blueprint_dependencies(blueprint_id: str):
    from ..main import _dependency_repo
    tenant_id = _resolve_tenant_for_blueprint(blueprint_id)
    deps = _dependency_repo.get_dependencies(tenant_id, blueprint_id)
    return {"items": [d.model_dump(mode="json") for d in deps], "total": len(deps)}


@router.post("/api/tenant-platform/blueprints/{blueprint_id}/dependencies")
def add_blueprint_dependency(blueprint_id: str, body: dict):
    from ..main import _dependency_repo
    from ..models import BlueprintDependency, DependencyType
    tenant_id = _resolve_tenant_for_blueprint(blueprint_id)
    dependency_id = body.get("dependency_id")
    dep_type = body.get("dependency_type", DependencyType.GRAPH_BLUEPRINT.value)
    if not dependency_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="dependency_id is required")
    dep = BlueprintDependency(
        dependent_id=blueprint_id,
        dependency_id=dependency_id,
        dependency_type=DependencyType(dep_type),
        tenant_id=tenant_id,
    )
    if _dependency_repo.check_circular(tenant_id, blueprint_id, dependency_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Circular dependency detected")
    _dependency_repo.add_dependency(dep)
    return dep.model_dump(mode="json")
