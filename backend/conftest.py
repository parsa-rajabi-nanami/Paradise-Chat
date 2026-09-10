import pytest
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from chat.models import ChatRoom, RoomParticipant


@pytest.fixture
def user_factory(db):
    def create_user(username="user", email=None, **kwargs):
        email = email or f"{username}@example.com"
        return get_user_model().objects.create_user(
            email=email,
            username=username,
            password=kwargs.pop("password", "StrongPassword123!"),
            passphrase=kwargs.pop("passphrase", "a sufficiently long passphrase"),
            **kwargs,
        )

    return create_user


@pytest.fixture
def room_factory(db, user_factory):
    def create_room(owner=None, members=(), room_type="group"):
        owner = owner or user_factory("owner")
        room = ChatRoom.objects.create(
            name="Test room", room_type=room_type, created_by=owner
        )
        RoomParticipant.objects.create(room=room, user=owner, role="owner")
        for member in members:
            RoomParticipant.objects.create(room=room, user=member, role="member")
        return room

    return create_room


@pytest.fixture
def jwt_for():
    def create_token(user):
        refresh = RefreshToken.for_user(user)
        return refresh, str(refresh.access_token)

    return create_token


@pytest.fixture
def websocket_pair(user_factory, room_factory):
    sender = user_factory("ws_sender")
    recipient = user_factory("ws_recipient")
    return sender, recipient, room_factory(owner=sender, members=[recipient])


@pytest.fixture
def websocket_room(user_factory, room_factory):
    user = user_factory("ws_user")
    return user, room_factory(owner=user)


@pytest.fixture
def presence_user(user_factory):
    return user_factory("presence")


@pytest.fixture
def parity_room(user_factory, room_factory):
    user = user_factory("parity")
    return user, room_factory(owner=user)
