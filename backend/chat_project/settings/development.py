"""
Development settings for chat_project.
"""

from datetime import timedelta
from .base import *

DEBUG = True

# Development-only secret key.
# Never use this value in staging or production environments.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-key-set-DJANGO_SECRET_KEY")

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"]

# CORS - Allow all in development
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Database defaults to the same PostgreSQL engine used by production. Set
# DEV_USE_SQLITE=1 only for a deliberately lightweight local fallback.
if os.environ.get("DEV_USE_SQLITE", "0") == "1":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DB_NAME", "chat_db"),
            "USER": os.environ.get("DB_USER", "chat_user"),
            "PASSWORD": os.environ.get("DB_PASSWORD", "chat_password"),
            "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
            "PORT": os.environ.get("DB_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }

# Channel Layers - Redis is used in development too so local behavior matches
# production. Redis must be running for real-time features and health checks.
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")],
        },
    },
}

# Email backend for development
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Shorter token lifetime for testing
SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] = timedelta(minutes=30)
SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"] = timedelta(days=1)

# Development uses the same throttling classes as production. Tests select
# the isolated test settings module instead of weakening runtime safeguards.
