"""Small, private invalidations; clients reconcile summaries from the REST API."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def notify_room(room_id, receipt=None):
    from .models import RoomParticipant

    layer = get_channel_layer()
    if not layer:
        return
    if receipt is not None:
        async_to_sync(layer.group_send)(f"chat_{room_id}", receipt)
    event = {"type": "room_changed", "room_id": str(room_id)}
    if receipt is not None:
        event["receipt"] = receipt
    for user_id in RoomParticipant.objects.filter(room_id=room_id).values_list(
        "user_id", flat=True
    ):
        async_to_sync(layer.group_send)(f"user_{user_id}", event)
