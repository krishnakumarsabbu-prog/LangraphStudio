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
    AuditLog,
    Blueprint,
    BlueprintDependency,
    BlueprintUpdate,
    BlueprintVersion,
    FrameworkNode,
    FrameworkNodeUpdate,
    NodeExecution,
    PersonaItem,
    Tenant,
    TenantNodeAccess,
    TenantUpdate,
    User,
    WorkflowExecution,
    WorkflowExecutionUpdate,
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


class InMemoryUserRepository:
    """Dict-backed user and persona repository."""

    def __init__(self) -> None:
        # { user_id: User }
        self._users: Dict[str, User] = {}
        # { email_lowercase: user_id }
        self._by_email: Dict[str, str] = {}
        # { persona_key: PersonaItem }
        self._personas: Dict[str, PersonaItem] = {}
        self._lock = threading.RLock()

    def create_user(self, user: User) -> User:
        with self._lock:
            self._users[user.id] = copy.deepcopy(user)
            self._by_email[user.email.strip().lower()] = user.id
            # Auto-register/sync persona so it appears in quick login and switcher
            persona_key = f"usr_{user.id}"
            self._personas[persona_key] = PersonaItem(
                key=persona_key,
                name=user.name,
                email=user.email,
                role=user.role,
                tenant_id=user.tenant_id,
                tenant_name=user.tenant_name,
                title=user.title or "Member",
                avatar=user.avatar or "👤",
                description=f"{user.tenant_name} • {user.role.value}",
            )
            return copy.deepcopy(user)

    def update_user(self, user_id: str, updates: dict) -> Optional[User]:
        with self._lock:
            u = self._users.get(user_id)
            if not u:
                return None
            data = u.model_dump()
            data.update(updates)
            updated = User(**data)
            self._users[user_id] = updated
            self._by_email[updated.email.strip().lower()] = user_id

            persona_key = f"usr_{user_id}"
            self._personas[persona_key] = PersonaItem(
                key=persona_key,
                name=updated.name,
                email=updated.email,
                role=updated.role,
                tenant_id=updated.tenant_id,
                tenant_name=updated.tenant_name,
                title=updated.title or "Member",
                avatar=updated.avatar or "👤",
                description=f"{updated.tenant_name} • {updated.role.value}",
            )
            return copy.deepcopy(updated)

    def delete_user(self, user_id: str) -> bool:
        with self._lock:
            u = self._users.pop(user_id, None)
            if u:
                self._by_email.pop(u.email.strip().lower(), None)
                self._personas.pop(f"usr_{user_id}", None)
                # also check if any legacy persona used this email
                to_delete = [k for k, p in self._personas.items() if p.email.strip().lower() == u.email.strip().lower()]
                for k in to_delete:
                    self._personas.pop(k, None)
                return True
            return False

    def get_user_by_email(self, email: str) -> Optional[User]:
        with self._lock:
            uid = self._by_email.get(email.strip().lower())
            if not uid:
                return None
            return copy.deepcopy(self._users.get(uid))

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        with self._lock:
            u = self._users.get(user_id)
            return copy.deepcopy(u) if u else None

    def list_users(self, tenant_id: Optional[str] = None) -> List[User]:
        with self._lock:
            if tenant_id and tenant_id != "all":
                return [copy.deepcopy(u) for u in self._users.values() if u.tenant_id == tenant_id]
            return [copy.deepcopy(u) for u in self._users.values()]

    def set_persona(self, persona: PersonaItem) -> None:
        with self._lock:
            self._personas[persona.key] = copy.deepcopy(persona)

    def list_personas(self) -> List[PersonaItem]:
        with self._lock:
            return [copy.deepcopy(p) for p in self._personas.values()]

    def get_persona(self, key: str) -> Optional[PersonaItem]:
        with self._lock:
            p = self._personas.get(key)
            return copy.deepcopy(p) if p else None


class InMemoryFrameworkNodeRepository:
    """Dict-backed framework node store. Keyed by node_type for fast lookup."""

    def __init__(self) -> None:
        self._nodes: Dict[str, FrameworkNode] = {}   # node_id -> FrameworkNode
        self._by_type: Dict[str, str] = {}            # node_type -> node_id
        self._lock = threading.RLock()

    def create(self, node: FrameworkNode) -> FrameworkNode:
        with self._lock:
            self._nodes[node.id] = copy.deepcopy(node)
            self._by_type[node.node_type] = node.id
            return copy.deepcopy(node)

    def get(self, node_id: str) -> Optional[FrameworkNode]:
        with self._lock:
            n = self._nodes.get(node_id)
            return copy.deepcopy(n) if n else None

    def get_by_type(self, node_type: str) -> Optional[FrameworkNode]:
        with self._lock:
            nid = self._by_type.get(node_type)
            if not nid:
                return None
            return copy.deepcopy(self._nodes.get(nid))

    def list_all(self) -> List[FrameworkNode]:
        with self._lock:
            return [copy.deepcopy(n) for n in self._nodes.values()]

    def update(self, node_id: str, updates: FrameworkNodeUpdate) -> Optional[FrameworkNode]:
        with self._lock:
            n = self._nodes.get(node_id)
            if n is None:
                return None
            data = n.model_dump()
            data.update(updates.model_dump(exclude_unset=True))
            import datetime as _dt
            data["updated_at"] = _dt.datetime.now(_dt.UTC)
            updated = FrameworkNode(**data)
            self._nodes[node_id] = updated
            return copy.deepcopy(updated)

    def delete(self, node_id: str) -> bool:
        with self._lock:
            n = self._nodes.pop(node_id, None)
            if n:
                self._by_type.pop(n.node_type, None)
                return True
            return False


class InMemoryTenantNodeAccessRepository:
    """Controls per-tenant framework node availability."""

    def __init__(self) -> None:
        # { tenant_id: { node_type: TenantNodeAccess } }
        self._access: Dict[str, Dict[str, TenantNodeAccess]] = {}
        self._lock = threading.RLock()

    def get_access_list(self, tenant_id: str) -> List[TenantNodeAccess]:
        with self._lock:
            bucket = self._access.get(tenant_id, {})
            return [copy.deepcopy(a) for a in bucket.values()]

    def set_access(self, access: TenantNodeAccess) -> TenantNodeAccess:
        with self._lock:
            self._access.setdefault(tenant_id := access.tenant_id, {})[access.node_type] = copy.deepcopy(access)
            return copy.deepcopy(access)

    def is_enabled(self, tenant_id: str, node_type: str) -> bool:
        with self._lock:
            a = self._access.get(tenant_id, {}).get(node_type)
            # Default: enabled if no record exists
            return a.is_enabled if a is not None else True

    def set_bulk(self, tenant_id: str, all_node_types: List[str], enabled_types: List[str]) -> List[TenantNodeAccess]:
        """Set access for ALL node types for a tenant at once."""
        import datetime as _dt
        with self._lock:
            results = []
            for nt in all_node_types:
                access = TenantNodeAccess(
                    tenant_id=tenant_id,
                    framework_node_id="",
                    node_type=nt,
                    is_enabled=nt in enabled_types,
                    updated_at=_dt.datetime.now(_dt.UTC),
                )
                self._access.setdefault(tenant_id, {})[nt] = access
                results.append(copy.deepcopy(access))
            return results


class InMemoryAuditRepository:
    """Append-only audit log store."""

    def __init__(self) -> None:
        self._logs: List[AuditLog] = []
        self._lock = threading.RLock()

    def append(self, log: AuditLog) -> AuditLog:
        with self._lock:
            self._logs.append(copy.deepcopy(log))
            return copy.deepcopy(log)

    def list_all(
        self,
        tenant_id: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLog]:
        with self._lock:
            results = list(self._logs)
            if tenant_id and tenant_id != "all":
                results = [r for r in results if r.actor_tenant_id == tenant_id or r.target_tenant_id == tenant_id]
            if actor_user_id:
                results = [r for r in results if r.actor_user_id == actor_user_id]
            if action:
                results = [r for r in results if r.action == action]
            # Newest first
            results.sort(key=lambda x: x.timestamp, reverse=True)
            return [copy.deepcopy(r) for r in results[offset: offset + limit]]

    def count(self, tenant_id: Optional[str] = None) -> int:
        with self._lock:
            if tenant_id and tenant_id != "all":
                return sum(1 for r in self._logs if r.actor_tenant_id == tenant_id or r.target_tenant_id == tenant_id)
            return len(self._logs)


class InMemoryExecutionRepository:
    """Tenant-partitioned workflow execution store."""

    def __init__(self) -> None:
        # { tenant_id: { execution_id: WorkflowExecution } }
        self._execs: Dict[str, Dict[str, WorkflowExecution]] = {}
        self._lock = threading.RLock()

    def _bucket(self, tenant_id: str) -> Dict[str, WorkflowExecution]:
        return self._execs.setdefault(tenant_id, {})

    def create(self, execution: WorkflowExecution) -> WorkflowExecution:
        with self._lock:
            self._bucket(execution.tenant_id)[execution.id] = copy.deepcopy(execution)
            return copy.deepcopy(execution)

    def get(self, tenant_id: str, execution_id: str) -> Optional[WorkflowExecution]:
        with self._lock:
            e = self._bucket(tenant_id).get(execution_id)
            return copy.deepcopy(e) if e else None

    def list_for_tenant(
        self,
        tenant_id: str,
        workflow_name: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[WorkflowExecution]:
        with self._lock:
            results = list(self._bucket(tenant_id).values())
            if workflow_name:
                results = [r for r in results if r.workflow_name == workflow_name]
            if status:
                results = [r for r in results if r.status == status]
            results.sort(key=lambda x: x.started_at, reverse=True)
            return [copy.deepcopy(r) for r in results[offset: offset + limit]]

    def count(self, tenant_id: str) -> int:
        with self._lock:
            return len(self._bucket(tenant_id))

    def update(self, tenant_id: str, execution_id: str, updates: WorkflowExecutionUpdate) -> Optional[WorkflowExecution]:
        import datetime as _dt
        with self._lock:
            e = self._bucket(tenant_id).get(execution_id)
            if e is None:
                return None
            data = e.model_dump()
            data.update(updates.model_dump(exclude_unset=True))
            updated = WorkflowExecution(**data)
            self._bucket(tenant_id)[execution_id] = updated
            return copy.deepcopy(updated)

    def count_all(self) -> int:
        with self._lock:
            return sum(len(b) for b in self._execs.values())
