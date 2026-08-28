"""Business Rule REST endpoints.

POST /api/tenant-platform/rules/validate
POST /api/tenant-platform/rules/test

These endpoints are completely independent of the existing LangGraph
execution layer. They accept a JSON rule definition and (for /test) a
sample input, and return validation errors or an evaluation trace.
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status

from ..rules.engine import RuleEngine
from ..rules.models import (
    RuleTestRequest,
    RuleTestResponse,
    RuleValidateRequest,
    RuleValidateResponse,
    TraceStep,
)

router = APIRouter(prefix="/api/tenant-platform/rules", tags=["rules"])

_engine = RuleEngine()


@router.post("/validate", response_model=RuleValidateResponse)
def validate_rule(request: RuleValidateRequest) -> RuleValidateResponse:
    errors = _engine.validate(request.rule_definition)
    return RuleValidateResponse(
        valid=len(errors) == 0,
        errors=errors,
    )


@router.post("/test", response_model=RuleTestResponse)
def test_rule(request: RuleTestRequest) -> RuleTestResponse:
    # Validate first
    errors = _engine.validate(request.rule_definition)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Rule definition is invalid.", "errors": errors},
        )

    matched, outcome, trace = _engine.test(request.rule_definition, request.sample_input)
    return RuleTestResponse(
        matched=matched,
        outcome=outcome,
        evaluation_trace=trace,
    )
