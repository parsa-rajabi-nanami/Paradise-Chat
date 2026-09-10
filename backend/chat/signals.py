from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import Message


@receiver(post_delete, sender=Message)
def delete_message_attachment(sender, instance, **kwargs):
    """
    Deletes the physical file from storage when the corresponding
    """

    if instance.attachment and instance.attachment.name:
        # Use Django's storage abstraction rather than assuming local disk.
        instance.attachment.delete(save=False)
