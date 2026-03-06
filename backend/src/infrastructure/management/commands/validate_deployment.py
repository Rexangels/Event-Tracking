from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections


class Command(BaseCommand):
    help = 'Validate runtime configuration for production-style deployments.'

    def add_arguments(self, parser):
        parser.add_argument('--strict', action='store_true', help='Fail on warnings as well as errors.')
        parser.add_argument('--skip-database', action='store_true', help='Skip the database connectivity check.')

    def handle(self, *args, **options):
        strict = options['strict']
        skip_database = options['skip_database']
        warnings: list[str] = []
        errors: list[str] = []

        if settings.ENVIRONMENT != 'production':
            warnings.append('ENVIRONMENT is not set to production.')
        else:
            if settings.DEBUG:
                errors.append('DEBUG must be False in production.')
            if str(settings.SECRET_KEY).startswith('django-insecure'):
                errors.append('SECRET_KEY is using the default insecure fallback.')
            if not settings.ALLOWED_HOSTS:
                errors.append('ALLOWED_HOSTS must not be empty in production.')
            if not settings.CSRF_TRUSTED_ORIGINS:
                errors.append('CSRF_TRUSTED_ORIGINS must be configured in production.')
            if settings.DATABASES['default']['ENGINE'].endswith('sqlite3'):
                errors.append('SQLite is not acceptable for an enterprise production deployment.')
            if not settings.SECURE_SSL_REDIRECT:
                errors.append('SECURE_SSL_REDIRECT must be enabled in production.')
            if not settings.SESSION_COOKIE_SECURE or not settings.CSRF_COOKIE_SECURE:
                errors.append('Session and CSRF cookies must be secure in production.')
            if not settings.USE_REDIS_CHANNEL_LAYER:
                warnings.append('USE_REDIS_CHANNEL_LAYER is disabled; horizontal scale-safe realtime is not enabled.')
            if not getattr(settings, 'STATIC_ROOT', None):
                errors.append('STATIC_ROOT must be configured for collectstatic.')

        if not skip_database:
            try:
                connections['default'].ensure_connection()
            except Exception as exc:
                errors.append(f'Database connectivity failed: {exc}')

        self.stdout.write(self.style.SUCCESS('Deployment validation summary'))
        for warning in warnings:
            self.stdout.write(self.style.WARNING(f'WARNING: {warning}'))
        for error in errors:
            self.stdout.write(self.style.ERROR(f'ERROR: {error}'))

        if errors or (strict and warnings):
            raise CommandError('Deployment validation failed.')

        if warnings:
            self.stdout.write(self.style.WARNING('Deployment validation completed with warnings.'))
        else:
            self.stdout.write(self.style.SUCCESS('Deployment validation passed.'))

