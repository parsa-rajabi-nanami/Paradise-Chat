"""Validate and normalize avatar uploads before they reach media storage."""

from io import BytesIO
import uuid

from django.core.files.base import ContentFile
from rest_framework import serializers
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_AVATAR_UPLOAD_SIZE = 5 * 1024 * 1024
MAX_AVATAR_DIMENSION = 4096
AVATAR_SIZE = (512, 512)
AVATAR_THUMBNAIL_SIZE = (96, 96)
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def _open_verified_image(upload):
    if upload.size > MAX_AVATAR_UPLOAD_SIZE:
        raise serializers.ValidationError("Avatar must be smaller than 5MB.")

    try:
        upload.seek(0)
        with Image.open(upload) as candidate:
            image_format = candidate.format
            candidate.verify()

        if image_format not in ALLOWED_IMAGE_FORMATS:
            raise serializers.ValidationError(
                "Only JPEG, PNG, or WEBP images are allowed."
            )

        upload.seek(0)
        image = Image.open(upload)
        if max(image.size) > MAX_AVATAR_DIMENSION:
            raise serializers.ValidationError(
                "Avatar dimensions cannot exceed 4096x4096."
            )
        return image
    except serializers.ValidationError:
        raise
    except (
        Image.DecompressionBombError,
        UnidentifiedImageError,
        OSError,
        ValueError,
        SyntaxError,
    ):
        raise serializers.ValidationError("Uploaded file is not a valid image.")


def _encode_webp(image, size):
    normalized = ImageOps.fit(
        image.convert("RGB"),
        size,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    output = BytesIO()
    normalized.save(output, format="WEBP", quality=86, method=6)
    return output.getvalue()


def process_avatar(upload):
    """Return a square WebP avatar and a small WebP list thumbnail."""

    image = _open_verified_image(upload)
    try:
        image = ImageOps.exif_transpose(image)
        avatar_data = _encode_webp(image, AVATAR_SIZE)
        thumbnail_data = _encode_webp(image, AVATAR_THUMBNAIL_SIZE)
    finally:
        image.close()

    identifier = uuid.uuid4().hex
    return (
        ContentFile(avatar_data, name=f"{identifier}.webp"),
        ContentFile(thumbnail_data, name=f"{identifier}.webp"),
    )
