"""Workflow Execution history endpoints."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status, Header

from ..models import WorkflowExecution, WorkflowExecutionCreate, WorkflowExecutionUpdate, ExecutionStatus
import datetime as dt
import uuid

router = APIRouter(prefix="/api/tenant-platform/executions", tags=["executions"])


def _get_repo():
    from ..main import _execution_repo
    return _execution_repo


def _resolve_tenant(authorization: Optional[str]):
    """Resolve tenant_id and user from bearer token."""
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    from ..security import verify_access_token
    claims = verify_access_token(authorization)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id = claims.get("sub") or claims.get("user_id")
    from ..main import _auth_service
    user = _auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user.tenant_id, user


@router.get("")
def list_executions(
    workflow_name: Optional[str] = Query(default=None),
    exec_status: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    tenant_id: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """List workflow executions for the authenticated tenant."""
    repo = _get_repo()
    
    # Allow passing tenant_id directly (for frontend with known tenant)
    if not tenant_id and authorization:
        try:
            t_id, _ = _resolve_tenant(authorization)
            tenant_id = t_id
        except Exception:
            pass

    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tenant_id required")

    items = repo.list_for_tenant(
        tenant_id=tenant_id,
        workflow_name=workflow_name,
        status=exec_status,
        limit=limit,
        offset=offset,
    )
    total = repo.count(tenant_id)
    return {
        "items": [e.model_dump(mode="json") for e in items],
        "total": total,
    }


@router.get("/{execution_id}")
def get_execution(
    execution_id: str,
    tenant_id: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Get a single execution (tenant-scoped)."""
    repo = _get_repo()

    if not tenant_id and authorization:
        try:
            t_id, _ = _resolve_tenant(authorization)
            tenant_id = t_id
        except Exception:
            pass

    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tenant_id required")

    e = repo.get(tenant_id, execution_id)
    if e is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return e.model_dump(mode="json")


@router.post("", status_code=status.HTTP_201_CREATED)
def create_execution(create: WorkflowExecutionCreate):
    """Create a new execution record (called by the LangGraph engine or frontend)."""
    repo = _get_repo()
    execution = WorkflowExecution(
        id=str(uuid.uuid4()),
        tenant_id=create.tenant_id,
        workflow_name=create.workflow_name,
        workflow_version=create.workflow_version,
        status=ExecutionStatus.RUNNING,
        started_at=dt.datetime.now(dt.UTC),
        triggered_by=create.triggered_by,
        triggered_by_user_id=create.triggered_by_user_id,
        triggered_by_user_name=create.triggered_by_user_name,
        input_data=create.input_data,
    )
    saved = repo.create(execution)
    return saved.model_dump(mode="json")


@router.put("/{execution_id}")
def update_execution(
    execution_id: str,
    updates: WorkflowExecutionUpdate,
    tenant_id: Optional[str] = Query(default=None),
):
    """Update execution status/result."""
    repo = _get_repo()
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tenant_id required")
    updated = repo.update(tenant_id, execution_id, updates)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return updated.model_dump(mode="json")
