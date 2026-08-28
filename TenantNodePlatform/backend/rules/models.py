"""Pydantic models for the Business Rule Engine.

The schema is versioned via ``RuleDefinition.schema_version``. The current
schema version is ``"1.0"``.

A rule definition is a tree of condition groups and leaf conditions. Leaf
conditions reference a dot-path field and apply one of the supported
operators. Logical operators (AND / OR / NOT) combine nested groups. The
engine resolves the outcome (true / false branch) or falls back to a default.
"""

from __future__ import annotations

import enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #

class Operator(str, enum.Enum):
    EQUALS = "EQUALS"
    NOT_EQUALS = "NOT_EQUALS"
    GREATER_THAN = "GREATER_THAN"
    LESS_THAN = "LESS_THAN"
    GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL"
    LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL"
    CONTAINS = "CONTAINS"
    NOT_CONTAINS = "NOT_CONTAINS"
    STARTS_WITH = "STARTS_WITH"
    ENDS_WITH = "ENDS_WITH"
    EXISTS = "EXISTS"
    NOT_EXISTS = "NOT_EXISTS"
    IS_EMPTY = "IS_EMPTY"
    IS_NOT_EMPTY = "IS_NOT_EMPTY"
    IN = "IN"
    NOT_IN = "NOT_IN"
    BETWEEN = "BETWEEN"


class LogicalOperator(str, enum.Enum):
    AND = "AND"
    OR = "OR"
    NOT = "NOT"


SCHEMA_VERSION = "1.0"


# --------------------------------------------------------------------------- #
# Rule structure
# --------------------------------------------------------------------------- #

class RuleCondition(BaseModel):
    """A single leaf condition: ``field <operator> value``."""

    field: str = Field(..., description="Dot-path to the field, e.g. 'address.matchScore'.")
    operator: Operator
    value: Optional[Any] = Field(
        None,
        description="Comparison value. Ignored for EXISTS / NOT_EXISTS / IS_EMPTY / IS_NOT_EMPTY.",
    )

    model_config = {"extra": "forbid"}


class RuleConditionGroup(BaseModel):
    """A logical group of nested conditions and/or sub-groups.

    A group has an ``operator`` (AND / OR / NOT) and a list of ``rules``.
    Each entry in ``rules`` is either a leaf ``RuleCondition`` or a nested
    ``RuleConditionGroup``. The engine discriminates by the presence of the
    ``operator`` field combined with ``rules`` (group) vs ``field`` (leaf).
    """

    operator: LogicalOperator = LogicalOperator.AND
    rules: List[Union[RuleConditionGroup, RuleCondition]] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


class RuleOutcome(BaseModel):
    """Outcomes for the true / false branches of the condition tree."""

    true: Optional[str] = None
    false: Optional[str] = None

    model_config = {"extra": "forbid"}


class RuleDefinition(BaseModel):
    """Top-level rule definition.

    Example::

        {
          "ruleSetId": "address-verification-rule",
          "schemaVersion": "1.0",
          "conditions": {
            "operator": "AND",
            "rules": [
              {"field": "address.matchScore", "operator": "GREATER_THAN_OR_EQUAL", "value": 80},
              {"field": "address.status", "operator": "EQUALS", "value": "VERIFIED"}
            ]
          },
          "outcomes": {"true": "APPROVE", "false": "REVIEW"},
          "defaultOutcome": "REVIEW"
        }
    """

    ruleSetId: str = Field(..., min_length=1)
    schemaVersion: str = Field(default=SCHEMA_VERSION)
    conditions: RuleConditionGroup
    outcomes: RuleOutcome = Field(default_factory=RuleOutcome)
    defaultOutcome: Optional[str] = None

    model_config = {"extra": "forbid"}


# --------------------------------------------------------------------------- #
# Field catalog
# --------------------------------------------------------------------------- #

class FieldCatalogEntry(BaseModel):
    """A single field exposed by a Service Node's output."""

    name: str = Field(..., description="Field name as it appears in the output, e.g. 'matchScore'.")
    type: str = Field(..., description="JSON type: string, number, boolean, object, array, null.")
    description: str = ""
    required: bool = False
    path: str = Field("", description="Dot-path prefix for nested objects, e.g. 'address'.")

    model_config = {"extra": "allow"}


class FieldCatalog(BaseModel):
    """Catalog of output fields for a service node."""

    nodeId: str
    serviceName: str = ""
    fields: List[FieldCatalogEntry] = Field(default_factory=list)

    model_config = {"extra": "allow"}


# --------------------------------------------------------------------------- #
# API request / response models
# --------------------------------------------------------------------------- #

class RuleValidateRequest(BaseModel):
    """Request body for POST /api/tenant-platform/rules/validate."""

    rule_definition: Dict[str, Any]

    model_config = {"extra": "forbid"}


class RuleValidateResponse(BaseModel):
    """Response for the validate endpoint."""

    valid: bool
    errors: List[str] = Field(default_factory=list)
    schema_version: str = SCHEMA_VERSION


class RuleTestRequest(BaseModel):
    """Request body for POST /api/tenant-platform/rules/test."""

    rule_definition: Dict[str, Any]
    sample_input: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "forbid"}


class TraceStep(BaseModel):
    """A single step in the evaluation trace."""

    description: str
    result: bool
    detail: str = ""


class RuleTestResponse(BaseModel):
    """Response for the test endpoint."""

    matched: bool
    outcome: Optional[str] = None
    evaluation_trace: List[TraceStep] = Field(default_factory=list)
    error: Optional[str] = None
