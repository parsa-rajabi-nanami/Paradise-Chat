import os
from django.core.exceptions import ImproperlyConfigured

environment = os.environ.get("DJANGO_ENV", "development").lower()

if environment == "production":
    if not os.environ.get("DJANGO_SECRET_KEY"):
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY environment variable must be set in production."
        )

    from .production import *  # noqa: F401, F403
else:
    from .development import *  # noqa: F401, F403
