"""HTTP correlation-id middleware."""

import uuid


MAX_REQUEST_ID_LENGTH = 128


class RequestIDMiddleware:
    """Propagate a bounded request ID to responses and downstream logs."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-ID", "")
        valid_request_id = (
            request_id
            and len(request_id) <= MAX_REQUEST_ID_LENGTH
            and all(
                char
                in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
                for char in request_id
            )
        )
        request.request_id = request_id if valid_request_id else uuid.uuid4().hex
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        return response
