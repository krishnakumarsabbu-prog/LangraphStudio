"""Tests for authentication and persona endpoints."""

from fastapi.testclient import TestClient
from backend.TenantNodePlatform.main import app

client = TestClient(app)


def test_list_personas():
    response = client.get("/api/tenant-platform/auth/personas")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] >= 4
    keys = [p["key"] for p in data["items"]]
    assert "superadmin" in keys
    assert "gsa_admin" in keys
    assert "usps_admin" in keys


def test_login_success():
    payload = {
        "email": "admin@gsa.gov",
        "password": "gsa123",
        "tenant_id": "tenant-gsa",
    }
    response = client.post("/api/tenant-platform/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["email"] == "admin@gsa.gov"
    assert data["user"]["role"] == "TENANT_ADMIN"
    assert data["user"]["tenant_id"] == "tenant-gsa"
    assert len(data["available_tenants"]) >= 3


def test_login_superadmin_all_tenants():
    payload = {
        "email": "superadmin@flowforge.internal",
        "password": "admin123",
        "tenant_id": "all",
    }
    response = client.post("/api/tenant-platform/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "SUPER_ADMIN"
    assert data["user"]["tenant_id"] == "all"


def test_login_invalid_email():
    payload = {
        "email": "nonexistent@nowhere.com",
        "password": "pass",
    }
    response = client.post("/api/tenant-platform/auth/login", json=payload)
    assert response.status_code == 401


def test_auth_me():
    # Login first
    login_res = client.post(
        "/api/tenant-platform/auth/login",
        json={"email": "admin@gsa.gov", "password": "gsa123"},
    )
    token = login_res.json()["token"]

    response = client.get(
        "/api/tenant-platform/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@gsa.gov"
