"""
Development settings for chat_project.
"""

from datetime import timedelta
from .base import *

DEBUG = True

# Development-only secret key.
# Never use this value in staging or production environments.
SECRET_KEY = "django-insecure-dev-key-change-in-production-12345"

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

# CORS - Allow all in development
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Database - SQLite for development
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Channel Layers - In-memory for development (fallback)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("127.0.0.1", 6379)],
        },
    },
}

# Email backend for development
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Shorter token lifetime for testing
SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] = timedelta(minutes=30)
SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"] = timedelta(days=1)

# Disable throttling in development
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []
