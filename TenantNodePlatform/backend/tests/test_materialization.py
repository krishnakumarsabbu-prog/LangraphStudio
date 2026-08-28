"""Tests for blueprint materialization."""

from __future__ import annotations

import pytest

from TenantNodePlatform.backend.models import (
    BlueprintCreate,
    BlueprintStatus,
    SourceType,
)


def _sample_graph():
    return {
        "nodes": [
            {"id": "svc-1", "type": "service", "data": {"label": "Svc", "url": "https://api.example.com", "method": "POST"}},
            {"id": "dec-1", "type": "decision", "data": {"label": "Dec", "rules": []}},
        ],
        "edges": [{"source": "svc-1", "target": "dec-1", "condition": ""}],
        "inputs": {"address": {}},
    }


def test_materialize_published_blueprint(materialization_service, blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="Mat", graph_definition=_sample_graph())
    )
    blueprint_service.publish_blueprint("tenant-1", bp.blueprint_id)

    result = materialization_service.materialize("tenant-1", bp.blueprint_id, id_prefix="inst1")
    assert "graph" in result
    assert len(result["graph"]["nodes"]) == 2
    assert result["graph"]["nodes"][0]["id"].startswith("inst1-")
    assert result["graph"]["nodes"][1]["id"].startswith("inst1-")
    assert result["graph"]["edges"][0]["source"].startswith("inst1-")
    assert result["graph"]["edges"][0]["target"].startswith("inst1-")
    assert result["graph"]["inputs"] == {"address": {}}


def test_materialize_unpublished_fails(materialization_service, blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="Unpub", graph_definition=_sample_graph())
    )
    with pytest.raises(ValueError, match="not published"):
        materialization_service.materialize("tenant-1", bp.blueprint_id)


def test_materialize_nonexistent_fails(materialization_service):
    with pytest.raises(ValueError, match="not found"):
        materialization_service.materialize("tenant-1", "no-such-bp")


def test_materialize_cross_tenant_fails(materialization_service, blueprint_service):
    bp = blueprint_service.create_blueprint(
        "tenant-A", BlueprintCreate(name="Private", graph_definition=_sample_graph())
    )
    blueprint_service.publish_blueprint("tenant-A", bp.blueprint_id)
    with pytest.raises(ValueError, match="not found"):
        materialization_service.materialize("tenant-B", bp.blueprint_id)


def test_materialize_graph_json_format(materialization_service, blueprint_service):
    """Materialized output must match the { graph: { nodes, edges, inputs } } shape
    that the existing LangGraph store's importJSON() expects."""
    bp = blueprint_service.create_blueprint(
        "tenant-1", BlueprintCreate(name="Format", graph_definition=_sample_graph())
    )
    blueprint_service.publish_blueprint("tenant-1", bp.blueprint_id)

    result = materialization_service.materialize("tenant-1", bp.blueprint_id, id_prefix="fmt")
    assert set(result["graph"].keys()) == {"nodes", "edges", "inputs"}
    for node in result["graph"]["nodes"]:
        assert "id" in node
        assert "type" in node
        assert "data" in node
    for edge in result["graph"]["edges"]:
        assert "source" in edge
        assert "target" in edge
