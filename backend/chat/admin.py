"""
Admin configuration for chat app.
"""

from django.contrib import admin
from .models import ChatConfiguration, ChatRoom, RoomParticipant, Message, MessageRead


@admin.register(ChatConfiguration)
class ChatConfigurationAdmin(admin.ModelAdmin):
    """Expose runtime controls without allowing duplicate configuration rows."""

    list_display = (
        "site_name",
        "registration_enabled",
        "file_uploads_enabled",
        "moderation_enabled",
        "maintenance_mode",
        "updated_at",
    )
    readonly_fields = ("updated_at",)

    def has_add_permission(self, request):
        return not ChatConfiguration.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class RoomParticipantInline(admin.TabularInline):
    model = RoomParticipant
    extra = 0
    readonly_fields = ("joined_at", "last_read_at")


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "room_type", "is_active", "created_by", "created_at")
    list_filter = ("room_type", "is_active", "created_at")
    search_fields = ("name", "description")
    inlines = [RoomParticipantInline]
    readonly_fields = ("created_at", "updated_at")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "room",
        "sender",
        "short_content",
        "message_type",
        "is_deleted",
        "created_at",
    )
    list_filter = ("message_type", "is_deleted", "is_edited", "created_at")
    search_fields = ("content", "sender__username")
    readonly_fields = ("created_at", "edited_at")

    def short_content(self, obj):
        content = obj.content or ""
        return content[:50] + "..." if len(content) > 50 else content

    short_content.short_description = "Content"


@admin.register(RoomParticipant)
class RoomParticipantAdmin(admin.ModelAdmin):
    list_display = ("user", "room", "role", "is_typing", "joined_at")
    list_filter = ("role", "is_muted", "joined_at")
    search_fields = ("user__username", "room__name")


@admin.register(MessageRead)
class MessageReadAdmin(admin.ModelAdmin):
    list_display = ("user", "message", "read_at")
    list_filter = ("read_at",)
