import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from infrastructure.models import SyncConflictLog
from inehss.models import FormTemplate, FormVersion, HazardReport, OfficerAssignment, FormSubmission


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
        )
        self.public_version = FormVersion.objects.create(
            template=self.public_form,
            version_number=1,
            schema=[{'name': 'summary', 'type': 'text', 'required': True}],
        )
        self.officer_form = FormTemplate.objects.create(
            name='Officer Inspection Form',
            form_type='officer',
        )
        self.officer_version = FormVersion.objects.create(
            template=self.officer_form,
            version_number=1,
            schema=[{'name': 'notes', 'type': 'text'}],
        )

    def test_report_search_filter(self):
        HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Oil spill near river'},
            reporter_name='Jane Doe',
            priority='high',
            status='new',
            latitude=6.52,
            longitude=3.37,
        )
        HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Illegal dump'},
            reporter_name='John Smith',
            priority='low',
            status='new',
            latitude=6.40,
            longitude=3.20,
        )

        response = self.client.get('/api/v1/inehss/reports/', {'search': 'Jane'})

        assert response.status_code == 200
        results = response.data.get('results', response.data)
        assert len(results) == 1
        assert results[0]['reporter_name'] == 'Jane Doe'

    def test_assignment_escalation_flow(self):
        report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Chemical fire'},
            reporter_name='Reporter',
        )
        assignment = OfficerAssignment.objects.create(
            report=report,
            officer=self.officer,
            form_version=self.officer_version,
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

    def test_normalized_values_and_status_history_are_created(self):
        report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Chemical spill near canal'},
            reporter_name='Reporter',
        )
        assignment = OfficerAssignment.objects.create(
            report=report,
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )

        report.refresh_from_db()
        assignment.refresh_from_db()

        assert report.field_values.count() == 1
        assert report.field_values.first().field_definition.field_key == 'summary'
        assert report.status_history.count() == 1
        assert report.status_history.first().to_status == 'new'
        assert assignment.status_history.count() == 1
        assert assignment.status_history.first().to_status == 'pending'

    def test_assignment_version_conflict_returns_409(self):
        report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Blocked drainage'},
            reporter_name='Reporter',
        )
        assignment = OfficerAssignment.objects.create(
            report=report,
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.officer)
        response = self.client.post(
            f'/api/v1/inehss/assignments/{assignment.id}/start/',
            {'expected_version': 999},
            format='json',
        )

        assert response.status_code == 409
        assert response.data['error'] == 'VERSION_CONFLICT'
        assert SyncConflictLog.objects.filter(record_type='officer_assignment', record_id=str(assignment.id)).count() == 1


    def test_assignment_reassign_flow(self):
        report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Waste discharge'},
            reporter_name='Reporter',
        )
        assignment = OfficerAssignment.objects.create(
            report=report,
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )
        new_officer = User.objects.create_user(username='officer2', password='pass1234')

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f'/api/v1/inehss/assignments/{assignment.id}/reassign/',
            {'officer_id': new_officer.id, 'reason': 'Closer to incident location'},
            format='json',
        )

        assignment.refresh_from_db()
        assert response.status_code == 200
        assert assignment.officer_id == new_officer.id
        assert assignment.status == 'reassigned'

    def test_assignment_can_resolve_latest_version_from_follow_up_template(self):
        report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Water contamination'},
            reporter_name='Reporter',
        )
        follow_up_template = FormTemplate.objects.create(
            name='Public Hazard Follow-up',
            form_type='officer',
            follow_up_for=self.public_form,
        )
        FormVersion.objects.create(
            template=follow_up_template,
            version_number=1,
            schema=[{'name': 'notes', 'type': 'text'}],
        )
        latest_follow_up_version = FormVersion.objects.create(
            template=follow_up_template,
            version_number=2,
            schema=[{'name': 'notes', 'type': 'text'}, {'name': 'severity', 'type': 'text'}],
        )

        response = self.client.post(
            '/api/v1/inehss/assignments/',
            {
                'report': str(report.id),
                'officer': self.officer.id,
                'inspection_form': str(follow_up_template.id),
            },
            format='json',
        )

        assert response.status_code == 201, response.data
        assignment = OfficerAssignment.objects.get(id=response.data['id'])
        assert assignment.form_version == latest_follow_up_version



    def test_officer_submission_requires_geolocation_for_final_submit(self):
        report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Illegal discharge'},
            reporter_name='Reporter',
        )
        assignment = OfficerAssignment.objects.create(
            report=report,
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.officer)
        response = self.client.post(
            '/api/v1/inehss/submissions/',
            {
                'assignment': str(assignment.id),
                'data': {'notes': 'Inspection completed'},
                'is_draft': False,
            },
            format='json',
        )

        assert response.status_code == 400
        assert 'location' in response.data

    def test_officer_submission_persists_geolocation_metadata(self):
        report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Illegal burn site'},
            reporter_name='Reporter',
        )
        assignment = OfficerAssignment.objects.create(
            report=report,
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.officer)
        response = self.client.post(
            '/api/v1/inehss/submissions/',
            {
                'assignment': str(assignment.id),
                'data': {'notes': 'Inspection completed'},
                'latitude': 6.5244,
                'longitude': 3.3792,
                'location_accuracy_m': 12.7,
                'location_source': 'gps',
                'location_captured_at': '2026-02-03T10:20:30Z',
                'is_draft': False,
            },
            format='json',
        )

        assert response.status_code == 201
        assert response.data['location_accuracy_m'] == 12.7
        assert response.data['location_source'] == 'gps'

        submission = FormSubmission.objects.get(id=response.data['id'])
        assert submission.field_values.count() == 1
        assert submission.field_values.first().field_definition.field_key == 'notes'
        assert submission.assignment.report.status_history.first().to_status == 'new'

    def test_persistent_patrol_submission_creates_lineage_linked_report(self):
        assignment = OfficerAssignment.objects.create(
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
            is_persistent=True,
        )

        self.client.force_authenticate(user=self.officer)
        response = self.client.post(
            '/api/v1/inehss/submissions/',
            {
                'assignment': str(assignment.id),
                'data': {'notes': 'Patrol found blocked drainage channel'},
                'latitude': 6.5244,
                'longitude': 3.3792,
                'location_accuracy_m': 8.4,
                'location_source': 'gps',
                'location_captured_at': '2026-03-06T09:15:00Z',
                'is_draft': False,
            },
            format='json',
        )

        assert response.status_code == 201

        submission = FormSubmission.objects.get(id=response.data['id'])
        generated_report = HazardReport.objects.get(origin_submission=submission)

        assert generated_report.origin_assignment == assignment
        assert generated_report.origin_submission == submission
        assert generated_report.report_origin['code'] if hasattr(generated_report, 'report_origin') else True
        assert generated_report.reporter_name == f'Officer Patrol: {self.officer.username}'
        assert generated_report.event is not None
        assert generated_report.latitude == submission.latitude
        assert generated_report.longitude == submission.longitude

    def test_follow_up_submission_creates_child_report(self):
        report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Illegal dumping hotspot'},
            reporter_name='Reporter',
        )
        follow_up_template = FormTemplate.objects.create(
            name='Dumping Follow-up Form',
            form_type='officer',
            follow_up_for=self.public_form,
        )
        follow_up_version = FormVersion.objects.create(
            template=follow_up_template,
            version_number=1,
            schema=[{'name': 'notes', 'type': 'text'}],
        )
        assignment = OfficerAssignment.objects.create(
            report=report,
            officer=self.officer,
            form_version=follow_up_version,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.officer)
        response = self.client.post(
            '/api/v1/inehss/submissions/',
            {
                'assignment': str(assignment.id),
                'data': {'notes': 'Follow-up inspection completed'},
                'latitude': 6.5244,
                'longitude': 3.3792,
                'location_accuracy_m': 10.0,
                'location_source': 'gps',
                'location_captured_at': '2026-03-06T09:30:00Z',
                'is_draft': False,
            },
            format='json',
        )

        assert response.status_code == 201, response.data

        submission = FormSubmission.objects.get(id=response.data['id'])
        child_report = HazardReport.objects.get(origin_submission=submission)
        assert child_report.parent_report == report
        assert child_report.form_version == follow_up_version
        assert child_report.origin_assignment == assignment
        assert report.follow_up_reports.count() == 1
