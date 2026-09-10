from rest_framework import serializers
from django.core.exceptions import ValidationError
from PIL import Image
import os


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
    """Validate avatar image (type, size, dimensions)."""

    if not file:
        return file

    max_size = 0.5 * 1024 * 1024  # 500KB
    allowed_extensions = {"jpg", "jpeg", "png", "webp"}

    if file.size > max_size:
        raise ValidationError("Avatar must be smaller than 500KB.")

    ext = os.path.splitext(file.name)[1].lower().replace(".", "")
    if ext not in allowed_extensions:
        raise ValidationError("Only JPG, JPEG, PNG, or WEBP images are allowed.")

    try:
        img = Image.open(file)

        width, height = img.size
        if width > 2000 or height > 2000:
            raise ValidationError("Avatar dimensions cannot exceed 2000x2000.")

        img.verify()
        file.seek(0)
    except Exception:
        raise ValidationError("Uploaded file is not a valid image.")

    return file
