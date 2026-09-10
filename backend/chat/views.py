"""
REST API views for chat functionality.
"""

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, ValidationError, PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import FileResponse
import mimetypes
import os
from django.db.models import Q, Max
from django.shortcuts import get_object_or_404
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from collections import defaultdict
from .utils import flatten_rooms
from .models import ChatRoom, RoomParticipant, Message
from .serializers import (
    ChatRoomSerializer,
    ChatRoomCreateSerializer,
    ChatRoomDetailSerializer,
    MessageSerializer,
    MessageCreateSerializer,
    MessageUpdateSerializer,
)


class ChatRoomListView(generics.ListCreateAPIView):
    """List all chat rooms for current user or create a new room."""

    permission_classes = (IsAuthenticated,)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ChatRoomCreateSerializer
        return ChatRoomSerializer

    def get_queryset(self):
        return (
            ChatRoom.objects.filter(
                participants=self.request.user, is_active=True, parent__isnull=True
            )
            .annotate(last_activity=Max("messages__created_at"))
            .order_by("-last_activity", "-updated_at")
            .prefetch_related(
                "room_participants__user",
            )
            .select_related("created_by")
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        visible_rooms = (
            ChatRoom.objects.filter(
                participants=request.user,
                is_active=True,
            )
            .filter(Q(parent__isnull=True) | Q(parent__is_active=True))
            .prefetch_related("room_participants__user")
            .select_related("parent", "created_by")
        )
        children_by_parent = defaultdict(list)
        for room in visible_rooms:
            room.prefetched_participants = list(room.room_participants.all())
            if room.parent_id:
                children_by_parent[room.parent_id].append(room)

        flat = flatten_rooms(
            queryset, request.user, children_by_parent=children_by_parent
        )

        serialized = []
        for item in flat:
            room = item["room"]
            if not hasattr(room, "prefetched_participants"):
                room.prefetched_participants = list(room.room_participants.all())
            data = ChatRoomSerializer(room, context={"request": request}).data
            data["depth"] = item["depth"]
            serialized.append(data)

        return Response({"results": serialized, "count": len(serialized)})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = serializer.save()
        return Response(
            ChatRoomSerializer(room, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ChatRoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a specific chat room."""

    permission_classes = (IsAuthenticated,)
    serializer_class = ChatRoomDetailSerializer

    def get_queryset(self):
        return (
            ChatRoom.objects.filter(participants=self.request.user, is_active=True)
            .filter(Q(parent__isnull=True) | Q(parent__is_active=True))
            .prefetch_related("participants", "messages")
        )

    def get_object(self):
        room = get_object_or_404(self.get_queryset(), id=self.kwargs["room_id"])
        # Mark as read when viewing
        participant = room.room_participants.filter(user=self.request.user).first()
        if participant:
            participant.mark_as_read()
        return room

    def destroy(self, request, *args, **kwargs):
        room = self.get_object()
        participant = room.room_participants.filter(user=request.user).first()

        if not participant:
            return Response(
                {"message": "You are not a participant in this room."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if room.room_type == "direct":
            room.delete()
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"chat_{room.id}",
                    {
                        "type": "room_deleted",
                        "room_id": room.id,
                    },
                )
            return Response(
                {"message": "Direct chat deleted successfully."},
                status=status.HTTP_200_OK,
            )

        if participant.role == "owner":
            other_owners = room.room_participants.filter(role="owner").exclude(
                user=request.user
            )

            if other_owners.exists():
                participant.delete()
                channel_layer = get_channel_layer()
                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        f"chat_{room.id}",
                        {
                            "type": "user_leave",
                            "user_id": request.user.id,
                            "username": request.user.username,
                        },
                    )
                return Response(
                    {"message": "You left the group."}, status=status.HTTP_200_OK
                )

            room.delete()
            return Response(
                {"message": "Group deleted successfully."}, status=status.HTTP_200_OK
            )

        participant.delete()
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"chat_{room.id}",
                {
                    "type": "user_leave",
                    "user_id": request.user.id,
                    "username": request.user.username,
                },
            )
        return Response({"message": "Left the room."}, status=status.HTTP_200_OK)


class ManageParticipantView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id, user_id):
        if not user_id:
            return Response(
                {"message": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        room = get_object_or_404(
            ChatRoom.objects.filter(
                participants=request.user,
                is_active=True,
            ).filter(Q(parent__isnull=True) | Q(parent__is_active=True)),
            id=room_id,
        )

        requester = room.room_participants.filter(user=request.user).first()

        if not requester:
            return Response({"message": "Not a participant."}, status=403)

        if requester.role not in ["owner", "admin"]:
            return Response({"message": "Permission denied."}, status=403)

        if room.room_participants.filter(user_id=user_id).exists():
            return Response({"message": "User already in room."}, status=400)

        User = get_user_model()

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"message": "User not found."}, status=404)

        RoomParticipant.objects.create(room=room, user=user, role="member")

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"chat_{room.id}",
                {
                    "type": "user_join",
                    "user_id": user.id,
                    "username": user.username,
                },
            )

        return Response({"message": "User added."}, status=201)

    def patch(self, request, room_id, user_id):
        if not user_id:
            return Response(
                {"message": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        room = get_object_or_404(
            ChatRoom.objects.filter(
                participants=request.user,
                is_active=True,
            ).filter(Q(parent__isnull=True) | Q(parent__is_active=True)),
            id=room_id,
        )

        requester = room.room_participants.filter(user=request.user).first()

        target = room.room_participants.filter(user_id=user_id).first()

        if not target:
            return Response({"message": "User not in room."}, status=404)

        if not requester:
            return Response({"message": "Not a participant."}, status=403)

        if requester.role != "owner":
            return Response({"message": "Only owner can change roles."}, status=403)

        if target.role == "owner":
            return Response({"message": "Cannot modify another owner."}, status=403)

        new_role = request.data.get("role")
        if new_role not in ["owner", "admin", "member"]:
            return Response({"message": "Invalid role."}, status=400)

        target.role = new_role
        target.save(update_fields=["role"])

        return Response(
            {"message": "Role updated.", "user_id": user_id, "role": new_role},
            status=200,
        )

    def delete(self, request, room_id, user_id):
        if not user_id:
            return Response(
                {"message": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        room = get_object_or_404(
            ChatRoom.objects.filter(
                participants=request.user,
                is_active=True,
            ).filter(Q(parent__isnull=True) | Q(parent__is_active=True)),
            id=room_id,
        )

        requester = room.room_participants.filter(user=request.user).first()

        target = room.room_participants.filter(user_id=user_id).first()

        if not requester:
            return Response({"message": "Not a participant."}, status=403)

        if not target:
            return Response({"message": "User not in room."}, status=404)

        if requester.role == "admin":
            if target.role != "member":
                return Response(
                    {"message": "Admins can only remove members."}, status=403
                )
        elif requester.role == "owner":
            if target.role == "owner":
                return Response(
                    {"message": "Owner cannot remove another owner."}, status=403
                )
        else:
            return Response({"message": "Permission denied."}, status=403)

        target.delete()
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"chat_{room.id}",
                {
                    "type": "user_leave",
                    "user_id": user_id,
                    "username": target.user.username,
                },
            )
        return Response({"message": "User removed from room."}, status=200)


class MessageListView(generics.ListCreateAPIView):
    """List messages in a room or send a new message."""

    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MessageCreateSerializer
        return MessageSerializer

    def get_queryset(self):
        room_id = self.kwargs["room_id"]
        room = get_object_or_404(
            ChatRoom.objects.filter(
                participants=self.request.user, is_active=True
            ).filter(Q(parent__isnull=True) | Q(parent__is_active=True)),
            id=room_id,
        )
        return Message.objects.filter(room=room, is_deleted=False).select_related(
            "sender", "reply_to"
        )

    def create(self, request, *args, **kwargs):
        room_id = self.kwargs["room_id"]
        room = get_object_or_404(
            ChatRoom.objects.filter(participants=request.user, is_active=True).filter(
                Q(parent__isnull=True) | Q(parent__is_active=True)
            ),
            id=room_id,
        )

        serializer = self.get_serializer(
            data=request.data, context={"room": room, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        message = serializer.save(sender=request.user, room=room)

        # Update room's updated_at
        room.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{room.id}",
            {
                "type": "chat_message",
                "message": MessageSerializer(
                    message, context={"request": request}
                ).data,
            },
        )

        return Response(
            MessageSerializer(message, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MessageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, edit, or delete a specific message."""

    permission_classes = (IsAuthenticated,)
    serializer_class = MessageSerializer

    def get_object(self):
        message = get_object_or_404(
            Message.objects.select_related("sender", "room"),
            id=self.kwargs["message_id"],
            room_id=self.kwargs["room_id"],
            is_deleted=False,
        )
        # Verify user is in the room
        if not message.room.participants.filter(id=self.request.user.id).exists():
            raise PermissionDenied("You are not a member of this room.")
        return message

    def update(self, request, *args, **kwargs):
        message = self.get_object()

        if message.sender != request.user:
            return Response(
                {"error": "You can only edit your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if message.message_type != "text":
            return Response(
                {"error": "Only text messages can be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = request.data.get("content")

        if not content or not content.strip():
            raise ValidationError("Content cannot be empty.")

        serializer = MessageUpdateSerializer(message, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_content = serializer.validated_data["content"]

        try:
            message.edit(new_content)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"chat_{message.room.id}",
                {
                    "type": "message_edited",
                    "message": MessageSerializer(
                        message, context={"request": request}
                    ).data,
                },
            )

        return Response(MessageSerializer(message, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        message = self.get_object()
        if message.sender != request.user:
            return Response(
                {"error": "You can only delete your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )
        message.soft_delete()

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"chat_{message.room.id}",
                {
                    "type": "message_deleted",
                    "message_id": str(message.id),
                    "user_id": request.user.id,
                },
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class MessageAttachmentView(APIView):
    """Stream an attachment only to an authenticated room participant."""

    permission_classes = (IsAuthenticated,)

    def get(self, request, message_id):
        message = get_object_or_404(
            Message.objects.select_related("room"),
            id=message_id,
            is_deleted=False,
        )
        if not message.room.participants.filter(id=request.user.id).exists():
            raise PermissionDenied("You are not a member of this room.")
        if not message.attachment or not message.attachment.name:
            raise NotFound("This message has no attachment.")

        message.attachment.open("rb")
        content_type = mimetypes.guess_type(message.attachment.name)[0]
        response = FileResponse(message.attachment, content_type=content_type)
        response["Content-Disposition"] = (
            f'inline; filename="{os.path.basename(message.attachment.name)}"'
        )
        return response


class DirectMessageView(APIView):
    """Create or get existing direct message room with a user."""

    permission_classes = (IsAuthenticated,)

    def post(self, request):
        user_id = request.data.get("user_id")
        if not user_id:
            return Response(
                {"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if user_id == request.user.id:
            return Response(
                {"error": "Cannot create DM with yourself"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()

        try:
            other_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Check for existing DM
        existing_room = (
            ChatRoom.objects.filter(room_type="direct", participants=request.user)
            .filter(participants=other_user)
            .first()
        )

        if existing_room:
            return Response(
                ChatRoomSerializer(existing_room, context={"request": request}).data
            )

        # Create new DM room
        with transaction.atomic():
            room = ChatRoom.objects.create(
                room_type="direct", created_by=request.user, parent=None
            )
            RoomParticipant.objects.create(room=room, user=request.user, role="member")
            RoomParticipant.objects.create(room=room, user=other_user, role="member")

        return Response(
            ChatRoomSerializer(room, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MarkAsReadView(APIView):
    """Mark all messages in a room as read."""

    permission_classes = (IsAuthenticated,)

    def post(self, request, room_id):
        room = get_object_or_404(
            ChatRoom.objects.filter(participants=request.user, is_active=True).filter(
                Q(parent__isnull=True) | Q(parent__is_active=True)
            ),
            id=room_id,
        )
        participant = room.room_participants.filter(user=request.user).first()
        if participant:
            participant.mark_as_read()
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"chat_{room.id}",
                    {
                        "type": "read_receipt",
                        "user_id": request.user.id,
                        "username": request.user.username,
                        "read_at": participant.last_read_at.isoformat(),
                    },
                )
        return Response({"message": "Marked as read"})


class TypingStatusView(APIView):
    """Update typing status (backup for WebSocket)."""

    permission_classes = (IsAuthenticated,)

    def post(self, request, room_id):
        room = get_object_or_404(
            ChatRoom.objects.filter(participants=request.user, is_active=True).filter(
                Q(parent__isnull=True) | Q(parent__is_active=True)
            ),
            id=room_id,
        )
        is_typing = request.data.get("is_typing", False)
        participant = room.room_participants.filter(user=request.user).first()
        if not participant:
            return Response({"error": "Participant not found"}, status=404)
        participant.set_typing(is_typing)
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"chat_{room.id}",
                {
                    "type": "typing_indicator",
                    "user_id": request.user.id,
                    "username": request.user.username,
                    "is_typing": bool(is_typing),
                },
            )
        return Response({"is_typing": is_typing})
