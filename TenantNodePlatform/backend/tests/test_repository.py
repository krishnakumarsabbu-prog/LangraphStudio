"""Tests for repository behavior and dependency management."""

from __future__ import annotations

from TenantNodePlatform.backend.models import (
    Blueprint,
    BlueprintDependency,
    DependencyType,
    Tenant,
)


def test_tenant_repo_crud(tenant_repo):
    t = Tenant(tenant_id="t1", tenant_name="T1")
    tenant_repo.create_tenant(t)
    assert tenant_repo.get_tenant("t1") is not None
    assert len(tenant_repo.list_tenants()) == 1
    assert tenant_repo.delete_tenant("t1") is True
    assert tenant_repo.get_tenant("t1") is None


def test_blueprint_repo_isolation(blueprint_repo):
    bp_a = Blueprint(blueprint_id="bp1", tenant_id="tenantA", name="A")
    bp_b = Blueprint(blueprint_id="bp2", tenant_id="tenantB", name="B")
    blueprint_repo.create_blueprint(bp_a)
    blueprint_repo.create_blueprint(bp_b)

    assert len(blueprint_repo.list_blueprints("tenantA")) == 1
    assert len(blueprint_repo.list_blueprints("tenantB")) == 1
    assert blueprint_repo.get_blueprint("tenantA", "bp1") is not None
    assert blueprint_repo.get_blueprint("tenantB", "bp1") is None
    assert blueprint_repo.get_blueprint("tenantA", "bp2") is None


def test_version_repo_records_and_lists(version_repo):
    from TenantNodePlatform.backend.models import BlueprintVersion

    v1 = BlueprintVersion(blueprint_id="bp1", version=1, snapshot={"tenant_id": "t1", "name": "v1"})
    version_repo.save_version(v1)
    v2 = BlueprintVersion(blueprint_id="bp1", version=2, snapshot={"tenant_id": "t1", "name": "v2"})
    version_repo.save_version(v2)

    versions = version_repo.list_versions("t1", "bp1")
    assert len(versions) == 2
    assert version_repo.get_latest_version_number("t1", "bp1") == 2
    assert version_repo.get_version("t1", "bp1", 1).snapshot["name"] == "v1"


def test_dependency_add_and_list(dependency_repo):
    dep = BlueprintDependency(
        dependent_id="bp1",
        dependency_id="bp2",
        dependency_type=DependencyType.GRAPH_BLUEPRINT,
        tenant_id="t1",
    )
    dependency_repo.add_dependency(dep)
    deps = dependency_repo.get_dependencies("t1", "bp1")
    assert len(deps) == 1
    assert deps[0].dependency_id == "bp2"


def test_dependency_circular_detection(dependency_repo):
    # bp1 -> bp2
    dependency_repo.add_dependency(
        BlueprintDependency(dependent_id="bp1", dependency_id="bp2", tenant_id="t1")
    )
    # bp2 -> bp3
    dependency_repo.add_dependency(
        BlueprintDependency(dependent_id="bp2", dependency_id="bp3", tenant_id="t1")
    )
    # Adding bp3 -> bp1 should be circular
    assert dependency_repo.check_circular("t1", "bp3", "bp1") is True
    # Adding bp1 -> bp2 (already exists) — check self
    assert dependency_repo.check_circular("t1", "bp1", "bp1") is True
    # Non-circular: bp1 -> bp4
    assert dependency_repo.check_circular("t1", "bp1", "bp4") is False


def test_dependency_remove(dependency_repo):
    dependency_repo.add_dependency(
        BlueprintDependency(dependent_id="bp1", dependency_id="bp2", tenant_id="t1")
    )
    assert dependency_repo.remove_dependency("t1", "bp1", "bp2") is True
    assert len(dependency_repo.get_dependencies("t1", "bp1")) == 0
    assert dependency_repo.remove_dependency("t1", "bp1", "bp2") is False


def test_dependency_tenant_isolation(dependency_repo):
    dependency_repo.add_dependency(
        BlueprintDependency(dependent_id="bp1", dependency_id="bp2", tenant_id="t1")
    )
    dependency_repo.add_dependency(
        BlueprintDependency(dependent_id="bp1", dependency_id="bp3", tenant_id="t2")
    )
    assert len(dependency_repo.get_dependencies("t1", "bp1")) == 1
    assert len(dependency_repo.get_dependencies("t2", "bp1")) == 1
    assert dependency_repo.get_dependencies("t1", "bp1")[0].dependency_id == "bp2"
