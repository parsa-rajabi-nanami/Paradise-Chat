"""
Serializers for chat functionality.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from accounts.serializers import UserMinimalSerializer
from django.conf import settings
from .models import ChatRoom, RoomParticipant, Message, MessageRead

User = get_user_model()


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for messages."""

    sender = UserMinimalSerializer(read_only=True)
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

        if attachment:
            attrs["message_type"] = (
                "image" if attachment.content_type.startswith("image") else "file"
            )

        valid_types = [choice[0] for choice in Message.MESSAGE_TYPES]
        message_type = attrs.get("message_type", "text")
        if message_type not in valid_types:
            raise serializers.ValidationError(f"Invalid message type.")

        if reply_to and reply_to.room_id != room.id:
            raise serializers.ValidationError(
                "Reply-to message must belong to same room."
            )

        if message_type == "text":
            if not content or not content.strip():
                raise serializers.ValidationError("Text content cannot be empty.")
            attrs["content"] = content.strip()

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
        return value.strip()


class RoomParticipantSerializer(serializers.ModelSerializer):
    """Serializer for room participants."""

    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = RoomParticipant
        fields = ("user", "role", "joined_at", "is_typing", "is_muted")


class ChatRoomSerializer(serializers.ModelSerializer):
    """Serializer for chat rooms."""

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

    def get_last_message(self, obj):
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
        return obj.get_unread_count(user)

    def get_display_name(self, obj):
        request = self.context.get("request")
        if obj.room_type == "direct" and request and request.user:
            participants = getattr(obj, "prefetched_participants", [])
            others = [p.user for p in participants if p.user != request.user]
            if others:
                return others[0].get_display_name()
        return obj.name or f"Group"

    def get_display_avatar(self, obj):
        request = self.context.get("request")
        if obj.room_type == "direct" and request and request.user:
            participants = getattr(obj, "prefetched_participants", [])
            others = [p.user for p in participants if p.user != request.user]
            if others and others[0].avatar:
                return request.build_absolute_uri(others[0].avatar.url)
        if obj.avatar:
            return (
                request.build_absolute_uri(obj.avatar.url)
                if request
                else f"{settings.BASE_URL}{obj.avatar.url}"
            )
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
        room_type = attrs.get("room_type")
        parent = attrs.get("parent")
        participant_ids = attrs.get("participant_ids")

        if room_type == "direct":
            if parent:
                raise serializers.ValidationError("Direct rooms cannot have a parent.")

            if not participant_ids or len(participant_ids) != 1:
                raise serializers.ValidationError(
                    "Direct rooms must have exactly two participants."
                )

        if room_type == "subgroup":
            if not parent:
                raise serializers.ValidationError("Subgroup must have a parent group.")

            if parent.created_by != user:
                raise serializers.ValidationError(
                    "Only the parent group owner can create subgroups."
                )

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
                ChatRoom.objects.filter(room_type="direct", participants=user)
                .filter(participants=other_user_id)
                .first()
            )

            if existing_room:
                return existing_room

        room = ChatRoom.objects.create(created_by=user, **validated_data)

        RoomParticipant.objects.create(room=room, user=user, role="owner")

        for participant_id in participant_ids:
            if participant_id != user.id:
                try:
                    participant = User.objects.get(id=participant_id)
                    RoomParticipant.objects.create(
                        room=room, user=participant, role="member"
                    )
                except User.DoesNotExist:
                    pass

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
