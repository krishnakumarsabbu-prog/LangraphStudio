"""Seed data for the Tenant Node Platform.

Creates two sample tenants (GSA, Demo Tenant) and a realistic GSA Address
Verification blueprint containing a Service node and a Decision node.
"""

from __future__ import annotations

from .models import (
    Blueprint,
    BlueprintStatus,
    SourceType,
    Tenant,
    TenantStatus,
)
from .repositories.in_memory import (
    InMemoryBlueprintRepository,
    InMemoryBlueprintVersionRepository,
    InMemoryTenantRepository,
)
from .services.services import BlueprintService


GSA_TENANT_ID = "gsa-tenant-0001"
DEMO_TENANT_ID = "demo-tenant-0001"


def gsa_address_verification_graph() -> dict:
    return {
        "nodes": [
            {
                "id": "gsa-address-service",
                "type": "service",
                "data": {
                    "label": "GSA Address Service",
                    "url": "https://api.example-gsa.gov/address/v1/verify",
                    "method": "POST",
                    "config": {
                        "headers": [
                            {"key": "Content-Type", "value": "application/json"},
                            {"key": "X-GSA-API-Key", "value": "${GSA_API_KEY}"},
                        ],
                        "requestBody": {
                            "address_line1": "{input.address_line1}",
                            "address_line2": "{input.address_line2}",
                            "city": "{input.city}",
                            "state": "{input.state}",
                            "zip_code": "{input.zip_code}",
                        },
                    },
                    "mappings": [
                        {"source": "input.address_line1", "target": "address_line1"},
                        {"source": "input.city", "target": "city"},
                        {"source": "input.state", "target": "state"},
                        {"source": "input.zip_code", "target": "zip_code"},
                    ],
                    "retryPolicy": {"max_attempts": 3, "backoff": "exponential"},
                    "timeout": 15,
                },
            },
            {
                "id": "gsa-address-decision",
                "type": "decision",
                "data": {
                    "label": "GSA Address Decision",
                    "rules": [
                        {
                            "condition": "state['gsa-address-service']['response']['valid'] == True",
                            "action": {"address_verified": True, "verification_status": "VERIFIED"},
                        },
                        {
                            "condition": "state['gsa-address-service']['response']['valid'] == False",
                            "action": {"address_verified": False, "verification_status": "FAILED"},
                        },
                        {
                            "condition": "state['gsa-address-service']['response']['confidence_score'] >= 0.9",
                            "action": {"confidence_level": "HIGH"},
                        },
                        {
                            "condition": "state['gsa-address-service']['response']['confidence_score'] < 0.9 and state['gsa-address-service']['response']['confidence_score'] >= 0.7",
                            "action": {"confidence_level": "MEDIUM"},
                        },
                        {
                            "condition": "state['gsa-address-service']['response']['confidence_score'] < 0.7",
                            "action": {"confidence_level": "LOW"},
                        },
                    ],
                },
            },
        ],
        "edges": [
            {
                "source": "gsa-address-service",
                "target": "gsa-address-decision",
                "condition": "",
            }
        ],
        "inputs": {
            "address_line1": {},
            "address_line2": {},
            "city": {},
            "state": {},
            "zip_code": {},
        },
    }


def gsa_address_verification_input_contract() -> dict:
    return {
        "address_line1": {"type": "string", "required": True},
        "address_line2": {"type": "string", "required": False},
        "city": {"type": "string", "required": True},
        "state": {"type": "string", "required": True},
        "zip_code": {"type": "string", "required": True},
    }


def gsa_address_verification_output_contract() -> dict:
    return {
        "address_verified": {"type": "boolean"},
        "verification_status": {"type": "string", "enum": ["VERIFIED", "FAILED"]},
        "confidence_level": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
    }


def seed_data(
    tenant_repo: InMemoryTenantRepository,
    blueprint_repo: InMemoryBlueprintRepository,
    version_repo: InMemoryBlueprintVersionRepository,
) -> None:
    gsa = Tenant(
        tenant_id=GSA_TENANT_ID,
        tenant_name="GSA",
        status=TenantStatus.ACTIVE,
        metadata={"agency": "General Services Administration", "environment": "production"},
    )
    tenant_repo.create_tenant(gsa)

    demo = Tenant(
        tenant_id=DEMO_TENANT_ID,
        tenant_name="Demo Tenant",
        status=TenantStatus.ACTIVE,
        metadata={"environment": "demo"},
    )
    tenant_repo.create_tenant(demo)

    bp_service = BlueprintService(blueprint_repo, version_repo)
    from .models import BlueprintCreate

    gsa_bp = BlueprintCreate(
        name="GSA Address Verification",
        description="Verifies a mailing address via the GSA Address Service API and applies a business-rule decision to determine verification status and confidence level.",
        source_type=SourceType.GRAPH,
        graph_definition=gsa_address_verification_graph(),
        input_contract=gsa_address_verification_input_contract(),
        output_contract=gsa_address_verification_output_contract(),
        created_by="seed",
    )
    created = bp_service.create_blueprint(GSA_TENANT_ID, gsa_bp)
    bp_service.publish_blueprint(GSA_TENANT_ID, created.blueprint_id)
