"""
Admin configuration for accounts app.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model
from .forms import UserChangeForm

User = get_user_model()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserChangeForm

    list_display = (
        "username",
        "email",
        "display_name",
        "is_online",
        "last_seen",
        "is_active",
        "is_staff",
    )
    list_filter = ("is_online", "is_active", "is_staff", "is_deleted", "created_at")
    search_fields = ("username", "email", "display_name")
    ordering = ("-created_at",)
    readonly_fields = ("passphrase", "created_at")

    fieldsets = (
        (None, {"fields": ("email", "username", "password")}),
        ("Personal Info", {"fields": ("display_name", "avatar", "bio")}),
        ("Status", {"fields": ("is_online", "last_seen")}),
        ("Settings", {"fields": ("email_notifications", "push_notifications")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "created_at")}),
        (
            "Passphrase",
            {
                "fields": ("new_passphrase", "passphrase"),
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "username", "password1", "password2"),
            },
        ),
    )
