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
    Tenant,
    TenantCreate,
    TenantUpdate,
)
from ..repositories.in_memory import (
    InMemoryBlueprintRepository,
    InMemoryBlueprintVersionRepository,
    InMemoryDependencyRepository,
    InMemoryTenantRepository,
)


class TenantService:
    def __init__(self, tenant_repo: InMemoryTenantRepository) -> None:
        self._repo = tenant_repo

    def create_tenant(self, create: TenantCreate) -> Tenant:
        tenant = Tenant(
            tenant_id=str(uuid.uuid4()),
            tenant_name=create.tenant_name,
            metadata=create.metadata,
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
