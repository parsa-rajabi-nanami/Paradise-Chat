import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def registration_payload(username="alice", email="alice@example.com"):
    return {
        "email": email,
        "username": username,
        "password": "StrongPassword123!",
        "password_confirm": "StrongPassword123!",
        "passphrase": "a sufficiently long passphrase",
    }


def test_auth_lifecycle_rotation_logout_password_change_and_delete():
    client = APIClient()

    registered = client.post(
        "/api/auth/register/", registration_payload(), format="json"
    )
    assert registered.status_code == 201
    tokens = registered.json()["tokens"]

    login = client.post(
        "/api/auth/login/",
        {
            "email": "alice@example.com",
            "password": "StrongPassword123!",
            "passphrase": "a sufficiently long passphrase",
        },
        format="json",
    )
    assert login.status_code == 200
    access = login.json()["access"]
    original_refresh = login.json()["refresh"]

    rotated = client.post(
        "/api/auth/refresh/", {"refresh": original_refresh}, format="json"
    )
    assert rotated.status_code == 200
    rotated_tokens = rotated.json()
    assert rotated_tokens["refresh"] != original_refresh
    assert (
        client.post(
            "/api/auth/refresh/", {"refresh": original_refresh}, format="json"
        ).status_code
        == 401
    )

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    changed = client.post(
        "/api/auth/password/change/",
        {
            "current_password": "StrongPassword123!",
            "new_password": "EvenStrongerPassword456!",
            "new_password_confirm": "EvenStrongerPassword456!",
            "current_passphrase": "a sufficiently long passphrase",
        },
        format="json",
    )
    assert changed.status_code == 200

    logout = client.post(
        "/api/auth/logout/", {"refresh": rotated_tokens["refresh"]}, format="json"
    )
    assert logout.status_code == 200
    assert (
        client.post(
            "/api/auth/refresh/", {"refresh": rotated_tokens["refresh"]}, format="json"
        ).status_code
        == 401
    )

    user = get_user_model().objects.get(email="alice@example.com")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    deleted = client.delete(
        "/api/auth/profile/delete/",
        {
            "password": "EvenStrongerPassword456!",
            "passphrase": "a sufficiently long passphrase",
            "refresh": str(tokens["refresh"]),
        },
        format="json",
    )
    assert deleted.status_code == 200
    user.refresh_from_db()
    assert user.is_deleted is True
    assert user.is_active is False


def test_auth_requires_passphrase_for_login(user_factory):
    user_factory("bob", email="bob@example.com")
    response = APIClient().post(
        "/api/auth/login/",
        {"email": "bob@example.com", "password": "StrongPassword123!"},
        format="json",
    )
    assert response.status_code == 401
