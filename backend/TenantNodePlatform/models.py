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
    password_hash: str


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
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TenantCreate(BaseModel):
    tenant_name: str
    slug: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TenantUpdate(BaseModel):
    tenant_name: Optional[str] = None
    slug: Optional[str] = None
    status: Optional[TenantStatus] = None
    category: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class Tenant(TenantBase):
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))


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
# API Response helpers
# --------------------------------------------------------------------------- #

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
