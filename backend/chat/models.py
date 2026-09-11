"""
Models for chat functionality - rooms, messages, and participants.
"""

import uuid
import os
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from .validators import validate_attachment
from accounts.validators import validate_avatar


def message_attachment_upload_to(instance, filename):
    """Generate an opaque storage name; never persist a client filename."""
    extension = os.path.splitext(filename)[1].lower()
    return f"message_attachments/{uuid.uuid4().hex}{extension}"


def room_avatar_upload_to(instance, filename):
    """Generate an opaque room-avatar filename."""
    extension = os.path.splitext(filename)[1].lower()
    return f"room_avatars/{uuid.uuid4().hex}{extension}"


class ChatRoom(models.Model):
    """
    Represents a chat room - either a direct message or group chat.
    """

    ROOM_TYPES = (
        ("direct", "Direct Message"),
        ("group", "Group Chat"),
        ("subgroup", "Sub Group"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, blank=True)
    room_type = models.CharField(max_length=10, choices=ROOM_TYPES, default="direct")
    description = models.TextField(max_length=500, blank=True)
    avatar = models.ImageField(
        upload_to=room_avatar_upload_to,
        null=True,
        blank=True,
        validators=[validate_avatar],
    )

    # Group hierarchy
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="subrooms"
    )

    # Participants
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through="RoomParticipant", related_name="chat_rooms"
    )

    # Room settings
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_rooms",
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["room_type"]),
            models.Index(fields=["-updated_at"]),
            models.Index(fields=["parent", "is_active"]),
        ]

    def __str__(self):
        if self.name:
            return self.name
        if self.room_type == "direct":
            return f"Direct Room {self.id}"
        return f"Room {self.id}"

    def get_other_participant(self, user):
        """For direct messages, get the other participant."""
        if self.room_type == "direct":
            return self.participants.exclude(id=user.id).first()
        return None

    def get_last_message(self):
        """Get the most recent message in the room."""
        return self.messages.filter(is_deleted=False).first()

    def get_unread_count(self, user):
        """Get count of unread messages for a user."""
        return (
            self.messages.filter(is_deleted=False)
            .exclude(sender=user)
            .exclude(read_by__user=user)
            .count()
        )


class RoomParticipant(models.Model):
    """
    Through model for room participants with additional metadata.
    """

    ROLES = (
        ("member", "Member"),
        ("admin", "Admin"),
        ("owner", "Owner"),
    )

    room = models.ForeignKey(
        ChatRoom, on_delete=models.CASCADE, related_name="room_participants"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="room_participations",
    )
    role = models.CharField(max_length=10, choices=ROLES, default="member")

    # Tracking
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    is_muted = models.BooleanField(default=False)
    is_typing = models.BooleanField(default=False)
    typing_started_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ["room", "user"]
        ordering = ["joined_at"]
        indexes = [
            models.Index(fields=["room", "last_read_at"]),
            models.Index(fields=["room", "is_typing", "typing_started_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} in {self.room}"

    def mark_as_read(self):
        """Mark all messages as read for this participant."""
        with transaction.atomic():
            unread_messages = (
                self.room.messages.filter(is_deleted=False)
                .exclude(sender=self.user)
                .exclude(read_by__user=self.user)
            )
            new_reads = [
                MessageRead(message=msg, user=self.user) for msg in unread_messages
            ]
            if new_reads:
                MessageRead.objects.bulk_create(new_reads, ignore_conflicts=True)
            self.last_read_at = timezone.now()
            self.save(update_fields=["last_read_at"])

    def set_typing(self, is_typing):
        """Update typing status."""
        self.is_typing = is_typing
        self.typing_started_at = timezone.now() if is_typing else None
        self.save(update_fields=["is_typing", "typing_started_at"])


class Message(models.Model):
    """
    Represents a message in a chat room.
    """

    MESSAGE_TYPES = (
        ("text", "Text"),
        ("image", "Image"),
        ("voice", "Voice"),
        ("file", "File"),
        ("system", "App Notif"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(
        ChatRoom, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_messages",
    )

    # Content
    content = models.TextField(max_length=5000)
    message_type = models.CharField(
        max_length=10, choices=MESSAGE_TYPES, default="text"
    )
    attachment = models.FileField(
        upload_to=message_attachment_upload_to,
        validators=[validate_attachment],
        blank=True,
        null=True,
    )

    # Reply functionality
    reply_to = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replies"
    )

    # Status
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["room", "-created_at"]),
            models.Index(fields=["sender", "-created_at"]),
            models.Index(fields=["room", "created_at", "is_deleted"]),
        ]

    def __str__(self):
        return (
            f"{self.sender.username if self.sender else 'System'}: {self.content[:50]}"
        )

    def edit(self, new_content):
        """Edit message content."""
        new_content = new_content.strip()

        if not new_content:
            raise ValueError("Content cannot be empty.")

        if self.content == new_content:
            return

        self.content = new_content
        self.is_edited = True
        self.edited_at = timezone.now()
        self.save(update_fields=["content", "is_edited", "edited_at"])

    def soft_delete(self):
        """Soft delete the message."""
        self.is_deleted = True
        self.content = "This message has been deleted"
        self.save(update_fields=["is_deleted", "content"])


class MessageRead(models.Model):
    """
    Tracks which users have read which messages.
    """

    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name="read_by"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="read_messages"
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["message", "user"]
        ordering = ["-read_at"]
        indexes = [
            models.Index(fields=["user", "read_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} read {self.message.id}"


class ChatConfiguration(models.Model):
    """Runtime chat and branding controls managed from Django Admin."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    site_name = models.CharField(max_length=100, default="Paradise Chat")
    site_description = models.CharField(max_length=255, blank=True)
    registration_enabled = models.BooleanField(default=True)
    file_uploads_enabled = models.BooleanField(default=True)
    moderation_enabled = models.BooleanField(default=False)
    maintenance_mode = models.BooleanField(default=False)
    max_message_length = models.PositiveIntegerField(default=5000)
    max_attachment_size_mb = models.PositiveIntegerField(default=10)
    primary_color = models.CharField(max_length=20, default="#0A2342")
    accent_color = models.CharField(max_length=20, default="#2CA58D")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Chat configuration"
        verbose_name_plural = "Chat configuration"

    def __str__(self):
        return self.site_name
