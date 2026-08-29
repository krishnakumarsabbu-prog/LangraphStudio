"""Workflow Execution Router for the LangGraph Platform.

Compiles and executes workflow graphs server-side with real HTTP API calls,
decision rule evaluations, field mappings, and metrics tracking.
Persists execution records to the tenant-partitioned execution repository.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import re
import time
import urllib.error
import urllib.request
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from ..models import (
    AuditAction,
    AuditLog,
    ExecutionStatus,
    NodeExecution,
    WorkflowExecution,
)

router = APIRouter(tags=["execution"])
logger = logging.getLogger("workflow.execution")


# --------------------------------------------------------------------------- #
# Request & Response Schemas
# --------------------------------------------------------------------------- #

class ExecuteWorkflowRequest(BaseModel):
    graph: Dict[str, Any] = Field(default_factory=dict, description="Workflow ReactFlow graph JSON")
    input: Dict[str, Any] = Field(default_factory=dict, description="Workflow input parameters")
    tenant_id: Optional[str] = Field(default="demo-tenant-0001")
    workflow_name: Optional[str] = Field(default="Ad-hoc Workflow")
    workflow_version: Optional[int] = Field(default=1)
    triggered_by: Optional[str] = Field(default=None)
    triggered_by_user_name: Optional[str] = Field(default=None)


# --------------------------------------------------------------------------- #
# Helpers & Node Runners
# --------------------------------------------------------------------------- #

def _replace_template_variables(template: str, state: Dict[str, Any]) -> str:
    """Replace {{path.to.var}} with values from state or input."""
    if not isinstance(template, str):
        return template

    def replacer(match):
        path = match.group(1).strip()
        val = _get_nested(state, path)
        if val is None and "input" in state:
            val = _get_nested(state["input"], path)
        return str(val) if val is not None else ""

    return re.sub(r"\{\{([^}]+)\}\}", replacer, template)


def _get_nested(data: Any, path: str) -> Any:
    if not path or not isinstance(data, dict):
        return data
    parts = path.split(".")
    curr = data
    for p in parts:
        if isinstance(curr, dict):
            curr = curr.get(p)
        else:
            return None
    return curr


def _execute_service_node(node: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    """Execute real HTTP request for a Service Node using standard library."""
    data = node.get("data", {})
    config = data.get("config", {}) or {}

    url = data.get("url") or config.get("url") or ""
    url = _replace_template_variables(url, state)
    method = (data.get("method") or config.get("method") or "GET").upper()

    headers = {}
    raw_headers = config.get("headers") or []
    if isinstance(raw_headers, list):
        for h in raw_headers:
            k = h.get("key")
            v = h.get("value")
            if k:
                headers[k] = _replace_template_variables(str(v), state)
    elif isinstance(raw_headers, dict):
        for k, v in raw_headers.items():
            headers[k] = _replace_template_variables(str(v), state)

    body_bytes = None
    body_data = None
    req_body_raw = config.get("requestBody") or data.get("body")
    if req_body_raw and method in ("POST", "PUT", "PATCH"):
        if isinstance(req_body_raw, str):
            rendered = _replace_template_variables(req_body_raw, state)
            try:
                body_data = json.loads(rendered)
                body_bytes = json.dumps(body_data).encode("utf-8")
                headers.setdefault("Content-Type", "application/json")
            except Exception:
                body_data = rendered
                body_bytes = rendered.encode("utf-8")
        elif isinstance(req_body_raw, dict):
            body_data = req_body_raw
            body_bytes = json.dumps(body_data).encode("utf-8")
            headers.setdefault("Content-Type", "application/json")

    # Capture outgoing request snapshot
    request_snapshot = {
        "url": url,
        "method": method,
        "headers": headers,
        "body": body_data,
    }

    if not url:
        return {
            "status": "success",
            "request": request_snapshot,
            "response": {"message": f"Service node {data.get('label', node.get('id'))} simulated (no URL configured)"},
            "output": {"mock": True},
        }

    # Perform actual HTTP call with timeout
    try:
        req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=15) as resp:
            status_code = resp.status
            raw_content = resp.read().decode("utf-8")
            try:
                resp_payload = json.loads(raw_content)
            except Exception:
                resp_payload = raw_content

            is_ok = 200 <= status_code < 400
            return {
                "status": "success" if is_ok else "error",
                "status_code": status_code,
                "request": request_snapshot,
                "response": resp_payload,
                "error": None if is_ok else f"HTTP {status_code}",
                "output": resp_payload if isinstance(resp_payload, dict) else {"response": resp_payload},
            }
    except urllib.error.HTTPError as http_err:
        try:
            err_content = json.loads(http_err.read().decode("utf-8"))
        except Exception:
            err_content = str(http_err)
        return {
            "status": "error",
            "status_code": http_err.code,
            "request": request_snapshot,
            "response": err_content,
            "error": f"HTTP {http_err.code}",
            "output": {"error": f"HTTP {http_err.code}"},
        }
    except Exception as ex:
        logger.error("Service node execution error for %s: %s", url, ex)
        return {
            "status": "error",
            "request": request_snapshot,
            "response": None,
            "error": str(ex),
            "output": {"error": str(ex)},
        }


def _execute_decision_node(node: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    """Execute decision branching logic and evaluate rules."""
    data = node.get("data", {})
    script = data.get("script") or ""
    rule_def = data.get("ruleDefinition") or {}
    branches = data.get("branches") or []

    evaluated_branch = branches[0] if branches else "default"
    rule_matched = False

    # Check ruleDefinition
    rules = rule_def.get("rules", [])
    for r in rules:
        field = r.get("field", "")
        op = r.get("operator", "==")
        target = r.get("value")
        actual = _get_nested(state, field)

        match = False
        if op == "==" and str(actual) == str(target):
            match = True
        elif op == "!=" and str(actual) != str(target):
            match = True
        elif op == ">" and float(actual or 0) > float(target or 0):
            match = True
        elif op == "<" and float(actual or 0) < float(target or 0):
            match = True
        elif op == "contains" and str(target).lower() in str(actual).lower():
            match = True

        if match:
            evaluated_branch = r.get("outcome", evaluated_branch)
            rule_matched = True
            break

    return {
        "status": "success",
        "request": {"script": script, "rules": rules},
        "response": {"selected_branch": evaluated_branch, "matched": rule_matched},
        "output": {"selected_branch": evaluated_branch},
    }


def _execute_mapper_node(node: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    """Execute object mapping transformation."""
    data = node.get("data", {})
    config = data.get("mapperConfig", {}) or {}
    mappings = config.get("mappings") or []
    output_format = config.get("outputFormat", "json")

    result: Dict[str, Any] = {}
    for m in mappings:
        src = m.get("sourcePath", "")
        dst = m.get("targetField", "")
        if src and dst:
            val = _get_nested(state, src)
            result[dst] = val

    return {
        "status": "success",
        "request": {"mappings": mappings, "output_format": output_format},
        "response": result,
        "output": result,
    }


# --------------------------------------------------------------------------- #
# Core Execution Engine
# --------------------------------------------------------------------------- #

def run_workflow_graph(
    graph_json: Dict[str, Any],
    initial_input: Dict[str, Any],
    tenant_id: str,
    workflow_name: str,
    triggered_by_user_id: str = "system",
    triggered_by_user_name: str = "System",
) -> Dict[str, Any]:
    """Execute a full workflow graph and produce node traces and persisted records."""
    exec_id = f"exec-{str(uuid.uuid4())[:8]}"
    start_time = time.time()
    started_at = dt.datetime.now(dt.UTC)

    nodes = graph_json.get("nodes", [])

    state: Dict[str, Any] = {"input": initial_input}
    result_by_node: Dict[str, Any] = {}
    node_execution_records: List[NodeExecution] = []
    overall_status = ExecutionStatus.COMPLETED
    error_summary: Optional[str] = None

    for node in nodes:
        node_id = node.get("id")
        node_type = (node.get("type") or "serviceNode").lower()
        node_label = node.get("data", {}).get("label") or node_id

        node_start = time.time()
        node_started_at = dt.datetime.now(dt.UTC)

        node_result: Dict[str, Any]
        try:
            if "service" in node_type:
                node_result = _execute_service_node(node, state)
            elif "decision" in node_type:
                node_result = _execute_decision_node(node, state)
            elif "mapper" in node_type:
                node_result = _execute_mapper_node(node, state)
            elif "llm" in node_type:
                prompt = node.get("data", {}).get("prompt", "Prompt executed")
                rendered_prompt = _replace_template_variables(prompt, state)
                node_result = {
                    "status": "success",
                    "request": {"prompt": rendered_prompt},
                    "response": {"completion": f"Simulated LLM completion for: {rendered_prompt[:60]}..."},
                    "output": {"text": f"Simulated output for {node_label}"},
                }
            else:
                # Default generic execution for parallel / merge / form / workflow
                node_result = {
                    "status": "success",
                    "request": {},
                    "response": {"message": f"Executed {node_type} successfully"},
                    "output": {},
                }
        except Exception as ex:
            logger.error("Node execution failure at %s: %s", node_id, ex)
            node_result = {
                "status": "error",
                "request": {},
                "response": None,
                "error": str(ex),
                "output": {"error": str(ex)},
            }

        node_duration_ms = int((time.time() - node_start) * 1000)
        node_result["executionTime"] = node_duration_ms

        # Merge node output into state
        if node_result.get("output"):
            state[node_id] = node_result["output"]

        result_by_node[node_id] = node_result

        # Track failure
        if node_result.get("status") == "error":
            overall_status = ExecutionStatus.FAILED
            error_summary = node_result.get("error") or f"Node '{node_label}' failed"

        # Build NodeExecution record
        node_rec = NodeExecution(
            id=f"nexec-{str(uuid.uuid4())[:8]}",
            execution_id=exec_id,
            node_id=node_id,
            node_label=node_label,
            node_type=node_type,
            status=ExecutionStatus.COMPLETED if node_result.get("status") == "success" else ExecutionStatus.FAILED,
            started_at=node_started_at,
            completed_at=dt.datetime.now(dt.UTC),
            duration_ms=node_duration_ms,
            input_data=node_result.get("request") or {},
            output_data=node_result.get("response") or {},
            error_data={"error": node_result["error"]} if node_result.get("error") else None,
        )
        node_execution_records.append(node_rec)

    total_duration_ms = int((time.time() - start_time) * 1000)

    # Persist Execution Record to Repo
    try:
        from ..main import _audit_repo, _execution_repo
        wf_exec = WorkflowExecution(
            id=exec_id,
            tenant_id=tenant_id,
            workflow_name=workflow_name,
            workflow_version=1,
            status=overall_status,
            started_at=started_at,
            completed_at=dt.datetime.now(dt.UTC),
            duration_ms=total_duration_ms,
            triggered_by=triggered_by_user_id,
            triggered_by_user_id=triggered_by_user_id,
            triggered_by_user_name=triggered_by_user_name,
            error_summary=error_summary,
            input_data=initial_input,
            output_data=state,
            node_executions=node_execution_records,
        )
        _execution_repo.create(wf_exec)

        _audit_repo.append(AuditLog(
            actor_user_id=triggered_by_user_id,
            actor_user_name=triggered_by_user_name,
            actor_tenant_id=tenant_id,
            action=AuditAction.WORKFLOW_EXECUTED,
            resource_type="Workflow",
            resource_id=workflow_name,
            resource_name=workflow_name,
            target_tenant_id=tenant_id,
            metadata={"execution_id": exec_id, "status": overall_status.value, "duration_ms": total_duration_ms},
        ))
    except Exception as ex:
        logger.warning("Could not persist execution record: %s", ex)

    return {
        "status": "success" if overall_status == ExecutionStatus.COMPLETED else "failed",
        "result": result_by_node,
        "final_output": state,
        "execution_id": exec_id,
        "duration_ms": total_duration_ms,
        "error": error_summary,
    }


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@router.post("/api/tenant-platform/execute")
@router.post("/execute")
def execute_workflow(
    req: ExecuteWorkflowRequest,
    authorization: Optional[str] = Header(default=None),
):
    """Execute a workflow graph server-side and return node traces and metrics."""
    actor_id = "system"
    actor_name = "System"
    tenant_id = req.tenant_id or "demo-tenant-0001"

    if authorization:
        from ..security import verify_access_token
        claims = verify_access_token(authorization)
        if claims:
            actor_id = claims.get("sub") or claims.get("user_id") or "system"
            if claims.get("tenant_id") and claims.get("tenant_id") != "all":
                tenant_id = claims["tenant_id"]

    return run_workflow_graph(
        graph_json=req.graph,
        initial_input=req.input,
        tenant_id=tenant_id,
        workflow_name=req.workflow_name or "Ad-hoc Workflow",
        triggered_by_user_id=actor_id,
        triggered_by_user_name=req.triggered_by_user_name or actor_name,
    )
