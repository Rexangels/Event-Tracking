import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from infrastructure.auth import UserProfile, UserRole
from inehss.models import FormTemplate, FormVersion, HazardReport, OfficerAssignment


@pytest.mark.django_db
class TestRBACGuards:
    def setup_method(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='admin_rbac', password='pass1234', is_staff=True)
        self.officer = User.objects.create_user(username='officer_rbac', password='pass1234')
        self.staff_officer = User.objects.create_user(username='staff_officer_rbac', email='staff.officer@example.com', password='pass1234', is_staff=True)
        self.other_officer = User.objects.create_user(username='other_officer_rbac', password='pass1234')
        self.supervisor = User.objects.create_user(username='supervisor_rbac', password='pass1234')

        UserProfile.objects.create(user=self.officer, role=UserRole.OFFICER)
        UserProfile.objects.create(user=self.staff_officer, role=UserRole.OFFICER)
        UserProfile.objects.create(user=self.other_officer, role=UserRole.OFFICER)
        UserProfile.objects.create(user=self.supervisor, role=UserRole.SUPERVISOR)

        self.public_form = FormTemplate.objects.create(
            name='RBAC Public Form',
            form_type='public',
        )
        self.public_version = FormVersion.objects.create(
            template=self.public_form,
            version_number=1,
            schema=[{'name': 'summary', 'type': 'text', 'required': True}],
        )
        self.officer_form = FormTemplate.objects.create(
            name='RBAC Officer Form',
            form_type='officer',
        )
        self.officer_version = FormVersion.objects.create(
            template=self.officer_form,
            version_number=1,
            schema=[{'name': 'notes', 'type': 'text'}],
        )
        self.report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'RBAC hazard report'},
            reporter_name='Tester',
        )

    def test_officer_cannot_create_assignment(self):
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(
            '/api/v1/inehss/assignments/',
            {
                'report': str(self.report.id),
                'officer': self.officer.id,
                'form_version': str(self.officer_version.id),
            },
            format='json',
        )

        assert response.status_code == 403
        assert 'admins/supervisors' in response.data['error']

    def test_supervisor_can_create_assignment(self):
        self.client.force_authenticate(user=self.supervisor)
        response = self.client.post(
            '/api/v1/inehss/assignments/',
            {
                'report': str(self.report.id),
                'officer': self.officer.id,
                'form_version': str(self.officer_version.id),
            },
            format='json',
        )

        assert response.status_code == 201

    def test_staff_login_resolves_admin_role(self):
        unauthenticated_client = APIClient()

        response = unauthenticated_client.post(
            '/api/v1/auth/login/',
            {'username': 'admin_rbac', 'password': 'pass1234'},
            format='json',
        )

        assert response.status_code == 200
        access_token = AccessToken(response.data['access'])
        assert access_token['role'] == UserRole.ADMIN

        unauthenticated_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        me_response = unauthenticated_client.get('/api/v1/auth/users/me/')
        assert me_response.status_code == 200
        assert me_response.data['role'] == UserRole.ADMIN
        assert me_response.data['is_staff'] is True

    def test_admin_created_officer_can_log_in_with_officer_role(self):
        self.client.force_authenticate(user=self.admin)
        create_response = self.client.post(
            '/api/v1/inehss/officers/',
            {
                'username': 'field_officer_login',
                'email': 'officer@example.com',
                'password': 'pass1234',
            },
            format='json',
        )

        assert create_response.status_code == 201
        officer_user = User.objects.get(username='field_officer_login')
        assert officer_user.is_staff is False
        assert officer_user.profile.role == UserRole.OFFICER

        unauthenticated_client = APIClient()
        login_response = unauthenticated_client.post(
            '/api/v1/auth/login/',
            {'username': 'field_officer_login', 'password': 'pass1234'},
            format='json',
        )

        assert login_response.status_code == 200
        access_token = AccessToken(login_response.data['access'])
        assert access_token['role'] == UserRole.OFFICER

        unauthenticated_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        me_response = unauthenticated_client.get('/api/v1/auth/users/me/')
        assert me_response.status_code == 200
        assert me_response.data['role'] == UserRole.OFFICER
        assert me_response.data['is_staff'] is False

    def test_officer_login_accepts_email_identifier(self):
        unauthenticated_client = APIClient()

        response = unauthenticated_client.post(
            '/api/v1/auth/login/',
            {'username': 'staff.officer@example.com', 'password': 'pass1234'},
            format='json',
        )

        assert response.status_code == 200
        access_token = AccessToken(response.data['access'])
        assert access_token['role'] == UserRole.OFFICER
        assert access_token['email'] == 'staff.officer@example.com'

    def test_officer_with_staff_flag_only_sees_own_assignments(self):
        own_assignment = OfficerAssignment.objects.create(
            report=self.report,
            officer=self.staff_officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )
        other_assignment = OfficerAssignment.objects.create(
            report=self.report,
            officer=self.other_officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.staff_officer)
        response = self.client.get('/api/v1/inehss/assignments/')

        assert response.status_code == 200
        assignment_ids = {str(item['id']) for item in response.data.get('results', response.data)}
        assert str(own_assignment.id) in assignment_ids
        assert str(other_assignment.id) not in assignment_ids
