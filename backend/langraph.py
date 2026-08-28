from __future__ import annotations
import os
import re
import json
import uuid
import copy
import logging
import datetime as dt
import threading
from collections import defaultdict
from typing import Any, Dict, List, Optional
import requests

PARALLEL_BRANCH_TIMEOUT_S: float = float(os.getenv("PARALLEL_BRANCH_TIMEOUT_S", "300"))

from simpleeval import simple_eval
from langgraph.graph import StateGraph, END
from langgraph.types import Send

from db import (
    save_workflow_execution,
    save_node_execution,
    update_service_metrics,
    get_node_status_map,
    get_latest_flow as db_get_latest_flow,
    NotFoundError,
    DBError,
)

logger = logging.getLogger("langgraph")
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter(
        fmt="%(asctime)s.%(msecs)03d %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    logger.addHandler(h)
logger.setLevel(logging.INFO)

# ==============================================================================
# Circuit breaker registry (per process, keyed by service node_id)
# ==============================================================================

_circuit_registry: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
    "failures": 0,
    "last_failure_at": None,
    "open": False,
})
_circuit_lock = threading.Lock()

CIRCUIT_FAILURE_THRESHOLD: int = int(os.getenv("CIRCUIT_FAILURE_THRESHOLD", "5"))
CIRCUIT_RESET_AFTER_S: float = float(os.getenv("CIRCUIT_RESET_AFTER_S", "60"))


def _circuit_is_open(node_id: str) -> bool:
    with _circuit_lock:
        cb = _circuit_registry[node_id]
        if not cb["open"]:
            return False
        last = cb["last_failure_at"]
        if last and (dt.datetime.utcnow() - last).total_seconds() > CIRCUIT_RESET_AFTER_S:
            cb["open"] = False
            cb["failures"] = 0
            return False
        return True


def _circuit_record_failure(node_id: str) -> None:
    with _circuit_lock:
        cb = _circuit_registry[node_id]
        cb["failures"] += 1
        cb["last_failure_at"] = dt.datetime.utcnow()
        if cb["failures"] >= CIRCUIT_FAILURE_THRESHOLD:
            cb["open"] = True
            logger.warning("[circuit-breaker:%s] opened after %d failures", node_id, cb["failures"])


def _circuit_record_success(node_id: str) -> None:
    with _circuit_lock:
        cb = _circuit_registry[node_id]
        cb["failures"] = 0
        cb["open"] = False


# ==============================================================================
# Helpers: deep_get / render_template / _validate_service_url
# ==============================================================================

def deep_get(data: Dict[str, Any], path: str) -> Any:
    if not path:
        return data
    parts = re.split(r'\.(?![^\[]*\])', path)
    for part in parts:
        match = re.findall(r'([^\[\]]+)|\[(\d+)\]', part)
        for key, index in match:
            if key:
                if isinstance(data, dict):
                    data = data.get(key)
                else:
                    return None
            elif index is not None:
                if isinstance(data, list):
                    try:
                        data = data[int(index)]
                    except (IndexError, ValueError):
                        return None
                else:
                    return None
            if data is None:
                return None
    return data


def render_template(obj: Any, context: Dict[str, Any]) -> Any:
    if isinstance(obj, str):
        matches = re.findall(r"\{([^{}]+)\}", obj)
        for m in matches:
            val = deep_get(context, m.strip())
            if val is not None:
                obj = obj.replace("{" + m + "}", str(val))
        return obj
    elif isinstance(obj, dict):
        return {k: render_template(v, context) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [render_template(v, context) for v in obj]
    return obj


def _validate_service_url(url: str) -> None:
    if not url:
        raise ValueError("Service node URL is required")
    if not (url.startswith("http://") or url.startswith("https://")):
        raise ValueError("Service node URL must start with http:// or https://")
    allowlist = os.getenv("SERVICE_URL_ALLOWLIST")
    if allowlist:
        hosts = [h.strip() for h in allowlist.split(",") if h.strip()]
        from urllib.parse import urlparse
        host = urlparse(url).netloc
        if host not in hosts:
            raise ValueError(f"Service URL host '{host}' is not in allowlist: {hosts}")


# ==============================================================================
# Parallel state helpers
#
# state["_parallel"][parallel_id] = {
#     "expected":   ["branch-a", "branch-b"],   # set once in parallel run_fn
#     "completed":  ["branch-a"],               # grows as branches finish
#     "results":    {"branch-a": {...}},         # per-branch output snapshot
#     "started_at": <iso-timestamp>,            # for timeout detection
#     "merged":     False,                      # idempotency guard for merge
#     "merge_strategy": {"field": "sum|append|last"},  # optional conflict resolution
# }
#
# Rules:
#   - Initialised ONCE in the parallel node's run_fn (not in the router).
#   - Router performs a lightweight copy: shallow-copies the top-level state
#     dict and deep-copies only the `_parallel` sub-key so every branch starts
#     with the same tracking context but cannot corrupt sibling branches.
#   - _mark_branch_completed is idempotent — safe for retries / double-delivery.
#   - Merge checks `merged` flag before executing to prevent re-execution if
#     LangGraph re-invokes the node after it already completed.
#   - After merge succeeds the context is cleaned up to avoid memory growth.
#   - Nested parallel blocks are isolated via their own node_id namespace key.
# ==============================================================================

def _init_parallel_context(
    state: Dict[str, Any],
    parallel_id: str,
    branch_targets: List[str],
    merge_strategy: Optional[Dict[str, str]] = None,
) -> None:
    if "_parallel" not in state:
        state["_parallel"] = {}
    state["_parallel"][parallel_id] = {
        "expected": list(branch_targets),
        "completed": [],
        "results": {},
        "started_at": dt.datetime.utcnow().isoformat(),
        "merged": False,
        "merge_strategy": merge_strategy or {},
    }


def _branch_state_copy(state: Dict[str, Any]) -> Dict[str, Any]:
    branch = {k: v for k, v in state.items() if k != "_parallel"}
    if "_parallel" in state:
        branch["_parallel"] = copy.deepcopy(state["_parallel"])
    return branch


def _mark_branch_completed(state: Dict[str, Any], parallel_id: str, branch_node_id: str) -> None:
    pctx = state.get("_parallel", {}).get(parallel_id)
    if pctx is None:
        return
    if branch_node_id not in pctx["completed"]:
        pctx["completed"].append(branch_node_id)
    pctx["results"][branch_node_id] = state.get(branch_node_id)

    expected = len(pctx["expected"])
    done = len(pctx["completed"])
    logger.info(
        "[merge-progress:%s] %d/%d branches completed",
        parallel_id, done, expected
    )


def _all_branches_done(state: Dict[str, Any], parallel_id: str) -> bool:
    pctx = state.get("_parallel", {}).get(parallel_id)
    if not pctx:
        return False
    return set(pctx["expected"]).issubset(set(pctx["completed"]))


def _get_branch_timeout(state: Dict[str, Any], parallel_id: str) -> float:
    pctx = state.get("_parallel", {}).get(parallel_id)
    if pctx and pctx.get("timeout_s"):
        return float(pctx["timeout_s"])
    return PARALLEL_BRANCH_TIMEOUT_S


def _check_branch_timeout(state: Dict[str, Any], parallel_id: str) -> Optional[List[str]]:
    pctx = state.get("_parallel", {}).get(parallel_id)
    if not pctx:
        return None
    started_at_str = pctx.get("started_at")
    if not started_at_str:
        return None
    elapsed = (dt.datetime.utcnow() - dt.datetime.fromisoformat(started_at_str)).total_seconds()
    timeout = _get_branch_timeout(state, parallel_id)
    if elapsed < timeout:
        return None
    expected = set(pctx["expected"])
    completed = set(pctx["completed"])
    return list(expected - completed)


def _cleanup_parallel_context(state: Dict[str, Any], parallel_id: str) -> None:
    parallel_ns = state.get("_parallel")
    if parallel_ns and parallel_id in parallel_ns:
        del parallel_ns[parallel_id]
        if not parallel_ns:
            del state["_parallel"]


def _apply_merge_strategy(
    merged: Dict[str, Any],
    branch_id: str,
    branch_result: Any,
    strategy: Dict[str, str],
) -> None:
    if not isinstance(branch_result, dict) or not strategy:
        merged[branch_id] = branch_result
        return

    merged[branch_id] = branch_result

    response = branch_result.get("response") if isinstance(branch_result, dict) else None
    if not isinstance(response, dict):
        return

    for field, rule in strategy.items():
        val = response.get(field)
        if val is None:
            continue
        existing = merged.get(f"__merged_{field}")
        if rule == "sum":
            merged[f"__merged_{field}"] = (existing or 0) + (val if isinstance(val, (int, float)) else 0)
        elif rule == "append":
            base = existing if isinstance(existing, list) else []
            if isinstance(val, list):
                base = base + val
            else:
                base = base + [val]
            merged[f"__merged_{field}"] = base
        elif rule == "last":
            merged[f"__merged_{field}"] = val


# ==============================================================================
# Node: Service Node
# ==============================================================================

def make_service_node(
    node_data: Dict[str, Any],
    execution_id: str,
    parallel_id: Optional[str] = None,
    retry_policy: Optional[Dict[str, Any]] = None,
    node_timeout_s: Optional[float] = None,
):
    data_cfg = node_data.get("data", {})
    url = data_cfg.get("url")
    method = data_cfg.get("method", "POST").upper()

    headers_config = data_cfg.get("config", {}).get("headers", [])
    headers = {
        h.get("key"): h.get("value")
        for h in headers_config
        if h.get("key") and h.get("value")
    }

    is_xml = any(
        (h.get("key", "").lower() == "content-type")
        and ("xml" in h.get("value", "").lower())
        for h in headers_config
    )

    request_body_raw = data_cfg.get("config", {}).get("requestBody", "{}")

    if is_xml:
        request_template: Any = request_body_raw if isinstance(request_body_raw, str) else str(request_body_raw)
    else:
        if isinstance(request_body_raw, str):
            try:
                request_template = json.loads(request_body_raw)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON requestBody for node {node_data.get('id')}: {e}")
        else:
            request_template = request_body_raw

    mappings = data_cfg.get("mappings", [])

    _retry = retry_policy or data_cfg.get("retryPolicy") or {}
    max_attempts: int = int(_retry.get("max_attempts", 1))
    backoff_strategy: str = _retry.get("backoff", "none")
    _timeout_s = node_timeout_s or data_cfg.get("timeout") or 15

    def _call_service(payload: Any) -> tuple:
        resp_data: Dict[str, Any] = {}
        error_msg: Optional[str] = None
        ok = False
        try:
            if is_xml:
                resp = requests.request(method, url, data=payload, headers=headers, timeout=_timeout_s)
            else:
                resp = requests.request(method, url, json=payload, headers=headers, timeout=_timeout_s)

            if resp.ok:
                try:
                    resp_data = resp.json()
                except ValueError:
                    resp_data = {"raw": resp.text}
                ok = True
            else:
                resp_data = {"error": resp.text, "status_code": resp.status_code}
                error_msg = resp.text
        except Exception as e:
            resp_data = {"error": str(e)}
            error_msg = str(e)
        return ok, resp_data, error_msg

    def run_fn(state: Dict[str, Any]):
        start_time = dt.datetime.utcnow()
        node_id = node_data["id"]
        node_label = data_cfg.get("label", node_id)

        if _circuit_is_open(node_id):
            msg = "circuit_open"
            logger.warning("[service:%s] circuit breaker open — skipping call", node_label)
            save_node_execution(
                execution_id, node_id, node_type="service", node_label=node_label,
                status="failed", request_data=None, response_data={"error": msg},
                error_msg=msg, exec_time=0
            )
            update_service_metrics(node_id, success=False, exec_time_ms=0)
            state[node_id] = {"error": msg}
            if parallel_id:
                _mark_branch_completed(state, parallel_id, node_id)
            return state

        try:
            _validate_service_url(url)
        except Exception as e:
            logger.error("[%s] URL validation failed: %s", node_label, e)
            save_node_execution(
                execution_id, node_id, node_type="service", node_label=node_label,
                status="failed", request_data=None, response_data={"error": str(e)},
                error_msg=str(e), exec_time=0
            )
            update_service_metrics(node_id, success=False, exec_time_ms=0)
            state[node_id] = {"error": str(e)}
            if parallel_id:
                _mark_branch_completed(state, parallel_id, node_id)
            return state

        payload = render_template(copy.deepcopy(request_template), state)

        if isinstance(payload, dict):
            for m in mappings:
                source = m.get("source")
                target = m.get("target")
                transform = m.get("transform")
                val = deep_get(state, source)
                if val is not None:
                    if transform == "upper":
                        val = str(val).upper()
                    elif transform == "lower":
                        val = str(val).lower()
                    elif transform == "strip":
                        val = str(val).strip()
                    parts = target.split(".") if target else []
                    sub = payload
                    for p in parts[:-1]:
                        if p not in sub or not isinstance(sub[p], dict):
                            sub[p] = {}
                        sub = sub[p]
                    if parts:
                        sub[parts[-1]] = val

        ok = False
        error_msg = None
        resp_data: Dict[str, Any] = {}

        for attempt in range(max(1, max_attempts)):
            if attempt > 0:
                delay = 0.0
                if backoff_strategy == "exponential":
                    delay = (2 ** attempt) * 0.5
                elif backoff_strategy == "linear":
                    delay = attempt * 1.0
                if delay > 0:
                    import time
                    time.sleep(delay)
                logger.info("[service:%s] retry attempt %d/%d", node_label, attempt + 1, max_attempts)

            ok, resp_data, error_msg = _call_service(payload)
            if ok:
                break

        exec_time = int((dt.datetime.utcnow() - start_time).total_seconds() * 1000)

        if ok:
            _circuit_record_success(node_id)
        else:
            _circuit_record_failure(node_id)

        save_node_execution(
            execution_id, node_id, node_type="service", node_label=node_label,
            status="completed" if ok else "failed", request_data=payload,
            response_data=resp_data, error_msg=error_msg, exec_time=exec_time
        )
        update_service_metrics(node_id, ok, exec_time)

        state[node_id] = {
            "request": payload,
            "response": resp_data,
            "_metrics": {"last_exec_ms": exec_time, "success": ok},
        }

        if parallel_id:
            _mark_branch_completed(state, parallel_id, node_id)

        logger.info("[service:%s] ok=%s time_ms=%s", node_label, ok, exec_time)
        return state

    return run_fn


# ==============================================================================
# Node: Decision Node
# ==============================================================================

def make_decision_node(node_data: Dict[str, Any], execution_id: str, parallel_id: Optional[str] = None):
    data_cfg = node_data.get("data", {})
    rules = data_cfg.get("rules", [])
    script = data_cfg.get("script")

    def run_fn(state: Dict[str, Any]):
        start_time = dt.datetime.utcnow()
        node_id = node_data["id"]
        node_label = data_cfg.get("label", node_id)

        new_state = state.copy()
        actions_taken = []
        names = {"state": new_state, "input": new_state.get("input", {})}

        if rules:
            for rule in rules or []:
                cond = rule.get("condition")
                try:
                    if bool(simple_eval(cond, names=names)):
                        action = rule.get("action", {})
                        if isinstance(action, dict):
                            new_state.update(action)
                            actions_taken.append({"condition": cond, "action": action})
                except Exception as e:
                    logger.warning("[decision:%s] Condition error: %s", node_label, e)

        if script:
            try:
                local_env = {"state": new_state}
                exec(script, {}, local_env)
                new_state = local_env.get("state", new_state)
            except Exception as e:
                logger.warning("[decision:%s] Script error: %s", node_label, e)

        exec_time = int((dt.datetime.utcnow() - start_time).total_seconds() * 1000)

        save_node_execution(
            execution_id, node_id, node_type="decision", node_label=node_label,
            status="completed", request_data={"rules": rules, "script": script},
            response_data={"actions_taken": actions_taken},
            error_msg=None, exec_time=exec_time
        )
        update_service_metrics(node_id, success=True, exec_time=exec_time)

        new_state[node_id] = {
            "request": {"rules": rules, "script": script},
            "response": {"actions_taken": actions_taken},
            "_metrics": {"last_exec_ms": exec_time, "success": True},
        }

        if parallel_id:
            _mark_branch_completed(new_state, parallel_id, node_id)

        logger.info("[decision:%s] actions=%d time_ms=%s", node_label, len(actions_taken), exec_time)
        return new_state

    return run_fn


# ==============================================================================
# Node: Form Node
# ==============================================================================

def make_form_node(node_data: Dict[str, Any], execution_id: str, parallel_id: Optional[str] = None):
    node_id = node_data["id"]
    data_cfg = node_data.get("data", {})
    node_label = data_cfg.get("label", node_id)
    form_schema = data_cfg.get("schema", {})
    custom_data = data_cfg

    def run_fn(state: Dict[str, Any]):
        save_node_execution(
            execution_id, node_id, node_type="form", node_label=node_label,
            status="paused", request_data={"form_schema": form_schema},
            response_data=None, error_msg=None, exec_time_ms=0
        )
        state["paused_at_form"] = {
            "node_id": node_id,
            "execution_id": execution_id,
            "data": custom_data,
        }
        logger.info("[form:%s] Workflow paused", node_label)
        return state

    return run_fn


# ==============================================================================
# Node: Sub-workflow Node
# ==============================================================================

def make_subworkflow_node(node_data: Dict[str, Any], execution_id: str, parallel_id: Optional[str] = None):
    node_id = node_data["id"]
    data_cfg = node_data.get("data", {})
    node_label = data_cfg.get("label", node_id)
    sub_workflow_name = data_cfg.get("selectedWorkflowName", node_id)

    def run_fn(state: Dict[str, Any]):
        start_time = dt.datetime.utcnow()
        parent_state = state

        def _fail(msg: str, exec_time_ms: int = 0):
            save_node_execution(
                execution_id, node_id, node_type="subworkflow", node_label=node_label,
                status="failed", request_data=None, response_data={"error": msg},
                error_msg=msg, exec_time_ms=exec_time_ms
            )
            update_service_metrics(node_id, success=False, exec_time_ms=exec_time_ms)
            parent_state[node_id] = {"error": msg}
            if parallel_id:
                _mark_branch_completed(parent_state, parallel_id, node_id)
            return parent_state

        try:
            response_data = db_get_latest_flow(sub_workflow_name)
            subgraph = response_data.get("data", {}).get("graph")
        except NotFoundError:
            logger.error("[subworkflow:%s] Subgraph '%s' not found", node_label, sub_workflow_name)
            return _fail("No subgraph provided")
        except DBError as e:
            logger.error("[subworkflow:%s] DB error: %s", node_label, e)
            return _fail(str(e))

        if not subgraph:
            logger.error("[subworkflow:%s] Empty subgraph for '%s'", node_label, sub_workflow_name)
            return _fail("Empty subgraph")

        sub_execution_id = str(uuid.uuid4())
        sub_state = {"input": parent_state.get("input", {})}

        entry_node_id = subgraph.get("nodes", [{}])[0].get("id") if subgraph.get("nodes") else None
        save_workflow_execution(
            sub_execution_id, node_label or "subworkflow", status="running",
            entry_node_id=entry_node_id, state=sub_state, workflow_graph=subgraph,
            parent_execution_id=execution_id
        )

        try:
            sub_graph = build_graph_from_json(subgraph, sub_execution_id)
            sub_result = sub_graph.invoke(sub_state)

            last_node_id = subgraph.get("nodes", [{}])[-1].get("id") if subgraph.get("nodes") else None
            save_workflow_execution(
                sub_execution_id, node_label or "subworkflow", status="completed",
                last_node_id=last_node_id, state=sub_result, workflow_graph=subgraph,
                parent_execution_id=execution_id
            )

            exec_time = int((dt.datetime.utcnow() - start_time).total_seconds() * 1000)
            save_node_execution(
                execution_id, node_id, node_type="subworkflow", node_label=node_label,
                status="completed", request_data={"sub_execution_id": sub_execution_id},
                response_data=sub_result, error_msg=None, exec_time=exec_time
            )
            update_service_metrics(node_id, success=True, exec_time=exec_time)

            parent_state[node_id] = {
                "sub_execution_id": sub_execution_id,
                "request": sub_state,
                "response": sub_result,
                "_metrics": {"last_exec_ms": exec_time, "success": True},
            }

            if parallel_id:
                _mark_branch_completed(parent_state, parallel_id, node_id)

            logger.info("[subworkflow:%s] Completed child execution=%s", node_label, sub_execution_id)
            return parent_state

        except Exception as e:
            save_workflow_execution(
                sub_execution_id, node_label or "subworkflow", status="failed",
                current_node_id="unknown", state={"error": str(e)}, workflow_graph=subgraph,
                parent_execution_id=execution_id
            )
            logger.exception("[subworkflow:%s] Exception: %s", node_label, e)
            return _fail(str(e))

    return run_fn


# ==============================================================================
# Node: Parallel Node
#
# Lifecycle:
#   1. run_fn  — records execution metrics AND initialises the namespaced
#                _parallel[node_id] context (expected branches, timestamps,
#                merged=False guard, optional merge_strategy and per-node
#                timeout_s).  This is the ONLY place init happens.
#   2. router  — attached via add_conditional_edges.  Uses _branch_state_copy
#                (shallow copy of user payload + deepcopy of only the _parallel
#                tracking dict) so branches are isolated without the full cost
#                of copy.deepcopy on arbitrarily large states.  Does NOT
#                re-initialise the context — reads what run_fn already set.
#
# Multiple and nested parallel blocks are fully isolated: each uses its own
# node_id as the namespace key in state["_parallel"].  Nested parallel blocks
# get unique keys because their node_ids differ, preventing namespace collision.
#
# Frontend data shape:
#   { id: "parallel-1", type: "parallel", data: { label: "...", outputCount: N,
#     mergeStrategy: {"field": "sum|append|last"}, timeout: 30 } }
# ==============================================================================

def make_parallel_node(node_data: Dict[str, Any], execution_id: str, branch_targets: List[str]):
    node_id = node_data["id"]
    data_cfg = node_data.get("data", {})
    node_label = data_cfg.get("label", node_id)
    output_count = int(data_cfg.get("outputCount", 2))
    merge_strategy: Dict[str, str] = data_cfg.get("mergeStrategy") or {}
    node_timeout_s: Optional[float] = data_cfg.get("timeout")

    def run_fn(state: Dict[str, Any]):
        start_time = dt.datetime.utcnow()

        _init_parallel_context(state, node_id, branch_targets, merge_strategy=merge_strategy)

        if node_timeout_s is not None:
            state["_parallel"][node_id]["timeout_s"] = float(node_timeout_s)

        exec_time = int((dt.datetime.utcnow() - start_time).total_seconds() * 1000)

        save_node_execution(
            execution_id, node_id, node_type="parallel", node_label=node_label,
            status="completed",
            request_data={"output_count": output_count, "branches": branch_targets},
            response_data={"branching": True},
            error_msg=None, exec_time=exec_time
        )
        update_service_metrics(node_id, success=True, exec_time=exec_time)

        state[node_id] = {
            "response": {"branching": True, "output_count": output_count},
            "_metrics": {"last_exec_ms": exec_time, "success": True},
        }

        logger.info(
            "[parallel:%s] initialised fan-out, branches=%s",
            node_label, branch_targets
        )
        return state

    return run_fn


def make_parallel_router(parallel_id: str, branch_targets: List[str]):
    def router(state: Dict[str, Any]) -> List[Send]:
        sends: List[Send] = []
        for target in branch_targets:
            branch_state = _branch_state_copy(state)
            sends.append(Send(target, branch_state))

        logger.info(
            "[parallel-router:%s] fan-out -> %s (%d branches)",
            parallel_id, branch_targets, len(branch_targets)
        )
        return sends

    return router


# ==============================================================================
# Node: Merge Node
#
# Fan-in collector with barrier, idempotency guard, timeout soft-fail, ordered
# merge, merge strategy application, and post-merge cleanup.
#
# Runtime flow:
#   1. Idempotency guard — if state[node_id] already exists with a "merged"
#      key the node returns immediately.
#   2. Timeout check — if the per-node or global timeout has elapsed, any
#      still-pending branches are soft-failed with a sentinel error value.
#   3. Barrier check — if not all expected branches are done, returns state
#      unchanged and logs current progress (completed/expected).
#   4. Ordered merge — collects branch results in the order defined by
#      pctx["expected"] for deterministic output, then applies merge strategy
#      fields (sum / append / last) across branches.
#   5. Cleanup — removes state["_parallel"][parallel_id] after merge.
#
# Frontend data shape:
#   { id: "merge-1", type: "merge", data: { label: "...", inputCount: N } }
# ==============================================================================

def make_merge_node(
    node_data: Dict[str, Any],
    execution_id: str,
    parallel_id: str,
    upstream_node_ids: List[str],
):
    node_id = node_data["id"]
    data_cfg = node_data.get("data", {})
    node_label = data_cfg.get("label", node_id)
    input_count = int(data_cfg.get("inputCount", 2))

    def run_fn(state: Dict[str, Any]):
        start_time = dt.datetime.utcnow()

        existing = state.get(node_id)
        if isinstance(existing, dict) and existing.get("_merged"):
            logger.info("[merge:%s] already merged — skipping re-execution", node_label)
            return state

        timed_out = _check_branch_timeout(state, parallel_id)
        if timed_out:
            logger.warning(
                "[merge:%s] timeout — soft-failing stuck branches: %s",
                node_label, timed_out
            )
            pctx = state.get("_parallel", {}).get(parallel_id, {})
            for stuck_id in timed_out:
                pctx.setdefault("results", {})[stuck_id] = {
                    "error": "branch_timeout",
                    "branch_node_id": stuck_id,
                }
                if stuck_id not in pctx.get("completed", []):
                    pctx.setdefault("completed", []).append(stuck_id)

        if not _all_branches_done(state, parallel_id):
            pctx = state.get("_parallel", {}).get(parallel_id, {})
            done = len(pctx.get("completed", []))
            expected = len(pctx.get("expected", []))
            logger.info(
                "[merge:%s] barrier waiting — progress: %d/%d branches completed",
                node_label, done, expected,
            )
            return state

        pctx = state["_parallel"][parallel_id]
        results_map = pctx.get("results", {})
        merge_strategy: Dict[str, str] = pctx.get("merge_strategy", {})

        merged_results: Dict[str, Any] = {}
        for branch_id in pctx["expected"]:
            result = results_map.get(branch_id)
            if result is None:
                result = state.get(branch_id)
            _apply_merge_strategy(merged_results, branch_id, result, merge_strategy)

        for uid in upstream_node_ids:
            if uid not in merged_results:
                merged_results[uid] = state.get(uid)

        exec_time = int((dt.datetime.utcnow() - start_time).total_seconds() * 1000)

        save_node_execution(
            execution_id, node_id, node_type="merge", node_label=node_label,
            status="completed",
            request_data={
                "parallel_id": parallel_id,
                "upstream_nodes": upstream_node_ids,
                "input_count": input_count,
            },
            response_data={"merged": merged_results},
            error_msg=None, exec_time=exec_time
        )
        update_service_metrics(node_id, success=True, exec_time=exec_time)

        state[node_id] = {
            "response": {"merged": merged_results},
            "_metrics": {"last_exec_ms": exec_time, "success": True},
            "_merged": True,
        }

        _cleanup_parallel_context(state, parallel_id)

        logger.info(
            "[merge:%s] barrier passed — merged %d branches from parallel=%s",
            node_label, len(merged_results), parallel_id
        )
        return state

    return run_fn


# ==============================================================================
# Node: Response Object Mapper Node
# ==============================================================================

def make_mapper_node(
    node_data: Dict[str, Any],
    execution_id: str,
    parallel_id: Optional[str] = None,
):
    node_id = node_data["id"]
    data_cfg = node_data.get("data", {})
    node_label = data_cfg.get("label", node_id)
    mapper_cfg = data_cfg.get("mapperConfig", {})

    output_format = mapper_cfg.get("outputFormat", "json").lower()
    raw_template = mapper_cfg.get("template") or mapper_cfg.get("sampleResponse") or "{}"

    def run_fn(state: Dict[str, Any]):
        start_time = dt.datetime.utcnow()

        rendered = render_template(copy.deepcopy(raw_template), state)

        final_response: Any = None
        if output_format == "xml":
            if isinstance(rendered, dict):
                def dict_to_xml(d, root_tag="Response"):
                    xml_parts = [f"<{root_tag}>"]
                    for k, v in d.items():
                        if isinstance(v, dict):
                            xml_parts.append(dict_to_xml(v, k))
                        else:
                            xml_parts.append(f"<{k}>{v}</{k}>")
                    xml_parts.append(f"</{root_tag}>")
                    return "".join(xml_parts)
                xml_body = dict_to_xml(rendered)
            else:
                xml_body = str(rendered)

            if not xml_body.strip().startswith("<?xml"):
                final_response = f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_body}'
            else:
                final_response = xml_body
        else:
            if isinstance(rendered, str):
                try:
                    final_response = json.loads(rendered)
                except Exception:
                    final_response = {"response": rendered}
            else:
                final_response = rendered

        exec_time = int((dt.datetime.utcnow() - start_time).total_seconds() * 1000)

        save_node_execution(
            execution_id, node_id, node_type="mapper", node_label=node_label,
            status="completed",
            request_data={"output_format": output_format, "template": raw_template},
            response_data={"output_format": output_format, "result": final_response},
            error_msg=None, exec_time=exec_time
        )
        update_service_metrics(node_id, success=True, exec_time=exec_time)

        state[node_id] = {
            "output_format": output_format,
            "response": final_response,
            "_metrics": {"last_exec_ms": exec_time, "success": True},
        }
        state["final_output"] = final_response
        state["final_output_format"] = output_format

        if parallel_id:
            _mark_branch_completed(state, parallel_id, node_id)

        logger.info("[mapper:%s] compiled %s response in %dms", node_label, output_format, exec_time)
        return state

    return run_fn


# ==============================================================================
# Node factory
# (parallel / merge are registered separately in build_graph_from_json because
#  they need topology context that is not available at factory-call time)
# ==============================================================================

NODE_FACTORY = {
    "service": make_service_node,
    "serviceNode": make_service_node,
    "decision": make_decision_node,
    "decisionNode": make_decision_node,
    "form": make_form_node,
    "formNode": make_form_node,
    "workflow": make_subworkflow_node,
    "workflowNode": make_subworkflow_node,
    "mapper": make_mapper_node,
    "mapperNode": make_mapper_node,
}


# ==============================================================================
# Graph builder
# ==============================================================================

def build_graph_from_json(graph_json: Dict[str, Any], execution_id: str):
    g = StateGraph(dict)

    node_status_map = get_node_status_map(execution_id)

    temp_graph_json: Dict[str, Any] = {"nodes": [], "edges": []}
    current_pause_form_id: Optional[str] = None

    all_edges: List[Dict[str, Any]] = graph_json.get("edges", [])

    edges_out: Dict[str, List[str]] = {}
    edges_in: Dict[str, List[str]] = {}

    for e in all_edges:
        src = e.get("source")
        tgt = e.get("target")
        if src and tgt:
            edges_out.setdefault(src, []).append(tgt)
            edges_in.setdefault(tgt, []).append(src)

    node_type_map: Dict[str, str] = {
        n["id"]: n.get("type", "") for n in graph_json.get("nodes", [])
    }

    branch_to_parallel: Dict[str, str] = {}
    for src, targets in edges_out.items():
        if node_type_map.get(src) == "parallel":
            for tgt in targets:
                branch_to_parallel[tgt] = src

    merge_to_parallel: Dict[str, str] = {}
    for node in graph_json.get("nodes", []):
        if node.get("type") != "merge":
            continue
        nid = node["id"]
        upstream = edges_in.get(nid, [])
        for up in upstream:
            pid = branch_to_parallel.get(up)
            if pid:
                merge_to_parallel[nid] = pid
                break
        if nid not in merge_to_parallel:
            for up in upstream:
                if node_type_map.get(up) == "parallel":
                    merge_to_parallel[nid] = up
                    break

    for node in graph_json.get("nodes", []):
        node_id = node.get("id")
        ntype = node.get("type")

        if node_status_map.get(node_id) == "completed":
            logger.debug("Skipping completed node: %s", node_id)
            continue

        if ntype == "parallel":
            parallel_branch_targets = [
                t for t in edges_out.get(node_id, [])
                if t in {n["id"] for n in graph_json.get("nodes", [])}
            ]
            func = make_parallel_node(node, execution_id, branch_targets=parallel_branch_targets)
            g.add_node(node_id, func)

        elif ntype == "merge":
            pid = merge_to_parallel.get(node_id, "")
            upstream_ids = edges_in.get(node_id, [])
            func = make_merge_node(node, execution_id, parallel_id=pid, upstream_node_ids=upstream_ids)
            g.add_node(node_id, func)

        elif ntype in NODE_FACTORY:
            pid = branch_to_parallel.get(node_id)
            func = NODE_FACTORY[ntype](node, execution_id, parallel_id=pid)
            g.add_node(node_id, func)

            if ntype == "form":
                current_pause_form_id = node_id
                temp_graph_json["nodes"].append(node)
                break
        else:
            raise Exception(f"Unknown node type: {ntype}")

        temp_graph_json["nodes"].append(node)

    valid_node_ids = {n["id"] for n in temp_graph_json["nodes"]}
    for e in all_edges:
        if e.get("source") in valid_node_ids and e.get("target") in valid_node_ids:
            temp_graph_json["edges"].append(e)

    edges_by_source: Dict[str, List[Dict[str, Any]]] = {}
    for e in temp_graph_json.get("edges", []):
        if current_pause_form_id and e.get("source") == current_pause_form_id:
            continue
        edges_by_source.setdefault(e.get("source"), []).append(e)

    for source, edges in edges_by_source.items():
        src_type = node_type_map.get(source, "")

        if src_type == "parallel":
            branch_targets: List[str] = []
            seen: set = set()
            for e in edges:
                tgt = e.get("target")
                if tgt and tgt not in seen:
                    branch_targets.append(tgt)
                    seen.add(tgt)

            router = make_parallel_router(source, branch_targets)
            path_map = {tgt: tgt for tgt in branch_targets}
            path_map[END] = END
            g.add_conditional_edges(source, router, path_map)
            logger.info("[build] Parallel fan-out: %s -> %s", source, branch_targets)

        elif any(e.get("condition") for e in edges):
            def conditional_fn(state, edges=edges):
                for edge in edges:
                    cond = edge.get("condition")
                    if not cond:
                        continue
                    try:
                        if bool(simple_eval(cond, names={"state": state, "input": state.get("input", {})})):
                            return edge.get("target")
                    except Exception as ex:
                        logger.warning("Condition eval error at edge %s: %s", edge, ex)
                for e in edges:
                    if not e.get("condition"):
                        return e.get("target")
                return END

            g.add_conditional_edges(source, conditional_fn)

        else:
            for e in edges:
                g.add_edge(e.get("source"), e.get("target"))

    if temp_graph_json.get("nodes"):
        entry = temp_graph_json["nodes"][0]["id"]
        g.set_entry_point(entry)

        if current_pause_form_id:
            g.add_edge(current_pause_form_id, END)
        else:
            last = temp_graph_json["nodes"][-1]["id"]
            last_type = node_type_map.get(last)
            if last_type != "parallel":
                g.add_edge(last, END)
    else:
        g.set_entry_point(END)

    logger.debug(
        "Graph compiled (nodes=%d, edges=%d)",
        len(temp_graph_json["nodes"]),
        len(temp_graph_json["edges"]),
    )

    return g.compile()


__all__ = [
    "deep_get",
    "render_template",
    "make_service_node",
    "make_decision_node",
    "make_form_node",
    "make_subworkflow_node",
    "make_parallel_node",
    "make_parallel_router",
    "make_merge_node",
    "NODE_FACTORY",
    "build_graph_from_json",
]