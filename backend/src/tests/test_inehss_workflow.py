import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from inehss.models import FormTemplate, HazardReport, OfficerAssignment


@pytest.mark.django_db
class TestINEHSSWorkflow:
    def setup_method(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='admin', password='pass1234', is_staff=True)
        self.officer = User.objects.create_user(username='officer', password='pass1234')
        self.client.force_authenticate(user=self.admin)

        self.public_form = FormTemplate.objects.create(
            name='Public Hazard Form',
            form_type='public',
            schema=[{'name': 'summary', 'type': 'text', 'required': True}],
        )
        self.officer_form = FormTemplate.objects.create(
            name='Officer Inspection Form',
            form_type='officer',
            schema=[{'name': 'notes', 'type': 'text'}],
        )

    def test_report_search_filter(self):
        HazardReport.objects.create(
            form_template=self.public_form,
            data={'summary': 'Oil spill near river'},
            reporter_name='Jane Doe',
            priority='high',
            status='new',
            latitude=6.52,
            longitude=3.37,
        )
        HazardReport.objects.create(
            form_template=self.public_form,
            data={'summary': 'Illegal dump'},
            reporter_name='John Smith',
            priority='low',
            status='new',
            latitude=6.40,
            longitude=3.20,
        )

        response = self.client.get('/api/v1/inehss/reports/', {'search': 'Jane'})

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['reporter_name'] == 'Jane Doe'

    def test_assignment_escalation_flow(self):
        report = HazardReport.objects.create(
            form_template=self.public_form,
            data={'summary': 'Chemical fire'},
            reporter_name='Reporter',
        )
        assignment = OfficerAssignment.objects.create(
            report=report,
            officer=self.officer,
            inspection_form=self.officer_form,
            assigned_by=self.admin,
        )

        # officer acts on assignment
        self.client.force_authenticate(user=self.officer)
        start_response = self.client.post(f'/api/v1/inehss/assignments/{assignment.id}/start/')
        escalate_response = self.client.post(
            f'/api/v1/inehss/assignments/{assignment.id}/escalate/',
            {'level': 'high', 'reason': 'Toxic smoke spreading rapidly'},
            format='json'
        )

        assignment.refresh_from_db()

        assert start_response.status_code == 200
        assert escalate_response.status_code == 200
        assert assignment.status == 'in_progress'
        assert assignment.progress_percent >= 25
        assert assignment.escalation_level == 'high'
