"""Comprehensive unit tests for the Business Rule Engine.

These tests are completely independent of the existing LangGraph / blueprint
tests. They cover validation, every operator, nested groups, field
resolution, type coercion, missing/null handling, and the API endpoints.
"""

from __future__ import annotations

import pytest

from TenantNodePlatform.backend.rules.engine import (
    RuleEngine,
    RuleEvaluationError,
    resolve_field_value,
    resolve_operator,
    return_decision,
    validate_rule_definition,
)
from TenantNodePlatform.backend.rules.field_catalog import (
    FieldCatalogRegistry,
    derive_field_catalog,
)
from TenantNodePlatform.backend.rules.models import (
    FieldCatalog,
    FieldCatalogEntry,
    Operator,
    SCHEMA_VERSION,
    TraceStep,
)


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #

@pytest.fixture
def engine():
    return RuleEngine()


@pytest.fixture
def address_rule():
    """The canonical example rule from the spec."""
    return {
        "ruleSetId": "address-verification-rule",
        "schemaVersion": "1.0",
        "conditions": {
            "operator": "AND",
            "rules": [
                {
                    "field": "address.matchScore",
                    "operator": "GREATER_THAN_OR_EQUAL",
                    "value": 80,
                },
                {
                    "field": "address.status",
                    "operator": "EQUALS",
                    "value": "VERIFIED",
                },
            ],
        },
        "outcomes": {"true": "APPROVE", "false": "REVIEW"},
        "defaultOutcome": "REVIEW",
    }


@pytest.fixture
def address_input():
    return {
        "address": {
            "addressMatch": True,
            "matchScore": 87,
            "status": "VERIFIED",
            "country": "IN",
        }
    }


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #

class TestValidation:
    def test_valid_rule_has_no_errors(self, address_rule):
        assert validate_rule_definition(address_rule) == []

    def test_missing_rule_set_id(self, address_rule):
        del address_rule["ruleSetId"]
        errors = validate_rule_definition(address_rule)
        assert any("ruleSetId" in e for e in errors)

    def test_empty_rule_set_id(self, address_rule):
        address_rule["ruleSetId"] = ""
        errors = validate_rule_definition(address_rule)
        assert any("ruleSetId" in e for e in errors)

    def test_unsupported_schema_version(self, address_rule):
        address_rule["schemaVersion"] = "2.0"
        errors = validate_rule_definition(address_rule)
        assert any("schemaVersion" in e for e in errors)

    def test_missing_conditions(self, address_rule):
        del address_rule["conditions"]
        errors = validate_rule_definition(address_rule)
        assert any("conditions" in e for e in errors)

    def test_invalid_operator(self, address_rule):
        address_rule["conditions"]["rules"][0]["operator"] = "BANANA"
        errors = validate_rule_definition(address_rule)
        assert any("operator" in e for e in errors)

    def test_missing_value_for_operator(self, address_rule):
        del address_rule["conditions"]["rules"][0]["value"]
        errors = validate_rule_definition(address_rule)
        assert any("value" in e for e in errors)

    def test_value_optional_for_exists(self):
        rule = {
            "ruleSetId": "exists-rule",
            "schemaVersion": "1.0",
            "conditions": {
                "operator": "AND",
                "rules": [{"field": "foo", "operator": "EXISTS"}],
            },
            "outcomes": {"true": "PASS"},
        }
        assert validate_rule_definition(rule) == []

    def test_between_requires_two_element_array(self):
        rule = {
            "ruleSetId": "between-rule",
            "schemaVersion": "1.0",
            "conditions": {
                "operator": "AND",
                "rules": [
                    {"field": "score", "operator": "BETWEEN", "value": [10]},
                ],
            },
        }
        errors = validate_rule_definition(rule)
        assert any("BETWEEN" in e for e in errors)

    def test_in_requires_array(self):
        rule = {
            "ruleSetId": "in-rule",
            "schemaVersion": "1.0",
            "conditions": {
                "operator": "AND",
                "rules": [
                    {"field": "country", "operator": "IN", "value": "IN"},
                ],
            },
        }
        errors = validate_rule_definition(rule)
        assert any("IN" in e for e in errors)

    def test_not_operator_must_have_one_rule(self):
        rule = {
            "ruleSetId": "not-rule",
            "schemaVersion": "1.0",
            "conditions": {
                "operator": "NOT",
                "rules": [
                    {"field": "a", "operator": "EQUALS", "value": 1},
                    {"field": "b", "operator": "EQUALS", "value": 2},
                ],
            },
        }
        errors = validate_rule_definition(rule)
        assert any("NOT" in e for e in errors)

    def test_empty_rules_array(self):
        rule = {
            "ruleSetId": "empty-rule",
            "schemaVersion": "1.0",
            "conditions": {"operator": "AND", "rules": []},
        }
        errors = validate_rule_definition(address_rule := {**rule})
        assert any("empty" in e.lower() for e in errors)

    def test_invalid_outcome_key(self, address_rule):
        address_rule["outcomes"]["maybe"] = "MAYBE"
        errors = validate_rule_definition(address_rule)
        assert any("maybe" in e for e in errors)

    def test_non_dict_rule(self):
        errors = validate_rule_definition("not a dict")  # type: ignore[arg-type]
        assert len(errors) == 1
        assert "JSON object" in errors[0]

    def test_nested_group_validation(self):
        rule = {
            "ruleSetId": "nested",
            "schemaVersion": "1.0",
            "conditions": {
                "operator": "OR",
                "rules": [
                    {
                        "operator": "AND",
                        "rules": [
                            {"field": "a", "operator": "EQUALS", "value": 1},
                            {"field": "b", "operator": "EQUALS", "value": 2},
                        ],
                    },
                    {"field": "c", "operator": "EQUALS", "value": 3},
                ],
            },
        }
        assert validate_rule_definition(rule) == []

    def test_extra_keys_rejected(self, address_rule):
        address_rule["conditions"]["rules"][0]["extra"] = "bad"
        errors = validate_rule_definition(address_rule)
        assert any("unexpected" in e for e in errors)


# --------------------------------------------------------------------------- #
# Field resolution
# --------------------------------------------------------------------------- #

class TestFieldResolution:
    def test_simple_field(self):
        assert resolve_field_value("name", {"name": "Alice"}) == "Alice"

    def test_nested_field(self):
        assert resolve_field_value("address.city", {"address": {"city": "Delhi"}}) == "Delhi"

    def test_deeply_nested_field(self):
        data = {"a": {"b": {"c": {"d": 42}}}}
        assert resolve_field_value("a.b.c.d", data) == 42

    def test_missing_field_returns_missing_sentinel(self):
        from TenantNodePlatform.backend.rules.engine import _MISSING
        assert resolve_field_value("nonexistent", {}) is _MISSING

    def test_missing_intermediate_segment(self):
        from TenantNodePlatform.backend.rules.engine import _MISSING
        assert resolve_field_value("a.b.c", {"a": {}}) is _MISSING

    def test_null_field_returns_none(self):
        assert resolve_field_value("value", {"value": None}) is None

    def test_empty_path(self):
        from TenantNodePlatform.backend.rules.engine import _MISSING
        assert resolve_field_value("", {"x": 1}) is _MISSING

    def test_non_dict_input(self):
        from TenantNodePlatform.backend.rules.engine import _MISSING
        assert resolve_field_value("x", "not a dict") is _MISSING  # type: ignore[arg-type]


# --------------------------------------------------------------------------- #
# Operators
# --------------------------------------------------------------------------- #

class TestOperators:
    def test_equals_string(self):
        result, _ = resolve_operator("EQUALS", "VERIFIED", "VERIFIED")
        assert result is True

    def test_equals_number_int_float(self):
        result, _ = resolve_operator("EQUALS", 87, 87.0)
        assert result is True

    def test_not_equals(self):
        result, _ = resolve_operator("NOT_EQUALS", "PENDING", "VERIFIED")
        assert result is True

    def test_greater_than(self):
        assert resolve_operator("GREATER_THAN", 90, 80)[0] is True
        assert resolve_operator("GREATER_THAN", 80, 80)[0] is False

    def test_less_than(self):
        assert resolve_operator("LESS_THAN", 70, 80)[0] is True
        assert resolve_operator("LESS_THAN", 80, 80)[0] is False

    def test_greater_than_or_equal(self):
        assert resolve_operator("GREATER_THAN_OR_EQUAL", 80, 80)[0] is True
        assert resolve_operator("GREATER_THAN_OR_EQUAL", 79, 80)[0] is False

    def test_less_than_or_equal(self):
        assert resolve_operator("LESS_THAN_OR_EQUAL", 80, 80)[0] is True
        assert resolve_operator("LESS_THAN_OR_EQUAL", 81, 80)[0] is False

    def test_contains_string(self):
        assert resolve_operator("CONTAINS", "hello world", "world")[0] is True
        assert resolve_operator("CONTAINS", "hello", "world")[0] is False

    def test_contains_list(self):
        assert resolve_operator("CONTAINS", ["IN", "US", "UK"], "IN")[0] is True
        assert resolve_operator("CONTAINS", ["US", "UK"], "IN")[0] is False

    def test_not_contains_string(self):
        assert resolve_operator("NOT_CONTAINS", "hello", "world")[0] is True

    def test_not_contains_list(self):
        assert resolve_operator("NOT_CONTAINS", ["US"], "IN")[0] is True

    def test_starts_with(self):
        assert resolve_operator("STARTS_WITH", "VERIFIED", "VER")[0] is True
        assert resolve_operator("STARTS_WITH", "FAILED", "VER")[0] is False

    def test_ends_with(self):
        assert resolve_operator("ENDS_WITH", "address_verified", "verified")[0] is True
        assert resolve_operator("ENDS_WITH", "address_failed", "verified")[0] is False

    def test_exists_present(self):
        assert resolve_operator("EXISTS", "value", None)[0] is True

    def test_exists_missing(self):
        from TenantNodePlatform.backend.rules.engine import _MISSING
        assert resolve_operator("EXISTS", _MISSING, None)[0] is False

    def test_not_exists(self):
        from TenantNodePlatform.backend.rules.engine import _MISSING
        assert resolve_operator("NOT_EXISTS", _MISSING, None)[0] is True

    def test_is_empty_string(self):
        assert resolve_operator("IS_EMPTY", "", None)[0] is True
        assert resolve_operator("IS_EMPTY", "x", None)[0] is False

    def test_is_empty_list(self):
        assert resolve_operator("IS_EMPTY", [], None)[0] is True
        assert resolve_operator("IS_EMPTY", [1], None)[0] is False

    def test_is_empty_null(self):
        assert resolve_operator("IS_EMPTY", None, None)[0] is True

    def test_is_empty_missing(self):
        from TenantNodePlatform.backend.rules.engine import _MISSING
        assert resolve_operator("IS_EMPTY", _MISSING, None)[0] is True

    def test_is_not_empty_string(self):
        assert resolve_operator("IS_NOT_EMPTY", "value", None)[0] is True
        assert resolve_operator("IS_NOT_EMPTY", "", None)[0] is False

    def test_in(self):
        assert resolve_operator("IN", "IN", ["IN", "US", "UK"])[0] is True
        assert resolve_operator("IN", "FR", ["IN", "US"])[0] is False

    def test_not_in(self):
        assert resolve_operator("NOT_IN", "FR", ["IN", "US"])[0] is True
        assert resolve_operator("NOT_IN", "IN", ["IN", "US"])[0] is False

    def test_between(self):
        assert resolve_operator("BETWEEN", 85, [80, 100])[0] is True
        assert resolve_operator("BETWEEN", 75, [80, 100])[0] is False
        assert resolve_operator("BETWEEN", 80, [80, 100])[0] is True
        assert resolve_operator("BETWEEN", 100, [80, 100])[0] is True

    def test_between_string_numeric(self):
        assert resolve_operator("BETWEEN", "85", [80, 100])[0] is True

    def test_numeric_comparison_with_string_actual(self):
        result, _ = resolve_operator("GREATER_THAN", "not a number", 80)
        assert result is False

    def test_numeric_comparison_with_string_expected(self):
        result, _ = resolve_operator("GREATER_THAN", 90, "not a number")
        assert result is False

    def test_missing_field_equality_returns_false(self):
        from TenantNodePlatform.backend.rules.engine import _MISSING
        assert resolve_operator("EQUALS", _MISSING, "VERIFIED")[0] is False

    def test_missing_field_not_equals_returns_true(self):
        from TenantNodePlatform.backend.rules.engine import _MISSING
        assert resolve_operator("NOT_EQUALS", _MISSING, "VERIFIED")[0] is True

    def test_unknown_operator_returns_false(self):
        result, _ = resolve_operator("BANANA", 1, 1)
        assert result is False


# --------------------------------------------------------------------------- #
# Condition group evaluation
# --------------------------------------------------------------------------- #

class TestConditionGroups:
    def test_and_group_all_true(self):
        node = {
            "operator": "AND",
            "rules": [
                {"field": "a", "operator": "EQUALS", "value": 1},
                {"field": "b", "operator": "EQUALS", "value": 2},
            ],
        }
        from TenantNodePlatform.backend.rules.engine import evaluate_condition_group
        assert evaluate_condition_group(node, {"a": 1, "b": 2}) is True

    def test_and_group_one_false(self):
        node = {
            "operator": "AND",
            "rules": [
                {"field": "a", "operator": "EQUALS", "value": 1},
                {"field": "b", "operator": "EQUALS", "value": 99},
            ],
        }
        from TenantNodePlatform.backend.rules.engine import evaluate_condition_group
        assert evaluate_condition_group(node, {"a": 1, "b": 2}) is False

    def test_or_group_any_true(self):
        node = {
            "operator": "OR",
            "rules": [
                {"field": "a", "operator": "EQUALS", "value": 99},
                {"field": "b", "operator": "EQUALS", "value": 2},
            ],
        }
        from TenantNodePlatform.backend.rules.engine import evaluate_condition_group
        assert evaluate_condition_group(node, {"a": 1, "b": 2}) is True

    def test_or_group_all_false(self):
        node = {
            "operator": "OR",
            "rules": [
                {"field": "a", "operator": "EQUALS", "value": 99},
                {"field": "b", "operator": "EQUALS", "value": 99},
            ],
        }
        from TenantNodePlatform.backend.rules.engine import evaluate_condition_group
        assert evaluate_condition_group(node, {"a": 1, "b": 2}) is False

    def test_not_group(self):
        node = {
            "operator": "NOT",
            "rules": [{"field": "a", "operator": "EQUALS", "value": 99}],
        }
        from TenantNodePlatform.backend.rules.engine import evaluate_condition_group
        assert evaluate_condition_group(node, {"a": 1}) is True

    def test_nested_groups_or(self):
        """(A AND B) OR (C AND D)"""
        node = {
            "operator": "OR",
            "rules": [
                {
                    "operator": "AND",
                    "rules": [
                        {"field": "a", "operator": "EQUALS", "value": 1},
                        {"field": "b", "operator": "EQUALS", "value": 2},
                    ],
                },
                {
                    "operator": "AND",
                    "rules": [
                        {"field": "c", "operator": "EQUALS", "value": 3},
                        {"field": "d", "operator": "EQUALS", "value": 4},
                    ],
                },
            ],
        }
        from TenantNodePlatform.backend.rules.engine import evaluate_condition_group
        # First group true
        assert evaluate_condition_group(node, {"a": 1, "b": 2, "c": 0, "d": 0}) is True
        # Second group true
        assert evaluate_condition_group(node, {"a": 0, "b": 0, "c": 3, "d": 4}) is True
        # Both false
        assert evaluate_condition_group(node, {"a": 0, "b": 0, "c": 0, "d": 0}) is False

    def test_deeply_nested(self):
        """((A AND B) OR (C)) AND NOT(D)"""
        node = {
            "operator": "AND",
            "rules": [
                {
                    "operator": "OR",
                    "rules": [
                        {
                            "operator": "AND",
                            "rules": [
                                {"field": "a", "operator": "EQUALS", "value": 1},
                                {"field": "b", "operator": "EQUALS", "value": 2},
                            ],
                        },
                        {"field": "c", "operator": "EQUALS", "value": 3},
                    ],
                },
                {
                    "operator": "NOT",
                    "rules": [{"field": "d", "operator": "EQUALS", "value": 99}],
                },
            ],
        }
        from TenantNodePlatform.backend.rules.engine import evaluate_condition_group
        assert evaluate_condition_group(node, {"a": 1, "b": 2, "c": 0, "d": 0}) is True
        assert evaluate_condition_group(node, {"a": 0, "b": 0, "c": 3, "d": 0}) is True
        assert evaluate_condition_group(node, {"a": 1, "b": 2, "c": 0, "d": 99}) is False


# --------------------------------------------------------------------------- #
# Full rule evaluation + decision
# --------------------------------------------------------------------------- #

class TestEvaluateRule:
    def test_canonical_example_approve(self, engine, address_rule, address_input):
        matched, outcome = engine.decide(address_rule, address_input)
        assert matched is True
        assert outcome == "APPROVE"

    def test_canonical_example_review_low_score(self, engine, address_rule):
        data = {"address": {"matchScore": 50, "status": "VERIFIED"}}
        matched, outcome = engine.decide(address_rule, data)
        assert matched is False
        assert outcome == "REVIEW"

    def test_canonical_example_review_unverified(self, engine, address_rule):
        data = {"address": {"matchScore": 90, "status": "PENDING"}}
        matched, outcome = engine.decide(address_rule, data)
        assert matched is False
        assert outcome == "REVIEW"

    def test_default_outcome_when_no_false_outcome(self, engine):
        rule = {
            "ruleSetId": "default-test",
            "schemaVersion": "1.0",
            "conditions": {
                "operator": "AND",
                "rules": [{"field": "x", "operator": "EQUALS", "value": 1}],
            },
            "outcomes": {"true": "PASS"},
            "defaultOutcome": "FAIL",
        }
        matched, outcome = engine.decide(rule, {"x": 99})
        assert matched is False
        assert outcome == "FAIL"

    def test_no_outcomes_returns_none(self, engine):
        rule = {
            "ruleSetId": "no-outcomes",
            "schemaVersion": "1.0",
            "conditions": {
                "operator": "AND",
                "rules": [{"field": "x", "operator": "EQUALS", "value": 1}],
            },
        }
        matched, outcome = engine.decide(rule, {"x": 1})
        assert matched is True
        assert outcome is None

    def test_missing_field_fails_gracefully(self, engine, address_rule):
        data = {}  # no address at all
        matched, outcome = engine.decide(address_rule, data)
        assert matched is False
        assert outcome == "REVIEW"

    def test_null_field_fails_gracefully(self, engine, address_rule):
        data = {"address": {"matchScore": None, "status": "VERIFIED"}}
        matched, outcome = engine.decide(address_rule, data)
        assert matched is False

    def test_wrong_type_handled(self, engine, address_rule):
        data = {"address": {"matchScore": "not a number", "status": "VERIFIED"}}
        matched, outcome = engine.decide(address_rule, data)
        assert matched is False

    def test_no_conditions_returns_false(self, engine):
        rule = {"ruleSetId": "empty", "schemaVersion": "1.0", "conditions": None}
        matched = engine.evaluate(rule, {})
        assert matched is False


# --------------------------------------------------------------------------- #
# Evaluation trace
# --------------------------------------------------------------------------- #

class TestEvaluationTrace:
    def test_trace_contains_steps(self, engine, address_rule, address_input):
        matched, outcome, trace = engine.test(address_rule, address_input)
        assert matched is True
        assert outcome == "APPROVE"
        assert len(trace) >= 3  # two conditions + AND + final outcome

    def test_trace_descriptions_are_human_readable(self, engine, address_rule, address_input):
        _, _, trace = engine.test(address_rule, address_input)
        descriptions = [step.description for step in trace]
        assert any("matchScore" in d for d in descriptions)
        assert any("status" in d for d in descriptions)
        assert any("APPROVE" in d for d in descriptions)

    def test_trace_shows_missing_field(self, engine, address_rule):
        data = {}
        _, _, trace = engine.test(address_rule, data)
        assert any("missing" in step.description.lower() for step in trace)

    def test_trace_step_results_match(self, engine, address_rule, address_input):
        _, _, trace = engine.test(address_rule, address_input)
        # The two leaf conditions should be True
        leaf_steps = [s for s in trace if "matchScore" in s.description or "status" in s.description]
        assert all(s.result for s in leaf_steps)


# --------------------------------------------------------------------------- #
# return_decision
# --------------------------------------------------------------------------- #

class TestReturnDecision:
    def test_true_outcome(self):
        rule = {"outcomes": {"true": "APPROVE", "false": "REJECT"}, "defaultOutcome": "REVIEW"}
        assert return_decision(rule, True) == "APPROVE"

    def test_false_outcome(self):
        rule = {"outcomes": {"true": "APPROVE", "false": "REJECT"}, "defaultOutcome": "REVIEW"}
        assert return_decision(rule, False) == "REJECT"

    def test_falls_back_to_default(self):
        rule = {"outcomes": {"true": "APPROVE"}, "defaultOutcome": "REVIEW"}
        assert return_decision(rule, False) == "REVIEW"

    def test_no_outcomes_uses_default(self):
        rule = {"defaultOutcome": "MANUAL_REVIEW"}
        assert return_decision(rule, True) == "MANUAL_REVIEW"

    def test_no_outcomes_no_default_returns_none(self):
        assert return_decision({}, True) is None

    def test_invalid_outcomes_falls_back(self):
        rule = {"outcomes": "not a dict", "defaultOutcome": "REVIEW"}
        assert return_decision(rule, True) == "REVIEW"


# --------------------------------------------------------------------------- #
# Field catalog
# --------------------------------------------------------------------------- #

class TestFieldCatalog:
    def test_derive_flat_fields(self):
        output = {
            "addressMatch": True,
            "matchScore": 87,
            "status": "VERIFIED",
            "country": "IN",
        }
        entries = derive_field_catalog(output)
        names = [e.name for e in entries]
        assert "addressMatch" in names
        assert "matchScore" in names
        assert "status" in names
        assert "country" in names

    def test_derive_field_types(self):
        output = {"flag": True, "score": 87, "name": "x", "items": [1, 2]}
        entries = derive_field_catalog(output)
        types = {e.name: e.type for e in entries}
        assert types["flag"] == "boolean"
        assert types["score"] == "number"
        assert types["name"] == "string"
        assert types["items"] == "array"

    def test_derive_nested_fields(self):
        output = {"address": {"city": "Delhi", "zip": "110001"}}
        entries = derive_field_catalog(output)
        names = [e.name for e in entries]
        assert "address" in names
        assert "city" in names
        assert "zip" in names
        # The nested entries should have path prefix
        city = next(e for e in entries if e.name == "city")
        assert city.path == "address"

    def test_registry_register_and_get(self):
        registry = FieldCatalogRegistry()
        catalog = FieldCatalog(
            nodeId="svc-1",
            serviceName="AddressService",
            fields=[FieldCatalogEntry(name="score", type="number")],
        )
        registry.register(catalog)
        retrieved = registry.get("svc-1")
        assert retrieved is not None
        assert retrieved.serviceName == "AddressService"
        assert len(retrieved.fields) == 1

    def test_registry_register_from_output(self):
        registry = FieldCatalogRegistry()
        output = {"matchScore": 87, "status": "VERIFIED"}
        catalog = registry.register_from_output("svc-1", output, service_name="AddrSvc")
        assert catalog.nodeId == "svc-1"
        assert catalog.serviceName == "AddrSvc"
        names = [f.name for f in catalog.fields]
        assert "matchScore" in names
        assert "status" in names

    def test_registry_list_all(self):
        registry = FieldCatalogRegistry()
        registry.register_from_output("svc-1", {"a": 1})
        registry.register_from_output("svc-2", {"b": 2})
        all_catalogs = registry.list_all()
        assert len(all_catalogs) == 2

    def test_registry_remove(self):
        registry = FieldCatalogRegistry()
        registry.register_from_output("svc-1", {"a": 1})
        assert registry.remove("svc-1") is True
        assert registry.get("svc-1") is None
        assert registry.remove("svc-1") is False

    def test_registry_get_nonexistent(self):
        registry = FieldCatalogRegistry()
        assert registry.get("nope") is None

    def test_derive_from_non_dict(self):
        assert derive_field_catalog("not a dict") == []  # type: ignore[arg-type]


# --------------------------------------------------------------------------- #
# Engine facade
# --------------------------------------------------------------------------- #

class TestEngineFacade:
    def test_validate_returns_errors(self, engine, address_rule):
        del address_rule["ruleSetId"]
        errors = engine.validate(address_rule)
        assert len(errors) > 0

    def test_validate_valid(self, engine, address_rule):
        assert engine.validate(address_rule) == []

    def test_test_invalid_returns_empty(self, engine):
        result = engine.test({"ruleSetId": ""}, {})
        assert result == (False, None, [])

    def test_decide_full_flow(self, engine, address_rule, address_input):
        matched, outcome = engine.decide(address_rule, address_input)
        assert matched is True
        assert outcome == "APPROVE"

    def test_evaluate_directly(self, engine, address_rule, address_input):
        assert engine.evaluate(address_rule, address_input) is True


# --------------------------------------------------------------------------- #
# API endpoints (via TestClient)
# --------------------------------------------------------------------------- #

class TestApiEndpoints:
    @pytest.fixture
    def client(self):
        from fastapi import FastAPI
        from TenantNodePlatform.backend.routers.rules import router as rules_router

        app = FastAPI()
        app.include_router(rules_router)
        from starlette.testclient import TestClient
        return TestClient(app)

    def test_validate_endpoint_valid(self, client, address_rule):
        resp = client.post(
            "/api/tenant-platform/rules/validate",
            json={"rule_definition": address_rule},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert body["errors"] == []
        assert body["schema_version"] == SCHEMA_VERSION

    def test_validate_endpoint_invalid(self, client, address_rule):
        del address_rule["ruleSetId"]
        resp = client.post(
            "/api/tenant-platform/rules/validate",
            json={"rule_definition": address_rule},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is False
        assert len(body["errors"]) > 0

    def test_test_endpoint_approve(self, client, address_rule, address_input):
        resp = client.post(
            "/api/tenant-platform/rules/test",
            json={"rule_definition": address_rule, "sample_input": address_input},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["matched"] is True
        assert body["outcome"] == "APPROVE"
        assert len(body["evaluation_trace"]) > 0
        assert body["error"] is None

    def test_test_endpoint_review(self, client, address_rule):
        data = {"address": {"matchScore": 50, "status": "VERIFIED"}}
        resp = client.post(
            "/api/tenant-platform/rules/test",
            json={"rule_definition": address_rule, "sample_input": data},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["matched"] is False
        assert body["outcome"] == "REVIEW"

    def test_test_endpoint_invalid_rule(self, client, address_rule):
        del address_rule["ruleSetId"]
        resp = client.post(
            "/api/tenant-platform/rules/test",
            json={"rule_definition": address_rule, "sample_input": {}},
        )
        assert resp.status_code == 400
        body = resp.json()
        assert "errors" in body["detail"]

    def test_test_endpoint_trace_format(self, client, address_rule, address_input):
        resp = client.post(
            "/api/tenant-platform/rules/test",
            json={"rule_definition": address_rule, "sample_input": address_input},
        )
        body = resp.json()
        trace = body["evaluation_trace"]
        assert all("description" in s for s in trace)
        assert all("result" in s for s in trace)
        assert any("APPROVE" in s["description"] for s in trace)
