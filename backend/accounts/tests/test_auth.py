from io import BytesIO

import pytest
from django.conf import settings
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import override_settings
from PIL import Image
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.test import APIClient

from chat.throttles import FileUploadRateThrottle

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


def test_login_endpoint_is_throttled(user_factory, monkeypatch):
    user_factory("login_throttled")
    rates = {
        **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
        "login": "1/minute",
    }
    rest_framework = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", rates)
    payload = {
        "email": "login_throttled@example.com",
        "password": "StrongPassword123!",
        "passphrase": "a sufficiently long passphrase",
    }

    with override_settings(REST_FRAMEWORK=rest_framework):
        cache.clear()
        client = APIClient()
        first = client.post("/api/auth/login/", payload, format="json")
        second = client.post("/api/auth/login/", payload, format="json")

    assert first.status_code == 200
    assert second.status_code == 429


def test_refresh_endpoint_is_throttled(user_factory, monkeypatch):
    from rest_framework_simplejwt.tokens import RefreshToken

    user = user_factory("refresh_throttled")
    refresh = str(RefreshToken.for_user(user))
    rates = {
        **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
        "token_refresh": "1/minute",
    }
    rest_framework = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", rates)

    with override_settings(REST_FRAMEWORK=rest_framework):
        cache.clear()
        client = APIClient()
        first = client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
        second = client.post(
            "/api/auth/refresh/", {"refresh": first.json()["refresh"]}, format="json"
        )

    assert first.status_code == 200
    assert second.status_code == 429


def test_profile_upload_is_throttled(user_factory, jwt_for, tmp_path, monkeypatch):
    user = user_factory("upload_throttled")
    _, access = jwt_for(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    image_data = BytesIO()
    Image.new("RGB", (16, 16), color="red").save(image_data, format="PNG")
    rates = {
        **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
        "upload": "1/minute",
    }
    rest_framework = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
    monkeypatch.setattr(FileUploadRateThrottle, "THROTTLE_RATES", rates)

    with override_settings(REST_FRAMEWORK=rest_framework, MEDIA_ROOT=tmp_path):
        cache.clear()
        first = client.patch(
            "/api/auth/profile/",
            {"avatar": ContentFile(image_data.getvalue(), name="first.png")},
            format="multipart",
        )
        second = client.patch(
            "/api/auth/profile/",
            {"avatar": ContentFile(image_data.getvalue(), name="second.png")},
            format="multipart",
        )

    assert first.status_code == 200
    assert second.status_code == 429


def test_avatar_endpoint_streams_authenticated_profile_image(
    user_factory, jwt_for, tmp_path
):
    user = user_factory("avatar_user")
    image_data = BytesIO()
    Image.new("RGB", (1, 1), color="red").save(image_data, format="PNG")

    with override_settings(MEDIA_ROOT=tmp_path):
        user.avatar.save("avatar.png", ContentFile(image_data.getvalue()), save=True)
        client = APIClient()

        assert client.get(f"/api/auth/users/{user.id}/avatar/").status_code == 401

        _, access = jwt_for(user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = client.get(f"/api/auth/users/{user.id}/avatar/")

    assert response.status_code == 200
    assert response["Content-Type"] == "image/webp"


def test_local_media_response_can_be_accelerated_by_nginx(
    user_factory, jwt_for, tmp_path
):
    user = user_factory("accelerated_avatar")
    image_data = BytesIO()
    Image.new("RGB", (8, 8), color="green").save(image_data, format="WEBP")

    with override_settings(MEDIA_ROOT=tmp_path, USE_NGINX_ACCEL_REDIRECT=True):
        user.avatar.save("avatar.webp", ContentFile(image_data.getvalue()), save=True)
        _, access = jwt_for(user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = client.get(f"/api/auth/users/{user.id}/avatar/")

    assert response.status_code == 200
    assert response["X-Accel-Redirect"].startswith("/protected-media/avatars/")


def test_profile_upload_is_center_cropped_and_generates_thumbnail(
    user_factory, jwt_for, tmp_path
):
    user = user_factory("cropped_avatar")
    source = BytesIO()
    Image.new("RGB", (1200, 600), color="blue").save(source, format="PNG")
    source.seek(0)

    _, access = jwt_for(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    with override_settings(MEDIA_ROOT=tmp_path):
        response = client.patch(
            "/api/auth/profile/",
            {"avatar": ContentFile(source.read(), name="landscape.png")},
            format="multipart",
        )

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.avatar.name.endswith(".webp")
        assert user.avatar_thumbnail.name.endswith(".webp")

        with Image.open(user.avatar.path) as avatar:
            assert avatar.format == "WEBP"
            assert avatar.size == (512, 512)
        with Image.open(user.avatar_thumbnail.path) as thumbnail:
            assert thumbnail.format == "WEBP"
            assert thumbnail.size == (96, 96)

        thumbnail_url = response.json()["avatar"]
        assert "size=thumbnail" not in thumbnail_url
        assert response.json()["email"] == user.email
        assert "/api/auth/users/" in response.json()["avatar"]
        assert "?v=" in response.json()["avatar"]


def test_profile_update_returns_complete_profile_without_replacing_avatar(
    user_factory, jwt_for, tmp_path
):
    user = user_factory("profile_update", email="profile@example.com")
    source = BytesIO()
    Image.new("RGB", (16, 16), color="purple").save(source, format="PNG")
    source.seek(0)

    with override_settings(MEDIA_ROOT=tmp_path):
        user.avatar.save("existing.png", ContentFile(source.getvalue()), save=True)
        old_avatar_name = user.avatar.name
        _, access = jwt_for(user)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        response = client.patch(
            "/api/auth/profile/",
            {"display_name": "Updated profile"},
            format="multipart",
        )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == user.email
    assert data["display_name"] == "Updated profile"
    assert data["avatar"].startswith("http")
    assert "/api/auth/users/" in data["avatar"]
    assert old_avatar_name.rsplit("/", 1)[-1] in data["avatar"]


def test_profile_upload_rejects_fake_image_content(user_factory, jwt_for):
    user = user_factory("fake_avatar")
    _, access = jwt_for(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.patch(
        "/api/auth/profile/",
        {"avatar": ContentFile(b"not an image", name="avatar.png")},
        format="multipart",
    )

    assert response.status_code == 400
    assert "avatar" in response.json()
