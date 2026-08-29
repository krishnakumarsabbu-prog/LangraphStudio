"""Workflow flows endpoints for LangGraph Builder & Dashboard."""

from __future__ import annotations

import copy
import datetime as dt
import threading
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/flows", tags=["flows"])


class FlowContext(BaseModel):
    description: Optional[str] = ""


class FlowPayload(BaseModel):
    name: str
    data: Dict[str, Any] = Field(default_factory=dict)
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    tenant_id: Optional[str] = None


class FlowItem(BaseModel):
    name: str
    latest_version: int = 1
    version: int = 1
    created_at: str
    updated_at: str
    data: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)
    tenant_id: Optional[str] = None


# In-memory flows storage
_flows_store: Dict[str, Dict[str, Any]] = {}
_flow_versions: Dict[str, List[Dict[str, Any]]] = {}
_flows_lock = threading.RLock()


# Seed a default sample workflow if empty
def _seed_sample_workflows():
    if not _flows_store:
        sample = {
            "name": "Customer Identity & Address Verification",
            "latest_version": 1,
            "version": 1,
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
            "updated_at": dt.datetime.now(dt.UTC).isoformat(),
            "data": {
                "graph": {
                    "nodes": [
                        {
                            "id": "node-gsa-svc",
                            "type": "serviceNode",
                            "data": {"label": "GSA Address Verification Service", "url": "https://api.gsa.gov/verify", "method": "POST"},
                            "position": {"x": 100, "y": 150}
                        },
                        {
                            "id": "node-rule-dec",
                            "type": "decisionNode",
                            "data": {"label": "Confidence Decision Rule", "branches": ["APPROVE", "MANUAL_REVIEW"]},
                            "position": {"x": 480, "y": 150}
                        }
                    ],
                    "edges": [
                        {"id": "e1", "source": "node-gsa-svc", "target": "node-rule-dec"}
                    ]
                }
            },
            "context": {"description": "Orchestrated federal identity and address validation pipeline"},
            "tenant_id": "tenant-gsa"
        }
        _flows_store[sample["name"]] = sample
        _flow_versions[sample["name"]] = [sample]

_seed_sample_workflows()


@router.get("", response_model=None)
def get_all_flows(tenant_id: Optional[str] = Query(default=None)):
    with _flows_lock:
        items = []
        for flow in _flows_store.values():
            if tenant_id and tenant_id != "all" and flow.get("tenant_id") and flow.get("tenant_id") != tenant_id:
                continue
            items.append(copy.deepcopy(flow))
        return items


@router.get("/{name}", response_model=None)
def get_flow(name: str):
    with _flows_lock:
        flow = _flows_store.get(name)
        if not flow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
        return copy.deepcopy(flow)


@router.post("", response_model=None)
def save_flow(payload: FlowPayload):
    with _flows_lock:
        now_iso = dt.datetime.now(dt.UTC).isoformat()
        existing = _flows_store.get(payload.name)
        
        if existing:
            new_version = existing.get("latest_version", 1) + 1
            updated = {
                "name": payload.name,
                "latest_version": new_version,
                "version": new_version,
                "created_at": existing.get("created_at", now_iso),
                "updated_at": now_iso,
                "data": payload.data,
                "context": payload.context or {},
                "tenant_id": payload.tenant_id or existing.get("tenant_id", "tenant-gsa"),
            }
            _flows_store[payload.name] = updated
            _flow_versions.setdefault(payload.name, []).append(copy.deepcopy(updated))
            return updated
        else:
            new_flow = {
                "name": payload.name,
                "latest_version": 1,
                "version": 1,
                "created_at": now_iso,
                "updated_at": now_iso,
                "data": payload.data,
                "context": payload.context or {},
                "tenant_id": payload.tenant_id or "tenant-gsa",
            }
            _flows_store[payload.name] = new_flow
            _flow_versions.setdefault(payload.name, [copy.deepcopy(new_flow)])
            return new_flow


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flow(name: str):
    with _flows_lock:
        if name in _flows_store:
            _flows_store.pop(name, None)
            _flow_versions.pop(name, None)
            return None
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")


@router.get("/{name}/versions", response_model=None)
def get_flow_versions(name: str):
    with _flows_lock:
        versions = _flow_versions.get(name, [])
        return versions
