from pathlib import Path

import pytest
from django.core.cache import cache
from django.http import HttpResponse
from django.test import RequestFactory

from .middleware import RequestIDMiddleware

pytestmark = pytest.mark.django_db


def test_request_id_preserves_safe_upstream_value():
    request = RequestFactory().get("/", HTTP_X_REQUEST_ID="request-123")
    middleware = RequestIDMiddleware(lambda request: HttpResponse(status=204))

    response = middleware(request)

    assert response["X-Request-ID"] == "request-123"


def test_request_id_replaces_untrusted_value():
    request = RequestFactory().get("/", HTTP_X_REQUEST_ID="x" * 129)
    middleware = RequestIDMiddleware(lambda request: HttpResponse(status=204))

    response = middleware(request)

    assert response["X-Request-ID"] != request.headers["X-Request-ID"]
    assert len(response["X-Request-ID"]) == 32


def test_healthz_reports_database_and_redis(client):
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": "ok", "redis": "ok"},
    }


def test_healthz_returns_not_ready_when_redis_fails(client, monkeypatch):
    def fail_cache_set(*args, **kwargs):
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(cache, "set", fail_cache_set)
    response = client.get("/healthz")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "checks": {"database": "ok", "redis": "error"},
    }


def test_nginx_protected_media_location_is_not_public():
    config = (
        Path(__file__).resolve().parents[2] / "deploy" / "nginx" / "default.conf"
    ).read_text()
    protected_location = config.split("location /protected-media/", 1)[1].split("}", 1)[
        0
    ]
    public_media_location = config.split("location /media/", 1)[1].split("}", 1)[0]

    assert "internal;" in protected_location
    assert "return 404;" in public_media_location
