"""
WebSocket consumers for real-time chat functionality.
Handles messaging, typing indicators, and online status.
"""

import json
import logging
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q
from .models import ChatRoom, Message, RoomParticipant
from .serializers import MessageSerializer

logger = logging.getLogger(__name__)
User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for chat rooms.
    Handles real-time messaging, typing indicators, and read receipts.
    """

    async def connect(self):
        """Handle WebSocket connection."""
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group_name = f"chat_{self.room_id}"
        self.user = self.scope["user"]

        # Reject if not authenticated
        if self.user.is_anonymous:
            logger.warning(
                f"Rejected anonymous WebSocket connection to room {self.room_id}"
            )
            await self.close()
            return

        # Check if room is active
        if not await self.is_room_active():
            logger.warning(
                f"Rejected connection: Room {self.room_id} is inactive or does not exist"
            )
            await self.close()
            return

        # Verify user is a participant
        if not await self.is_room_participant():
            logger.warning(f"User {self.user.id} not in room {self.room_id}")
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        await self.accept()

        # Notify room of user joining
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_join",
                "user_id": self.user.id,
                "username": self.user.username,
            },
        )

        logger.info(f"User {self.user.username} connected to room {self.room_id}")

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if hasattr(self, "room_group_name") and not self.user.is_anonymous:
            # Clear typing status
            await self.set_typing_status(False)

            # Notify room of user leaving
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "user_leave",
                    "user_id": self.user.id,
                    "username": self.user.username,
                },
            )

            # Leave room group
            await self.channel_layer.group_discard(
                self.room_group_name, self.channel_name
            )

            logger.info(
                f"User {self.user.username} disconnected from room {self.room_id}"
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get("type")

            handlers = {
                "message": self.handle_message,
                "typing": self.handle_typing,
                "read": self.handle_read,
                "edit": self.handle_edit,
                "delete": self.handle_delete,
            }

            handler = handlers.get(message_type)
            if handler:
                await handler(data)
            else:
                logger.warning(f"Unknown message type: {message_type}")

        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error handling message: {e}")

    async def handle_message(self, data):
        """Handle new text message."""
        content = data.get("content", "").strip()
        reply_to = data.get("reply_to")

        if reply_to:
            valid_reply = await self.is_valid_reply(reply_to)
            if not valid_reply:
                return

        if not content:
            return

        # Save message to database
        message = await self.save_message(content, reply_to)

        if message:
            # Broadcast to room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": await self.serialize_message(message),
                },
            )

    async def handle_typing(self, data):
        """Handle typing indicator."""
        is_typing = data.get("is_typing", False)

        await self.set_typing_status(is_typing)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "typing_indicator",
                "user_id": self.user.id,
                "username": self.user.username,
                "is_typing": is_typing,
            },
        )

    async def handle_read(self, data):
        """Handle read receipt."""
        await self.mark_as_read()

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "read_receipt",
                "user_id": self.user.id,
                "username": self.user.username,
                "read_at": timezone.now().isoformat(),
            },
        )

    async def handle_edit(self, data):
        """Handle message edit."""
        message_id = data.get("message_id")
        new_content = data.get("content", "").strip()

        if not message_id or not new_content:
            return

        message = await self.edit_message(message_id, new_content)

        if message:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "message_edited",
                    "message": await self.serialize_message(message),
                },
            )

    async def handle_delete(self, data):
        """Handle message deletion."""
        message_id = data.get("message_id")

        if not message_id:
            return

        success = await self.delete_message(message_id)

        if success:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "message_deleted",
                    "message_id": message_id,
                    "user_id": self.user.id,
                },
            )

    # Channel layer event handlers

    async def chat_message(self, event):
        """Send message to WebSocket."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "message",
                    "message": event["message"],
                }
            )
        )

    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket."""
        # Don't send to the user who is typing
        if event["user_id"] != self.user.id:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "typing",
                        "user_id": event["user_id"],
                        "username": event["username"],
                        "is_typing": event["is_typing"],
                    }
                )
            )

    async def read_receipt(self, event):
        """Send read receipt to WebSocket."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "read",
                    "user_id": event["user_id"],
                    "username": event["username"],
                    "read_at": event["read_at"],
                }
            )
        )

    async def message_edited(self, event):
        """Send edited message to WebSocket."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "edit",
                    "message": event["message"],
                }
            )
        )

    async def message_deleted(self, event):
        """Send deletion notification to WebSocket."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "delete",
                    "message_id": event["message_id"],
                }
            )
        )

    async def user_join(self, event):
        """Notify of user joining."""
        if event["user_id"] != self.user.id:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "user_join",
                        "user_id": event["user_id"],
                        "username": event["username"],
                    }
                )
            )

    async def user_leave(self, event):
        """Notify of user leaving."""
        if event["user_id"] != self.user.id:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "user_leave",
                        "user_id": event["user_id"],
                        "username": event["username"],
                    }
                )
            )

    def build_absolute_uri(self, relative_url):
        headers = dict(self.scope.get("headers", {}))
        host = headers.get(b"host", b"localhost:8000").decode()
        scheme = "https" if self.scope.get("scheme") == "https" else "http"
        return f"{scheme}://{host}{relative_url}"

    # Database operations

    @database_sync_to_async
    def is_room_active(self):
        """Check if room is active."""
        try:
            return (
                ChatRoom.objects.filter(id=self.room_id, is_active=True)
                .filter(Q(parent__isnull=True) | Q(parent__is_active=True))
                .exists()
            )

        except Exception:
            return False

    @database_sync_to_async
    def is_room_participant(self):
        """Check if user is a participant in the room."""
        return RoomParticipant.objects.filter(
            room_id=self.room_id, user=self.user
        ).exists()

    @database_sync_to_async
    def save_message(self, content, reply_to=None):
        """Save a new message to database."""
        try:
            room = ChatRoom.objects.select_related("parent").get(
                id=self.room_id,
                is_active=True,
            )

            if room.parent and not room.parent.is_active:
                return None

            message = Message.objects.create(
                room=room,
                sender=self.user,
                content=content,
                reply_to_id=reply_to or None,
            )

            room.save(update_fields=["updated_at"])

            return Message.objects.select_related("sender", "reply_to").get(
                id=message.id
            )

        except ChatRoom.DoesNotExist:
            logger.error(f"ChatRoom not found: {self.room_id}")
            return None
        except Exception:
            logger.exception("Error saving message")
            return None

    @database_sync_to_async
    def serialize_message(self, message):
        """Serialize message for JSON response."""
        return {
            "id": str(message.id),
            "room": str(message.room_id),
            "sender": {
                "id": message.sender.id,
                "username": message.sender.username,
                "display_name": message.sender.get_display_name(),
                "avatar": (
                    self.build_absolute_uri(message.sender.avatar.url)
                    if message.sender.avatar
                    else None
                ),
                "is_online": message.sender.is_online,
            },
            "content": message.content,
            "message_type": message.message_type,
            "reply_to": str(message.reply_to_id) if message.reply_to_id else None,
            "is_edited": message.is_edited,
            "is_deleted": message.is_deleted,
            "created_at": message.created_at.isoformat(),
        }

    @database_sync_to_async
    def set_typing_status(self, is_typing):
        """Update user's typing status."""
        try:
            participant = RoomParticipant.objects.get(
                room_id=self.room_id, user=self.user
            )
            participant.set_typing(is_typing)
        except RoomParticipant.DoesNotExist:
            pass

    @database_sync_to_async
    def mark_as_read(self):
        """Mark messages as read for user."""
        try:
            participant = RoomParticipant.objects.get(
                room_id=self.room_id, user=self.user
            )
            participant.mark_as_read()
        except RoomParticipant.DoesNotExist:
            pass

    @database_sync_to_async
    def edit_message(self, message_id, new_content):
        """Edit a message and return the updated object."""
        try:
            message = Message.objects.select_related("sender", "reply_to").get(
                id=message_id, sender=self.user, is_deleted=False
            )

            message.edit(new_content)

            return message

        except Message.DoesNotExist:
            logger.warning(
                f"Message {message_id} not found or unauthorized edit attempt."
            )
            return None
        except Exception:
            logger.exception(f"Error editing message {message_id}")
            return None

    @database_sync_to_async
    def delete_message(self, message_id):
        """Soft delete a message."""
        try:
            message = Message.objects.get(
                id=message_id, sender=self.user, is_deleted=False
            )
            message.soft_delete()
            return True
        except Message.DoesNotExist:
            return False

    @database_sync_to_async
    def is_valid_reply(self, reply_to_id):
        return Message.objects.filter(
            id=reply_to_id, room_id=self.room_id, is_deleted=False
        ).exists()


class OnlineStatusConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for tracking online/offline status.
    Users connect to this to broadcast their online status.
    """

    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope["user"]

        if self.user.is_anonymous:
            await self.close()
            return

        self.status_group = "online_status"

        # Join status group
        await self.channel_layer.group_add(self.status_group, self.channel_name)

        await self.accept()

        # Set user online
        await self.set_online_status(True)

        # Broadcast online status
        await self.channel_layer.group_send(
            self.status_group,
            {
                "type": "status_update",
                "user_id": self.user.id,
                "username": self.user.username,
                "is_online": True,
            },
        )

        logger.info(f"User {self.user.username} is now online")

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if not self.user.is_anonymous:
            # Set user offline
            await self.set_online_status(False)

            # Broadcast offline status
            await self.channel_layer.group_send(
                self.status_group,
                {
                    "type": "status_update",
                    "user_id": self.user.id,
                    "username": self.user.username,
                    "is_online": False,
                },
            )

            # Leave status group
            await self.channel_layer.group_discard(self.status_group, self.channel_name)

            logger.info(f"User {self.user.username} is now offline")

    async def receive(self, text_data):
        """Handle incoming messages (heartbeat)."""
        try:
            data = json.loads(text_data)
            if data.get("type") == "heartbeat":
                await self.send(text_data=json.dumps({"type": "heartbeat_ack"}))
        except json.JSONDecodeError:
            pass

    async def status_update(self, event):
        """Send status update to WebSocket."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "status",
                    "user_id": event["user_id"],
                    "username": event["username"],
                    "is_online": event["is_online"],
                }
            )
        )

    @database_sync_to_async
    def set_online_status(self, is_online):
        """Update user's online status in database."""
        if is_online:
            self.user.set_online()
        else:
            self.user.set_offline()
