"""Pytest configuration for TNP backend tests.

Each test module gets fresh in-memory repositories and services so tests
are fully isolated.
"""

from __future__ import annotations

import sys
import os
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pytest

from TenantNodePlatform.backend.repositories.in_memory import (
    InMemoryBlueprintRepository,
    InMemoryBlueprintVersionRepository,
    InMemoryDependencyRepository,
    InMemoryTenantRepository,
)
from TenantNodePlatform.backend.services.services import (
    BlueprintMaterializationService,
    BlueprintService,
    BlueprintVersionService,
    TenantService,
)


@pytest.fixture
def tenant_repo():
    return InMemoryTenantRepository()


@pytest.fixture
def blueprint_repo():
    return InMemoryBlueprintRepository()


@pytest.fixture
def version_repo():
    return InMemoryBlueprintVersionRepository()


@pytest.fixture
def dependency_repo():
    return InMemoryDependencyRepository()


@pytest.fixture
def tenant_service(tenant_repo):
    return TenantService(tenant_repo)


@pytest.fixture
def blueprint_service(blueprint_repo, version_repo):
    return BlueprintService(blueprint_repo, version_repo)


@pytest.fixture
def version_service(version_repo):
    return BlueprintVersionService(version_repo)


@pytest.fixture
def materialization_service(blueprint_repo):
    return BlueprintMaterializationService(blueprint_repo)
