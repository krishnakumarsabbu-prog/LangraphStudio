"""Audit Log endpoints."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Query, Header

from ..models import AuditLog, AuditLogCreate, AuditAction
import datetime as dt

router = APIRouter(prefix="/api/tenant-platform/audit", tags=["audit"])


def _get_repo():
    from ..main import _audit_repo
    return _audit_repo


def _resolve_user(authorization: Optional[str]):
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    parts = token.split("-")
    if len(parts) < 3 or parts[0] != "tnp" or parts[1] != "jwt":
        return None
    user_id = "-".join(parts[2:-1]) if len(parts) > 3 else parts[2]
    from ..main import _auth_service
    return _auth_service.get_user_by_id(user_id)


@router.get("")
def list_audit_logs(
    tenant_id: Optional[str] = Query(default=None),
    actor_user_id: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0),
    authorization: Optional[str] = Header(default=None),
):
    """List audit log events, filtered by tenant/user/action."""
    repo = _get_repo()
    # Non-super-admins can only see their own tenant's audit log
    user = _resolve_user(authorization)
    if user and user.role != "SUPER_ADMIN":
        tenant_id = user.tenant_id

    items = repo.list_all(
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        action=action,
        limit=limit,
        offset=offset,
    )
    total = repo.count(tenant_id=tenant_id)
    return {
        "items": [i.model_dump(mode="json") for i in items],
        "total": total,
    }


@router.post("", status_code=201)
def create_audit_log(create: AuditLogCreate):
    """Append an audit event (called internally by other services)."""
    repo = _get_repo()
    log = AuditLog(
        actor_user_id=create.actor_user_id,
        actor_user_name=create.actor_user_name,
        actor_tenant_id=create.actor_tenant_id,
        action=create.action,
        resource_type=create.resource_type,
        resource_id=create.resource_id,
        resource_name=create.resource_name,
        target_tenant_id=create.target_tenant_id,
        metadata=create.metadata,
        ip_address=create.ip_address,
        timestamp=dt.datetime.now(dt.UTC),
    )
    saved = repo.append(log)
    return saved.model_dump(mode="json")
