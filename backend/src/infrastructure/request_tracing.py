from contextvars import ContextVar
from uuid import uuid4

from django.conf import settings


request_id_ctx: ContextVar[str] = ContextVar('request_id', default='-')


def get_request_id() -> str:
    return request_id_ctx.get()


class RequestIDLogFilter:
    """Inject the current request id into log records."""

    def filter(self, record):
        record.request_id = get_request_id()
        return True


class RequestIDMiddleware:
    """Attach a stable request id to each HTTP request and response."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.header_name = getattr(settings, 'REQUEST_ID_HEADER', 'X-Request-ID')
        self.meta_name = f"HTTP_{self.header_name.upper().replace('-', '_')}"

    def __call__(self, request):
        request_id = request.META.get(self.meta_name) or str(uuid4())
        request.request_id = request_id
        token = request_id_ctx.set(request_id)
        try:
            response = self.get_response(request)
        finally:
            request_id_ctx.reset(token)

        response[self.header_name] = request_id
        return response

