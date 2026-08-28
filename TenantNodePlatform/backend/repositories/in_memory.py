"""In-memory repository implementations.

All data is partitioned by ``tenant_id``. No method can read or write
another tenant's data. Data is lost on restart — intentional for this
phase. A future database-backed implementation can replace these
classes without changing business logic.
"""

from __future__ import annotations

import copy
import datetime as dt
import threading
from typing import Dict, List, Optional, Set

from ..models import (
    Blueprint,
    BlueprintDependency,
    BlueprintUpdate,
    BlueprintVersion,
    Tenant,
    TenantUpdate,
)


class InMemoryTenantRepository:
    """Dict-backed tenant store. Thread-safe via a single lock."""

    def __init__(self) -> None:
        self._tenants: Dict[str, Tenant] = {}
        self._lock = threading.RLock()

    def create_tenant(self, tenant: Tenant) -> Tenant:
        with self._lock:
            self._tenants[tenant.tenant_id] = tenant
            return copy.deepcopy(tenant)

    def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        with self._lock:
            t = self._tenants.get(tenant_id)
            return copy.deepcopy(t) if t else None

    def list_tenants(self) -> List[Tenant]:
        with self._lock:
            return [copy.deepcopy(t) for t in self._tenants.values()]

    def update_tenant(self, tenant_id: str, updates: TenantUpdate) -> Optional[Tenant]:
        with self._lock:
            t = self._tenants.get(tenant_id)
            if t is None:
                return None
            data = t.model_dump()
            update_data = updates.model_dump(exclude_unset=True)
            data.update(update_data)
            data["updated_at"] = dt.datetime.now(dt.UTC)
            updated = Tenant(**data)
            self._tenants[tenant_id] = updated
            return copy.deepcopy(updated)

    def delete_tenant(self, tenant_id: str) -> bool:
        with self._lock:
            return self._tenants.pop(tenant_id, None) is not None


class InMemoryBlueprintRepository:
    """Dict-backed blueprint store, partitioned by tenant_id."""

    def __init__(self) -> None:
        # { tenant_id: { blueprint_id: Blueprint } }
        self._blueprints: Dict[str, Dict[str, Blueprint]] = {}
        self._lock = threading.RLock()

    def _tenant_bucket(self, tenant_id: str) -> Dict[str, Blueprint]:
        return self._blueprints.setdefault(tenant_id, {})

    def create_blueprint(self, blueprint: Blueprint) -> Blueprint:
        with self._lock:
            self._tenant_bucket(blueprint.tenant_id)[blueprint.blueprint_id] = blueprint
            return copy.deepcopy(blueprint)

    def get_blueprint(
        self, tenant_id: str, blueprint_id: str, version: Optional[int] = None
    ) -> Optional[Blueprint]:
        with self._lock:
            bp = self._tenant_bucket(tenant_id).get(blueprint_id)
            if bp is None:
                return None
            if version is not None and bp.version != version:
                return None
            return copy.deepcopy(bp)

    def list_blueprints(self, tenant_id: str) -> List[Blueprint]:
        with self._lock:
            return [copy.deepcopy(bp) for bp in self._tenant_bucket(tenant_id).values()]

    def update_blueprint(
        self, tenant_id: str, blueprint_id: str, updates: BlueprintUpdate
    ) -> Optional[Blueprint]:
        with self._lock:
            bp = self._tenant_bucket(tenant_id).get(blueprint_id)
            if bp is None:
                return None
            data = bp.model_dump()
            update_data = updates.model_dump(exclude_unset=True)
            data.update(update_data)
            data["updated_at"] = dt.datetime.now(dt.UTC)
            updated = Blueprint(**data)
            self._tenant_bucket(tenant_id)[blueprint_id] = updated
            return copy.deepcopy(updated)

    def delete_blueprint(self, tenant_id: str, blueprint_id: str) -> bool:
        with self._lock:
            return self._tenant_bucket(tenant_id).pop(blueprint_id, None) is not None


class InMemoryBlueprintVersionRepository:
    """Dict-backed version store: { tenant_id: { blueprint_id: [version, ...] } }."""

    def __init__(self) -> None:
        self._versions: Dict[str, Dict[str, List[BlueprintVersion]]] = {}
        self._lock = threading.RLock()

    def _tenant_bucket(self, tenant_id: str) -> Dict[str, List[BlueprintVersion]]:
        return self._versions.setdefault(tenant_id, {})

    def save_version(self, version: BlueprintVersion) -> BlueprintVersion:
        with self._lock:
            bucket = self._tenant_bucket(version.snapshot.get("tenant_id", ""))
            bp_id = version.blueprint_id
            bucket.setdefault(bp_id, []).append(version)
            return copy.deepcopy(version)

    def get_version(
        self, tenant_id: str, blueprint_id: str, version: int
    ) -> Optional[BlueprintVersion]:
        with self._lock:
            versions = self._tenant_bucket(tenant_id).get(blueprint_id, [])
            for v in versions:
                if v.version == version:
                    return copy.deepcopy(v)
            return None

    def list_versions(
        self, tenant_id: str, blueprint_id: str
    ) -> List[BlueprintVersion]:
        with self._lock:
            versions = self._tenant_bucket(tenant_id).get(blueprint_id, [])
            return [copy.deepcopy(v) for v in versions]

    def get_latest_version_number(
        self, tenant_id: str, blueprint_id: str
    ) -> Optional[int]:
        with self._lock:
            versions = self._tenant_bucket(tenant_id).get(blueprint_id, [])
            if not versions:
                return None
            return max(v.version for v in versions)


class InMemoryDependencyRepository:
    """List-backed dependency store, partitioned by tenant_id."""

    def __init__(self) -> None:
        # { tenant_id: [BlueprintDependency, ...] }
        self._deps: Dict[str, List[BlueprintDependency]] = {}
        self._lock = threading.RLock()

    def _tenant_bucket(self, tenant_id: str) -> List[BlueprintDependency]:
        return self._deps.setdefault(tenant_id, [])

    def add_dependency(self, dependency: BlueprintDependency) -> BlueprintDependency:
        with self._lock:
            bucket = self._tenant_bucket(dependency.tenant_id)
            for existing in bucket:
                if (
                    existing.dependent_id == dependency.dependent_id
                    and existing.dependency_id == dependency.dependency_id
                ):
                    return copy.deepcopy(existing)
            bucket.append(dependency)
            return copy.deepcopy(dependency)

    def get_dependencies(
        self, tenant_id: str, blueprint_id: str
    ) -> List[BlueprintDependency]:
        with self._lock:
            return [
                copy.deepcopy(d)
                for d in self._tenant_bucket(tenant_id)
                if d.dependent_id == blueprint_id
            ]

    def check_circular(
        self, tenant_id: str, dependent_id: str, dependency_id: str
    ) -> bool:
        """Return True if adding dependent_id -> dependency_id creates a cycle."""
        with self._lock:
            if dependent_id == dependency_id:
                return True
            visited: Set[str] = set()
            stack = [dependency_id]
            deps = self._tenant_bucket(tenant_id)
            while stack:
                current = stack.pop()
                if current == dependent_id:
                    return True
                if current in visited:
                    continue
                visited.add(current)
                for d in deps:
                    if d.dependent_id == current:
                        stack.append(d.dependency_id)
            return False

    def remove_dependency(
        self, tenant_id: str, dependent_id: str, dependency_id: str
    ) -> bool:
        with self._lock:
            bucket = self._tenant_bucket(tenant_id)
            for i, d in enumerate(bucket):
                if d.dependent_id == dependent_id and d.dependency_id == dependency_id:
                    bucket.pop(i)
                    return True
            return False
