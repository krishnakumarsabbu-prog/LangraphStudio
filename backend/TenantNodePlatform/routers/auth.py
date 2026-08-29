"""Authentication and persona endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status, Header

from ..models import LoginRequest, LoginResponse, PersonaItem, UserProfile
from ..services.services import AuthService

router = APIRouter(prefix="/api/tenant-platform/auth", tags=["auth"])


def get_auth_service() -> AuthService:
    from ..main import _auth_service
    return _auth_service


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    service = get_auth_service()
    try:
        response = service.login(req)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.get("/personas")
def list_personas():
    service = get_auth_service()
    personas = service.get_personas()
    return {"items": [p.model_dump(mode="json") for p in personas], "total": len(personas)}


@router.get("/me", response_model=UserProfile)
def get_me(authorization: str | None = Header(default=None)):
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    
    # Token format: tnp-jwt-{user_id}-{timestamp}
    token = authorization.replace("Bearer ", "").strip()
    parts = token.split("-")
    if len(parts) >= 3 and parts[0] == "tnp" and parts[1] == "jwt":
        # Extract user_id
        user_id = "-".join(parts[2:-1]) if len(parts) > 3 else parts[2]
        service = get_auth_service()
        user = service.get_user_by_id(user_id)
        if user:
            return user

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
