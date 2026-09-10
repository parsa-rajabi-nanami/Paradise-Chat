import pytest
from django.core.files.base import ContentFile
from django.test import override_settings
from rest_framework.test import APIClient

from chat.models import Message, RoomParticipant


pytestmark = pytest.mark.django_db


def authenticated_client(user, jwt_for):
    _, access = jwt_for(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return client


def test_manage_participant_role_matrix(user_factory, room_factory, jwt_for):
    owner = user_factory("owner")
    admin = user_factory("admin")
    member = user_factory("member")
    other_member = user_factory("other")
    remove_target = user_factory("remove_target")
    room = room_factory(
        owner=owner, members=[admin, member, other_member, remove_target]
    )
    RoomParticipant.objects.filter(room=room, user=admin).update(role="admin")

    owner_client = authenticated_client(owner, jwt_for)
    admin_client = authenticated_client(admin, jwt_for)
    member_client = authenticated_client(other_member, jwt_for)

    url = f"/api/chat/rooms/{room.id}/participants/{member.id}/"
    assert owner_client.patch(url, {"role": "admin"}, format="json").status_code == 200

    # Admins cannot change roles, including their own or another member's.
    assert admin_client.patch(url, {"role": "owner"}, format="json").status_code == 403
    assert (
        member_client.post(
            f"/api/chat/rooms/{room.id}/participants/{remove_target.id}/"
        ).status_code
        == 403
    )

    # Admins may remove members, but not admins or owners.
    remove_member = f"/api/chat/rooms/{room.id}/participants/{remove_target.id}/"
    assert admin_client.delete(remove_member).status_code == 200
    admin_target = f"/api/chat/rooms/{room.id}/participants/{owner.id}/"
    assert admin_client.delete(admin_target).status_code == 403


def test_message_lifecycle_excludes_soft_deleted_and_cleans_attachment(
    user_factory, room_factory, jwt_for, tmp_path
):
    user = user_factory("sender")
    room = room_factory(owner=user)
    client = authenticated_client(user, jwt_for)

    created = client.post(
        f"/api/chat/rooms/{room.id}/messages/",
        {"content": "hello"},
        format="multipart",
    )
    assert created.status_code == 201
    message_id = created.json()["id"]

    updated = client.patch(
        f"/api/chat/rooms/{room.id}/messages/{message_id}/",
        {"content": "edited"},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.json()["content"] == "edited"

    message = Message.objects.get(id=message_id)
    with override_settings(MEDIA_ROOT=tmp_path):
        message.attachment.save("payload.txt", ContentFile(b"attachment"), save=True)
        stored_name = message.attachment.name
        stored_path = tmp_path / stored_name
        assert stored_path.exists()
        message.delete()
        assert not stored_path.exists()

    deleted = client.delete(f"/api/chat/rooms/{room.id}/messages/{message_id}/")
    # The message was hard-deleted above only for the signal test; normal API
    # deletion remains a soft delete, so create a fresh message for that path.
    assert deleted.status_code == 404

    fresh = client.post(
        f"/api/chat/rooms/{room.id}/messages/",
        {"content": "to delete"},
        format="multipart",
    )
    fresh_id = fresh.json()["id"]
    assert (
        client.delete(f"/api/chat/rooms/{room.id}/messages/{fresh_id}/").status_code
        == 204
    )
    soft_deleted = Message.objects.get(id=fresh_id)
    assert soft_deleted.is_deleted is True
    assert soft_deleted.content == "This message has been deleted"
    listed = client.get(f"/api/chat/rooms/{room.id}/messages/")
    assert all(item["id"] != fresh_id for item in listed.json()["results"])
