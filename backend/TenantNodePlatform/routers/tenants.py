"""Tenant REST endpoints."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, status, Header

from ..models import TenantCreate, TenantUpdate, TenantStatus, AuditAction, AuditLog, UserRole
from ..services.services import TenantService

router = APIRouter(prefix="/api/tenant-platform/tenants", tags=["tenants"])


def get_tenant_service() -> TenantService:
    from ..main import _tenant_service
    return _tenant_service


def _resolve_user(authorization: Optional[str]):
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    parts = token.split("-")
    if len(parts) < 3:
        return None
    user_id = "-".join(parts[2:-1]) if len(parts) > 3 else parts[2]
    from ..main import _auth_service
    return _auth_service.get_user_by_id(user_id)


def _audit(actor, action, tenant_id, tenant_name=""):
    try:
        from ..main import _audit_repo
        _audit_repo.append(AuditLog(
            actor_user_id=actor.id if actor else "system",
            actor_user_name=actor.name if actor else "system",
            actor_tenant_id=actor.tenant_id if actor else "all",
            action=action,
            resource_type="Tenant",
            resource_id=tenant_id,
            resource_name=tenant_name,
            target_tenant_id=tenant_id,
        ))
    except Exception:
        pass


@router.get("", response_model=None)
def list_tenants():
    service = get_tenant_service()
    tenants = service.list_tenants()
    return {"items": [t.model_dump(mode="json") for t in tenants], "total": len(tenants)}


@router.get("/{tenant_id}")
def get_tenant(tenant_id: str):
    service = get_tenant_service()
    t = service.get_tenant(tenant_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return t.model_dump(mode="json")


@router.post("", status_code=status.HTTP_201_CREATED)
def create_tenant(create: TenantCreate, authorization: Optional[str] = Header(default=None)):
    service = get_tenant_service()
    t = service.create_tenant(create)
    actor = _resolve_user(authorization)
    _audit(actor, AuditAction.TENANT_CREATED, t.tenant_id, t.tenant_name)
    return t.model_dump(mode="json")


@router.patch("/{tenant_id}")
def update_tenant(tenant_id: str, updates: TenantUpdate, authorization: Optional[str] = Header(default=None)):
    service = get_tenant_service()
    t = service.update_tenant(tenant_id, updates)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    actor = _resolve_user(authorization)
    _audit(actor, AuditAction.TENANT_UPDATED, tenant_id, t.tenant_name)
    return t.model_dump(mode="json")


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: str, authorization: Optional[str] = Header(default=None)):
    service = get_tenant_service()
    t = service.get_tenant(tenant_id)
    if not service.delete_tenant(tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    actor = _resolve_user(authorization)
    _audit(actor, AuditAction.TENANT_DELETED, tenant_id, t.tenant_name if t else "")
    return None


@router.post("/{tenant_id}/suspend")
def suspend_tenant(tenant_id: str, authorization: Optional[str] = Header(default=None)):
    """Suspend a tenant — their users can no longer access the platform."""
    service = get_tenant_service()
    t = service.update_tenant(tenant_id, TenantUpdate(status=TenantStatus.SUSPENDED))
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    actor = _resolve_user(authorization)
    _audit(actor, AuditAction.TENANT_SUSPENDED, tenant_id, t.tenant_name)
    return t.model_dump(mode="json")


@router.post("/{tenant_id}/activate")
def activate_tenant(tenant_id: str, authorization: Optional[str] = Header(default=None)):
    """Activate a suspended or inactive tenant."""
    service = get_tenant_service()
    t = service.update_tenant(tenant_id, TenantUpdate(status=TenantStatus.ACTIVE))
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    actor = _resolve_user(authorization)
    _audit(actor, AuditAction.TENANT_ACTIVATED, tenant_id, t.tenant_name)
    return t.model_dump(mode="json")
