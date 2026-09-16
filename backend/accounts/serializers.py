"""
Serializers for user authentication and profile management.
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.urls import reverse
from .validators import validate_passphrase
from .avatar_processing import process_avatar
from rest_framework.exceptions import AuthenticationFailed
import re

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer with additional user data."""

    passphrase = serializers.CharField(required=False, allow_blank=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token["username"] = user.username
        token["email"] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        passphrase = attrs.get("passphrase")

        if user.is_deleted:
            raise AuthenticationFailed("This account has been deleted.")

        if user.has_passphrase():
            if not passphrase:
                raise AuthenticationFailed("Security passphrase is required.")
            if not user.check_passphrase(passphrase):
                raise AuthenticationFailed("Security passphrase is incorrect.")

        # Add user info to response
        request = self.context.get("request")
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "display_name": self.user.get_display_name(),
            "bio": user.bio,
            "email_notifications": user.email_notifications,
            "push_notifications": user.push_notifications,
            "avatar": user.get_avatar_url(request) if request else None,
        }
        return data


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )
    passphrase = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_passphrase],
    )

    class Meta:
        model = User
        fields = (
            "email",
            "username",
            "password",
            "password_confirm",
            "passphrase",
            "display_name",
        )
        extra_kwargs = {
            "display_name": {"required": False},
        }

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.strip().lower()

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "A user with this username already exists."
            )
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters.")
        if not re.match(r"^[A-Za-z0-9_]+$", value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, and underscores."
            )
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")

        user = User.objects.create_user(**validated_data)

        return user


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user profile display."""

    display_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "display_name",
            "avatar",
            "bio",
            "is_online",
            "last_seen",
            "created_at",
        )
        read_only_fields = ("id", "email", "created_at")

    def get_display_name(self, obj):
        return obj.get_display_name()

    def get_avatar(self, obj):
        request = self.context.get("request")
        return obj.get_avatar_url(request) if hasattr(obj, "get_avatar_url") else None


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""

    class Meta:
        model = User
        fields = (
            "username",
            "display_name",
            "bio",
            "avatar",
            "email_notifications",
            "push_notifications",
        )
        extra_kwargs = {
            "username": {"required": False},
        }

    def validate_username(self, value):
        user = self.context["request"].user
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters.")
        if not re.match(r"^[A-Za-z0-9_]+$", value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, and underscores."
            )
        if User.objects.exclude(pk=user.pk).filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "A user with this username already exists."
            )
        return value

    def update(self, instance, validated_data):
        avatar = validated_data.pop("avatar", serializers.empty)
        old_avatar_name = instance.avatar.name if instance.avatar else None
        old_thumbnail_name = (
            instance.avatar_thumbnail.name if instance.avatar_thumbnail else None
        )

        if avatar is not serializers.empty:
            if avatar:
                normalized_avatar, thumbnail = process_avatar(avatar)
                validated_data["avatar"] = normalized_avatar
                validated_data["avatar_thumbnail"] = thumbnail
            else:
                validated_data["avatar"] = None
                validated_data["avatar_thumbnail"] = None

        updated = super().update(instance, validated_data)

        if avatar is not serializers.empty and avatar:
            storage = instance.avatar.storage
            if old_avatar_name and old_avatar_name != instance.avatar.name:
                storage.delete(old_avatar_name)
            if (
                old_thumbnail_name
                and old_thumbnail_name != instance.avatar_thumbnail.name
            ):
                storage.delete(old_thumbnail_name)
        elif avatar is not serializers.empty:
            if old_avatar_name:
                instance.avatar.storage.delete(old_avatar_name)
            if old_thumbnail_name:
                instance.avatar_thumbnail.storage.delete(old_thumbnail_name)

        return updated


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change."""

    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)
    current_passphrase = serializers.CharField(required=True)
    new_passphrase = serializers.CharField(
        required=False, allow_blank=True, validators=[validate_passphrase]
    )

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_current_passphrase(self, value):
        user = self.context["request"].user
        if user.has_passphrase():
            if not value:
                raise serializers.ValidationError("Current passphrase is required.")
            if not user.check_passphrase(value):
                raise serializers.ValidationError("Current passphrase is incorrect.")
        return value

    def validate(self, attrs):
        new_passphrase = attrs.get("new_passphrase")

        if new_passphrase:
            if new_passphrase and new_passphrase == attrs.get("new_password"):
                raise serializers.ValidationError(
                    {"new_passphrase": "Passphrase cannot be the same as password."}
                )

        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )

        return attrs


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal serializer for user references in other objects."""

    display_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "display_name", "avatar", "is_online")

    def get_display_name(self, obj):
        return obj.get_display_name()

    def get_avatar(self, obj):
        request = self.context.get("request")
        if request:
            return obj.get_avatar_url(request, thumbnail=True)

        base_url = self.context.get("base_url")
        if base_url and obj.avatar:
            path = reverse("user_avatar", kwargs={"user_id": obj.id})
            suffix = "?size=thumbnail" if obj.avatar_thumbnail else ""
            return f"{base_url.rstrip('/')}{path}{suffix}"

        return obj.get_avatar_url(thumbnail=True)


class UserDeleteSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    passphrase = serializers.CharField(write_only=True)

    def validate(self, data):
        user = self.context["request"].user

        if not user.check_password(data.get("password")):
            raise serializers.ValidationError({"password": "Incorrect password."})

        if user.has_passphrase() and not user.check_passphrase(data.get("passphrase")):
            raise serializers.ValidationError({"passphrase": "Invalid passphrase."})

        return data
