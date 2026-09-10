import asyncio
import os

import pytest
from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import re_path
from rest_framework.test import APIClient

from chat.consumers import ChatConsumer, OnlineStatusConsumer

os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"


pytestmark = pytest.mark.django_db(transaction=True)


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
        limited = await socket.receive_json_from()
        assert limited["type"] == "error"
        assert limited["code"] == "rate_limited"
        await socket.disconnect()


def test_chat_consumer_rate_guard(websocket_room):
    async_to_sync(_chat_consumer_rate_guard)(websocket_room)


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
