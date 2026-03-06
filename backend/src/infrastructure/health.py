from pathlib import Path
import socket
from urllib.parse import urlparse

from django.conf import settings
from django.db import connections
from django.utils import timezone


def _database_check() -> dict:
    config = settings.DATABASES['default']
    result = {'status': 'CONNECTED', 'engine': config['ENGINE']}
    try:
        connections['default'].ensure_connection()
    except Exception as exc:
        result['status'] = 'ERROR'
        result['detail'] = str(exc)
    return result


def _channel_layer_check() -> dict:
    backend = settings.CHANNEL_LAYERS['default']['BACKEND']
    result = {
        'status': 'IN_MEMORY' if not settings.USE_REDIS_CHANNEL_LAYER else 'CONNECTED',
        'backend': backend,
        'redis_enabled': settings.USE_REDIS_CHANNEL_LAYER,
    }
    if not settings.USE_REDIS_CHANNEL_LAYER:
        return result

    parsed = urlparse(settings.REDIS_URL)
    host = parsed.hostname or '127.0.0.1'
    port = parsed.port or 6379
    try:
        with socket.create_connection((host, port), timeout=2):
            pass
    except OSError as exc:
        result['status'] = 'ERROR'
        result['detail'] = str(exc)
    return result


def _staticfiles_check() -> dict:
    static_root = Path(settings.STATIC_ROOT)
    exists = static_root.exists()
    return {
        'status': 'READY' if exists else 'MISSING',
        'path': str(static_root),
    }


def build_health_report(request_id: str | None = None) -> tuple[dict, int]:
    database = _database_check()
    channel_layer = _channel_layer_check()
    staticfiles = _staticfiles_check()

    warnings: list[str] = []
    critical_issues: list[str] = []

    if database['status'] == 'ERROR':
        critical_issues.append('database_unavailable')

    if settings.ENVIRONMENT == 'production':
        if settings.DEBUG:
            warnings.append('debug_enabled_in_production')
        if settings.DATABASES['default']['ENGINE'].endswith('sqlite3'):
            warnings.append('sqlite_in_production')
        if not settings.CSRF_TRUSTED_ORIGINS:
            warnings.append('missing_csrf_trusted_origins')
        if not settings.USE_REDIS_CHANNEL_LAYER:
            warnings.append('in_memory_channel_layer_in_production')
        if channel_layer['status'] == 'ERROR':
            critical_issues.append('redis_unavailable')
        if staticfiles['status'] != 'READY':
            warnings.append('staticfiles_not_collected')
        if str(settings.SECRET_KEY).startswith('django-insecure'):
            warnings.append('insecure_secret_key')

    status = 'OPERATIONAL'
    http_status = 200
    if critical_issues:
        status = 'CRITICAL'
        http_status = 503
    elif warnings:
        status = 'DEGRADED'
        http_status = 503

    report = {
        'status': status,
        'timestamp': timezone.now().isoformat(),
        'environment': settings.ENVIRONMENT,
        'request_id': request_id,
        'checks': {
            'database': database,
            'channel_layer': channel_layer,
            'staticfiles': staticfiles,
            'security': {
                'debug': settings.DEBUG,
                'https_redirect': settings.SECURE_SSL_REDIRECT,
                'allowed_hosts': len(settings.ALLOWED_HOSTS),
            },
        },
    }
    if warnings:
        report['warnings'] = warnings
    if critical_issues:
        report['critical_issues'] = critical_issues
    return report, http_status

