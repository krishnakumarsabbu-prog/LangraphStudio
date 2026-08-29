"""User REST endpoints for multi-tenant identity and access management."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from ..models import UserCreate, UserProfile, UserUpdate
from ..services.services import UserService

router = APIRouter(prefix="/api/tenant-platform/users", tags=["users"])


def get_user_service() -> UserService:
    from ..main import _user_service
    return _user_service


@router.get("", response_model=None)
def list_users(tenant_id: Optional[str] = Query(default=None)):
    service = get_user_service()
    users = service.list_users(tenant_id=tenant_id)
    return {"items": [u.model_dump(mode="json") for u in users], "total": len(users)}


@router.get("/{user_id}", response_model=UserProfile)
def get_user(user_id: str):
    service = get_user_service()
    u = service.get_user(user_id)
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return u


@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserProfile)
def create_user(create: UserCreate):
    service = get_user_service()
    try:
        u = service.create_user(create)
        return u
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{user_id}", response_model=UserProfile)
def update_user(user_id: str, updates: UserUpdate):
    service = get_user_service()
    u = service.update_user(user_id, updates)
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return u


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str):
    service = get_user_service()
    if not service.delete_user(user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return None
