"""Framework Node Registry endpoints (Super Admin only)."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status, Header

from ..models import (
    FrameworkNodeCreate,
    FrameworkNodeUpdate,
    FrameworkNode,
    TenantNodeAccessUpdate,
    UserRole,
)

router = APIRouter(prefix="/api/tenant-platform", tags=["framework-nodes"])


def _get_fn_repo():
    from ..main import _framework_node_repo
    return _framework_node_repo


def _get_access_repo():
    from ..main import _node_access_repo
    return _node_access_repo


def _get_tenant_service():
    from ..main import _tenant_service
    return _tenant_service


def _require_super_admin(authorization: Optional[str]) -> None:
    """Token-based super admin check with JWT signature verification."""
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    from ..security import verify_access_token
    claims = verify_access_token(authorization)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id = claims.get("sub") or claims.get("user_id")
    from ..main import _auth_service
    user = _auth_service.get_user_by_id(user_id)
    if not user or user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required")


# --------------------------------------------------------------------------- #
# Framework Node CRUD
# --------------------------------------------------------------------------- #

@router.get("/framework-nodes")
def list_framework_nodes(authorization: Optional[str] = Header(default=None)):
    repo = _get_fn_repo()
    nodes = repo.list_all()
    return {"items": [n.model_dump(mode="json") for n in nodes], "total": len(nodes)}


@router.post("/framework-nodes", status_code=status.HTTP_201_CREATED)
def create_framework_node(
    create: FrameworkNodeCreate,
    authorization: Optional[str] = Header(default=None),
):
    _require_super_admin(authorization)
    repo = _get_fn_repo()
    existing = repo.get_by_type(create.node_type)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Framework node type '{create.node_type}' already exists")
    node = FrameworkNode(**create.model_dump())
    created = repo.create(node)
    return created.model_dump(mode="json")


@router.put("/framework-nodes/{node_id}")
def update_framework_node(
    node_id: str,
    updates: FrameworkNodeUpdate,
    authorization: Optional[str] = Header(default=None),
):
    _require_super_admin(authorization)
    repo = _get_fn_repo()
    updated = repo.update(node_id, updates)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Framework node not found")
    return updated.model_dump(mode="json")


@router.delete("/framework-nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_framework_node(
    node_id: str,
    authorization: Optional[str] = Header(default=None),
):
    _require_super_admin(authorization)
    repo = _get_fn_repo()
    if not repo.delete(node_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Framework node not found")
    return None


# --------------------------------------------------------------------------- #
# Tenant Node Access (per-tenant framework node availability)
# --------------------------------------------------------------------------- #

@router.get("/tenants/{tenant_id}/node-access")
def get_tenant_node_access(
    tenant_id: str,
    authorization: Optional[str] = Header(default=None),
):
    """Return per-tenant node access settings merged with full framework node list."""
    fn_repo = _get_fn_repo()
    access_repo = _get_access_repo()
    all_nodes = fn_repo.list_all()
    access_list = access_repo.get_access_list(tenant_id)
    access_map = {a.node_type: a.is_enabled for a in access_list}

    result = []
    for n in all_nodes:
        result.append({
            "node_type": n.node_type,
            "display_name": n.display_name,
            "category": n.category,
            "icon": n.icon,
            "status": n.status,
            "is_enabled": access_map.get(n.node_type, True),  # default enabled
        })
    return {"items": result, "total": len(result)}


@router.put("/tenants/{tenant_id}/node-access")
def update_tenant_node_access(
    tenant_id: str,
    body: TenantNodeAccessUpdate,
    authorization: Optional[str] = Header(default=None),
):
    """Bulk update which framework node types are enabled for a tenant."""
    _require_super_admin(authorization)
    fn_repo = _get_fn_repo()
    access_repo = _get_access_repo()
    all_types = [n.node_type for n in fn_repo.list_all()]
    result = access_repo.set_bulk(tenant_id, all_types, body.enabled_node_types)
    return {"items": [r.model_dump(mode="json") for r in result], "total": len(result)}


# --------------------------------------------------------------------------- #
# Canvas available-nodes endpoint
# --------------------------------------------------------------------------- #

@router.get("/canvas/available-nodes")
def get_canvas_available_nodes(
    tenant_id: str = Query(...),
    authorization: Optional[str] = Header(default=None),
):
    """Return framework nodes (filtered by tenant access) + tenant published blueprints."""
    fn_repo = _get_fn_repo()
    access_repo = _get_access_repo()

    # Framework nodes
    all_nodes = fn_repo.list_all()
    access_list = access_repo.get_access_list(tenant_id)
    access_map = {a.node_type: a.is_enabled for a in access_list}

    framework_nodes = [
        n.model_dump(mode="json")
        for n in all_nodes
        if n.status == "ACTIVE" and access_map.get(n.node_type, True)
    ]

    # Tenant blueprints (published only)
    from ..main import _blueprint_service
    all_bps = _blueprint_service.list_blueprints(tenant_id)
    tenant_nodes = [
        bp.model_dump(mode="json")
        for bp in all_bps
        if bp.status == "PUBLISHED"
    ]

    return {
        "framework_nodes": framework_nodes,
        "tenant_nodes": tenant_nodes,
    }


# --------------------------------------------------------------------------- #
# Platform stats for Super Admin Dashboard
# --------------------------------------------------------------------------- #

@router.get("/stats")
def get_platform_stats(authorization: Optional[str] = Header(default=None)):
    """Aggregated platform statistics for the Super Admin Dashboard."""
    from ..main import _tenant_service, _user_service, _blueprint_service, _execution_repo, _audit_repo
    
    tenants = _tenant_service.list_tenants()
    active = sum(1 for t in tenants if t.status == "active")
    suspended = sum(1 for t in tenants if t.status == "suspended")
    users = _user_service.list_users()
    fn_repo = _get_fn_repo()
    framework_nodes = fn_repo.list_all()

    # Aggregate blueprints across all tenants
    total_bps = 0
    for t in tenants:
        bps = _blueprint_service.list_blueprints(t.tenant_id)
        total_bps += len(bps)

    total_execs = _execution_repo.count_all() if hasattr(_execution_repo, "count_all") else 0

    recent_tenants = sorted(tenants, key=lambda x: x.created_at, reverse=True)[:5]
    recent_audit = _audit_repo.list_all(limit=10) if _audit_repo else []

    return {
        "total_tenants": len(tenants),
        "active_tenants": active,
        "suspended_tenants": suspended,
        "total_users": len(users),
        "total_blueprints": total_bps,
        "total_executions": total_execs,
        "framework_nodes": len(framework_nodes),
        "recent_tenants": [t.model_dump(mode="json") for t in recent_tenants],
        "recent_audit_events": [a.model_dump(mode="json") for a in recent_audit],
    }
