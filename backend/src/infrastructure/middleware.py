"""WebSocket JWT authentication middleware for Django Channels."""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async

@database_sync_to_async
def get_user(token_key):
    try:
        from django.contrib.auth import get_user_model
        from django.contrib.auth.models import AnonymousUser
        from rest_framework_simplejwt.tokens import AccessToken

        token = AccessToken(token_key)
        user_id = token['user_id']
        return get_user_model().objects.get(id=user_id)
    except Exception:
        from django.contrib.auth.models import AnonymousUser
        return AnonymousUser()

class JwtAuthMiddleware:
    """
    Middleware to authenticate users for WebSockets using JWT
    Checks for 'token' in the query string
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        from django.contrib.auth.models import AnonymousUser

        query_string = parse_qs(scope["query_string"].decode())
        token = query_string.get("token")
        
        if token:
            scope["user"] = await get_user(token[0])
        else:
            scope["user"] = AnonymousUser()
            
        return await self.inner(scope, receive, send)
