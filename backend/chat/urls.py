"""
URL patterns for chat app.
"""

from django.urls import path
from .views import (
    ChatRoomListView,
    ChatRoomDetailView,
    ManageParticipantView,
    MessageListView,
    MessageDetailView,
    MessageAttachmentView,
    RoomAvatarView,
    DirectMessageView,
    MarkAsReadView,
    TypingStatusView,
)

urlpatterns = [
    # Rooms
    path("rooms/", ChatRoomListView.as_view(), name="room_list"),
    path("rooms/<uuid:room_id>/", ChatRoomDetailView.as_view(), name="room_detail"),
    # Participants
    path(
        "rooms/<uuid:room_id>/participants/<int:user_id>/",
        ManageParticipantView.as_view(),
        name="manage_participant",
    ),
    # Messages
    path(
        "rooms/<uuid:room_id>/messages/", MessageListView.as_view(), name="message_list"
    ),
    path(
        "rooms/<uuid:room_id>/messages/<uuid:message_id>/",
        MessageDetailView.as_view(),
        name="message_detail",
    ),
    path(
        "messages/<uuid:message_id>/attachment/",
        MessageAttachmentView.as_view(),
        name="message_attachment",
    ),
    path(
        "rooms/<uuid:room_id>/avatar/",
        RoomAvatarView.as_view(),
        name="room_avatar",
    ),
    # Actions
    path("direct/", DirectMessageView.as_view(), name="direct_message"),
    path("rooms/<uuid:room_id>/read/", MarkAsReadView.as_view(), name="mark_as_read"),
    path(
        "rooms/<uuid:room_id>/typing/", TypingStatusView.as_view(), name="typing_status"
    ),
]
