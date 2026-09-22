import asyncio
import os

import pytest
from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import override_settings
from django.urls import re_path
from rest_framework.test import APIClient

from chat.consumers import ChatConsumer, OnlineStatusConsumer
from chat.models import Message

os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"


pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def disable_channels_connection_cleanup_for_communicator(monkeypatch):
    """Avoid Channels' sync bridge deadlock under pytest's async loop.

    WebsocketCommunicator already patches the synchronous cleanup callback, but
    Channels 4.3 still invokes it through ``sync_to_async``. That bridge can
    deadlock in this test harness; production ASGI execution is unaffected.
    The consumer subclasses below explicitly call their wrapped sync function
    for deterministic database fixtures; this patch must not be copied into
    production code.
    """

    async def no_op():
        return None

    monkeypatch.setattr("channels.consumer.aclose_old_connections", no_op)


class CommunicatorChatConsumer(ChatConsumer):
    """Use committed worker-thread calls while retaining production handlers."""

    async def is_room_active(self):
        return True

    async def is_room_participant(self):
        return True

    async def save_message(self, content, reply_to=None):
        return ChatConsumer.__dict__["save_message"].func(self, content, reply_to)

    async def serialize_message(self, message):
        return ChatConsumer.__dict__["serialize_message"].func(self, message)

    async def set_typing_status(self, is_typing):
        return ChatConsumer.__dict__["set_typing_status"].func(self, is_typing)

    async def mark_as_read(self):
        return ChatConsumer.__dict__["mark_as_read"].func(self)

    async def edit_message(self, message_id, new_content):
        return ChatConsumer.__dict__["edit_message"].func(self, message_id, new_content)

    async def delete_message(self, message_id):
        return ChatConsumer.__dict__["delete_message"].func(self, message_id)

    async def is_valid_reply(self, reply_to_id):
        return ChatConsumer.__dict__["is_valid_reply"].func(self, reply_to_id)


class CommunicatorOnlineStatusConsumer(OnlineStatusConsumer):
    async def set_online_status(self, is_online):
        return OnlineStatusConsumer.__dict__["set_online_status"].func(self, is_online)

    async def get_online_users(self):
        return OnlineStatusConsumer.__dict__["get_online_users"].func(self)


def application_for_user(user, consumer_class, route):
    router = URLRouter([re_path(route, consumer_class.as_asgi())])

    async def application(scope, receive, send):
        authenticated_scope = dict(scope)
        authenticated_scope["user"] = user
        return await router(authenticated_scope, receive, send)

    return application


async def connect_room(user, room):
    from rest_framework_simplejwt.tokens import AccessToken

    access = AccessToken.for_user(user)
    communicator = WebsocketCommunicator(
        application_for_user(
            user,
            CommunicatorChatConsumer,
            r"ws/chat/(?P<room_id>[0-9a-f-]+)/$",
        ),
        f"/ws/chat/{room.id}/?token={access}",
        headers=[(b"origin", b"http://testserver")],
    )
    connected, detail = await asyncio.wait_for(communicator.connect(), timeout=5)
    assert connected is True, f"WebSocket rejected: {connected}, detail={detail}"
    return communicator


async def _chat_consumer_message_typing_read_edit_delete(websocket_pair):
    sender, recipient, room = websocket_pair

    sender_socket = await connect_room(sender, room)
    recipient_socket = await connect_room(recipient, room)
    join_event = await sender_socket.receive_json_from()
    assert join_event["type"] == "user_join"

    await sender_socket.send_json_to({"type": "message", "content": "hello"})
    sender_message = await sender_socket.receive_json_from()
    recipient_message = await recipient_socket.receive_json_from()
    assert sender_message["type"] == recipient_message["type"] == "message"
    message_id = sender_message["message"]["id"]
    assert sender_message["message"]["content"] == "hello"

    await sender_socket.send_json_to({"type": "typing", "is_typing": True})
    typing = await recipient_socket.receive_json_from()
    assert typing["type"] == "typing"
    assert typing["is_typing"] is True

    await sender_socket.send_json_to({"type": "read"})
    read = await recipient_socket.receive_json_from()
    assert read["type"] == "read"
    assert read["user_id"] == sender.id

    await sender_socket.send_json_to(
        {"type": "edit", "message_id": message_id, "content": "edited"}
    )
    edited = await recipient_socket.receive_json_from()
    assert edited["type"] == "edit"
    assert edited["message"]["content"] == "edited"

    await sender_socket.send_json_to({"type": "delete", "message_id": message_id})
    deleted = await recipient_socket.receive_json_from()
    assert deleted == {"type": "delete", "message_id": message_id}

    await sender_socket.disconnect()
    await recipient_socket.disconnect()


def test_chat_consumer_message_typing_read_edit_delete(websocket_pair):
    async_to_sync(_chat_consumer_message_typing_read_edit_delete)(websocket_pair)


async def _chat_consumer_rate_guard(websocket_room):
    user, room = websocket_room
    with override_settings(WS_RATE_LIMIT_MESSAGES=2, WS_RATE_LIMIT_WINDOW_SECONDS=60):
        socket = await connect_room(user, room)
        await socket.send_json_to({"type": "unknown"})
        await socket.send_json_to({"type": "unknown"})
        await socket.send_json_to({"type": "unknown"})
        assert (await socket.receive_json_from())["code"] == "unsupported_type"
        assert (await socket.receive_json_from())["code"] == "unsupported_type"
        limited = await socket.receive_json_from()
        assert limited["type"] == "error"
        assert limited["code"] == "rate_limited"
        await socket.disconnect()


def test_chat_consumer_rate_guard(websocket_room):
    async_to_sync(_chat_consumer_rate_guard)(websocket_room)


async def _chat_consumer_rejects_invalid_payload(websocket_room):
    user, room = websocket_room
    socket = await connect_room(user, room)

    await socket.send_json_to([])
    invalid_payload = await socket.receive_json_from()
    assert invalid_payload["code"] == "invalid_payload"

    await socket.send_json_to(
        {"type": "message", "content": "hello", "reply_to": "bad-id"}
    )
    invalid_reply = await socket.receive_json_from()
    assert invalid_reply["code"] == "invalid_reply"

    await socket.send_json_to({"type": "heartbeat"})
    assert await socket.receive_json_from() == {"type": "heartbeat_ack"}
    await socket.disconnect()


def test_chat_consumer_rejects_invalid_payload(websocket_room):
    async_to_sync(_chat_consumer_rejects_invalid_payload)(websocket_room)


async def _chat_consumer_rejects_anonymous():
    socket = WebsocketCommunicator(
        application_for_user(
            AnonymousUser(),
            CommunicatorChatConsumer,
            r"ws/chat/(?P<room_id>[0-9a-f-]+)/$",
        ),
        "/ws/chat/00000000-0000-0000-0000-000000000000/",
        headers=[(b"origin", b"http://testserver")],
    )
    connected, close_code = await socket.connect()
    assert connected is False
    assert close_code == 4003


def test_chat_consumer_rejects_anonymous():
    async_to_sync(_chat_consumer_rejects_anonymous)()


async def _online_status_heartbeat(presence_user):
    user = presence_user
    from rest_framework_simplejwt.tokens import AccessToken

    access = AccessToken.for_user(user)
    socket = WebsocketCommunicator(
        application_for_user(user, CommunicatorOnlineStatusConsumer, r"ws/status/$"),
        f"/ws/status/?token={access}",
        headers=[(b"origin", b"http://testserver")],
    )
    connected, _ = await socket.connect()
    assert connected is True
    status = await socket.receive_json_from()
    assert status["type"] == "status"
    assert status["is_online"] is True

    await socket.send_json_to({"type": "heartbeat"})
    assert await socket.receive_json_from() == {"type": "heartbeat_ack"}
    await socket.disconnect()

    assert get_user_model().objects.get(id=user.id).is_online is False


def test_online_status_heartbeat(presence_user):
    async_to_sync(_online_status_heartbeat)(presence_user)


def test_online_status_sends_snapshot_for_existing_connections(
    presence_user, user_factory
):
    existing_user = user_factory("already_online")

    async def connect_and_receive_snapshot():
        existing = CommunicatorOnlineStatusConsumer()
        existing.user = existing_user
        await existing.set_online_status(True)

        from rest_framework_simplejwt.tokens import AccessToken

        access = AccessToken.for_user(presence_user)
        socket = WebsocketCommunicator(
            application_for_user(
                presence_user, CommunicatorOnlineStatusConsumer, r"ws/status/$"
            ),
            f"/ws/status/?token={access}",
            headers=[(b"origin", b"http://testserver")],
        )
        connected, _ = await socket.connect()
        assert connected is True

        statuses = [await socket.receive_json_from() for _ in range(2)]
        assert {status["user_id"] for status in statuses} == {
            existing_user.id,
            presence_user.id,
        }

        await socket.disconnect()
        await existing.set_online_status(False)

    async_to_sync(connect_and_receive_snapshot)()


def test_presence_stays_online_until_last_connection_closes(presence_user):
    async def open_and_close_connections():
        first = CommunicatorOnlineStatusConsumer()
        first.user = presence_user
        second = CommunicatorOnlineStatusConsumer()
        second.user = presence_user

        await first.set_online_status(True)
        await second.set_online_status(True)
        await first.set_online_status(False)
        assert get_user_model().objects.get(id=presence_user.id).is_online is True

        await second.set_online_status(False)
        assert get_user_model().objects.get(id=presence_user.id).is_online is False

    async_to_sync(open_and_close_connections)()


class RecordingLayer:
    def __init__(self):
        self.events = []

    async def group_send(self, group, event):
        self.events.append((group, event))


async def _ws_message_for_parity(user, room, rest_event):
    ws_layer = RecordingLayer()
    consumer = CommunicatorChatConsumer()
    consumer.room_id = str(room.id)
    consumer.room_group_name = f"chat_{room.id}"
    consumer.user = user
    consumer.channel_layer = ws_layer
    await consumer.handle_message({"type": "message", "content": "WS"})
    ws_event = ws_layer.events[-1][1]

    assert rest_event["type"] == ws_event["type"] == "chat_message"
    assert set(rest_event["message"]) == set(ws_event["message"])


def test_rest_and_ws_message_broadcast_shapes_match(parity_room, monkeypatch):
    user, room = parity_room
    rest_layer = RecordingLayer()
    monkeypatch.setattr("chat.views.get_channel_layer", lambda: rest_layer)
    from rest_framework_simplejwt.tokens import AccessToken

    access = AccessToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    response = client.post(
        f"/api/chat/rooms/{room.id}/messages/", {"content": "REST"}, format="multipart"
    )
    assert response.status_code == 201
    rest_event = rest_layer.events[-1][1]
    async_to_sync(_ws_message_for_parity)(user, room, rest_event)


def test_websocket_media_urls_use_public_host_and_scheme(
    user_factory, room_factory, tmp_path
):
    user = user_factory("ws_media_user")
    room = room_factory(owner=user)

    with override_settings(MEDIA_ROOT=tmp_path):
        user.avatar.save("avatar.png", ContentFile(b"avatar"), save=True)
        message = Message.objects.create(
            room=room, sender=user, content="realtime avatar"
        )

        consumer = CommunicatorChatConsumer()
        consumer.scope = {
            "headers": [(b"host", b"127.0.0.1:8080")],
            "scheme": "wss",
        }
        serialized = async_to_sync(consumer.serialize_message)(message)

    assert serialized["sender"]["avatar"].startswith(
        f"https://127.0.0.1:8080/api/auth/users/{user.id}/avatar/?v="
    )


def test_websocket_edit_and_delete_are_bound_to_connected_room(
    user_factory, room_factory
):
    user = user_factory("room_bound_user")
    first_room = room_factory(owner=user)
    second_room = room_factory(owner=user)
    message = Message.objects.create(
        room=first_room, sender=user, content="must stay private"
    )

    async def attempt_cross_room_mutation():
        consumer = CommunicatorChatConsumer()
        consumer.room_id = str(second_room.id)
        consumer.user = user
        assert await consumer.edit_message(message.id, "changed") is None
        assert await consumer.delete_message(message.id) is False

    async_to_sync(attempt_cross_room_mutation)()
    message.refresh_from_db()
    assert message.content == "must stay private"
    assert message.is_deleted is False
