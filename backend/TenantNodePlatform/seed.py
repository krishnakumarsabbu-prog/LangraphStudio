"""Seed data for the Tenant Node Platform.

Seeds:
1. Four tenants: GSA, USPS, Fintech Global, Demo.
2. Users and Persona switchers with full RBAC roles.
3. Realistic Node Blueprints across tenants.
"""

from __future__ import annotations

from .models import (
    AuditAction,
    AuditLog,
    BlueprintCreate,
    FrameworkNode,
    FrameworkNodeStatus,
    PersonaItem,
    SourceType,
    Tenant,
    TenantNodeAccess,
    TenantStatus,
    User,
    UserRole,
)
from .repositories.in_memory import (
    InMemoryAuditRepository,
    InMemoryBlueprintRepository,
    InMemoryBlueprintVersionRepository,
    InMemoryFrameworkNodeRepository,
    InMemoryTenantNodeAccessRepository,
    InMemoryTenantRepository,
    InMemoryUserRepository,
)
from .services.services import BlueprintService


def seed_data(
    tenant_repo: InMemoryTenantRepository,
    blueprint_repo: InMemoryBlueprintRepository,
    version_repo: InMemoryBlueprintVersionRepository,
    user_repo: InMemoryUserRepository,
    framework_node_repo: InMemoryFrameworkNodeRepository | None = None,
    node_access_repo: InMemoryTenantNodeAccessRepository | None = None,
    audit_repo: InMemoryAuditRepository | None = None,
) -> None:
    # ----------------------------------------------------------------------- #
    # 1. Seed Tenants
    # ----------------------------------------------------------------------- #
    tenants = [
        Tenant(
            tenant_id="tenant-gsa",
            tenant_name="GSA (General Services Admin)",
            slug="gsa",
            category="Federal Agency",
            description="Government identity, verification & procurement workflows",
            status=TenantStatus.ACTIVE,
            metadata={"icon": "Building2"},
        ),
        Tenant(
            tenant_id="tenant-usps",
            tenant_name="USPS (Postal Service)",
            slug="usps",
            category="Logistics & Postal",
            description="Delivery Point Validation (DPV) & address verification services",
            status=TenantStatus.ACTIVE,
            metadata={"icon": "Truck"},
        ),
        Tenant(
            tenant_id="tenant-fintech",
            tenant_name="Fintech Global Corp",
            slug="fintech",
            category="Financial Services",
            description="KYC, AML & real-time fraud assessment workflows",
            status=TenantStatus.ACTIVE,
            metadata={"icon": "ShieldCheck"},
        ),
        Tenant(
            tenant_id="demo-tenant-0001",
            tenant_name="Demo Tenant",
            slug="demo",
            category="Sandbox",
            description="Sandbox environment for platform testing",
            status=TenantStatus.ACTIVE,
            metadata={"icon": "Boxes"},
        ),
    ]

    for t in tenants:
        tenant_repo.create_tenant(t)

    # ----------------------------------------------------------------------- #
    # 2. Seed Users & Personas
    # ----------------------------------------------------------------------- #
    users_and_personas = [
        {
            "key": "superadmin",
            "id": "usr-superadmin",
            "name": "Eleanor Vance",
            "email": "superadmin@flowforge.internal",
            "role": UserRole.SUPER_ADMIN,
            "tenant_id": "all",
            "tenant_name": "All Tenants (Super Admin)",
            "title": "Principal Platform Operator",
            "avatar": "👑",
            "description": "All Tenants • Cross-Tenant Control",
            "password_hash": "admin123",
        },
        {
            "key": "gsa_admin",
            "id": "usr-gsa-admin",
            "name": "Marcus Holloway",
            "email": "admin@gsa.gov",
            "role": UserRole.TENANT_ADMIN,
            "tenant_id": "tenant-gsa",
            "tenant_name": "GSA (General Services Admin)",
            "title": "GSA Lead Systems Architect",
            "avatar": "🛡️",
            "description": "GSA • Author & Publish Blueprints",
            "password_hash": "gsa123",
        },
        {
            "key": "gsa_analyst",
            "id": "usr-gsa-analyst",
            "name": "Sarah Chen",
            "email": "analyst@gsa.gov",
            "role": UserRole.TENANT_USER,
            "tenant_id": "tenant-gsa",
            "tenant_name": "GSA (General Services Admin)",
            "title": "GSA Business Workflow Analyst",
            "avatar": "📊",
            "description": "GSA • Build & Run Workflows",
            "password_hash": "gsa123",
        },
        {
            "key": "usps_admin",
            "id": "usr-usps-admin",
            "name": "David Reynolds",
            "email": "admin@usps.gov",
            "role": UserRole.TENANT_ADMIN,
            "tenant_id": "tenant-usps",
            "tenant_name": "USPS (Postal Service)",
            "title": "USPS Solutions Engineer",
            "avatar": "📦",
            "description": "USPS • DPV & Logistics Nodes",
            "password_hash": "usps123",
        },
        {
            "key": "fintech_admin",
            "id": "usr-fintech-admin",
            "name": "Elena Rostova",
            "email": "admin@fintech.io",
            "role": UserRole.TENANT_ADMIN,
            "tenant_id": "tenant-fintech",
            "tenant_name": "Fintech Global Corp",
            "title": "Fintech Head of Compliance",
            "avatar": "💳",
            "description": "Fintech • Risk & AML Nodes",
            "password_hash": "fintech123",
        },
    ]

    for item in users_and_personas:
        u = User(
            id=item["id"],
            name=item["name"],
            email=item["email"],
            role=item["role"],
            tenant_id=item["tenant_id"],
            tenant_name=item["tenant_name"],
            avatar=item["avatar"],
            title=item["title"],
            password_hash=item["password_hash"],
        )
        user_repo.create_user(u)

        p = PersonaItem(
            key=item["key"],
            name=item["name"],
            email=item["email"],
            role=item["role"],
            tenant_id=item["tenant_id"],
            tenant_name=item["tenant_name"],
            title=item["title"],
            avatar=item["avatar"],
            description=item["description"],
        )
        user_repo.set_persona(p)

    # ----------------------------------------------------------------------- #
    # 3. Seed Blueprints
    # ----------------------------------------------------------------------- #
    bp_service = BlueprintService(blueprint_repo, version_repo)

    # GSA: Address & Identity Verification
    bp_gsa_1 = bp_service.create_blueprint(
        "tenant-gsa",
        BlueprintCreate(
            name="GSA Address & Identity Verification",
            description="Comprehensive federal address verification service with automated business rule classification and high-confidence matching.",
            source_type=SourceType.GRAPH,
            created_by="admin@gsa.gov",
            input_contract={
                "type": "object",
                "properties": {
                    "street": {"type": "string"},
                    "city": {"type": "string"},
                    "state": {"type": "string"},
                    "zip": {"type": "string"},
                },
            },
            output_contract={
                "type": "object",
                "properties": {
                    "outcome": {"type": "string"},
                    "status": {"type": "string"},
                    "match_score": {"type": "number"},
                },
            },
            graph_definition={
                "nodes": [
                    {
                        "id": "gsa-address-service",
                        "type": "serviceNode",
                        "data": {
                            "label": "GSA Address API Service",
                            "url": "https://api.gsa.gov/v2/address/verify",
                            "method": "POST",
                            "headers": {"Content-Type": "application/json", "X-GSA-API-KEY": "gsa_live_demo_key"},
                            "timeout": 5000,
                            "retries": 2,
                            "mapping": '{\n  "street": "state.street",\n  "city": "state.city",\n  "zip": "state.zip"\n}',
                        },
                        "position": {"x": 100, "y": 150},
                    },
                    {
                        "id": "gsa-address-decision",
                        "type": "decisionNode",
                        "data": {
                            "label": "GSA Address Approval Rule",
                            "script": (
                                "if state.get('status') == 'VERIFIED' and float(state.get('match_score', 0)) >= 80 and state.get('address_match') == True:\n"
                                "    return 'APPROVE'\n"
                                "elif float(state.get('match_score', 0)) >= 50:\n"
                                "    return 'MANUAL_REVIEW'\n"
                                "else:\n"
                                "    return 'REJECT'"
                            ),
                            "branches": ["APPROVE", "MANUAL_REVIEW", "REJECT"],
                        },
                        "position": {"x": 480, "y": 150},
                    },
                ],
                "edges": [
                    {
                        "id": "edge_gsa_service_to_decision",
                        "source": "gsa-address-service",
                        "target": "gsa-address-decision",
                        "condition": "",
                    }
                ],
                "inputs": {"message": {}},
            },
        ),
    )
    bp_service.publish_blueprint("tenant-gsa", bp_gsa_1.blueprint_id)

    # GSA: SAM.gov Vendor Check
    bp_gsa_2 = bp_service.create_blueprint(
        "tenant-gsa",
        BlueprintCreate(
            name="GSA Federal SAM.gov Vendor Check",
            description="Checks vendor exclusion list and active registration status in federal procurement registry.",
            source_type=SourceType.GRAPH,
            created_by="admin@gsa.gov",
            input_contract={
                "type": "object",
                "properties": {"uei": {"type": "string"}, "cage_code": {"type": "string"}},
            },
            output_contract={
                "type": "object",
                "properties": {"eligible": {"type": "boolean"}},
            },
            graph_definition={
                "nodes": [
                    {
                        "id": "gsa-vendor-service",
                        "type": "serviceNode",
                        "data": {
                            "label": "SAM.gov Entity Search",
                            "url": "https://api.sam.gov/entity-information/v3/entities",
                            "method": "GET",
                            "headers": {"Content-Type": "application/json"},
                            "timeout": 8000,
                        },
                        "position": {"x": 100, "y": 150},
                    },
                    {
                        "id": "gsa-vendor-decision",
                        "type": "decisionNode",
                        "data": {
                            "label": "Vendor Eligibility Rule",
                            "script": (
                                "if state.get('active_status') == 'ACTIVE' and state.get('excluded') != True:\n"
                                "    return 'ELIGIBLE'\n"
                                "else:\n"
                                "    return 'INELIGIBLE'"
                            ),
                            "branches": ["ELIGIBLE", "INELIGIBLE"],
                        },
                        "position": {"x": 480, "y": 150},
                    },
                ],
                "edges": [
                    {
                        "id": "edge_gsa_vendor_svc_to_dec",
                        "source": "gsa-vendor-service",
                        "target": "gsa-vendor-decision",
                        "condition": "",
                    }
                ],
            },
        ),
    )
    bp_service.publish_blueprint("tenant-gsa", bp_gsa_2.blueprint_id)

    # USPS: DPV Validation
    bp_usps = bp_service.create_blueprint(
        "tenant-usps",
        BlueprintCreate(
            name="USPS Delivery Point Validation (DPV)",
            description="USPS CASS-certified delivery point validation, ZIP+4 coding and carrier route lookup.",
            source_type=SourceType.GRAPH,
            created_by="admin@usps.gov",
            input_contract={
                "type": "object",
                "properties": {"address1": {"type": "string"}, "zip5": {"type": "string"}},
            },
            output_contract={
                "type": "object",
                "properties": {"dpv_status": {"type": "string"}, "deliverable": {"type": "boolean"}},
            },
            graph_definition={
                "nodes": [
                    {
                        "id": "usps-dpv-service",
                        "type": "serviceNode",
                        "data": {
                            "label": "USPS DPV Validation API",
                            "url": "https://api.usps.com/addresses/v3/address",
                            "method": "POST",
                            "headers": {"Content-Type": "application/json"},
                            "timeout": 4000,
                        },
                        "position": {"x": 100, "y": 150},
                    },
                    {
                        "id": "usps-dpv-decision",
                        "type": "decisionNode",
                        "data": {
                            "label": "Deliverability Decision",
                            "script": (
                                "if state.get('dpv_confirmation') == 'Y':\n"
                                "    return 'DELIVERABLE'\n"
                                "elif state.get('dpv_confirmation') == 'D':\n"
                                "    return 'SECONDARY_MISSING'\n"
                                "else:\n"
                                "    return 'UNDELIVERABLE'"
                            ),
                            "branches": ["DELIVERABLE", "SECONDARY_MISSING", "UNDELIVERABLE"],
                        },
                        "position": {"x": 480, "y": 150},
                    },
                ],
                "edges": [
                    {
                        "id": "edge_usps_dpv_to_dec",
                        "source": "usps-dpv-service",
                        "target": "usps-dpv-decision",
                        "condition": "",
                    }
                ],
            },
        ),
    )
    bp_service.publish_blueprint("tenant-usps", bp_usps.blueprint_id)

    # Fintech: Real-Time Fraud Risk Assessment
    bp_fintech = bp_service.create_blueprint(
        "tenant-fintech",
        BlueprintCreate(
            name="Real-Time Fraud Risk Assessment",
            description="Calculates fraud risk score, IP reputation, velocity anomalies and AML watchlists.",
            source_type=SourceType.GRAPH,
            created_by="admin@fintech.io",
            input_contract={
                "type": "object",
                "properties": {"transaction_amount": {"type": "number"}, "user_id": {"type": "string"}},
            },
            output_contract={
                "type": "object",
                "properties": {"risk_level": {"type": "string"}, "score": {"type": "number"}},
            },
            graph_definition={
                "nodes": [
                    {
                        "id": "fintech-fraud-service",
                        "type": "serviceNode",
                        "data": {
                            "label": "Fraud Assessment Engine",
                            "url": "https://api.fintechglobal.com/v1/risk/score",
                            "method": "POST",
                            "headers": {"Content-Type": "application/json"},
                            "timeout": 3000,
                        },
                        "position": {"x": 100, "y": 150},
                    },
                    {
                        "id": "fintech-fraud-decision",
                        "type": "decisionNode",
                        "data": {
                            "label": "Risk Routing Decision",
                            "script": (
                                "if float(state.get('risk_score', 0)) < 30:\n"
                                "    return 'LOW_RISK_APPROVE'\n"
                                "elif float(state.get('risk_score', 0)) < 70:\n"
                                "    return 'STEP_UP_2FA'\n"
                                "else:\n"
                                "    return 'BLOCK_DECLINE'"
                            ),
                            "branches": ["LOW_RISK_APPROVE", "STEP_UP_2FA", "BLOCK_DECLINE"],
                        },
                        "position": {"x": 480, "y": 150},
                    },
                ],
                "edges": [
                    {
                        "id": "edge_fintech_fraud_to_dec",
                        "source": "fintech-fraud-service",
                        "target": "fintech-fraud-decision",
                        "condition": "",
                    }
                ],
            },
        ),
    )
    bp_service.publish_blueprint("tenant-fintech", bp_fintech.blueprint_id)

    # ----------------------------------------------------------------------- #
    # 5. Seed Framework Nodes
    # ----------------------------------------------------------------------- #
    if framework_node_repo is None:
        return

    _FRAMEWORK_NODES = [
        {
            "node_type": "SERVICE",
            "name": "service_node",
            "display_name": "Service Node",
            "description": "Call an external HTTP/REST API endpoint. Supports GET, POST, PUT, PATCH, DELETE with request/response mapping.",
            "category": "Integration",
            "icon": "Globe",
            "version": "1.0",
            "canvas_type": "serviceNode",
            "configuration_schema": {
                "url": {"type": "string", "required": True},
                "method": {"type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"]},
                "headers": {"type": "object"},
                "auth_type": {"type": "string"},
                "timeout_ms": {"type": "integer", "default": 5000},
                "retry_count": {"type": "integer", "default": 0},
            },
        },
        {
            "node_type": "DECISION",
            "name": "decision_node",
            "display_name": "Decision Node",
            "description": "Evaluate conditions and route the workflow to different branches based on rules.",
            "category": "Logic",
            "icon": "GitBranch",
            "version": "1.0",
            "canvas_type": "decisionNode",
            "configuration_schema": {
                "branches": {"type": "array", "items": {"type": "string"}},
                "rules": {"type": "array"},
                "default_branch": {"type": "string"},
            },
        },
        {
            "node_type": "LLM",
            "name": "llm_node",
            "display_name": "LLM Node",
            "description": "Invoke a large language model (OpenAI, Anthropic, etc.) with a prompt template.",
            "category": "AI/ML",
            "icon": "Bot",
            "version": "1.0",
            "canvas_type": "llmNode",
            "configuration_schema": {
                "model": {"type": "string", "default": "gpt-4o"},
                "prompt_template": {"type": "string"},
                "temperature": {"type": "number", "default": 0.7},
                "max_tokens": {"type": "integer", "default": 1000},
            },
        },
        {
            "node_type": "FORM",
            "name": "form_node",
            "display_name": "Form Node",
            "description": "Present a human-in-the-loop data collection form that pauses the workflow until submitted.",
            "category": "Human-in-Loop",
            "icon": "FileText",
            "version": "1.0",
            "canvas_type": "formNode",
            "configuration_schema": {
                "fields": {"type": "array"},
                "title": {"type": "string"},
                "submit_label": {"type": "string", "default": "Submit"},
            },
        },
        {
            "node_type": "PARALLEL",
            "name": "parallel_node",
            "display_name": "Parallel Node",
            "description": "Execute multiple workflow branches concurrently. Waits for all branches to complete.",
            "category": "Control Flow",
            "icon": "Columns",
            "version": "1.0",
            "canvas_type": "parallelNode",
            "configuration_schema": {
                "branches": {"type": "array"},
                "timeout_s": {"type": "integer", "default": 300},
            },
        },
        {
            "node_type": "MERGE",
            "name": "merge_node",
            "display_name": "Merge Node",
            "description": "Collect outputs from parallel branches and merge them into a single state object.",
            "category": "Control Flow",
            "icon": "GitMerge",
            "version": "1.0",
            "canvas_type": "mergeNode",
            "configuration_schema": {
                "merge_strategy": {"type": "string", "enum": ["first_wins", "last_wins", "combine"], "default": "combine"},
            },
        },
        {
            "node_type": "MAPPER",
            "name": "mapper_node",
            "display_name": "Mapper Node",
            "description": "Transform and reshape data between nodes using field mapping rules.",
            "category": "Data",
            "icon": "Sliders",
            "version": "1.0",
            "canvas_type": "mapperNode",
            "configuration_schema": {
                "mappings": {"type": "array"},
                "output_schema": {"type": "object"},
            },
        },
        {
            "node_type": "WORKFLOW",
            "name": "workflow_node",
            "display_name": "Workflow Node",
            "description": "Embed and execute another saved workflow as a sub-workflow step.",
            "category": "Composition",
            "icon": "Workflow",
            "version": "1.0",
            "canvas_type": "workflowNode",
            "configuration_schema": {
                "workflow_name": {"type": "string", "required": True},
                "input_mapping": {"type": "object"},
                "output_mapping": {"type": "object"},
            },
        },
    ]

    all_node_types = []
    for fn_data in _FRAMEWORK_NODES:
        node = FrameworkNode(**fn_data, status=FrameworkNodeStatus.ACTIVE)
        framework_node_repo.create(node)
        all_node_types.append(fn_data["node_type"])

    # ----------------------------------------------------------------------- #
    # 6. Seed Tenant Node Access (all nodes enabled for all tenants by default)
    # ----------------------------------------------------------------------- #
    if node_access_repo is not None:
        tenant_ids = ["tenant-gsa", "tenant-usps", "tenant-fintech", "demo-tenant-0001"]
        for tid in tenant_ids:
            node_access_repo.set_bulk(tid, all_node_types, all_node_types)

    # ----------------------------------------------------------------------- #
    # 7. Seed initial Audit Log entries
    # ----------------------------------------------------------------------- #
    if audit_repo is not None:
        import datetime as _dt
        seed_events = [
            {"action": AuditAction.TENANT_CREATED, "resource_name": "GSA (General Services Admin)", "resource_id": "tenant-gsa"},
            {"action": AuditAction.TENANT_CREATED, "resource_name": "USPS (Postal Service)", "resource_id": "tenant-usps"},
            {"action": AuditAction.TENANT_CREATED, "resource_name": "Fintech Global Corp", "resource_id": "tenant-fintech"},
            {"action": AuditAction.BLUEPRINT_PUBLISHED, "resource_name": "GSA Address Validation", "resource_id": "bp-seed-gsa"},
            {"action": AuditAction.LOGIN, "resource_name": "Eleanor Vance", "resource_id": "usr-superadmin"},
        ]
        for ev in seed_events:
            audit_repo.append(AuditLog(
                actor_user_id="usr-superadmin",
                actor_user_name="Eleanor Vance",
                actor_tenant_id="all",
                action=ev["action"],
                resource_type="Tenant" if "TENANT" in ev["action"] else "Blueprint",
                resource_id=ev["resource_id"],
                resource_name=ev["resource_name"],
                timestamp=_dt.datetime.now(_dt.UTC),
            ))
