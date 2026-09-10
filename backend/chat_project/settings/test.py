"""Fast, isolated settings used by the pytest suite."""

from .base import *

DEBUG = False
SECRET_KEY = "test-only-secret-key"
ALLOWED_HOSTS = ["testserver", "localhost"]
CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]
MIDDLEWARE = [
    middleware
    for middleware in MIDDLEWARE
    if middleware
    not in {
        "whitenoise.middleware.WhiteNoiseMiddleware",
        "chat_project.middleware.RequestIDMiddleware",
    }
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test.sqlite3",
        "TEST": {"NAME": BASE_DIR / "pytest.sqlite3"},
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []
