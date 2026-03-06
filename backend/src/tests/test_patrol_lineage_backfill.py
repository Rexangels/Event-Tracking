from io import StringIO

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command

from inehss.models import FormSubmission, FormTemplate, FormVersion, HazardReport, OfficerAssignment


@pytest.mark.django_db
def test_patrol_lineage_backfill_command_dry_run_and_apply():
    admin = User.objects.create_user(username='backfill_admin', password='pass1234', is_staff=True)
    officer = User.objects.create_user(username='backfill_officer', password='pass1234')
    form = FormTemplate.objects.create(name='Backfill Patrol Form', form_type='officer')
    version = FormVersion.objects.create(template=form, version_number=1, schema=[{'name': 'notes', 'type': 'text'}])

    assignment = OfficerAssignment.objects.create(
        officer=officer,
        form_version=version,
        assigned_by=admin,
        is_persistent=True,
    )
    submission = FormSubmission.objects.create(
        assignment=assignment,
        data={'notes': 'Legacy patrol finding'},
        submitted_by=officer,
        latitude=6.5,
        longitude=3.3,
        is_draft=False,
    )
    report = HazardReport.objects.create(
        form_version=version,
        data=submission.data,
        latitude=submission.latitude,
        longitude=submission.longitude,
        reporter_name='Officer Patrol: backfill_officer',
    )

    HazardReport.objects.filter(id=report.id).update(created_at=submission.submitted_at)
    report.refresh_from_db()

    dry_run_output = StringIO()
    call_command('backfill_patrol_report_lineage', stdout=dry_run_output)
    report.refresh_from_db()
    assert report.origin_assignment_id is None
    assert report.origin_submission_id is None

    apply_output = StringIO()
    call_command('backfill_patrol_report_lineage', apply=True, stdout=apply_output)
    report.refresh_from_db()

    assert report.origin_assignment_id == assignment.id
    assert report.origin_submission_id == submission.id
    assert 'matched=1' in apply_output.getvalue()


@pytest.mark.django_db
def test_patrol_lineage_backfill_skips_ambiguous_matches():
    admin = User.objects.create_user(username='backfill_admin_2', password='pass1234', is_staff=True)
    officer = User.objects.create_user(username='backfill_officer_2', password='pass1234')
    form = FormTemplate.objects.create(name='Backfill Patrol Form 2', form_type='officer')
    version = FormVersion.objects.create(template=form, version_number=1, schema=[{'name': 'notes', 'type': 'text'}])

    assignment = OfficerAssignment.objects.create(
        officer=officer,
        form_version=version,
        assigned_by=admin,
        is_persistent=True,
    )
    first_submission = FormSubmission.objects.create(
        assignment=assignment,
        data={'notes': 'Same finding'},
        submitted_by=officer,
        latitude=6.5,
        longitude=3.3,
        is_draft=False,
    )
    second_submission = FormSubmission.objects.create(
        assignment=assignment,
        data={'notes': 'Same finding'},
        submitted_by=officer,
        latitude=6.5,
        longitude=3.3,
        is_draft=False,
    )
    report = HazardReport.objects.create(
        form_version=version,
        data=first_submission.data,
        latitude=6.5,
        longitude=3.3,
        reporter_name='Officer Patrol: backfill_officer_2',
    )

    HazardReport.objects.filter(id=report.id).update(created_at=second_submission.submitted_at)
    report.refresh_from_db()

    output = StringIO()
    call_command('backfill_patrol_report_lineage', apply=True, stdout=output)
    report.refresh_from_db()

    assert report.origin_assignment_id is None
    assert report.origin_submission_id is None
    assert 'ambiguous=1' in output.getvalue()