import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from domain.entities import EventStatus
from infrastructure.auth import UserProfile, UserRole
from infrastructure.models import EventModel
from inehss.models import FormTemplate, FormVersion, HazardReport, OfficerAssignment, FormSubmission


@pytest.mark.django_db
class TestINEHSSReadLayer:
    def setup_method(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='read_admin', password='pass1234', is_staff=True)
        self.officer = User.objects.create_user(username='read_officer', password='pass1234')
        self.other_officer = User.objects.create_user(username='other_officer', password='pass1234')
        self.analyst = User.objects.create_user(username='read_analyst', password='pass1234')

        UserProfile.objects.create(user=self.officer, role=UserRole.OFFICER)
        UserProfile.objects.create(user=self.other_officer, role=UserRole.OFFICER)
        UserProfile.objects.create(user=self.analyst, role=UserRole.ANALYST)

        self.public_form = FormTemplate.objects.create(name='Read Layer Public Form', form_type='public')
        self.public_version = FormVersion.objects.create(
            template=self.public_form,
            version_number=1,
            schema=[{'name': 'summary', 'type': 'text', 'required': True}],
        )
        self.officer_form = FormTemplate.objects.create(name='Read Layer Officer Form', form_type='officer')
        self.officer_version = FormVersion.objects.create(
            template=self.officer_form,
            version_number=1,
            schema=[{'name': 'notes', 'type': 'text'}],
        )

    def test_officer_only_sees_reports_assigned_to_them(self):
        visible_report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Visible to assigned officer'},
            reporter_name='Citizen A',
        )
        hidden_report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Hidden from officer'},
            reporter_name='Citizen B',
        )

        OfficerAssignment.objects.create(
            report=visible_report,
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )
        OfficerAssignment.objects.create(
            report=hidden_report,
            officer=self.other_officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.officer)
        response = self.client.get('/api/v1/inehss/reports/')

        assert response.status_code == 200
        results = response.data.get('results', response.data)
        assert len(results) == 1
        assert results[0]['id'] == str(visible_report.id)

    def test_officer_sees_patrol_generated_reports_from_their_origin_assignment(self):
        assignment = OfficerAssignment.objects.create(
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
            is_persistent=True,
        )
        submission = FormSubmission.objects.create(
            assignment=assignment,
            data={'notes': 'Origin patrol submission'},
            submitted_by=self.officer,
            latitude=6.5,
            longitude=3.3,
            is_draft=False,
        )
        report = HazardReport.objects.create(
            form_version=self.officer_version,
            data=submission.data,
            reporter_name='Officer Patrol: read_officer',
            origin_assignment=assignment,
            origin_submission=submission,
        )

        self.client.force_authenticate(user=self.officer)
        response = self.client.get('/api/v1/inehss/reports/')

        assert response.status_code == 200
        results = response.data.get('results', response.data)
        assert [item['id'] for item in results] == [str(report.id)]

    def test_analyst_can_filter_reports_by_officer_username(self):
        matching_report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Flood response'},
            reporter_name='Citizen A',
        )
        other_report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Fire response'},
            reporter_name='Citizen B',
        )

        OfficerAssignment.objects.create(
            report=matching_report,
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )
        OfficerAssignment.objects.create(
            report=other_report,
            officer=self.other_officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.analyst)
        response = self.client.get('/api/v1/inehss/reports/', {'assigned_officer': 'read_officer'})

        assert response.status_code == 200
        results = response.data.get('results', response.data)
        assert len(results) == 1
        assert results[0]['id'] == str(matching_report.id)

    def test_report_list_includes_origin_metadata_and_assignment_count(self):
        public_report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Citizen complaint'},
            reporter_name='Citizen A',
        )
        follow_up_report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Follow-up inspection requested'},
            reporter_name='Citizen B',
            parent_report=public_report,
        )
        patrol_report = HazardReport.objects.create(
            form_version=self.officer_version,
            data={'notes': 'Patrol found illegal dumping'},
            reporter_name='Officer Patrol: read_officer',
            origin_assignment=OfficerAssignment.objects.create(
                officer=self.officer,
                form_version=self.officer_version,
                assigned_by=self.admin,
                is_persistent=True,
            ),
        )
        patrol_report.origin_submission = FormSubmission.objects.create(
            assignment=patrol_report.origin_assignment,
            data={'notes': 'Patrol found illegal dumping'},
            submitted_by=self.officer,
            latitude=6.5,
            longitude=3.3,
            is_draft=False,
        )
        patrol_report.save(update_fields=['origin_submission'])

        OfficerAssignment.objects.create(
            report=public_report,
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )
        OfficerAssignment.objects.create(
            report=public_report,
            officer=self.other_officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/v1/inehss/reports/')

        assert response.status_code == 200
        results = response.data.get('results', response.data)
        by_id = {item['id']: item for item in results}

        assert by_id[str(public_report.id)]['report_origin']['code'] == 'public'
        assert by_id[str(public_report.id)]['assignment_count'] == 2
        assert by_id[str(follow_up_report.id)]['report_origin']['code'] == 'follow_up'
        assert by_id[str(patrol_report.id)]['report_origin']['code'] == 'patrol'
        assert by_id[str(patrol_report.id)]['lineage']['lineage_status'] == 'linked'
        assert by_id[str(patrol_report.id)]['lineage']['origin_officer_username'] == 'read_officer'
        assert by_id[str(patrol_report.id)]['lineage']['origin_assignment_is_persistent'] is True

    def test_legacy_patrol_report_retains_heuristic_origin_without_lineage(self):
        patrol_report = HazardReport.objects.create(
            form_version=self.officer_version,
            data={'notes': 'Legacy patrol report'},
            reporter_name='Officer Patrol: read_officer',
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/v1/inehss/reports/{patrol_report.id}/')

        assert response.status_code == 200
        assert response.data['report_origin']['code'] == 'patrol'
        assert response.data['lineage']['lineage_status'] == 'heuristic_only'

    def test_report_timeline_includes_report_assignment_submission_and_event_history(self):
        report = HazardReport.objects.create(
            form_version=self.public_version,
            data={'summary': 'Bridge collapse'},
            reporter_name='Citizen Reporter',
            status='assigned',
        )
        assignment = OfficerAssignment.objects.create(
            report=report,
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
        )
        assignment.set_status_context(actor=self.officer, reason='Officer started work')
        assignment.status = 'in_progress'
        assignment.save()

        first_submission = FormSubmission.objects.create(
            assignment=assignment,
            data={'notes': 'Initial inspection', 'households': 20},
            submitted_by=self.officer,
            latitude=6.5,
            longitude=3.3,
            is_draft=False,
        )
        second_submission = FormSubmission.objects.create(
            assignment=assignment,
            data={'notes': 'Updated inspection', 'households': 42},
            submitted_by=self.officer,
            latitude=6.5,
            longitude=3.3,
            is_draft=False,
        )

        event = EventModel.objects.create(
            title='Bridge collapse event',
            description='Created for timeline test',
            category='environmental_hazard',
            status=EventStatus.PENDING.value,
            source_system='inehss',
            source_record_type='hazard_report',
            source_record_id=str(report.id),
            latitude=6.5,
            longitude=3.3,
        )
        event.set_status_context(actor=self.admin, reason='Verified by operations desk')
        event.status = EventStatus.VERIFIED.value
        event.save()
        report.event = event
        report.save(update_fields=['event'])

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/v1/inehss/reports/{report.id}/timeline/')

        assert response.status_code == 200
        timeline = response.data['timeline']
        source_types = [entry['source_type'] for entry in timeline]

        assert 'report_status' in source_types
        assert 'assignment_status' in source_types
        assert 'submission' in source_types
        assert 'event_status' in source_types

        submission_entries = [entry for entry in timeline if entry['source_type'] == 'submission']
        assert len(submission_entries) == 2
        assert submission_entries[0]['source_id'] == str(first_submission.id)
        assert submission_entries[1]['source_id'] == str(second_submission.id)
        assert submission_entries[1]['metadata']['changed_fields'] == [
            {'field': 'households', 'from': 20, 'to': 42},
            {'field': 'notes', 'from': 'Initial inspection', 'to': 'Updated inspection'},
        ]

    def test_patrol_generated_report_timeline_and_assignment_query_include_origin_lineage(self):
        assignment = OfficerAssignment.objects.create(
            officer=self.officer,
            form_version=self.officer_version,
            assigned_by=self.admin,
            is_persistent=True,
        )
        assignment.set_status_context(actor=self.officer, reason='Patrol started')
        assignment.status = 'in_progress'
        assignment.save()

        first_submission = FormSubmission.objects.create(
            assignment=assignment,
            data={'notes': 'Checkpoint 1'},
            submitted_by=self.officer,
            latitude=6.5,
            longitude=3.3,
            is_draft=False,
        )
        second_submission = FormSubmission.objects.create(
            assignment=assignment,
            data={'notes': 'Checkpoint 2'},
            submitted_by=self.officer,
            latitude=6.51,
            longitude=3.31,
            is_draft=False,
        )
        report = HazardReport.objects.create(
            form_version=self.officer_version,
            data=second_submission.data,
            reporter_name='Officer Patrol: read_officer',
            origin_assignment=assignment,
            origin_submission=second_submission,
        )

        self.client.force_authenticate(user=self.admin)
        timeline_response = self.client.get(f'/api/v1/inehss/reports/{report.id}/timeline/')
        assignments_response = self.client.get('/api/v1/inehss/assignments/', {'report': str(report.id)})

        assert timeline_response.status_code == 200
        timeline = timeline_response.data['timeline']
        origin_assignment_entries = [
            entry for entry in timeline
            if entry['source_type'] == 'assignment_status' and entry['metadata'].get('lineage_role') == 'origin_assignment'
        ]
        origin_submission_entries = [
            entry for entry in timeline
            if entry['source_type'] == 'submission' and entry['metadata'].get('lineage_role') == 'origin_submission'
        ]

        assert origin_assignment_entries
        assert len(origin_submission_entries) == 1
        assert origin_submission_entries[0]['source_id'] == str(second_submission.id)
        assert origin_submission_entries[0]['metadata']['changed_fields'] == [
            {'field': 'notes', 'from': 'Checkpoint 1', 'to': 'Checkpoint 2'},
        ]

        assert assignments_response.status_code == 200
        assignments = assignments_response.data.get('results', assignments_response.data)
        assert [item['id'] for item in assignments] == [str(assignment.id)]