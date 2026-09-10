import os

import magic

from django.core.exceptions import ValidationError


MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
ALLOWED_ATTACHMENT_TYPES = {
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "png": {"image/png"},
    "webp": {"image/webp"},
    "pdf": {"application/pdf"},
    "txt": {"text/plain"},
    "doc": {"application/msword"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    "xls": {"application/vnd.ms-excel"},
    "xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    "zip": {"application/zip", "application/x-zip-compressed"},
}
FORBIDDEN_EXTENSIONS = {
    "bat",
    "cmd",
    "com",
    "dll",
    "exe",
    "htm",
    "html",
    "ini",
    "js",
    "mjs",
    "php",
    "py",
    "rb",
    "sh",
    "svg",
    "wasm",
}


def validate_attachment(file):
    """
    Secure file validator
    """

    if not file:
        return file

    if file.size > MAX_ATTACHMENT_SIZE:
        raise ValidationError("File size must not exceed 10MB.")

    filename = os.path.basename(file.name or "")
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    if ext in FORBIDDEN_EXTENSIONS or ext not in ALLOWED_ATTACHMENT_TYPES:
        raise ValidationError("This file type is not allowed.")

    # Validate the actual MIME type
    try:
        file.seek(0)
        detected_mime_type = magic.from_buffer(
            file.read(2048),
            mime=True,
        )
        file.seek(0)
        if detected_mime_type not in ALLOWED_ATTACHMENT_TYPES[ext]:
            raise ValidationError(
                "The uploaded file content does not match an allowed file type."
            )
    except ValidationError:
        raise
    except Exception:
        raise ValidationError("Unable to verify the uploaded file type.")

    return file
