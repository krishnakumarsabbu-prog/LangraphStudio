"""Business Rule Engine — generic, JSON-based rule definitions and evaluation.

This package is completely independent of the existing LangGraph execution
layer. Business users define rules as structured JSON (field / operator /
value); the engine evaluates them safely without executing any user-provided
Python and without ``eval()``.
"""

from __future__ import annotations

from .engine import RuleEngine, RuleEvaluationError, RuleValidationError
from .models import (
    FieldCatalogEntry,
    LogicalOperator,
    Operator,
    RuleCondition,
    RuleConditionGroup,
    RuleDefinition,
    RuleOutcome,
    RuleTestRequest,
    RuleTestResponse,
    RuleValidateRequest,
    RuleValidateResponse,
)

__all__ = [
    "FieldCatalogEntry",
    "LogicalOperator",
    "Operator",
    "RuleCondition",
    "RuleConditionGroup",
    "RuleDefinition",
    "RuleEngine",
    "RuleEvaluationError",
    "RuleOutcome",
    "RuleTestRequest",
    "RuleTestResponse",
    "RuleValidationError",
    "RuleValidateRequest",
    "RuleValidateResponse",
]
