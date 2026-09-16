"""Request throttles for authenticated file-upload mutations."""

from rest_framework.throttling import UserRateThrottle


class FileUploadRateThrottle(UserRateThrottle):
    """Limit profile, room-avatar, and message-upload mutations."""

    scope = "upload"
