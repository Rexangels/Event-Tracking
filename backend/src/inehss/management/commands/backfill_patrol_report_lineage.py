from datetime import timedelta

from django.core.management.base import BaseCommand

from application.inehss_read_services import HazardReportReadService
from inehss.models import FormSubmission, HazardReport


class Command(BaseCommand):
    help = 'Backfill patrol report lineage for legacy patrol-generated reports using high-confidence matches.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Persist matched lineage instead of running in dry-run mode.')
        parser.add_argument('--report-id', help='Limit the backfill to a single hazard report UUID.')
        parser.add_argument('--max-age-minutes', type=int, default=10, help='Maximum time delta allowed between submission and report creation.')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        report_id = options.get('report_id')
        max_age = timedelta(minutes=options['max_age_minutes'])

        reports = HazardReport.objects.filter(
            parent_report__isnull=True,
            origin_assignment__isnull=True,
            origin_submission__isnull=True,
        ).select_related('form_version__template')

        if report_id:
            reports = reports.filter(id=report_id)

        scanned = matched = ambiguous = 0

        for report in reports.iterator():
            if HazardReportReadService.describe_origin(report)['code'] != HazardReportReadService.ORIGIN_PATROL:
                continue

            scanned += 1
            candidates = self._find_candidates(report, max_age)
            if len(candidates) != 1:
                if candidates:
                    ambiguous += 1
                continue

            submission = candidates[0]
            matched += 1
            self.stdout.write(
                f"{'BACKFILL' if apply_changes else 'MATCH'} report={report.id} assignment={submission.assignment_id} submission={submission.id}"
            )

            if apply_changes:
                report.origin_assignment = submission.assignment
                report.origin_submission = submission
                report.save(update_fields=['origin_assignment', 'origin_submission'])

        mode = 'applied' if apply_changes else 'dry-run'
        self.stdout.write(self.style.SUCCESS(
            f'Patrol lineage backfill {mode} complete: scanned={scanned}, matched={matched}, ambiguous={ambiguous}'
        ))

    def _find_candidates(self, report: HazardReport, max_age: timedelta) -> list[FormSubmission]:
        reporter_name = report.reporter_name or ''
        officer_username = reporter_name.replace('Officer Patrol:', '').strip()
        if not officer_username:
            return []

        candidates = FormSubmission.objects.filter(
            assignment__officer__username=officer_username,
            assignment__form_version_id=report.form_version_id,
            assignment__is_persistent=True,
            generated_report__isnull=True,
            is_draft=False,
            data=report.data,
        ).select_related('assignment__officer')

        matches = []
        for submission in candidates.iterator():
            if abs(report.created_at - submission.submitted_at) > max_age:
                continue
            if report.latitude is not None and submission.latitude != report.latitude:
                continue
            if report.longitude is not None and submission.longitude != report.longitude:
                continue
            matches.append(submission)
        return matches