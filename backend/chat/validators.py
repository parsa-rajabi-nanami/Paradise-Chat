import os
import magic

from django.core.exceptions import ValidationError


def validate_attachment(file):
    """
    Secure file validator
    """

    if not file:
        return file

    max_size = 10 * 1024 * 1024  # 10MB

    allowed_extensions = {
        # Images
        "jpg",
        "jpeg",
        "png",
        "webp",
        # Documents
        "pdf",
        "txt",
        "doc",
        "docx",
        # Spreadsheets
        "xls",
        "xlsx",
        # Archives
        "zip",
    }

    allowed_mime_types = {
        # Images
        "image/jpeg",
        "image/png",
        "image/webp",
        # Documents
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        # Excel
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        # Zip
        "application/zip",
    }

    if file.size > max_size:
        raise ValidationError("File size must not exceed 10MB.")

    ext = os.path.splitext(file.name)[1].lower().replace(".", "")
    if ext not in allowed_extensions:
        raise ValidationError("This file type is not allowed.")

    # Validate the actual MIME type
    try:
        file.seek(0)
        detected_mime_type = magic.from_buffer(
            file.read(2048),
            mime=True,
        )
        file.seek(0)
        if detected_mime_type not in allowed_mime_types:
            raise ValidationError(
                "The uploaded file content does not match an allowed file type."
            )
    except Exception:
        raise ValidationError("Unable to verify the uploaded file type.")

    return file
