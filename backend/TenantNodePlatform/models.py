from __future__ import annotations

import datetime as dt
import enum
import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #

class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"


class BlueprintStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    DEPRECATED = "DEPRECATED"


class SourceType(str, enum.Enum):
    SERVICE = "service"
    DECISION = "decision"
    FORM = "form"
    WORKFLOW = "workflow"
    LLM = "llm"
    MAPPER = "mapper"
    GRAPH = "graph"


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    TENANT_ADMIN = "TENANT_ADMIN"
    TENANT_USER = "TENANT_USER"
    TENANT_VIEWER = "TENANT_VIEWER"


class FrameworkNodeStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DEPRECATED = "DEPRECATED"
    DISABLED = "DISABLED"


class ExecutionStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


# --------------------------------------------------------------------------- #
# User & Authentication Models
# --------------------------------------------------------------------------- #

class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    tenant_id: str
    tenant_name: str
    avatar: Optional[str] = "👤"
    title: Optional[str] = ""


class User(UserProfile):
    password_hash: str = "password123"


class UserCreate(BaseModel):
    name: str
    email: str
    role: UserRole = UserRole.TENANT_USER
    tenant_id: str
    avatar: Optional[str] = "👤"
    title: Optional[str] = "Workflow Operator"
    password: Optional[str] = "password123"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    tenant_id: Optional[str] = None
    avatar: Optional[str] = None
    title: Optional[str] = None
    password: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str = ""
    tenant_id: Optional[str] = None


class LoginResponse(BaseModel):
    success: bool
    token: str
    user: UserProfile
    available_tenants: List[Tenant]


class PersonaItem(BaseModel):
    key: str
    name: str
    email: str
    role: UserRole
    tenant_id: str
    tenant_name: str
    title: str
    avatar: str
    description: str


# --------------------------------------------------------------------------- #
# Tenant
# --------------------------------------------------------------------------- #

class TenantBase(BaseModel):
    tenant_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_name: str
    slug: str = ""
    status: TenantStatus = TenantStatus.ACTIVE
    category: str = "Enterprise"
    description: str = ""
    primary_contact_name: str = ""
    primary_contact_email: str = ""
    timezone: str = "UTC"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TenantCreate(BaseModel):
    tenant_name: str
    slug: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    timezone: Optional[str] = "UTC"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TenantUpdate(BaseModel):
    tenant_name: Optional[str] = None
    slug: Optional[str] = None
    status: Optional[TenantStatus] = None
    category: Optional[str] = None
    description: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    timezone: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class Tenant(TenantBase):
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    created_by: str = "system"


# --------------------------------------------------------------------------- #
# Blueprint
# --------------------------------------------------------------------------- #

class BlueprintCreate(BaseModel):
    name: str
    description: str = ""
    source_type: SourceType = SourceType.GRAPH
    graph_definition: Dict[str, Any] = Field(default_factory=dict)
    input_contract: Dict[str, Any] = Field(default_factory=dict)
    output_contract: Dict[str, Any] = Field(default_factory=dict)
    created_by: str = "system"


class BlueprintUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    source_type: Optional[SourceType] = None
    graph_definition: Optional[Dict[str, Any]] = None
    input_contract: Optional[Dict[str, Any]] = None
    output_contract: Optional[Dict[str, Any]] = None
    status: Optional[BlueprintStatus] = None


class Blueprint(BaseModel):
    blueprint_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    name: str
    description: str = ""
    status: BlueprintStatus = BlueprintStatus.DRAFT
    version: int = 1
    source_type: SourceType = SourceType.GRAPH
    graph_definition: Dict[str, Any] = Field(default_factory=dict)
    input_contract: Dict[str, Any] = Field(default_factory=dict)
    output_contract: Dict[str, Any] = Field(default_factory=dict)
    created_by: str = "system"
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))


class BatchImportRequest(BaseModel):
    blueprints: List[Dict[str, Any]]


# --------------------------------------------------------------------------- #
# Blueprint Version
# --------------------------------------------------------------------------- #

class BlueprintVersion(BaseModel):
    blueprint_id: str
    version: int
    snapshot: Dict[str, Any]
    created_by: str = "system"
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))


# --------------------------------------------------------------------------- #
# Blueprint Dependency
# --------------------------------------------------------------------------- #

class DependencyType(str, enum.Enum):
    NODE_BLUEPRINT = "node_blueprint"
    GRAPH_BLUEPRINT = "graph_blueprint"


class BlueprintDependency(BaseModel):
    dependent_id: str
    dependency_id: str
    dependency_type: DependencyType = DependencyType.GRAPH_BLUEPRINT
    tenant_id: str


# --------------------------------------------------------------------------- #
# Framework Nodes
# --------------------------------------------------------------------------- #

class FrameworkNode(BaseModel):
    """Platform-level node type definition managed by Super Admin."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    node_type: str           # e.g. "SERVICE", "DECISION"
    name: str                # e.g. "service_node"
    display_name: str        # e.g. "Service Node"
    description: str = ""
    category: str = "Core"
    icon: str = "Box"
    version: str = "1.0"
    status: FrameworkNodeStatus = FrameworkNodeStatus.ACTIVE
    configuration_schema: Dict[str, Any] = Field(default_factory=dict)
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)
    canvas_type: str = ""    # The React Flow node type key, e.g. "serviceNode"
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    created_by: str = "system"


class FrameworkNodeCreate(BaseModel):
    node_type: str
    name: str
    display_name: str
    description: str = ""
    category: str = "Core"
    icon: str = "Box"
    version: str = "1.0"
    configuration_schema: Dict[str, Any] = Field(default_factory=dict)
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)
    canvas_type: str = ""


class FrameworkNodeUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    status: Optional[FrameworkNodeStatus] = None
    configuration_schema: Optional[Dict[str, Any]] = None
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None


# --------------------------------------------------------------------------- #
# Tenant Framework Node Access
# --------------------------------------------------------------------------- #

class TenantNodeAccess(BaseModel):
    """Controls which framework nodes a tenant can use."""
    tenant_id: str
    framework_node_id: str
    node_type: str
    is_enabled: bool = True
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    updated_by: str = "system"


class TenantNodeAccessUpdate(BaseModel):
    """Bulk update of node access for a tenant."""
    enabled_node_types: List[str]   # List of node_type strings that should be enabled


# --------------------------------------------------------------------------- #
# Audit Log
# --------------------------------------------------------------------------- #

class AuditAction(str, enum.Enum):
    # Tenant lifecycle
    TENANT_CREATED = "TENANT_CREATED"
    TENANT_UPDATED = "TENANT_UPDATED"
    TENANT_SUSPENDED = "TENANT_SUSPENDED"
    TENANT_ACTIVATED = "TENANT_ACTIVATED"
    TENANT_DELETED = "TENANT_DELETED"
    # User lifecycle
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"
    USER_DELETED = "USER_DELETED"
    ROLE_ASSIGNED = "ROLE_ASSIGNED"
    # Framework nodes
    FRAMEWORK_NODE_CREATED = "FRAMEWORK_NODE_CREATED"
    FRAMEWORK_NODE_UPDATED = "FRAMEWORK_NODE_UPDATED"
    FRAMEWORK_NODE_DISABLED = "FRAMEWORK_NODE_DISABLED"
    NODE_ACCESS_UPDATED = "NODE_ACCESS_UPDATED"
    # Blueprint / Tenant nodes
    BLUEPRINT_CREATED = "BLUEPRINT_CREATED"
    BLUEPRINT_UPDATED = "BLUEPRINT_UPDATED"
    BLUEPRINT_PUBLISHED = "BLUEPRINT_PUBLISHED"
    BLUEPRINT_DELETED = "BLUEPRINT_DELETED"
    POSTMAN_IMPORTED = "POSTMAN_IMPORTED"
    # Workflow
    WORKFLOW_CREATED = "WORKFLOW_CREATED"
    WORKFLOW_UPDATED = "WORKFLOW_UPDATED"
    WORKFLOW_DELETED = "WORKFLOW_DELETED"
    WORKFLOW_EXECUTED = "WORKFLOW_EXECUTED"
    # Impersonation
    IMPERSONATION_STARTED = "IMPERSONATION_STARTED"
    IMPERSONATION_ENDED = "IMPERSONATION_ENDED"
    # Auth
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"


class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    actor_user_id: str
    actor_user_name: str = ""
    actor_tenant_id: str
    action: AuditAction
    resource_type: str = ""
    resource_id: str = ""
    resource_name: str = ""
    target_tenant_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ip_address: str = "unknown"
    timestamp: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))


class AuditLogCreate(BaseModel):
    actor_user_id: str
    actor_user_name: str = ""
    actor_tenant_id: str
    action: AuditAction
    resource_type: str = ""
    resource_id: str = ""
    resource_name: str = ""
    target_tenant_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ip_address: str = "unknown"


# --------------------------------------------------------------------------- #
# Workflow Execution
# --------------------------------------------------------------------------- #

class WorkflowExecution(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    workflow_name: str
    workflow_version: int = 1
    status: ExecutionStatus = ExecutionStatus.QUEUED
    started_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    completed_at: Optional[dt.datetime] = None
    duration_ms: Optional[int] = None
    triggered_by: str = "user"
    triggered_by_user_id: str = ""
    triggered_by_user_name: str = ""
    error_summary: Optional[str] = None
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Dict[str, Any] = Field(default_factory=dict)
    node_executions: List[NodeExecution] = Field(default_factory=list)


class WorkflowExecutionCreate(BaseModel):
    tenant_id: str
    workflow_name: str
    workflow_version: int = 1
    triggered_by: str = "user"
    triggered_by_user_id: str = ""
    triggered_by_user_name: str = ""
    input_data: Dict[str, Any] = Field(default_factory=dict)


class WorkflowExecutionUpdate(BaseModel):
    status: Optional[ExecutionStatus] = None
    completed_at: Optional[dt.datetime] = None
    duration_ms: Optional[int] = None
    error_summary: Optional[str] = None
    output_data: Optional[Dict[str, Any]] = None
    node_executions: Optional[List[NodeExecution]] = None


class NodeExecution(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    execution_id: str
    node_id: str
    node_label: str = ""
    node_type: str
    status: ExecutionStatus = ExecutionStatus.QUEUED
    started_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    completed_at: Optional[dt.datetime] = None
    duration_ms: Optional[int] = None
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Dict[str, Any] = Field(default_factory=dict)
    error_data: Optional[Dict[str, Any]] = None


# --------------------------------------------------------------------------- #
# Impersonation
# --------------------------------------------------------------------------- #

class ImpersonationContext(BaseModel):
    original_user_id: str
    original_user_name: str
    original_tenant_id: str
    target_tenant_id: str
    target_tenant_name: str
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    started_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))


# --------------------------------------------------------------------------- #
# API Response helpers
# --------------------------------------------------------------------------- #

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int


class PlatformStats(BaseModel):
    """Aggregated stats for Super Admin Dashboard."""
    total_tenants: int = 0
    active_tenants: int = 0
    suspended_tenants: int = 0
    total_users: int = 0
    total_workflows: int = 0
    total_blueprints: int = 0
    total_executions: int = 0
    framework_nodes: int = 0
    recent_tenants: List[Dict[str, Any]] = Field(default_factory=list)
    recent_audit_events: List[Dict[str, Any]] = Field(default_factory=list)
