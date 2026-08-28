"""Tests for tenant isolation, creation, and retrieval."""

from __future__ import annotations

from TenantNodePlatform.backend.models import TenantCreate, TenantStatus, TenantUpdate


def test_create_tenant(tenant_service):
    create = TenantCreate(tenant_name="Test Tenant", metadata={"env": "test"})
    t = tenant_service.create_tenant(create)
    assert t.tenant_id is not None
    assert t.tenant_name == "Test Tenant"
    assert t.status == TenantStatus.ACTIVE
    assert t.metadata == {"env": "test"}


def test_get_tenant(tenant_service):
    create = TenantCreate(tenant_name="Acme")
    t = tenant_service.create_tenant(create)
    fetched = tenant_service.get_tenant(t.tenant_id)
    assert fetched is not None
    assert fetched.tenant_name == "Acme"


def test_get_nonexistent_tenant(tenant_service):
    assert tenant_service.get_tenant("does-not-exist") is None


def test_list_tenants(tenant_service):
    tenant_service.create_tenant(TenantCreate(tenant_name="A"))
    tenant_service.create_tenant(TenantCreate(tenant_name="B"))
    tenants = tenant_service.list_tenants()
    assert len(tenants) == 2


def test_update_tenant(tenant_service):
    create = TenantCreate(tenant_name="Old Name")
    t = tenant_service.create_tenant(create)
    updated = tenant_service.update_tenant(t.tenant_id, TenantUpdate(tenant_name="New Name"))
    assert updated is not None
    assert updated.tenant_name == "New Name"


def test_delete_tenant(tenant_service):
    create = TenantCreate(tenant_name="ToDelete")
    t = tenant_service.create_tenant(create)
    assert tenant_service.delete_tenant(t.tenant_id) is True
    assert tenant_service.get_tenant(t.tenant_id) is None


def test_tenant_isolation_in_blueprint_repo(tenant_service, blueprint_service):
    """A tenant cannot retrieve another tenant's blueprint."""
    from TenantNodePlatform.backend.models import BlueprintCreate

    t1 = tenant_service.create_tenant(TenantCreate(tenant_name="T1"))
    t2 = tenant_service.create_tenant(TenantCreate(tenant_name="T2"))

    bp = blueprint_service.create_blueprint(
        t1.tenant_id,
        BlueprintCreate(name="Secret BP", description="T1 only"),
    )

    # T2 cannot see T1's blueprint
    assert blueprint_service.get_blueprint(t2.tenant_id, bp.blueprint_id) is None
    # T1 can see its own blueprint
    assert blueprint_service.get_blueprint(t1.tenant_id, bp.blueprint_id) is not None
    # T2's blueprint list is empty
    assert len(blueprint_service.list_blueprints(t2.tenant_id)) == 0
    assert len(blueprint_service.list_blueprints(t1.tenant_id)) == 1
