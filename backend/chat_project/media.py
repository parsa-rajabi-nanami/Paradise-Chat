"""Protected media responses with optional Nginx local-storage acceleration."""

from pathlib import Path
from urllib.parse import quote

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.http import FileResponse, HttpResponse


def protected_file_response(field, *, content_type=None):
    """Return a protected file response for local or object storage.

    Local production deployments can let Nginx read the file after Django has
    authorized the request. Object storage falls back to Django streaming.
    """

    if getattr(settings, "USE_NGINX_ACCEL_REDIRECT", False) and isinstance(
        field.storage, FileSystemStorage
    ):
        media_root = Path(settings.MEDIA_ROOT).resolve()
        file_path = Path(field.path).resolve()
        if media_root == file_path or media_root not in file_path.parents:
            raise FileNotFoundError("Media file is outside MEDIA_ROOT")

        response = HttpResponse(content_type=content_type)
        response["X-Accel-Redirect"] = "/protected-media/" + quote(
            field.name.lstrip("/"), safe="/"
        )
        response["Content-Length"] = str(field.size)
        return response

    field.open("rb")
    return FileResponse(field, content_type=content_type)
