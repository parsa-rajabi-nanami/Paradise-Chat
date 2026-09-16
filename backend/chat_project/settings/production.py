"""
Production settings for chat_project.
"""

import os
from datetime import timedelta
from urllib.parse import urlparse
from django.core.exceptions import ImproperlyConfigured
from .base import *


def require_production_secret(name):
    """Load a strong, non-template secret from the process environment."""

    value = os.environ.get(name, "")
    placeholder_prefixes = ("generate_", "replace_", "change_me")
    if len(value) < 50 or value.lower().startswith(placeholder_prefixes):
        raise ImproperlyConfigured(
            f"{name} must be a real random secret of at least 50 characters."
        )
    return value


DEBUG = False
SECRET_KEY = require_production_secret("DJANGO_SECRET_KEY")

BASE_URL = os.environ.get("DJANGO_BASE_URL", "").rstrip("/")
parsed_base_url = urlparse(BASE_URL)
if parsed_base_url.scheme not in {"http", "https"} or not parsed_base_url.netloc:
    raise ImproperlyConfigured(
        "DJANGO_BASE_URL must be an absolute http(s) URL in production."
    )

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("ALLOWED_HOSTS", "").split(",")
    if host.strip()
]
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "ALLOWED_HOSTS must contain at least one host in production."
    )

# Security settings
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "True") == "True"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# CORS settings
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured(
        "CORS_ALLOWED_ORIGINS must contain at least one origin in production."
    )
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# Query-string WebSocket tokens have a shorter production lifetime. Clients
# refresh through the existing REST refresh endpoint.
JWT_SIGNING_KEY = require_production_secret("JWT_SIGNING_KEY")

SIMPLE_JWT["SIGNING_KEY"] = JWT_SIGNING_KEY
SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] = timedelta(
    minutes=int(os.environ.get("ACCESS_TOKEN_MINUTES", "15"))
)

# Database - PostgreSQL for production
if not os.environ.get("DB_PASSWORD"):
    raise ImproperlyConfigured("DB_PASSWORD must be set in production.")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "chat_db"),
        "USER": os.environ.get("DB_USER", "chat_user"),
        "PASSWORD": os.environ.get("DB_PASSWORD"),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
        "CONN_HEALTH_CHECKS": True,
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}

# Redis Channel Layer
REDIS_URL = os.environ.get("REDIS_URL")
REDIS_CACHE_URL = os.environ.get("REDIS_CACHE_URL")
if not REDIS_URL or not REDIS_CACHE_URL:
    raise ImproperlyConfigured(
        "REDIS_URL and REDIS_CACHE_URL must be set in production."
    )

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}

# Cache with Redis
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_CACHE_URL,
    }
}

# Logging for production
LOGGING["root"]["handlers"] = ["console"]

MEDIA_STORAGE = os.environ.get("MEDIA_STORAGE", "local").lower()
if MEDIA_STORAGE == "local":
    USE_NGINX_ACCEL_REDIRECT = (
        os.environ.get("USE_NGINX_ACCEL_REDIRECT", "True") == "True"
    )
elif MEDIA_STORAGE == "s3":
    AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME")
    if not AWS_STORAGE_BUCKET_NAME:
        raise ImproperlyConfigured(
            "AWS_STORAGE_BUCKET_NAME must be set when MEDIA_STORAGE=s3."
        )
    AWS_S3_REGION_NAME = os.environ.get("AWS_S3_REGION_NAME") or None
    AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL") or None
    AWS_S3_ADDRESSING_STYLE = os.environ.get("AWS_S3_ADDRESSING_STYLE", "auto")
    AWS_QUERYSTRING_AUTH = True
    AWS_DEFAULT_ACL = None
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": AWS_STORAGE_BUCKET_NAME,
            "region_name": AWS_S3_REGION_NAME,
            "endpoint_url": AWS_S3_ENDPOINT_URL,
            "addressing_style": AWS_S3_ADDRESSING_STYLE,
            "querystring_auth": AWS_QUERYSTRING_AUTH,
            "default_acl": AWS_DEFAULT_ACL,
            "file_overwrite": False,
        },
    }
else:
    raise ImproperlyConfigured("MEDIA_STORAGE must be either local or s3.")
