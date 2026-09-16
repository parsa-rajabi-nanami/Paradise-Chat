from rest_framework import serializers
from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

from .avatar_processing import (
    ALLOWED_IMAGE_FORMATS,
    MAX_AVATAR_DIMENSION,
    MAX_AVATAR_UPLOAD_SIZE,
)


def validate_passphrase(value: str):
    """validator for passphrase change."""
    if not value or not value.strip():
        raise serializers.ValidationError("Passphrase cannot be empty.")

    if len(value) < 16:
        raise serializers.ValidationError(
            "Passphrase must be at least 16 characters long."
        )

    return value


def validate_avatar(file):
    """Validate avatar content, not only the client-supplied filename."""

    if not file:
        return file

    try:
        if file.size > MAX_AVATAR_UPLOAD_SIZE:
            raise ValidationError("Avatar must be smaller than 5MB.")

        file.seek(0)
        img = Image.open(file)
        if img.format not in ALLOWED_IMAGE_FORMATS:
            raise ValidationError("Only JPEG, PNG, or WEBP images are allowed.")
        if max(img.size) > MAX_AVATAR_DIMENSION:
            raise ValidationError("Avatar dimensions cannot exceed 4096x4096.")
        img.verify()
        file.seek(0)
    except (
        Image.DecompressionBombError,
        UnidentifiedImageError,
        OSError,
        ValueError,
        SyntaxError,
    ):
        raise ValidationError("Uploaded file is not a valid image.")

    return file
