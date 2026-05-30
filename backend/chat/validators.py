import os
from django.core.exceptions import ValidationError


def validate_attachment(file):
    """
    Secure file validator
    """

    if not file:
        return file

    max_size = 10 * 1024 * 1024  # 10MB

    allowed_extensions = {
        "jpg",
        "jpeg",
        "png",
        "webp",
        "pdf",
        "txt",
        "doc",
        "docx",
        "xls",
        "xlsx",
    }

    allowed_mime_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }

    if file.size > max_size:
        raise ValidationError("File size must not exceed 10MB.")

    ext = os.path.splitext(file.name)[1].lower().replace(".", "")
    if ext not in allowed_extensions:
        raise ValidationError("This file type is not allowed.")

    if hasattr(file, "content_type"):
        if file.content_type not in allowed_mime_types:
            raise ValidationError("Invalid file type.")

    return file
