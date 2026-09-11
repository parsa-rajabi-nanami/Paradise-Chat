"""
Custom User model with online/offline status tracking.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.contrib.auth.hashers import make_password, check_password
from django.db import models
from django.utils import timezone
from django.conf import settings
from django.urls import reverse
import os
import uuid
from .validators import validate_avatar


def avatar_upload_to(instance, filename):
    """Generate an opaque avatar filename; never persist a client filename."""
    extension = os.path.splitext(filename)[1].lower()
    return f"avatars/{uuid.uuid4().hex}{extension}"


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(
        self, email, username, password=None, passphrase=None, **extra_fields
    ):
        if not email:
            raise ValueError("Users must have an email address")
        if not username:
            raise ValueError("Users must have a username")

        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.set_passphrase(passphrase)
        user.save(using=self._db)
        return user

    def create_superuser(
        self, email, username, password=None, passphrase=None, **extra_fields
    ):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(
            email, username, password, passphrase=passphrase, **extra_fields
        )


class User(AbstractUser):
    """
    Custom User model with extended fields for chat functionality.
    """

    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=50, unique=True, db_index=True)
    display_name = models.CharField(max_length=100, blank=True)
    avatar = models.ImageField(
        upload_to=avatar_upload_to,
        null=True,
        blank=True,
        validators=[validate_avatar],
    )
    bio = models.TextField(max_length=500, blank=True)

    # Online status tracking
    is_online = models.BooleanField(default=False, db_index=True)
    last_seen = models.DateTimeField(default=timezone.now)

    # Settings
    email_notifications = models.BooleanField(default=True)
    push_notifications = models.BooleanField(default=True)
    passphrase = models.CharField(max_length=255, blank=True)
    is_deleted = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["username"]),
            models.Index(fields=["is_online"]),
        ]

    def __str__(self):
        return self.username

    def get_display_name(self):
        return self.display_name or self.username

    def set_online(self):
        """Mark user as online."""
        self.is_online = True
        self.save(update_fields=["is_online"])

    def set_offline(self):
        """Mark user as offline and update last seen."""
        self.is_online = False
        self.last_seen = timezone.now()
        self.save(update_fields=["is_online", "last_seen"])

    def set_passphrase(self, phrase: str):
        self.passphrase = make_password(phrase)

    def check_passphrase(self, phrase: str) -> bool:
        if not self.passphrase:
            return False
        return check_password(phrase, self.passphrase)

    def has_passphrase(self) -> bool:
        return bool(self.passphrase)

    def get_avatar_url(self, request=None):
        if not self.avatar:
            return None
        path = reverse("user_avatar", kwargs={"user_id": self.id})
        if request:
            return request.build_absolute_uri(path)
        return f"{settings.BASE_URL}{path}"


class UserPresence(models.Model):
    """One row per active WebSocket presence connection."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="presence_connections",
    )
    connected_at = models.DateTimeField(auto_now_add=True)
    last_heartbeat = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["user", "last_heartbeat"])]
