"""Tests for blueprint creation, retrieval, versioning, and publishing."""

from __future__ import annotations

from TenantNodePlatform.backend.models import (
    BlueprintCreate,
    BlueprintStatus,
    BlueprintUpdate,
    SourceType,
)


def _sample_graph():
    return {
        "nodes": [
            {"id": "svc-1", "type": "service", "data": {"label": "Svc", "url": "https://api.example.com", "method": "POST"}},
            {"id": "dec-1", "type": "decision", "data": {"label": "Dec", "rules": []}},
        ],
        "edges": [{"source": "svc-1", "target": "dec-1", "condition": ""}],
        "inputs": {},
    }


def test_create_blueprint(blueprint_service):
    create = BlueprintCreate(
        name="Test BP",
        description="A test blueprint",
        source_type=SourceType.GRAPH,
        graph_definition=_sample_graph(),
    )
    bp = blueprint_service.create_blueprint("tenant-1", create)
    assert bp.blueprint_id is not None
    assert bp.name == "Test BP"
    assert bp.version == 1
    assert bp.status == BlueprintStatus.DRAFT


def test_get_blueprint(blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1",
        BlueprintCreate(name="BP1", graph_definition=_sample_graph()),
    )
    fetched = blueprint_service.get_blueprint("tenant-1", bp.blueprint_id)
    assert fetched is not None
    assert fetched.name == "BP1"


def test_get_nonexistent_blueprint(blueprint_service):
    assert blueprint_service.get_blueprint("tenant-1", "nope") is None


def test_list_blueprints(blueprint_service):
    blueprint_service.create_blueprint("tenant-1", BlueprintCreate(name="A"))
    blueprint_service.create_blueprint("tenant-1", BlueprintCreate(name="B"))
    bps = blueprint_service.list_blueprints("tenant-1")
    assert len(bps) == 2


def test_publish_blueprint(blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="ToPublish", graph_definition=_sample_graph())
    )
    published = blueprint_service.publish_blueprint("tenant-1", bp.blueprint_id)
    assert published is not None
    assert published.status == BlueprintStatus.PUBLISHED


def test_publish_already_published_is_idempotent(blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="Pub", graph_definition=_sample_graph())
    )
    blueprint_service.publish_blueprint("tenant-1", bp.blueprint_id)
    again = blueprint_service.publish_blueprint("tenant-1", bp.blueprint_id)
    assert again is not None
    assert again.status == BlueprintStatus.PUBLISHED


def test_update_draft_blueprint_keeps_version(blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="Draft", graph_definition=_sample_graph())
    )
    updated = blueprint_service.update_blueprint(
        "tenant-1", bp.blueprint_id, BlueprintUpdate(description="updated desc")
    )
    assert updated is not None
    assert updated.version == 1
    assert updated.description == "updated desc"


def test_update_published_blueprint_creates_new_version(blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="Pub", graph_definition=_sample_graph())
    )
    blueprint_service.publish_blueprint("tenant-1", bp.blueprint_id)
    assert bp.version == 1

    updated = blueprint_service.update_blueprint(
        "tenant-1", bp.blueprint_id, BlueprintUpdate(description="changed after publish")
    )
    assert updated is not None
    assert updated.version == 2
    assert updated.status == BlueprintStatus.DRAFT
    assert updated.description == "changed after publish"


def test_versions_are_recorded(blueprint_service, version_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="Versioned", graph_definition=_sample_graph())
    )
    blueprint_service.publish_blueprint("tenant-1", bp.blueprint_id)
    updated = blueprint_service.update_blueprint(
        "tenant-1", bp.blueprint_id, BlueprintUpdate(description="v2 change")
    )
    blueprint_service.publish_blueprint("tenant-1", updated.blueprint_id)

    versions = version_service.list_versions("tenant-1", bp.blueprint_id)
    assert len(versions) >= 2
    version_numbers = [v.version for v in versions]
    assert 1 in version_numbers
    assert 2 in version_numbers


def test_published_version_is_immutable(blueprint_service, version_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="Immutable", graph_definition=_sample_graph())
    )
    blueprint_service.publish_blueprint("tenant-1", bp.blueprint_id)

    v1 = version_service.get_version("tenant-1", bp.blueprint_id, 1)
    assert v1 is not None
    original_snapshot = v1.snapshot.copy()
    # Updating the blueprint creates a new version, v1 snapshot must be unchanged
    updated = blueprint_service.update_blueprint(
        "tenant-1", bp.blueprint_id, BlueprintUpdate(description="new desc")
    )
    assert updated.version == 2

    v1_after = version_service.get_version("tenant-1", bp.blueprint_id, 1)
    assert v1_after.snapshot == original_snapshot


def test_delete_blueprint(blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="ToDelete")
    )
    assert blueprint_service.delete_blueprint("tenant-1", bp.blueprint_id) is True
    assert blueprint_service.get_blueprint("tenant-1", bp.blueprint_id) is None


def test_cross_tenant_access_rejected(blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-A", BlueprintCreate(name="Private", graph_definition=_sample_graph())
    )
    # tenant-B cannot access tenant-A's blueprint
    assert blueprint_service.get_blueprint("tenant-B", bp.blueprint_id) is None
    assert blueprint_service.update_blueprint("tenant-B", bp.blueprint_id, BlueprintUpdate(description="hack")) is None
    assert blueprint_service.delete_blueprint("tenant-B", bp.blueprint_id) is False
    # tenant-A still has it
    assert blueprint_service.get_blueprint("tenant-A", bp.blueprint_id) is not None
