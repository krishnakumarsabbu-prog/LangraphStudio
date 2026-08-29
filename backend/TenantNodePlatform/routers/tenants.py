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
    from ..security import verify_access_token
    claims = verify_access_token(authorization)
    if not claims:
        return None
    user_id = claims.get("sub") or claims.get("user_id")
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
    actor = _resolve_user(authorization)
    try:
        t = service.create_tenant(create)
        _audit(actor, AuditAction.TENANT_CREATED, t.tenant_id, t.tenant_name)
        return t.model_dump(mode="json")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{tenant_id}")
def update_tenant(tenant_id: str, updates: TenantUpdate, authorization: Optional[str] = Header(default=None)):
    service = get_tenant_service()
    actor = _resolve_user(authorization)
    t = service.update_tenant(tenant_id, updates)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    _audit(actor, AuditAction.TENANT_UPDATED, tenant_id, t.tenant_name)
    return t.model_dump(mode="json")


@router.post("/{tenant_id}/suspend")
def suspend_tenant(tenant_id: str, authorization: Optional[str] = Header(default=None)):
    service = get_tenant_service()
    actor = _resolve_user(authorization)
    if actor and actor.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin required")
    t = service.update_tenant(tenant_id, TenantUpdate(status=TenantStatus.SUSPENDED))
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    _audit(actor, AuditAction.TENANT_SUSPENDED, tenant_id, t.tenant_name)
    return {"status": "suspended", "tenant_id": tenant_id}


@router.post("/{tenant_id}/activate")
def activate_tenant(tenant_id: str, authorization: Optional[str] = Header(default=None)):
    service = get_tenant_service()
    actor = _resolve_user(authorization)
    if actor and actor.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin required")
    t = service.update_tenant(tenant_id, TenantUpdate(status=TenantStatus.ACTIVE))
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    _audit(actor, AuditAction.TENANT_ACTIVATED, tenant_id, t.tenant_name)
    return {"status": "active", "tenant_id": tenant_id}


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: str, authorization: Optional[str] = Header(default=None)):
    service = get_tenant_service()
    actor = _resolve_user(authorization)
    if actor and actor.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin required")
    t = service.get_tenant(tenant_id)
    name = t.tenant_name if t else ""
    deleted = service.delete_tenant(tenant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    _audit(actor, AuditAction.TENANT_DELETED, tenant_id, name)
    return None
