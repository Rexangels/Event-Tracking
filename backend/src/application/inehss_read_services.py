from __future__ import annotations

from datetime import datetime, time

from django.db.models import Q, QuerySet
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from infrastructure.auth import UserRole
from inehss.models import HazardReport, FormSubmission


TRUTHY_VALUES = {'1', 'true', 'yes', 'on'}
FALSY_VALUES = {'0', 'false', 'no', 'off'}


def _user_role(user):
    return getattr(getattr(user, 'profile', None), 'role', None)


def _parse_bool(raw_value: str | None):
    if raw_value is None:
        return None
    normalized = str(raw_value).strip().lower()
    if normalized in TRUTHY_VALUES:
        return True
    if normalized in FALSY_VALUES:
        return False
    return None


def _parse_datetime_bound(raw_value: str | None, *, end_of_day: bool = False):
    if not raw_value:
        return None

    parsed_dt = parse_datetime(raw_value)
    if parsed_dt:
        if timezone.is_naive(parsed_dt):
            return timezone.make_aware(parsed_dt, timezone.get_current_timezone())
        return parsed_dt

    parsed_date = parse_date(raw_value)
    if not parsed_date:
        return None

    parsed_dt = datetime.combine(parsed_date, time.max if end_of_day else time.min)
    return timezone.make_aware(parsed_dt, timezone.get_current_timezone())


def _compute_changed_fields(current_data: dict | None, previous_data: dict | None) -> list[dict]:
    current = current_data or {}
    previous = previous_data or {}
    changed_fields = []

    for key in sorted(set(current) | set(previous)):
        old_value = previous.get(key)
        new_value = current.get(key)
        if old_value != new_value:
            changed_fields.append({
                'field': key,
                'from': old_value,
                'to': new_value,
            })

    return changed_fields


class HazardReportReadService:
    ELEVATED_ROLES = {UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ANALYST}
    ORIGIN_PUBLIC = 'public'
    ORIGIN_PATROL = 'patrol'
    ORIGIN_FOLLOW_UP = 'follow_up'
    ORIGIN_UNKNOWN = 'unknown'

    ORIGIN_METADATA = {
        ORIGIN_PUBLIC: {
            'code': ORIGIN_PUBLIC,
            'label': 'Public Report',
            'description': 'Submitted from a public/community reporting form.',
        },
        ORIGIN_PATROL: {
            'code': ORIGIN_PATROL,
            'label': 'Patrol Report',
            'description': 'Created from an officer patrol or persistent field assignment.',
        },
        ORIGIN_FOLLOW_UP: {
            'code': ORIGIN_FOLLOW_UP,
            'label': 'Follow-up Report',
            'description': 'A follow-up record linked to an earlier report in the same chain.',
        },
        ORIGIN_UNKNOWN: {
            'code': ORIGIN_UNKNOWN,
            'label': 'Unknown Origin',
            'description': 'The system could not confidently classify how this report originated.',
        },
    }

    @staticmethod
    def _iso(value):
        return value.isoformat() if value else None

    @classmethod
    def has_relational_patrol_lineage(cls, report: HazardReport) -> bool:
        return bool(report.origin_assignment_id or report.origin_submission_id)

    @classmethod
    def describe_origin(cls, report: HazardReport) -> dict:
        if report.parent_report_id:
            return cls.ORIGIN_METADATA[cls.ORIGIN_FOLLOW_UP]

        if cls.has_relational_patrol_lineage(report):
            return cls.ORIGIN_METADATA[cls.ORIGIN_PATROL]

        template = getattr(getattr(report, 'form_version', None), 'template', None)
        template_form_type = getattr(template, 'form_type', None)
        reporter_name = (report.reporter_name or '').strip().lower()

        if template_form_type == 'officer' or reporter_name.startswith('officer patrol:'):
            return cls.ORIGIN_METADATA[cls.ORIGIN_PATROL]

        if template_form_type == 'public':
            return cls.ORIGIN_METADATA[cls.ORIGIN_PUBLIC]

        return cls.ORIGIN_METADATA[cls.ORIGIN_UNKNOWN]

    @classmethod
    def build_lineage(cls, report: HazardReport) -> dict | None:
        origin_assignment = getattr(report, 'origin_assignment', None)
        origin_submission = getattr(report, 'origin_submission', None)

        if origin_assignment is None and origin_submission is not None:
            origin_assignment = getattr(origin_submission, 'assignment', None)

        if origin_assignment is None and origin_submission is None:
            if cls.describe_origin(report)['code'] != cls.ORIGIN_PATROL:
                return None
            return {
                'lineage_status': 'heuristic_only',
                'is_patrol_generated': False,
                'origin_assignment_id': None,
                'origin_submission_id': None,
                'origin_officer_username': None,
                'origin_assignment_status': None,
                'origin_assignment_is_persistent': None,
                'origin_assignment_assigned_at': None,
                'origin_submission_timestamp': None,
                'origin_submission_version': None,
                'origin_submission_is_draft': None,
                'origin_submission_submitted_by': None,
            }

        return {
            'lineage_status': 'linked',
            'is_patrol_generated': True,
            'origin_assignment_id': str(origin_assignment.id) if origin_assignment else None,
            'origin_submission_id': str(origin_submission.id) if origin_submission else None,
            'origin_officer_username': getattr(getattr(origin_assignment, 'officer', None), 'username', None),
            'origin_assignment_status': getattr(origin_assignment, 'status', None),
            'origin_assignment_is_persistent': getattr(origin_assignment, 'is_persistent', None),
            'origin_assignment_assigned_at': cls._iso(getattr(origin_assignment, 'assigned_at', None)),
            'origin_submission_timestamp': cls._iso(getattr(origin_submission, 'submitted_at', None)),
            'origin_submission_version': getattr(origin_submission, 'version', None),
            'origin_submission_is_draft': getattr(origin_submission, 'is_draft', None),
            'origin_submission_submitted_by': getattr(getattr(origin_submission, 'submitted_by', None), 'username', None),
        }

    @classmethod
    def visible_queryset(cls, user) -> QuerySet[HazardReport]:
        queryset = HazardReport.objects.select_related(
            'form_version__template',
            'parent_report',
            'origin_assignment__officer',
            'origin_submission__submitted_by',
            'origin_submission__assignment__officer',
            'event',
        ).prefetch_related(
            'attachments',
            'assignments__officer',
            'assignments__status_history',
            'assignments__submissions__submitted_by',
            'origin_assignment__status_history',
            'origin_assignment__submissions__submitted_by',
            'status_history',
            'follow_up_reports__status_history',
        ).order_by('-created_at')

        if not user or not user.is_authenticated:
            return queryset.none()

        role = _user_role(user)
        if user.is_staff or user.is_superuser or role in cls.ELEVATED_ROLES:
            return queryset
        if role == UserRole.OFFICER:
            return queryset.filter(
                Q(assignments__officer=user)
                | Q(origin_assignment__officer=user)
                | Q(origin_submission__submitted_by=user)
            ).distinct()
        return queryset.none()

    @classmethod
    def apply_filters(cls, queryset: QuerySet[HazardReport], params) -> QuerySet[HazardReport]:
        tracking_id = params.get('tracking_id')
        priority = params.get('priority')
        status_filter = params.get('status')
        search = params.get('search')
        min_lat = params.get('min_lat')
        max_lat = params.get('max_lat')
        min_lon = params.get('min_lon')
        max_lon = params.get('max_lon')
        parent_report = params.get('parent_report')
        form_template = params.get('form_template') or params.get('template_id')
        form_version = params.get('form_version')
        officer = params.get('officer') or params.get('assigned_officer')
        created_from = _parse_datetime_bound(params.get('created_from'))
        created_to = _parse_datetime_bound(params.get('created_to'), end_of_day=True)
        has_attachments = _parse_bool(params.get('has_attachments'))
        event_id = params.get('event_id')

        if tracking_id:
            queryset = queryset.filter(tracking_id__icontains=tracking_id)
        if priority:
            queryset = queryset.filter(priority=priority)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if parent_report:
            queryset = queryset.filter(parent_report_id=parent_report)
        if form_template:
            queryset = queryset.filter(form_version__template_id=form_template)
        if form_version:
            queryset = queryset.filter(form_version_id=form_version)
        if event_id:
            queryset = queryset.filter(event_id=event_id)
        if created_from:
            queryset = queryset.filter(created_at__gte=created_from)
        if created_to:
            queryset = queryset.filter(created_at__lte=created_to)
        if has_attachments is True:
            queryset = queryset.filter(attachments__isnull=False)
        elif has_attachments is False:
            queryset = queryset.filter(attachments__isnull=True)

        if officer:
            officer_filter = (
                Q(assignments__officer__username__icontains=officer)
                | Q(origin_assignment__officer__username__icontains=officer)
                | Q(origin_submission__submitted_by__username__icontains=officer)
            )
            if str(officer).isdigit():
                officer_filter |= Q(assignments__officer_id=int(officer))
                officer_filter |= Q(origin_assignment__officer_id=int(officer))
                officer_filter |= Q(origin_submission__submitted_by_id=int(officer))
            queryset = queryset.filter(officer_filter)

        if search:
            queryset = queryset.filter(
                Q(reporter_name__icontains=search)
                | Q(reporter_email__icontains=search)
                | Q(address__icontains=search)
                | Q(tracking_id__icontains=search)
                | Q(form_version__template__name__icontains=search)
                | Q(assignments__officer__username__icontains=search)
                | Q(origin_assignment__officer__username__icontains=search)
                | Q(origin_submission__submitted_by__username__icontains=search)
            )

        try:
            if min_lat is not None:
                queryset = queryset.filter(latitude__gte=float(min_lat))
            if max_lat is not None:
                queryset = queryset.filter(latitude__lte=float(max_lat))
            if min_lon is not None:
                queryset = queryset.filter(longitude__gte=float(min_lon))
            if max_lon is not None:
                queryset = queryset.filter(longitude__lte=float(max_lon))
        except ValueError:
            pass

        return queryset.distinct().order_by('-created_at')

    @classmethod
    def build_timeline(cls, report: HazardReport) -> list[dict]:
        timeline = []

        for status_entry in report.status_history.all():
            timeline.append({
                'timestamp': status_entry.changed_at,
                'source_type': 'report_status',
                'source_id': str(status_entry.id),
                'title': 'Report created' if not status_entry.from_status else 'Report status changed',
                'actor': getattr(status_entry.changed_by, 'username', None),
                'metadata': {
                    'report_id': str(report.id),
                    'tracking_id': report.tracking_id,
                    'from_status': status_entry.from_status,
                    'to_status': status_entry.to_status,
                    'reason': status_entry.reason,
                },
            })

        assignments = sorted(report.assignments.all(), key=lambda item: item.assigned_at)
        direct_assignment_ids = {assignment.id for assignment in assignments}
        for assignment in assignments:
            for status_entry in assignment.status_history.all():
                timeline.append({
                    'timestamp': status_entry.changed_at,
                    'source_type': 'assignment_status',
                    'source_id': str(status_entry.id),
                    'title': 'Assignment created' if not status_entry.from_status else 'Assignment status changed',
                    'actor': getattr(status_entry.changed_by, 'username', None),
                    'metadata': {
                        'assignment_id': str(assignment.id),
                        'officer': assignment.officer.username,
                        'from_status': status_entry.from_status,
                        'to_status': status_entry.to_status,
                        'reason': status_entry.reason,
                        'progress_percent': assignment.progress_percent,
                    },
                })

            submissions = sorted(assignment.submissions.all(), key=lambda item: item.submitted_at)
            previous_submission: FormSubmission | None = None
            for submission in submissions:
                timeline.append({
                    'timestamp': submission.submitted_at,
                    'source_type': 'submission',
                    'source_id': str(submission.id),
                    'title': 'Draft saved' if submission.is_draft else 'Submission recorded',
                    'actor': submission.submitted_by.username,
                    'metadata': {
                        'assignment_id': str(assignment.id),
                        'submission_version': submission.version,
                        'is_draft': submission.is_draft,
                        'form_version_number': assignment.form_version.version_number,
                        'changed_fields': _compute_changed_fields(
                            submission.data,
                            previous_submission.data if previous_submission else None,
                        ),
                    },
                })
                previous_submission = submission

        origin_assignment = getattr(report, 'origin_assignment', None)
        if origin_assignment and origin_assignment.id not in direct_assignment_ids:
            for status_entry in origin_assignment.status_history.all():
                timeline.append({
                    'timestamp': status_entry.changed_at,
                    'source_type': 'assignment_status',
                    'source_id': str(status_entry.id),
                    'title': 'Origin patrol assignment created' if not status_entry.from_status else 'Origin patrol assignment status changed',
                    'actor': getattr(status_entry.changed_by, 'username', None),
                    'metadata': {
                        'assignment_id': str(origin_assignment.id),
                        'officer': origin_assignment.officer.username,
                        'from_status': status_entry.from_status,
                        'to_status': status_entry.to_status,
                        'reason': status_entry.reason,
                        'progress_percent': origin_assignment.progress_percent,
                        'lineage_role': 'origin_assignment',
                        'is_persistent': origin_assignment.is_persistent,
                    },
                })

        origin_submission = getattr(report, 'origin_submission', None)
        if origin_submission:
            submissions = sorted(origin_submission.assignment.submissions.all(), key=lambda item: item.submitted_at)
            previous_submission = None
            for submission in submissions:
                if submission.id == origin_submission.id:
                    timeline.append({
                        'timestamp': submission.submitted_at,
                        'source_type': 'submission',
                        'source_id': str(submission.id),
                        'title': 'Origin patrol submission recorded',
                        'actor': submission.submitted_by.username,
                        'metadata': {
                            'assignment_id': str(origin_submission.assignment_id),
                            'submission_version': submission.version,
                            'is_draft': submission.is_draft,
                            'form_version_number': origin_submission.assignment.form_version.version_number,
                            'changed_fields': _compute_changed_fields(
                                submission.data,
                                previous_submission.data if previous_submission else None,
                            ),
                            'lineage_role': 'origin_submission',
                            'generated_report_id': str(report.id),
                        },
                    })
                    break
                previous_submission = submission

        follow_up_reports = sorted(report.follow_up_reports.all(), key=lambda item: item.created_at)
        for follow_up in follow_up_reports:
            for status_entry in follow_up.status_history.all():
                timeline.append({
                    'timestamp': status_entry.changed_at,
                    'source_type': 'follow_up_report_status',
                    'source_id': str(status_entry.id),
                    'title': 'Follow-up report created' if not status_entry.from_status else 'Follow-up report status changed',
                    'actor': getattr(status_entry.changed_by, 'username', None),
                    'metadata': {
                        'report_id': str(follow_up.id),
                        'tracking_id': follow_up.tracking_id,
                        'from_status': status_entry.from_status,
                        'to_status': status_entry.to_status,
                        'reason': status_entry.reason,
                    },
                })

        if report.event_id and report.event:
            for status_entry in report.event.status_history.all():
                timeline.append({
                    'timestamp': status_entry.changed_at,
                    'source_type': 'event_status',
                    'source_id': str(status_entry.id),
                    'title': 'Event created' if not status_entry.from_status else 'Event status changed',
                    'actor': getattr(status_entry.changed_by, 'username', None),
                    'metadata': {
                        'event_id': str(report.event_id),
                        'from_status': status_entry.from_status,
                        'to_status': status_entry.to_status,
                        'reason': status_entry.reason,
                    },
                })

        timeline.sort(key=lambda item: item['timestamp'])
        for item in timeline:
            item['timestamp'] = item['timestamp'].isoformat()
        return timeline