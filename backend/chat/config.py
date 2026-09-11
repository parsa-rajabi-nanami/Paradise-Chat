"""Small runtime configuration helpers used at request boundaries."""

from .models import ChatConfiguration

DEFAULT_MAX_MESSAGE_LENGTH = 5000
DEFAULT_MAX_ATTACHMENT_SIZE_MB = 10


def get_chat_configuration():
    """Return the singleton configuration, creating safe defaults if needed."""

    configuration, _ = ChatConfiguration.objects.get_or_create(pk=1)
    return configuration
