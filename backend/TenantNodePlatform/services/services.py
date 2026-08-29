"""Business services for the Tenant Node Platform.

Services orchestrate repository calls and enforce business rules
(versioning, tenant isolation, immutability of published versions).
No persistence logic lives here — only orchestration.
"""

from __future__ import annotations

import copy
import datetime as dt
import uuid
from typing import List, Optional

from ..models import (
    Blueprint,
    BlueprintCreate,
    BlueprintStatus,
    BlueprintUpdate,
    BlueprintVersion,
    LoginRequest,
    LoginResponse,
    PersonaItem,
    Tenant,
    TenantCreate,
    TenantUpdate,
    User,
    UserCreate,
    UserProfile,
    UserRole,
    UserUpdate,
)
from ..repositories.in_memory import (
    InMemoryBlueprintRepository,
    InMemoryBlueprintVersionRepository,
    InMemoryDependencyRepository,
    InMemoryTenantRepository,
    InMemoryUserRepository,
)


class TenantService:
    def __init__(self, tenant_repo: InMemoryTenantRepository) -> None:
        self._repo = tenant_repo

    def create_tenant(self, create: TenantCreate) -> Tenant:
        slug = create.slug or create.tenant_name.lower().replace(" ", "-").replace("_", "-")
        tenant_id = f"tenant-{slug}" if not slug.startswith("tenant-") else slug
        
        # Ensure unique tenant_id
        if self._repo.get_tenant(tenant_id):
            tenant_id = f"{tenant_id}-{str(uuid.uuid4())[:4]}"

        tenant = Tenant(
            tenant_id=tenant_id,
            tenant_name=create.tenant_name,
            slug=slug,
            category=create.category or "Enterprise",
            description=create.description or "",
            metadata=create.metadata or {"icon": "Building2"},
        )
        return self._repo.create_tenant(tenant)

    def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        return self._repo.get_tenant(tenant_id)

    def list_tenants(self) -> List[Tenant]:
        return self._repo.list_tenants()

    def update_tenant(self, tenant_id: str, updates: TenantUpdate) -> Optional[Tenant]:
        return self._repo.update_tenant(tenant_id, updates)

    def delete_tenant(self, tenant_id: str) -> bool:
        return self._repo.delete_tenant(tenant_id)


class BlueprintService:
    def __init__(
        self,
        blueprint_repo: InMemoryBlueprintRepository,
        version_repo: InMemoryBlueprintVersionRepository,
    ) -> None:
        self._repo = blueprint_repo
        self._version_repo = version_repo

    def create_blueprint(self, tenant_id: str, create: BlueprintCreate) -> Blueprint:
        bp = Blueprint(
            tenant_id=tenant_id,
            name=create.name,
            description=create.description,
            source_type=create.source_type,
            graph_definition=create.graph_definition,
            input_contract=create.input_contract,
            output_contract=create.output_contract,
            created_by=create.created_by,
        )
        saved = self._repo.create_blueprint(bp)
        self._save_version(saved, created_by=create.created_by)
        return saved

    def get_blueprint(
        self, tenant_id: str, blueprint_id: str, version: Optional[int] = None
    ) -> Optional[Blueprint]:
        bp = self._repo.get_blueprint(tenant_id, blueprint_id, version=version)
        if bp is None and version is not None:
            bp_version = self._version_repo.get_version(tenant_id, blueprint_id, version)
            if bp_version is not None:
                return Blueprint(**bp_version.snapshot)
        return bp

    def list_blueprints(self, tenant_id: str) -> List[Blueprint]:
        return self._repo.list_blueprints(tenant_id)

    def update_blueprint(
        self, tenant_id: str, blueprint_id: str, updates: BlueprintUpdate
    ) -> Optional[Blueprint]:
        existing = self._repo.get_blueprint(tenant_id, blueprint_id)
        if existing is None:
            return None

        if existing.status == BlueprintStatus.PUBLISHED:
            data = existing.model_dump()
            update_data = updates.model_dump(exclude_unset=True)
            data.update(update_data)
            data["version"] = existing.version + 1
            data["status"] = BlueprintStatus.DRAFT
            data["updated_at"] = dt.datetime.now(dt.UTC)
            new_bp = Blueprint(**data)
            saved = self._repo.create_blueprint(new_bp)
            self._save_version(saved, created_by=existing.created_by)
            return saved

        return self._repo.update_blueprint(tenant_id, blueprint_id, updates)

    def delete_blueprint(self, tenant_id: str, blueprint_id: str) -> bool:
        return self._repo.delete_blueprint(tenant_id, blueprint_id)

    def publish_blueprint(self, tenant_id: str, blueprint_id: str) -> Optional[Blueprint]:
        bp = self._repo.get_blueprint(tenant_id, blueprint_id)
        if bp is None:
            return None
        if bp.status == BlueprintStatus.PUBLISHED:
            return bp
        updates = BlueprintUpdate(status=BlueprintStatus.PUBLISHED)
        published = self._repo.update_blueprint(tenant_id, blueprint_id, updates)
        if published is not None:
            self._save_version(published, created_by=published.created_by)
        return published

    def _save_version(self, bp: Blueprint, created_by: str = "system") -> None:
        snapshot = bp.model_dump()
        snapshot["tenant_id"] = bp.tenant_id
        version = BlueprintVersion(
            blueprint_id=bp.blueprint_id,
            version=bp.version,
            snapshot=snapshot,
            created_by=created_by,
        )
        self._version_repo.save_version(version)


class BlueprintVersionService:
    def __init__(
        self,
        version_repo: InMemoryBlueprintVersionRepository,
    ) -> None:
        self._repo = version_repo

    def list_versions(self, tenant_id: str, blueprint_id: str) -> List[BlueprintVersion]:
        return self._repo.list_versions(tenant_id, blueprint_id)

    def get_version(
        self, tenant_id: str, blueprint_id: str, version: int
    ) -> Optional[BlueprintVersion]:
        return self._repo.get_version(tenant_id, blueprint_id, version)


class BlueprintMaterializationService:
    """Converts a published blueprint into standard LangGraph graph JSON."""

    def __init__(
        self,
        blueprint_repo: InMemoryBlueprintRepository,
    ) -> None:
        self._repo = blueprint_repo

    def materialize(
        self,
        tenant_id: str,
        blueprint_id: str,
        id_prefix: Optional[str] = None,
    ) -> dict:
        bp = self._repo.get_blueprint(tenant_id, blueprint_id)
        if bp is None:
            raise ValueError(f"Blueprint {blueprint_id} not found for tenant {tenant_id}")
        if bp.status != BlueprintStatus.PUBLISHED:
            raise ValueError(f"Blueprint {blueprint_id} is not published")

        graph_def = copy.deepcopy(bp.graph_definition)
        prefix = id_prefix or bp.blueprint_id[:8]

        nodes = graph_def.get("nodes", [])
        for node in nodes:
            node["id"] = f"{prefix}-{node.get('id', node.get('ref', 'node'))}"

        edges = graph_def.get("edges", [])
        for edge in edges:
            edge["source"] = f"{prefix}-{edge['source']}"
            edge["target"] = f"{prefix}-{edge['target']}"

        return {
            "graph": {
                "nodes": nodes,
                "edges": edges,
                "inputs": graph_def.get("inputs", {}),
            },
            "blueprint_id": bp.blueprint_id,
            "blueprint_name": bp.name,
            "version": bp.version,
        }


class AuthService:
    def __init__(
        self,
        user_repo: InMemoryUserRepository,
        tenant_repo: InMemoryTenantRepository,
    ) -> None:
        self._user_repo = user_repo
        self._tenant_repo = tenant_repo

    def login(self, req: LoginRequest) -> LoginResponse:
        email = req.email.strip().lower()
        user = self._user_repo.get_user_by_email(email)
        if not user:
            raise ValueError(f"User with email '{req.email}' not found.")

        effective_tenant_id = user.tenant_id
        effective_tenant_name = user.tenant_name

        if user.role == UserRole.SUPER_ADMIN and req.tenant_id:
            effective_tenant_id = req.tenant_id
            if req.tenant_id == "all":
                effective_tenant_name = "All Tenants (Super Admin)"
            else:
                t = self._tenant_repo.get_tenant(req.tenant_id)
                if t:
                    effective_tenant_name = t.tenant_name

        profile = UserProfile(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            tenant_id=effective_tenant_id,
            tenant_name=effective_tenant_name,
            avatar=user.avatar,
            title=user.title,
        )

        all_tenants = self._tenant_repo.list_tenants()
        token = f"tnp-jwt-{user.id}-{int(dt.datetime.now(dt.UTC).timestamp())}"

        return LoginResponse(
            success=True,
            token=token,
            user=profile,
            available_tenants=all_tenants,
        )

    def get_personas(self) -> List[PersonaItem]:
        return self._user_repo.list_personas()

    def get_user_by_id(self, user_id: str) -> Optional[UserProfile]:
        user = self._user_repo.get_user_by_id(user_id)
        if not user:
            return None
        return UserProfile(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            tenant_id=user.tenant_id,
            tenant_name=user.tenant_name,
            avatar=user.avatar,
            title=user.title,
        )


class UserService:
    def __init__(
        self,
        user_repo: InMemoryUserRepository,
        tenant_repo: InMemoryTenantRepository,
    ) -> None:
        self._user_repo = user_repo
        self._tenant_repo = tenant_repo

    def list_users(self, tenant_id: Optional[str] = None) -> List[UserProfile]:
        users = self._user_repo.list_users(tenant_id=tenant_id)
        return [
            UserProfile(
                id=u.id,
                name=u.name,
                email=u.email,
                role=u.role,
                tenant_id=u.tenant_id,
                tenant_name=u.tenant_name,
                avatar=u.avatar,
                title=u.title,
            )
            for u in users
        ]

    def get_user(self, user_id: str) -> Optional[UserProfile]:
        u = self._user_repo.get_user_by_id(user_id)
        if not u:
            return None
        return UserProfile(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role,
            tenant_id=u.tenant_id,
            tenant_name=u.tenant_name,
            avatar=u.avatar,
            title=u.title,
        )

    def create_user(self, create: UserCreate) -> UserProfile:
        existing = self._user_repo.get_user_by_email(create.email)
        if existing:
            raise ValueError(f"User with email '{create.email}' already exists")

        tenant_name = "Global / Cross-Tenant"
        if create.tenant_id != "all":
            t = self._tenant_repo.get_tenant(create.tenant_id)
            if not t:
                raise ValueError(f"Tenant '{create.tenant_id}' not found")
            tenant_name = t.tenant_name

        user_id = f"usr-{str(uuid.uuid4())[:8]}"
        user = User(
            id=user_id,
            name=create.name,
            email=create.email.strip().lower(),
            role=create.role,
            tenant_id=create.tenant_id,
            tenant_name=tenant_name,
            avatar=create.avatar or "👤",
            title=create.title or "Workflow Operator",
            password_hash=create.password or "password123",
        )
        saved = self._user_repo.create_user(user)
        return UserProfile(
            id=saved.id,
            name=saved.name,
            email=saved.email,
            role=saved.role,
            tenant_id=saved.tenant_id,
            tenant_name=saved.tenant_name,
            avatar=saved.avatar,
            title=saved.title,
        )

    def update_user(self, user_id: str, updates: UserUpdate) -> Optional[UserProfile]:
        existing = self._user_repo.get_user_by_id(user_id)
        if not existing:
            return None
        
        update_dict = updates.model_dump(exclude_unset=True)
        if "tenant_id" in update_dict:
            t = self._tenant_repo.get_tenant(update_dict["tenant_id"])
            if t:
                update_dict["tenant_name"] = t.tenant_name

        if "password" in update_dict:
            update_dict["password_hash"] = update_dict.pop("password")

        updated = self._user_repo.update_user(user_id, update_dict)
        if not updated:
            return None
        return UserProfile(
            id=updated.id,
            name=updated.name,
            email=updated.email,
            role=updated.role,
            tenant_id=updated.tenant_id,
            tenant_name=updated.tenant_name,
            avatar=updated.avatar,
            title=updated.title,
        )

    def delete_user(self, user_id: str) -> bool:
        return self._user_repo.delete_user(user_id)

