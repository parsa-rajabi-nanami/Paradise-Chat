"""
WebSocket consumers for real-time chat functionality.
Handles messaging, typing indicators, and online status.
"""

import asyncio
import json
import logging
import time
import uuid
from collections import deque
from datetime import timedelta

from django.conf import settings
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q
from .models import ChatRoom, Message, RoomParticipant
from .config import get_chat_configuration
from accounts.models import UserPresence
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
        self.joined_room = False
        self._rate_limit_events = deque()

        # Reject if not authenticated
        if self.user.is_anonymous:
            logger.warning(
                f"Rejected anonymous WebSocket connection to room {self.room_id}"
            )
            await self.close(code=4003)
            return

        # Check if room is active
        if not await self.is_room_active():
            logger.warning(
                f"Rejected connection: Room {self.room_id} is inactive or does not exist"
            )
            await self.close(code=4003)
            return

        # Verify user is a participant
        if not await self.is_room_participant():
            logger.warning(f"User {self.user.id} not in room {self.room_id}")
            await self.close(code=4003)
            return

        # Join room group
        try:
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            self.joined_room = True
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
        except Exception:
            logger.exception("Unable to establish room WebSocket session")
            if self.joined_room:
                try:
                    await self.channel_layer.group_discard(
                        self.room_group_name, self.channel_name
                    )
                except Exception:
                    logger.debug(
                        "Unable to discard failed room WebSocket session", exc_info=True
                    )
            self.joined_room = False
            await self.close(code=1013)
            return

        logger.info(f"User {self.user.username} connected to room {self.room_id}")

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if getattr(self, "joined_room", False) and not self.user.is_anonymous:
            # Clear typing status
            await self.set_typing_status(False)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "typing_indicator",
                    "user_id": self.user.id,
                    "username": self.user.username,
                    "is_typing": False,
                },
            )

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
        if not await self.refresh_authenticated_user():
            return

        if not self._allow_incoming_frame():
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "code": "rate_limited",
                        "detail": "Too many messages.",
                    }
                )
            )
            return

        try:
            data = json.loads(text_data)
            if not isinstance(data, dict):
                await self.send_error("invalid_payload", "A JSON object is required.")
                return

            message_type = data.get("type")

            if message_type == "heartbeat":
                await self.send(text_data=json.dumps({"type": "heartbeat_ack"}))
                return

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
                await self.send_error("unsupported_type", "Unsupported message type.")

        except json.JSONDecodeError:
            await self.send_error("invalid_json", "Invalid JSON payload.")
        except Exception as e:
            logger.error(f"Error handling message: {e}")

    async def send_error(self, code, detail):
        """Return a stable protocol error without exposing server internals."""
        await self.send(
            text_data=json.dumps({"type": "error", "code": code, "detail": detail})
        )

    async def refresh_authenticated_user(self):
        """Revalidate middleware-provided JWTs during long-lived sessions."""
        token = self.scope.get("auth_token")
        if not token:
            return not self.user.is_anonymous

        from .middleware import get_user_from_token

        user = await get_user_from_token(token)
        if user.is_anonymous:
            await self.close(code=4001)
            return False
        self.user = user
        return True

    def _allow_incoming_frame(self):
        """Apply a small sliding-window guard to this authenticated connection."""
        now = time.monotonic()
        window = float(getattr(settings, "WS_RATE_LIMIT_WINDOW_SECONDS", 10))
        limit = int(getattr(settings, "WS_RATE_LIMIT_MESSAGES", 30))
        cutoff = now - window
        while self._rate_limit_events and self._rate_limit_events[0] <= cutoff:
            self._rate_limit_events.popleft()
        if len(self._rate_limit_events) >= limit:
            return False
        self._rate_limit_events.append(now)
        return True

    async def handle_message(self, data):
        """Handle new text message."""
        raw_content = data.get("content", "")
        if not isinstance(raw_content, str):
            return
        content = raw_content.strip()
        reply_to = data.get("reply_to")

        if reply_to:
            try:
                reply_to = str(uuid.UUID(str(reply_to)))
            except (ValueError, TypeError, AttributeError):
                await self.send_error("invalid_reply", "reply_to must be a UUID.")
                return
            valid_reply = await self.is_valid_reply(reply_to)
            if not valid_reply:
                await self.send_error("invalid_reply", "Reply target is not available.")
                return

        if not content:
            await self.send_error("invalid_message", "Message content cannot be empty.")
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
        if not isinstance(is_typing, bool):
            return

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
        from .serializers import ReadReceiptSerializer

        payload = ReadReceiptSerializer(data=data)
        if not payload.is_valid():
            await self.send_error("invalid_read", "Expected up to 100 message UUIDs.")
            return
        self.read_message_ids = payload.validated_data.get("message_ids")
        receipt = await self.mark_as_read()
        if receipt:
            await self.channel_layer.group_send(self.room_group_name, receipt)

    async def handle_edit(self, data):
        """Handle message edit."""
        message_id = data.get("message_id")
        raw_content = data.get("content", "")
        if not isinstance(raw_content, str):
            return
        new_content = raw_content.strip()

        if not message_id or not new_content:
            await self.send_error(
                "invalid_message", "A message ID and content are required."
            )
            return

        try:
            message_id = str(uuid.UUID(str(message_id)))
        except (ValueError, TypeError, AttributeError):
            await self.send_error("invalid_message", "message_id must be a UUID.")
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
            await self.send_error("invalid_message", "message_id is required.")
            return

        try:
            message_id = str(uuid.UUID(str(message_id)))
        except (ValueError, TypeError, AttributeError):
            await self.send_error("invalid_message", "message_id must be a UUID.")
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
                    "room_id": event["room_id"],
                    "message_ids": event["message_ids"],
                }
            )
        )

    async def room_changed(self, event):
        """Refresh a sidebar summary when another session changes a room."""
        await self.send(
            text_data=json.dumps({"type": "room_changed", "room_id": event["room_id"]})
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
        scope = getattr(self, "scope", {})
        headers = dict(scope.get("headers", {}))
        host = headers.get(b"host", b"localhost:8000").decode()
        forwarded_proto = headers.get(b"x-forwarded-proto", b"").decode()
        scheme = forwarded_proto.split(",", 1)[0].strip().lower()
        if scheme not in {"http", "https"}:
            scheme = "https" if scope.get("scheme") in {"https", "wss"} else "http"
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
            room_id=self.room_id,
            user=self.user,
            user__is_active=True,
            user__is_deleted=False,
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

            if not RoomParticipant.objects.filter(room=room, user=self.user).exists():
                return None

            if len(content) > get_chat_configuration().max_message_length:
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
        # Keep the WS message payload fields aligned with MessageSerializer,
        # which is also used by the REST broadcast path.
        return MessageSerializer(
            message, context={"base_url": self.build_absolute_uri("")}
        ).data

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
            return participant.mark_as_read(getattr(self, "read_message_ids", None))
        except RoomParticipant.DoesNotExist:
            pass

    @database_sync_to_async
    def edit_message(self, message_id, new_content):
        """Edit a message and return the updated object."""
        try:
            message = Message.objects.select_related(
                "sender", "reply_to", "room__parent"
            ).get(
                id=message_id,
                room_id=self.room_id,
                room__is_active=True,
                sender=self.user,
                is_deleted=False,
            )
            if message.room.parent_id and not message.room.parent.is_active:
                return None
            if len(new_content) > get_chat_configuration().max_message_length:
                return None

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
            message = Message.objects.select_related("room__parent").get(
                id=message_id,
                room_id=self.room_id,
                room__is_active=True,
                sender=self.user,
                is_deleted=False,
            )
            if message.room.parent_id and not message.room.parent.is_active:
                return False
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
            await self.close(code=4003)
            return

        self.status_group = "online_status"
        self.user_group = f"user_{self.user.id}"

        # Join status group
        await self.channel_layer.group_add(self.status_group, self.channel_name)
        await self.channel_layer.group_add(self.user_group, self.channel_name)

        await self.accept()

        # Set user online
        await self.set_online_status(True)

        # Send a snapshot so a newly connected client does not have to wait
        # for every other user to reconnect before their status is known.
        online_users, offline_user_ids = await self.get_online_users()
        for online_user in online_users:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "status",
                        "user_id": online_user["id"],
                        "username": online_user["username"],
                        "is_online": True,
                    }
                )
            )

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

        for user_id in offline_user_ids:
            await self.channel_layer.group_send(
                self.status_group,
                {
                    "type": "status_update",
                    "user_id": user_id,
                    "is_online": False,
                },
            )

        logger.info(f"User {self.user.username} is now online")

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if not self.user.is_anonymous:
            # Set user offline
            became_offline = await self.set_online_status(False)

            # Broadcast offline only when the last tab/device disconnected.
            if became_offline:
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
            await self.channel_layer.group_discard(self.user_group, self.channel_name)

            logger.info(f"User {self.user.username} is now offline")

    async def receive(self, text_data):
        """Handle incoming messages (heartbeat)."""
        if not await self.refresh_authenticated_user():
            return
        try:
            data = json.loads(text_data)
            if data.get("type") == "heartbeat":
                await self.send(text_data=json.dumps({"type": "heartbeat_ack"}))
                asyncio.create_task(self._touch_presence_safely())
                stale_user_ids = await self.expire_stale_presence()
                for user_id in stale_user_ids:
                    await self.channel_layer.group_send(
                        self.status_group,
                        {
                            "type": "status_update",
                            "user_id": user_id,
                            "is_online": False,
                        },
                    )
        except json.JSONDecodeError:
            pass

    async def refresh_authenticated_user(self):
        """Revalidate the JWT on heartbeat for long-lived status sessions."""
        token = self.scope.get("auth_token")
        if not token:
            return not self.user.is_anonymous

        from .middleware import get_user_from_token

        user = await get_user_from_token(token)
        if user.is_anonymous:
            await self.close(code=4001)
            return False
        self.user = user
        return True

    async def _touch_presence_safely(self):
        try:
            await self.touch_presence()
        except Exception:
            logger.debug("Unable to update presence heartbeat", exc_info=True)

    @database_sync_to_async
    def expire_stale_presence(self):
        cutoff = timezone.now() - timedelta(seconds=90)
        stale_ids = set(
            UserPresence.objects.filter(last_heartbeat__lt=cutoff).values_list(
                "user_id", flat=True
            )
        )
        UserPresence.objects.filter(last_heartbeat__lt=cutoff).delete()
        still_active = set(
            UserPresence.objects.filter(user_id__in=stale_ids).values_list(
                "user_id", flat=True
            )
        )
        expired = stale_ids - still_active
        if expired:
            User.objects.filter(id__in=expired).update(
                is_online=False, last_seen=timezone.now()
            )
        return list(expired)

    async def status_update(self, event):
        """Send status update to WebSocket."""
        # The connecting client receives its own state in the snapshot above.
        if event["user_id"] == self.user.id:
            return
        await self.send(
            text_data=json.dumps(
                {
                    "type": "status",
                    "user_id": event["user_id"],
                    "username": event.get("username", ""),
                    "is_online": event["is_online"],
                }
            )
        )

    async def room_changed(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "room_changed",
                    "room_id": event["room_id"],
                    "receipt": event.get("receipt"),
                }
            )
        )

    @database_sync_to_async
    def set_online_status(self, is_online):
        """Update user's online status in database."""
        if is_online:
            UserPresence.objects.filter(
                user=self.user,
                last_heartbeat__lt=timezone.now() - timedelta(seconds=90),
            ).delete()
            presence = UserPresence.objects.create(user=self.user)
            self.presence_id = presence.id
            self.user.set_online()
            return True
        else:
            if getattr(self, "presence_id", None):
                UserPresence.objects.filter(
                    id=self.presence_id, user=self.user
                ).delete()
            if UserPresence.objects.filter(user=self.user).exists():
                return False
            self.user.set_offline()
            return True

    @database_sync_to_async
    def touch_presence(self):
        if getattr(self, "presence_id", None):
            UserPresence.objects.filter(id=self.presence_id, user=self.user).update(
                last_heartbeat=timezone.now()
            )

    @database_sync_to_async
    def get_online_users(self):
        """Return users with a presence heartbeat within the timeout window."""
        cutoff = timezone.now() - timedelta(seconds=90)
        stale_user_ids = set(
            UserPresence.objects.filter(last_heartbeat__lt=cutoff)
            .values_list("user_id", flat=True)
            .distinct()
        )
        UserPresence.objects.filter(last_heartbeat__lt=cutoff).delete()

        users_to_mark_offline = set()
        if stale_user_ids:
            active_presence_user_ids = set(
                UserPresence.objects.filter(
                    user_id__in=stale_user_ids, last_heartbeat__gte=cutoff
                )
                .values_list("user_id", flat=True)
                .distinct()
            )
            users_to_mark_offline = stale_user_ids - active_presence_user_ids
            if users_to_mark_offline:
                User.objects.filter(id__in=users_to_mark_offline).update(
                    is_online=False, last_seen=timezone.now()
                )

        online_users = list(
            User.objects.filter(
                presence_connections__last_heartbeat__gte=cutoff,
                is_active=True,
                is_deleted=False,
            )
            .values("id", "username")
            .distinct()
        )
        return online_users, list(users_to_mark_offline)
