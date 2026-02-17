import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from infrastructure.auth import UserProfile, UserRole
from inehss.models import FormTemplate, HazardReport


@pytest.mark.django_db
class TestRBACGuards:
    def setup_method(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='admin_rbac', password='pass1234', is_staff=True)
        self.officer = User.objects.create_user(username='officer_rbac', password='pass1234')
        self.supervisor = User.objects.create_user(username='supervisor_rbac', password='pass1234')

        UserProfile.objects.create(user=self.officer, role=UserRole.OFFICER)
        UserProfile.objects.create(user=self.supervisor, role=UserRole.SUPERVISOR)

        self.public_form = FormTemplate.objects.create(
            name='RBAC Public Form',
            form_type='public',
            schema=[{'name': 'summary', 'type': 'text', 'required': True}],
        )
        self.officer_form = FormTemplate.objects.create(
            name='RBAC Officer Form',
            form_type='officer',
            schema=[{'name': 'notes', 'type': 'text'}],
        )
        self.report = HazardReport.objects.create(
            form_template=self.public_form,
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
                'inspection_form': str(self.officer_form.id),
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
                'inspection_form': str(self.officer_form.id),
            },
            format='json',
        )

        assert response.status_code == 201
