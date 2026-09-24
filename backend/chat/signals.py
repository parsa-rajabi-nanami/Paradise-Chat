from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from .models import Message
from accounts.models import User


@receiver(post_delete, sender=Message)
def delete_message_attachment(sender, instance, **kwargs):
    """
    Deletes the physical file from storage when the corresponding
    """

    if instance.attachment and instance.attachment.name:
        # Use Django's storage abstraction rather than assuming local disk.
        instance.attachment.delete(save=False)


@receiver(post_delete, sender=User)
def delete_user_avatars(sender, instance, **kwargs):
    for field in (instance.avatar, instance.avatar_thumbnail):
        if field and field.name:
            field.delete(save=False)


@receiver(post_save, sender=Message)
def notify_message_change(sender, instance, **kwargs):
    from django.db import transaction
    from .events import notify_room

    room_id = instance.room_id

    def publish():
        try:
            notify_room(room_id)
        except RuntimeError:
            # Async consumers publish their own room events after the DB write.
            pass

    transaction.on_commit(publish, robust=True)
