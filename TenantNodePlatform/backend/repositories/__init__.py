"""Repository abstract interfaces for the Tenant Node Platform.

These protocols define the persistence seam. The in-memory implementation
lives in ``in_memory.py``. A future database-backed implementation can
satisfy the same protocols without changing any business logic.
"""

from __future__ import annotations

from typing import List, Optional, Protocol

from ..models import (
    Blueprint,
    BlueprintDependency,
    BlueprintUpdate,
    BlueprintVersion,
    Tenant,
    TenantUpdate,
)


# --------------------------------------------------------------------------- #
# Tenant repository
# --------------------------------------------------------------------------- #

class TenantRepository(Protocol):
    def create_tenant(self, tenant: Tenant) -> Tenant: ...
    def get_tenant(self, tenant_id: str) -> Optional[Tenant]: ...
    def list_tenants(self) -> List[Tenant]: ...
    def update_tenant(self, tenant_id: str, updates: TenantUpdate) -> Optional[Tenant]: ...
    def delete_tenant(self, tenant_id: str) -> bool: ...


# --------------------------------------------------------------------------- #
# Blueprint repository
# --------------------------------------------------------------------------- #

class BlueprintRepository(Protocol):
    def create_blueprint(self, blueprint: Blueprint) -> Blueprint: ...
    def get_blueprint(
        self, tenant_id: str, blueprint_id: str, version: Optional[int] = None
    ) -> Optional[Blueprint]: ...
    def list_blueprints(self, tenant_id: str) -> List[Blueprint]: ...
    def update_blueprint(
        self, tenant_id: str, blueprint_id: str, updates: BlueprintUpdate
    ) -> Optional[Blueprint]: ...
    def delete_blueprint(self, tenant_id: str, blueprint_id: str) -> bool: ...


# --------------------------------------------------------------------------- #
# Blueprint version repository
# --------------------------------------------------------------------------- #

class BlueprintVersionRepository(Protocol):
    def save_version(self, version: BlueprintVersion) -> BlueprintVersion: ...
    def get_version(
        self, tenant_id: str, blueprint_id: str, version: int
    ) -> Optional[BlueprintVersion]: ...
    def list_versions(
        self, tenant_id: str, blueprint_id: str
    ) -> List[BlueprintVersion]: ...
    def get_latest_version_number(
        self, tenant_id: str, blueprint_id: str
    ) -> Optional[int]: ...


# --------------------------------------------------------------------------- #
# Dependency repository
# --------------------------------------------------------------------------- #

class DependencyRepository(Protocol):
    def add_dependency(self, dependency: BlueprintDependency) -> BlueprintDependency: ...
    def get_dependencies(
        self, tenant_id: str, blueprint_id: str
    ) -> List[BlueprintDependency]: ...
    def check_circular(
        self, tenant_id: str, dependent_id: str, dependency_id: str
    ) -> bool: ...
    def remove_dependency(
        self, tenant_id: str, dependent_id: str, dependency_id: str
    ) -> bool: ...
