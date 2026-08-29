"""Tenant impersonation endpoints for Super Admin."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, status, Header

from ..models import AuditAction, AuditLog, ImpersonationContext, UserRole
import datetime as dt

router = APIRouter(prefix="/api/tenant-platform/impersonate", tags=["impersonation"])


def _get_audit_repo():
    from ..main import _audit_repo
    return _audit_repo


def _resolve_super_admin(authorization: Optional[str]):
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    token = authorization.replace("Bearer ", "").strip()
    parts = token.split("-")
    if len(parts) < 3 or parts[0] != "tnp" or parts[1] != "jwt":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = "-".join(parts[2:-1]) if len(parts) > 3 else parts[2]
    from ..main import _auth_service
    user = _auth_service.get_user_by_id(user_id)
    if not user or user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required")
    return user


@router.post("/{tenant_id}/start")
def start_impersonation(
    tenant_id: str,
    authorization: Optional[str] = Header(default=None),
):
    """Super Admin starts impersonating a tenant. Returns impersonation context to store client-side."""
    actor = _resolve_super_admin(authorization)
    from ..main import _tenant_service
    tenant = _tenant_service.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    context = ImpersonationContext(
        original_user_id=actor.id,
        original_user_name=actor.name,
        original_tenant_id=actor.tenant_id,
        target_tenant_id=tenant_id,
        target_tenant_name=tenant.tenant_name,
    )

    # Audit
    audit_repo = _get_audit_repo()
    audit_repo.append(AuditLog(
        actor_user_id=actor.id,
        actor_user_name=actor.name,
        actor_tenant_id=actor.tenant_id,
        action=AuditAction.IMPERSONATION_STARTED,
        resource_type="Tenant",
        resource_id=tenant_id,
        resource_name=tenant.tenant_name,
        target_tenant_id=tenant_id,
        metadata={"impersonation_session_id": context.session_id},
    ))

    return context.model_dump(mode="json")


@router.post("/end")
def end_impersonation(
    body: dict,
    authorization: Optional[str] = Header(default=None),
):
    """Super Admin ends impersonation. Creates audit event."""
    actor = _resolve_super_admin(authorization)
    target_tenant_id = body.get("target_tenant_id", "")
    session_id = body.get("session_id", "")

    # Audit
    audit_repo = _get_audit_repo()
    from ..main import _tenant_service
    tenant = _tenant_service.get_tenant(target_tenant_id)
    audit_repo.append(AuditLog(
        actor_user_id=actor.id,
        actor_user_name=actor.name,
        actor_tenant_id=actor.tenant_id,
        action=AuditAction.IMPERSONATION_ENDED,
        resource_type="Tenant",
        resource_id=target_tenant_id,
        resource_name=tenant.tenant_name if tenant else target_tenant_id,
        target_tenant_id=target_tenant_id,
        metadata={"impersonation_session_id": session_id},
    ))

    return {"success": True, "ended_at": dt.datetime.now(dt.UTC).isoformat()}
