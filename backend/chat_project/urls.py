"""
URL configuration for chat_project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse


def healthz(request):
    """Return dependency readiness for load balancers and orchestrators."""
    checks = {}
    healthy = True

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        healthy = False

    try:
        cache.set("healthz", "ok", timeout=5)
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"
        healthy = False

    return JsonResponse(
        {"status": "ok" if healthy else "error", "checks": checks},
        status=200 if healthy else 503,
    )


urlpatterns = [
    path("healthz", healthz, name="healthz"),
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/chat/", include("chat.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
