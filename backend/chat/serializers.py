"""
Serializers for chat functionality.
"""

from rest_framework import serializers
from django.urls import reverse
from django.contrib.auth import get_user_model
from accounts.serializers import UserMinimalSerializer
from django.conf import settings
from .models import ChatRoom, RoomParticipant, Message
from .config import get_chat_configuration

User = get_user_model()


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for messages."""

    sender = UserMinimalSerializer(read_only=True)
    attachment = serializers.SerializerMethodField()
    reply_to_preview = serializers.SerializerMethodField()
    is_own_message = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id",
            "sender",
            "content",
            "message_type",
            "attachment",
            "reply_to",
            "reply_to_preview",
            "is_edited",
            "edited_at",
            "is_deleted",
            "created_at",
            "is_own_message",
        )
        read_only_fields = (
            "id",
            "sender",
            "is_edited",
            "edited_at",
            "is_deleted",
            "created_at",
        )

    def get_reply_to_preview(self, obj):
        reply = obj.reply_to
        if not reply:
            return None
        return {
            "id": str(reply.id),
            "content": (
                "This message was deleted"
                if reply.is_deleted
                else (reply.content[:100] if reply.content else "")
            ),
            "sender": reply.sender.username if reply.sender else "Unknown",
        }

    def get_attachment(self, obj):
        if not obj.attachment or not obj.attachment.name:
            return None
        request = self.context.get("request")
        path = reverse("message_attachment", kwargs={"message_id": obj.id})
        return (
            request.build_absolute_uri(path)
            if request
            else f"{settings.BASE_URL}{path}"
        )

    def get_is_own_message(self, obj):
        request = self.context.get("request")
        if request and request.user:
            return obj.sender_id == request.user.id
        return False


class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating messages."""

    class Meta:
        model = Message
        fields = ("content", "message_type", "attachment", "reply_to")

    def validate_content(self, value):
        if value:
            return value.strip()
        return value

    def validate(self, attrs):
        content = attrs.get("content")
        attachment = attrs.get("attachment")
        reply_to = attrs.get("reply_to")
        room = self.context.get("room")

        if not room:
            raise serializers.ValidationError("Room context is required.")

        configuration = get_chat_configuration()
        if not configuration.file_uploads_enabled and attrs.get("attachment"):
            raise serializers.ValidationError("File uploads are currently disabled.")

        if attachment:
            if attachment.size > configuration.max_attachment_size_mb * 1024 * 1024:
                raise serializers.ValidationError(
                    "The uploaded file exceeds the configured size limit."
                )
            attrs["message_type"] = (
                "image" if attachment.content_type.startswith("image") else "file"
            )

        valid_types = [choice[0] for choice in Message.MESSAGE_TYPES]
        message_type = attrs.get("message_type", "text")
        if message_type not in valid_types:
            raise serializers.ValidationError("Invalid message type.")

        if reply_to and reply_to.room_id != room.id:
            raise serializers.ValidationError(
                "Reply-to message must belong to same room."
            )
        if reply_to and reply_to.is_deleted:
            raise serializers.ValidationError("Cannot reply to a deleted message.")

        if message_type == "text":
            if not content or not content.strip():
                raise serializers.ValidationError("Text content cannot be empty.")
            attrs["content"] = content.strip()

        if content and len(content.strip()) > configuration.max_message_length:
            raise serializers.ValidationError(
                f"Message cannot exceed {configuration.max_message_length} characters."
            )

        if message_type != "text" and not attachment:
            raise serializers.ValidationError(
                f"{message_type} messages must include an attachment."
            )

        if not content and not attachment:
            raise serializers.ValidationError(
                "Message must contain either text or an attachment."
            )

        return attrs


class MessageUpdateSerializer(serializers.ModelSerializer):
    """Serializer for Editing messages."""

    class Meta:
        model = Message
        fields = ["content"]

    def validate_content(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Content cannot be empty.")
        value = value.strip()
        max_length = get_chat_configuration().max_message_length
        if len(value) > max_length:
            raise serializers.ValidationError(
                f"Message cannot exceed {max_length} characters."
            )
        return value


class RoomParticipantSerializer(serializers.ModelSerializer):
    """Serializer for room participants."""

    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = RoomParticipant
        fields = ("user", "role", "joined_at", "is_typing", "is_muted")


class ChatRoomSerializer(serializers.ModelSerializer):
    """Serializer for chat rooms."""

    avatar = serializers.SerializerMethodField()
    participants_info = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    display_avatar = serializers.SerializerMethodField()
    depth = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ChatRoom
        fields = (
            "id",
            "avatar",
            "name",
            "room_type",
            "description",
            "participants_info",
            "last_message",
            "unread_count",
            "display_name",
            "display_avatar",
            "is_active",
            "depth",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_participants_info(self, obj):
        participants = getattr(
            obj,
            "prefetched_participants",
            obj.room_participants.select_related("user").all(),
        )
        return RoomParticipantSerializer(participants[:10], many=True).data

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        path = reverse("room_avatar", kwargs={"room_id": obj.id})
        return request.build_absolute_uri(path) if request else f"{settings.BASE_URL}{path}"

    def get_last_message(self, obj):
        if getattr(obj, "summary_message_id", None):
            return {
                "id": str(obj.summary_message_id),
                "content": (obj.summary_content or "")[:100],
                "sender": obj.summary_sender or "App",
                "created_at": obj.summary_created_at.isoformat(),
                "message_type": obj.summary_message_type,
            }
        message = obj.get_last_message()
        if message:
            return {
                "id": str(message.id),
                "content": (message.content[:100] if not message.is_deleted else "..."),
                "sender": message.sender.username if message.sender else "App",
                "created_at": message.created_at.isoformat(),
                "message_type": message.message_type,
            }
        return None

    def get_unread_count(self, obj):
        user = self.context.get("request").user
        if user.is_anonymous:
            return 0
        if hasattr(obj, "unread_count_for_user"):
            return obj.unread_count_for_user
        return obj.get_unread_count(user)

    def get_display_name(self, obj):
        request = self.context.get("request")
        if obj.room_type == "direct" and request and request.user:
            participants = getattr(obj, "prefetched_participants", None)
            if participants is None:
                participants = obj.room_participants.select_related("user").all()
            others = [p.user for p in participants if p.user != request.user]
            if others:
                return others[0].get_display_name()
        return obj.name or "Group"

    def get_display_avatar(self, obj):
        request = self.context.get("request")
        if obj.room_type == "direct" and request and request.user:
            participants = getattr(obj, "prefetched_participants", None)
            if participants is None:
                participants = obj.room_participants.select_related("user").all()
            others = [p.user for p in participants if p.user != request.user]
            if others and others[0].avatar:
                return others[0].get_avatar_url(request)
        if obj.avatar:
            return self.get_avatar(obj)
        return None


class ChatRoomCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating chat rooms."""

    participant_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True
    )
    parent = serializers.PrimaryKeyRelatedField(
        queryset=ChatRoom.objects.filter(room_type="group"),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ChatRoom
        fields = ("name", "room_type", "description", "participant_ids", "parent")

    def validate(self, attrs):
        request = self.context.get("request")
        if not request:
            raise serializers.ValidationError("Request context is required.")

        user = request.user

        room_type = attrs.get("room_type")
        parent = attrs.get("parent")
        participant_ids = attrs.get("participant_ids")

        if not user.is_active or user.is_deleted:
            raise serializers.ValidationError("This account cannot create rooms.")

        if len(participant_ids) != len(set(participant_ids)):
            raise serializers.ValidationError("Participants must be unique.")

        active_user_ids = set(
            User.objects.filter(
                id__in=participant_ids, is_active=True, is_deleted=False
            ).values_list("id", flat=True)
        )
        if active_user_ids != set(participant_ids):
            raise serializers.ValidationError("One or more participants are invalid.")

        if room_type == "direct":
            if parent:
                raise serializers.ValidationError("Direct rooms cannot have a parent.")

            if not participant_ids or len(participant_ids) != 1:
                raise serializers.ValidationError(
                    "Direct rooms must have exactly two participants."
                )
            if participant_ids[0] == user.id:
                raise serializers.ValidationError(
                    "Cannot create a direct room with yourself."
                )

        if room_type == "subgroup":
            if not parent:
                raise serializers.ValidationError("Subgroup must have a parent group.")

            if parent.created_by != user:
                raise serializers.ValidationError(
                    "Only the parent group owner can create subgroups."
                )

            if not parent.is_active:
                raise serializers.ValidationError("Parent group is inactive.")
            if not parent.room_participants.filter(user=user, role="owner").exists():
                raise serializers.ValidationError("You are not an active parent owner.")

            parent_member_ids = set(parent.participants.values_list("id", flat=True))
            is_invalid_participant = any(
                p_id != user.id and p_id not in parent_member_ids
                for p_id in participant_ids
            )

            if is_invalid_participant:
                raise serializers.ValidationError(
                    "Some participants are not members of the parent group."
                )

        if room_type in ["group", "subgroup"]:
            if not isinstance(participant_ids, list) or len(participant_ids) == 0:
                raise serializers.ValidationError(
                    "Participant list cannot be empty for groups or subgroups."
                )

        return attrs

    def create(self, validated_data):
        participant_ids = validated_data.pop("participant_ids")
        user = self.context["request"].user

        if validated_data.get("room_type") == "direct" and len(participant_ids) == 1:
            other_user_id = participant_ids[0]
            existing_room = (
                ChatRoom.objects.filter(
                    room_type="direct", participants=user, is_active=True
                )
                .filter(participants=other_user_id)
                .first()
            )

            if existing_room:
                return existing_room

        room = ChatRoom.objects.create(created_by=user, **validated_data)

        RoomParticipant.objects.create(room=room, user=user, role="owner")

        for participant_id in participant_ids:
            if participant_id != user.id:
                participant = User.objects.get(id=participant_id)
                RoomParticipant.objects.create(
                    room=room, user=participant, role="member"
                )

        return room


class ChatRoomDetailSerializer(ChatRoomSerializer):
    """Detailed serializer for single chat room view."""

    messages = serializers.SerializerMethodField()

    class Meta(ChatRoomSerializer.Meta):
        fields = ChatRoomSerializer.Meta.fields + ("messages",)

    def get_messages(self, obj):
        messages = obj.messages.filter(is_deleted=False).select_related(
            "sender", "reply_to"
        )[:50]
        return MessageSerializer(messages, many=True, context=self.context).data


class ChatRoomUpdateSerializer(serializers.ModelSerializer):
    """Only safe room metadata is writable after creation."""

    class Meta:
        model = ChatRoom
        fields = ("name", "description", "avatar")
