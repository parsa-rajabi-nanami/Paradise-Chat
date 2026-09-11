from django.http import HttpResponse
from django.test import RequestFactory

from .middleware import RequestIDMiddleware


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
