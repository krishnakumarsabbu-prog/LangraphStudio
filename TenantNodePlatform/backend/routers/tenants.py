"""Tenant REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..models import TenantCreate, TenantUpdate
from ..services.services import TenantService

router = APIRouter(prefix="/api/tenant-platform/tenants", tags=["tenants"])


def get_tenant_service() -> TenantService:
    from ..main import _tenant_service
    return _tenant_service


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
def create_tenant(create: TenantCreate):
    service = get_tenant_service()
    t = service.create_tenant(create)
    return t.model_dump(mode="json")


@router.patch("/{tenant_id}")
def update_tenant(tenant_id: str, updates: TenantUpdate):
    service = get_tenant_service()
    t = service.update_tenant(tenant_id, updates)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return t.model_dump(mode="json")


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: str):
    service = get_tenant_service()
    if not service.delete_tenant(tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return None
