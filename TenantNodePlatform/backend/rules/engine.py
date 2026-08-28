"""Business Rule Engine core.

Implements:

    validate_rule_definition()
    evaluate_rule()
    evaluate_condition_group()
    resolve_field_value()
    resolve_operator()
    return_decision()

The engine is deliberately defensive: missing fields, null values, type
mismatches, and invalid operators are handled gracefully and never raise
uncaught exceptions during evaluation. No ``eval()`` is used and no
user-provided Python is ever executed.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from .models import (
    Operator,
    RuleCondition,
    RuleConditionGroup,
    RuleDefinition,
    RuleOutcome,
    SCHEMA_VERSION,
    TraceStep,
)


# --------------------------------------------------------------------------- #
# Exceptions
# --------------------------------------------------------------------------- #

class RuleValidationError(Exception):
    """Raised when a rule definition is structurally invalid."""


class RuleEvaluationError(Exception):
    """Raised when an unexpected (non-recoverable) error occurs during evaluation."""


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #

def validate_rule_definition(rule: Dict[str, Any]) -> List[str]:
    """Validate a raw rule-definition dict.

    Returns a list of human-readable error strings. An empty list means the
    rule is valid. This function never raises for malformed input — it
    collects errors instead.
    """
    errors: List[str] = []

    if not isinstance(rule, dict):
        return ["Rule definition must be a JSON object."]

    rule_set_id = rule.get("ruleSetId")
    if not rule_set_id or not isinstance(rule_set_id, str):
        errors.append("'ruleSetId' is required and must be a non-empty string.")

    schema_version = rule.get("schemaVersion", SCHEMA_VERSION)
    if schema_version != SCHEMA_VERSION:
        errors.append(
            f"Unsupported schemaVersion '{schema_version}'. Supported: '{SCHEMA_VERSION}'."
        )

    conditions = rule.get("conditions")
    if conditions is None:
        errors.append("'conditions' is required.")
    else:
        errors.extend(_validate_condition_node(conditions, path="conditions"))

    outcomes = rule.get("outcomes", {})
    if outcomes is not None:
        if not isinstance(outcomes, dict):
            errors.append("'outcomes' must be an object with 'true' and/or 'false' keys.")
        else:
            for key in outcomes:
                if key not in ("true", "false"):
                    errors.append(f"'outcomes' has unexpected key '{key}'. Only 'true' and 'false' are allowed.")
            for key in ("true", "false"):
                val = outcomes.get(key)
                if val is not None and not isinstance(val, str):
                    errors.append(f"'outcomes.{key}' must be a string or null.")

    default_outcome = rule.get("defaultOutcome")
    if default_outcome is not None and not isinstance(default_outcome, str):
        errors.append("'defaultOutcome' must be a string or null.")

    return errors


def _validate_condition_node(node: Any, path: str) -> List[str]:
    """Validate a condition node (either a leaf condition or a group)."""
    errors: List[str] = []

    if not isinstance(node, dict):
        return [f"'{path}' must be a JSON object."]

    # Leaf condition: has 'field' and 'operator'
    if "field" in node and "operator" in node and "rules" not in node:
        field = node.get("field")
        if not field or not isinstance(field, str):
            errors.append(f"'{path}.field' is required and must be a non-empty string.")

        operator = node.get("operator")
        valid_ops = {op.value for op in Operator}
        if operator not in valid_ops:
            errors.append(
                f"'{path}.operator' must be one of: {', '.join(sorted(valid_ops))}."
            )

        # Value requirement depends on operator
        if operator and operator not in (
            Operator.EXISTS.value,
            Operator.NOT_EXISTS.value,
            Operator.IS_EMPTY.value,
            Operator.IS_NOT_EMPTY.value,
        ):
            if "value" not in node:
                errors.append(f"'{path}.value' is required for operator '{operator}'.")
            elif operator == Operator.BETWEEN.value:
                if not isinstance(node.get("value"), (list, tuple)) or len(node.get("value")) != 2:
                    errors.append(f"'{path}.value' for BETWEEN must be a two-element array [low, high].")
            elif operator in (Operator.IN.value, Operator.NOT_IN.value):
                if not isinstance(node.get("value"), (list, tuple)):
                    errors.append(f"'{path}.value' for {operator} must be an array.")

        # No extra keys
        allowed = {"field", "operator", "value"}
        extra = set(node.keys()) - allowed
        if extra:
            errors.append(f"'{path}' has unexpected keys: {', '.join(sorted(extra))}.")
        return errors

    # Condition group: has 'rules'
    if "rules" in node:
        operator = node.get("operator", "AND")
        valid_logicals = {"AND", "OR", "NOT"}
        if operator not in valid_logicals:
            errors.append(
                f"'{path}.operator' must be one of: {', '.join(sorted(valid_logicals))}."
            )

        rules = node.get("rules")
        if not isinstance(rules, list):
            errors.append(f"'{path}.rules' must be an array.")
            return errors

        if operator == "NOT" and len(rules) != 1:
            errors.append(f"'{path}': NOT operator must have exactly one rule.")

        if len(rules) == 0:
            errors.append(f"'{path}.rules' must not be empty.")

        for i, child in enumerate(rules):
            errors.extend(_validate_condition_node(child, path=f"{path}.rules[{i}]"))

        allowed = {"operator", "rules"}
        extra = set(node.keys()) - allowed
        if extra:
            errors.append(f"'{path}' has unexpected keys: {', '.join(sorted(extra))}.")
        return errors

    return [f"'{path}' is neither a valid condition (needs 'field' + 'operator') nor a group (needs 'rules')."]


# --------------------------------------------------------------------------- #
# Field resolution
# --------------------------------------------------------------------------- #

_MISSING = object()


def resolve_field_value(field_path: str, input_data: Dict[str, Any]) -> Any:
    """Resolve a dot-path field from the input data.

    Returns ``_MISSING`` when any segment of the path is absent. Returns
    ``None`` only when the leaf is explicitly null. This distinction lets
    operators like EXISTS differentiate between "field missing" and
    "field is null".
    """
    if not field_path or not isinstance(input_data, dict):
        return _MISSING

    current: Any = input_data
    for segment in field_path.split("."):
        if isinstance(current, dict) and segment in current:
            current = current[segment]
        else:
            return _MISSING
    return current


# --------------------------------------------------------------------------- #
# Operator resolution
# --------------------------------------------------------------------------- #

def _is_numeric(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _coerce_numeric(value: Any) -> Optional[float]:
    if _is_numeric(value):
        return float(value)
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def resolve_operator(
    operator: str,
    actual: Any,
    expected: Any,
) -> Tuple[bool, str]:
    """Evaluate a single operator against actual and expected values.

    Returns ``(result, detail)`` where ``detail`` is a short human-readable
    explanation of the comparison, used in the evaluation trace.
    """
    op = operator

    # --- Existence operators (ignore expected) ---
    if op == Operator.EXISTS.value:
        exists = actual is not _MISSING
        return exists, f"field exists = {exists}"

    if op == Operator.NOT_EXISTS.value:
        exists = actual is not _MISSING
        return (not exists), f"field does not exist = {not exists}"

    if op == Operator.IS_EMPTY.value:
        if actual is _MISSING:
            return True, "field missing → empty"
        if actual is None:
            return True, "null → empty"
        if isinstance(actual, (str, list, dict)) and len(actual) == 0:
            return True, f"empty {type(actual).__name__} → empty"
        if isinstance(actual, (str, list, dict)):
            return False, f"non-empty {type(actual).__name__}"
        return False, f"value present ({type(actual).__name__}) → not empty"

    if op == Operator.IS_NOT_EMPTY.value:
        if actual is _MISSING:
            return False, "field missing → not empty = false"
        if actual is None:
            return False, "null → not empty = false"
        if isinstance(actual, (str, list, dict)):
            return len(actual) > 0, f"length {len(actual)} > 0"
        return True, f"value present ({type(actual).__name__}) → not empty"

    # For remaining operators, a missing field means the comparison fails
    # gracefully (returns False) unless it's a NOT_* operator.
    if actual is _MISSING:
        if op in (Operator.NOT_EQUALS.value, Operator.NOT_CONTAINS.value, Operator.NOT_IN.value):
            return True, "field missing → inequality holds"
        return False, "field missing → comparison false"

    # --- Equality operators ---
    if op == Operator.EQUALS.value:
        result = _equals(actual, expected)
        return result, f"{actual!r} == {expected!r} → {result}"

    if op == Operator.NOT_EQUALS.value:
        result = not _equals(actual, expected)
        return result, f"{actual!r} != {expected!r} → {result}"

    # --- Comparison operators (numeric-aware) ---
    if op in (
        Operator.GREATER_THAN.value,
        Operator.LESS_THAN.value,
        Operator.GREATER_THAN_OR_EQUAL.value,
        Operator.LESS_THAN_OR_EQUAL.value,
        Operator.BETWEEN.value,
    ):
        a_num = _coerce_numeric(actual)
        if a_num is None:
            return False, f"actual {actual!r} is not numeric → false"

        if op == Operator.BETWEEN.value:
            if not isinstance(expected, (list, tuple)) or len(expected) != 2:
                return False, "BETWEEN value must be [low, high]"
            low, high = expected[0], expected[1]
            low_num = _coerce_numeric(low)
            high_num = _coerce_numeric(high)
            if low_num is None or high_num is None:
                return False, "BETWEEN bounds not numeric"
            result = low_num <= a_num <= high_num
            return result, f"{a_num} between [{low_num}, {high_num}] → {result}"

        e_num = _coerce_numeric(expected)
        if e_num is None:
            return False, f"expected {expected!r} is not numeric → false"

        if op == Operator.GREATER_THAN.value:
            result = a_num > e_num
        elif op == Operator.LESS_THAN.value:
            result = a_num < e_num
        elif op == Operator.GREATER_THAN_OR_EQUAL.value:
            result = a_num >= e_num
        else:  # LESS_THAN_OR_EQUAL
            result = a_num <= e_num
        return result, f"{a_num} {op} {e_num} → {result}"

    # --- String containment operators ---
    if op == Operator.CONTAINS.value:
        if isinstance(actual, str) and isinstance(expected, str):
            result = expected in actual
            return result, f"'{actual}' contains '{expected}' → {result}"
        if isinstance(actual, (list, tuple)):
            result = expected in actual
            return result, f"list contains {expected!r} → {result}"
        return False, f"cannot apply CONTAINS to {type(actual).__name__}"

    if op == Operator.NOT_CONTAINS.value:
        if isinstance(actual, str) and isinstance(expected, str):
            result = expected not in actual
            return result, f"'{actual}' not contains '{expected}' → {result}"
        if isinstance(actual, (list, tuple)):
            result = expected not in actual
            return result, f"list not contains {expected!r} → {result}"
        return True, f"cannot apply NOT_CONTAINS to {type(actual).__name__} → true"

    if op == Operator.STARTS_WITH.value:
        if isinstance(actual, str) and isinstance(expected, str):
            result = actual.startswith(expected)
            return result, f"'{actual}' starts with '{expected}' → {result}"
        return False, f"cannot apply STARTS_WITH to {type(actual).__name__}"

    if op == Operator.ENDS_WITH.value:
        if isinstance(actual, str) and isinstance(expected, str):
            result = actual.endswith(expected)
            return result, f"'{actual}' ends with '{expected}' → {result}"
        return False, f"cannot apply ENDS_WITH to {type(actual).__name__}"

    # --- Membership operators ---
    if op == Operator.IN.value:
        if isinstance(expected, (list, tuple, set)):
            result = actual in expected
            return result, f"{actual!r} in {list(expected)!r} → {result}"
        return False, "IN value must be an array"

    if op == Operator.NOT_IN.value:
        if isinstance(expected, (list, tuple, set)):
            result = actual not in expected
            return result, f"{actual!r} not in {list(expected)!r} → {result}"
        return False, "NOT_IN value must be an array"

    return False, f"unknown operator '{op}'"


def _equals(actual: Any, expected: Any) -> bool:
    """Type-coercing equality.

    Numeric values are compared numerically (so 87 == 87.0). Booleans are
    not treated as numbers here. Strings are compared exactly.
    """
    if _is_numeric(actual) and _is_numeric(expected):
        return float(actual) == float(expected)
    return actual == expected


# --------------------------------------------------------------------------- #
# Condition group evaluation
# --------------------------------------------------------------------------- #

def evaluate_condition_group(
    node: Dict[str, Any],
    input_data: Dict[str, Any],
    trace: Optional[List[TraceStep]] = None,
    indent: int = 0,
) -> bool:
    """Evaluate a condition node (leaf or group) against the input data.

    Appends human-readable steps to ``trace`` when provided.
    """
    if trace is None:
        trace = []

    if not isinstance(node, dict):
        raise RuleEvaluationError("Condition node must be a JSON object.")

    # Leaf condition
    if "field" in node and "operator" in node and "rules" not in node:
        return _evaluate_leaf(node, input_data, trace, indent)

    # Group
    if "rules" in node:
        return _evaluate_group(node, input_data, trace, indent)

    raise RuleEvaluationError(
        "Condition node is neither a valid leaf condition nor a group."
    )


def _evaluate_leaf(
    node: Dict[str, Any],
    input_data: Dict[str, Any],
    trace: List[TraceStep],
    indent: int,
) -> bool:
    field_path = node.get("field", "")
    operator = node.get("operator", "")
    expected = node.get("value")

    actual = resolve_field_value(field_path, input_data)
    result, detail = resolve_operator(operator, actual, expected)

    # Build a readable description for the trace
    actual_repr = "MISSING" if actual is _MISSING else repr(actual)
    description = f"{'  ' * indent}{field_path} {operator} {expected!r}"
    if actual is _MISSING:
        description += f"  [field='{field_path}' missing]"
    trace.append(
        TraceStep(
            description=description,
            result=result,
            detail=detail,
        )
    )
    return result


def _evaluate_group(
    node: Dict[str, Any],
    input_data: Dict[str, Any],
    trace: List[TraceStep],
    indent: int,
) -> bool:
    operator = node.get("operator", "AND")
    rules = node.get("rules", [])

    if operator == "NOT":
        if len(rules) != 1:
            raise RuleEvaluationError("NOT operator must have exactly one rule.")
        child_result = evaluate_condition_group(rules[0], input_data, trace, indent + 1)
        result = not child_result
        trace.append(
            TraceStep(
                description=f"{'  ' * indent}NOT → {result}",
                result=result,
                detail=f"negated child result {child_result}",
            )
        )
        return result

    child_results: List[bool] = []
    for child in rules:
        child_results.append(
            evaluate_condition_group(child, input_data, trace, indent + 1)
        )

    if operator == "AND":
        result = all(child_results)
    elif operator == "OR":
        result = any(child_results)
    else:
        raise RuleEvaluationError(f"Unknown logical operator '{operator}'.")

    trace.append(
        TraceStep(
            description=f"{'  ' * indent}{operator} → {result}",
            result=result,
            detail=f"children: {child_results}",
        )
    )
    return result


# --------------------------------------------------------------------------- #
# Rule evaluation + decision
# --------------------------------------------------------------------------- #

def evaluate_rule(
    rule: Dict[str, Any],
    input_data: Dict[str, Any],
    trace: Optional[List[TraceStep]] = None,
) -> bool:
    """Evaluate the top-level conditions of a rule definition.

    Returns ``True`` if the condition tree matches, ``False`` otherwise.
    Populates ``trace`` with per-step evaluation details when provided.
    """
    if trace is None:
        trace = []

    conditions = rule.get("conditions")
    if conditions is None:
        trace.append(
            TraceStep(
                description="No conditions defined",
                result=False,
                detail="rule has no 'conditions' block",
            )
        )
        return False

    return evaluate_condition_group(conditions, input_data, trace, indent=0)


def return_decision(
    rule: Dict[str, Any],
    matched: bool,
) -> Optional[str]:
    """Resolve the final outcome for a rule given whether conditions matched."""
    outcomes = rule.get("outcomes") or {}
    if not isinstance(outcomes, dict):
        return rule.get("defaultOutcome")

    if matched:
        outcome = outcomes.get("true")
    else:
        outcome = outcomes.get("false")

    if outcome is None:
        return rule.get("defaultOutcome")
    return outcome


# --------------------------------------------------------------------------- #
# Engine facade
# --------------------------------------------------------------------------- #

class RuleEngine:
    """Facade combining validation, evaluation, and decision resolution.

    Usage::

        engine = RuleEngine()
        errors = engine.validate(definition_dict)
        result = engine.test(definition_dict, sample_input)
    """

    def validate(self, rule: Dict[str, Any]) -> List[str]:
        return validate_rule_definition(rule)

    def evaluate(
        self,
        rule: Dict[str, Any],
        input_data: Dict[str, Any],
        trace: Optional[List[TraceStep]] = None,
    ) -> bool:
        return evaluate_rule(rule, input_data, trace=trace)

    def decide(
        self,
        rule: Dict[str, Any],
        input_data: Dict[str, Any],
        trace: Optional[List[TraceStep]] = None,
    ) -> Tuple[bool, Optional[str]]:
        matched = evaluate_rule(rule, input_data, trace=trace)
        outcome = return_decision(rule, matched)
        return matched, outcome

    def test(
        self,
        rule: Dict[str, Any],
        input_data: Dict[str, Any],
    ) -> Tuple[bool, Optional[str], List[TraceStep]]:
        """Full test: validate, evaluate, and resolve the decision.

        Returns ``(matched, outcome, evaluation_trace)``. If validation
        fails, returns ``(False, None, [])`` — callers should call
        ``validate()`` separately to get validation errors.
        """
        errors = validate_rule_definition(rule)
        if errors:
            return False, None, []

        trace: List[TraceStep] = []
        matched = evaluate_rule(rule, input_data, trace=trace)
        outcome = return_decision(rule, matched)

        # Append final outcome step to the trace
        trace.append(
            TraceStep(
                description=f"Final outcome → {outcome}",
                result=matched,
                detail=f"matched={matched}, outcome={outcome}",
            )
        )
        return matched, outcome, trace
