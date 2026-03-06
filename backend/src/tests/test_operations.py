import io

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestOperationalReadiness:
    def setup_method(self):
        self.client = APIClient()

    def test_public_health_endpoint_returns_request_id_and_checks(self):
        response = self.client.get('/api/v1/health/')

        assert response.status_code in {200, 503}
        assert 'X-Request-ID' in response
        assert response.data['request_id'] == response['X-Request-ID']
        assert 'database' in response.data['checks']
        assert 'channel_layer' in response.data['checks']
        assert 'staticfiles' in response.data['checks']

    def test_admin_health_endpoint_requires_admin_access(self):
        response = self.client.get('/api/v1/admin/health/')
        assert response.status_code == 401

        admin = User.objects.create_user(username='ops_admin', password='pass1234', is_staff=True)
        self.client.force_authenticate(user=admin)
        response = self.client.get('/api/v1/admin/health/')

        assert response.status_code in {200, 503}
        assert 'checks' in response.data
        assert response.data['checks']['database']['status'] in {'CONNECTED', 'ERROR'}

    @override_settings(
        ENVIRONMENT='production',
        DEBUG=False,
        SECRET_KEY='django-insecure-change-me-in-production',
        ALLOWED_HOSTS=['example.com'],
        CSRF_TRUSTED_ORIGINS=['https://example.com'],
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
        SECURE_SSL_REDIRECT=True,
        SESSION_COOKIE_SECURE=True,
        CSRF_COOKIE_SECURE=True,
        USE_REDIS_CHANNEL_LAYER=True,
        STATIC_ROOT='staticfiles',
    )
    def test_validate_deployment_strict_fails_for_insecure_production_config(self):
        with pytest.raises(CommandError):
            call_command('validate_deployment', '--strict', '--skip-database')

    @override_settings(
        ENVIRONMENT='development',
        DEBUG=True,
        SECRET_KEY='dev-secret-key',
        ALLOWED_HOSTS=['localhost'],
        CSRF_TRUSTED_ORIGINS=[],
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
        SECURE_SSL_REDIRECT=False,
        SESSION_COOKIE_SECURE=False,
        CSRF_COOKIE_SECURE=False,
        USE_REDIS_CHANNEL_LAYER=False,
        STATIC_ROOT='staticfiles',
    )
    def test_validate_deployment_non_strict_allows_development_warning_mode(self):
        output = io.StringIO()

        call_command('validate_deployment', '--skip-database', stdout=output)

        assert 'Deployment validation completed with warnings.' in output.getvalue()

