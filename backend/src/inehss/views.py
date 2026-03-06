"""
INEHSS API Views
"""

import logging

from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from application.inehss_read_services import HazardReportReadService
from infrastructure.auth import UserProfile, UserRole
from infrastructure.models import SyncConflictLog

from .models import FormTemplate, HazardReport, OfficerAssignment, FormSubmission, MediaAttachment
from .serializers import (
    FormTemplateSerializer, FormSchemaSerializer,
    HazardReportSerializer, HazardReportCreateSerializer,
    OfficerAssignmentSerializer,
    FormSubmissionSerializer, FormSubmissionCreateSerializer,
    MediaAttachmentSerializer
)

User = get_user_model()
logger = logging.getLogger(__name__)


def _user_role(user):
    return getattr(getattr(user, 'profile', None), 'role', None)


def _is_admin_or_supervisor(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser or _user_role(user) in {UserRole.ADMIN, UserRole.SUPERVISOR}))


def _can_read_reports(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser or _user_role(user) in {UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ANALYST, UserRole.OFFICER}))


def _get_expected_version(request):
    raw_value = request.data.get('expected_version') or request.query_params.get('expected_version')
    if raw_value in (None, ''):
        return None
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        return None


def _version_conflict_response(request, instance, record_type: str):
    expected_version = _get_expected_version(request)
    if expected_version is None or expected_version == instance.version:
        return None

    SyncConflictLog.objects.create(
        record_type=record_type,
        record_id=str(instance.pk),
        client_version=expected_version,
        server_version=instance.version,
        actor=request.user if request.user.is_authenticated else None,
        details=f'Expected version {expected_version}, found {instance.version}',
    )
    return Response(
        {
            'error': 'VERSION_CONFLICT',
            'message': 'The record changed on the server. Refresh and retry with the latest version.',
            'current_version': instance.version,
        },
        status=status.HTTP_409_CONFLICT,
    )


class OfficerListView(APIView):
    """List and create officer users with their own credentials."""
    permission_classes = [permissions.IsAdminUser]
    
    def get(self, request):
        officers = User.objects.filter(profile__role=UserRole.OFFICER).values('id', 'username', 'email', 'date_joined')
        return Response(list(officers))

    def post(self, request):
        """Create a new officer account"""
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not username or not password:
            return Response(
                {'error': 'Username and password are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if User.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                is_staff=False,
            )
            UserProfile.objects.create(user=user, role=UserRole.OFFICER)
            return Response({
                'id': user.id,
                'username': user.username,
                'email': user.email
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class PublicReportThrottle(AnonRateThrottle):
    """Throttle for public report submissions"""
    rate = '10/hour'



class FormTemplateViewSet(viewsets.ModelViewSet):
    """
    API endpoint for form templates.
    - GET: Public access (list active forms)
    - POST/PUT/DELETE: Staff only
    """
    queryset = FormTemplate.objects.all()
    serializer_class = FormTemplateSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]
    
    def get_queryset(self):
        # Staff see all, public sees only active
        if self.request.user.is_staff:
            queryset = FormTemplate.objects.all()
        else:
            queryset = FormTemplate.objects.filter(is_active=True)

        form_type = self.request.query_params.get('form_type')
        follow_up_for = self.request.query_params.get('follow_up_for')

        if form_type:
            queryset = queryset.filter(form_type=form_type)
        if follow_up_for == 'null':
            queryset = queryset.filter(follow_up_for__isnull=True)
        elif follow_up_for:
            queryset = queryset.filter(follow_up_for_id=follow_up_for)

        return queryset
    
    def perform_create(self, serializer):
        # We temporarily accept 'schema' in the payload to build the template
        # Then we create the first version.
        template = serializer.save()
        
        # Create initial version
        from .models import FormVersion
        schema_data = self.request.data.get('schema', [])
        FormVersion.objects.create(
            template=template,
            version_number=1,
            schema=schema_data,
            is_published=True
        )

    def perform_update(self, serializer):
        template = serializer.save()
        
        # Check if schema was provided to trigger a new version
        schema_data = self.request.data.get('schema')
        if schema_data is not None:
            from .models import FormVersion
            latest_version = template.versions.order_by('-version_number').first()
            next_version_num = (latest_version.version_number + 1) if latest_version else 1
            
            FormVersion.objects.create(
                template=template,
                version_number=next_version_num,
                schema=schema_data,
                is_published=True
            )
            
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get all versions for a specific form template"""
        template = self.get_object()
        versions = template.versions.order_by('version_number')
        data = []
        for v in versions:
            report_count = HazardReport.objects.filter(form_version=v).count()
            data.append({
                'id': str(v.id),
                'version_number': v.version_number,
                'schema': v.schema,
                'is_published': v.is_published,
                'created_at': v.created_at.isoformat(),
                'report_count': report_count,
            })
        return Response({
            'template_id': str(template.id),
            'template_name': template.name,
            'geo_mode': template.geo_mode,
            'versions': data,
        })
            
    @action(detail=True, methods=['get'])
    def schema(self, request, pk=None):
        """Get the full schema for a specific form template (Returns the latest version)"""
        template = self.get_object()
        latest_version = template.versions.order_by('-version_number').first()
        
        if not latest_version:
            return Response({'error': 'No version exists for this template'}, status=404)
        
        return Response({
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'form_type': template.form_type,
            'geo_mode': template.geo_mode,
            'version_id': str(latest_version.id),
            'version_number': latest_version.version_number,
            'schema': latest_version.schema
        })
    
    @action(detail=False, methods=['get'])
    def public(self, request):
        """Get only public form templates"""
        templates = FormTemplate.objects.filter(is_active=True, form_type='public')
        serializer = FormTemplateSerializer(templates, many=True)
        return Response(serializer.data)



class HazardReportViewSet(viewsets.ModelViewSet):
    """
    API endpoint for hazard reports.
    - POST (create): Public access with throttling
    - GET/PUT/DELETE: Authenticated staff only
    """
    queryset = HazardReport.objects.all()

    def get_queryset(self):
        queryset = HazardReportReadService.visible_queryset(self.request.user)
        return HazardReportReadService.apply_filters(queryset, self.request.query_params)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return HazardReportCreateSerializer
        return HazardReportSerializer
    
    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        if _can_read_reports(self.request.user):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]
    
    def get_throttles(self):
        if self.action == 'create':
            return [PublicReportThrottle()]
        return []
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        
        # Auto-create Event for map visualization
        try:
            from infrastructure.models import EventModel
            from domain.entities import EventSeverity, EventStatus
            
            # Map priority to severity
            severity_map = {
                'low': EventSeverity.LOW.value,
                'medium': EventSeverity.MEDIUM.value,
                'high': EventSeverity.HIGH.value,
                'critical': EventSeverity.CRITICAL.value
            }
            
            # Skip event creation for reports without location (e.g. self-initiated direct assignments)
            if instance.latitude is None or instance.longitude is None:
                print(f"Skipping event creation for report {instance.id} (No location data)")
                return Response({
                    'tracking_id': instance.tracking_id,
                    'message': 'Report created. Event generation pending location data.'
                }, status=status.HTTP_201_CREATED)

            # Create the event
            event = EventModel(
                title=f"{instance.form_version.template.name} - {instance.tracking_id}",
                description=f"Public hazard report submitted via INEHSS.\n\nType: {instance.form_version.template.name}\nTracking ID: {instance.tracking_id}\nAddress: {instance.address}",
                category=instance.form_version.template.event_category,
                severity=severity_map.get(instance.priority, EventSeverity.MEDIUM.value),
                status=EventStatus.PENDING.value,
                latitude=instance.latitude,
                longitude=instance.longitude,
                trust_score=0.5,
                source_system='inehss',
                source_record_type='hazard_report',
                source_record_id=str(instance.id),
                source_form_version_id=instance.form_version_id,
            )
            event.set_status_context(reason='Event created from public hazard report submission')
            event.save()
            
            # Link event to report
            HazardReport.objects.filter(pk=instance.pk).update(event=event)
            instance.event = event
            
        except Exception as e:
            # Don't fail the report submission if event creation fails, just log it
            logger.exception("Failed to auto-create event for report %s", instance.id)
            
        # Return the tracking ID to the user
        return Response({
            'id': str(instance.id),
            'tracking_id': instance.tracking_id,
            'version': instance.version,
            'message': 'Report submitted successfully. Save your tracking ID for follow-up.'
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        conflict_response = _version_conflict_response(request, instance, 'hazard_report')
        if conflict_response:
            return conflict_response
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        conflict_response = _version_conflict_response(request, instance, 'hazard_report')
        if conflict_response:
            return conflict_response
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        report = self.get_object()
        timeline = HazardReportReadService.build_timeline(report)
        return Response({
            'report_id': str(report.id),
            'tracking_id': report.tracking_id,
            'timeline': timeline,
        })
    
    @action(detail=False, methods=['get'], url_path='track/(?P<tracking_id>[^/.]+)')
    def track(self, request, tracking_id=None):
        """Public endpoint to check report status by tracking ID"""
        try:
            report = HazardReport.objects.get(tracking_id=tracking_id)
            return Response({
                'tracking_id': report.tracking_id,
                'status': report.status,
                'created_at': report.created_at,
                'updated_at': report.updated_at
            })
        except HazardReport.DoesNotExist:
            return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)


class OfficerAssignmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for officer assignments.
    Officers can only see their own assignments.
    """
    serializer_class = OfficerAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = OfficerAssignment.objects.all() if user.is_staff else OfficerAssignment.objects.filter(officer=user)
        report_id = self.request.query_params.get('report')
        if report_id:
            queryset = queryset.filter(Q(report_id=report_id) | Q(generated_reports__id=report_id)).distinct()
        return queryset

    def _ensure_owner_or_staff(self, assignment, request):
        return assignment.officer == request.user or request.user.is_staff

    def create(self, request, *args, **kwargs):
        if not _is_admin_or_supervisor(request.user):
            return Response({'error': 'Only admins/supervisors can create assignments'}, status=status.HTTP_403_FORBIDDEN)
        print("DEBUG: Creating assignment payload:", request.data)
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("DEBUG: Assignment Validation Errors:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        conflict_response = _version_conflict_response(request, instance, 'officer_assignment')
        if conflict_response:
            return conflict_response
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        conflict_response = _version_conflict_response(request, instance, 'officer_assignment')
        if conflict_response:
            return conflict_response
        return super().partial_update(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Officer accepts an assignment"""
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response
        
        assignment.set_status_context(actor=request.user, reason='Assignment accepted')
        assignment.status = 'accepted'
        assignment.progress_percent = max(assignment.progress_percent, 10)
        assignment.save()
        return Response({'status': 'Assignment accepted'})

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response
        assignment.set_status_context(actor=request.user, reason='Assignment work started')
        assignment.status = 'in_progress'
        assignment.progress_percent = max(assignment.progress_percent, 25)
        assignment.save()
        return Response({'status': 'Assignment in progress'})

    @action(detail=True, methods=['post'])
    def submit_review(self, request, pk=None):
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response
        assignment.set_status_context(actor=request.user, reason='Assignment submitted for review')
        assignment.status = 'awaiting_review'
        assignment.progress_percent = max(assignment.progress_percent, 85)
        assignment.save()
        return Response({'status': 'Assignment submitted for review'})

    @action(detail=True, methods=['post'])
    def request_revision(self, request, pk=None):
        assignment = self.get_object()
        if not _is_admin_or_supervisor(request.user):
            return Response({'error': 'Only admins/supervisors can request revision'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response
        assignment.set_status_context(actor=request.user, reason='Revision requested by reviewer')
        assignment.status = 'revision_needed'
        assignment.notes = request.data.get('notes', assignment.notes)
        assignment.progress_percent = min(assignment.progress_percent, 80)
        assignment.save()
        return Response({'status': 'Revision requested'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        assignment = self.get_object()
        if not _is_admin_or_supervisor(request.user):
            return Response({'error': 'Only admins/supervisors can approve'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response
        assignment.set_status_context(actor=request.user, reason='Assignment approved')
        assignment.status = 'approved'
        assignment.progress_percent = 100
        assignment.save()
        return Response({'status': 'Assignment approved'})

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response
        assignment.set_status_context(actor=request.user, reason='Assignment declined')
        assignment.status = 'declined'
        assignment.notes = request.data.get('reason', assignment.notes)
        assignment.save()
        return Response({'status': 'Assignment declined'})

    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response
        level = request.data.get('level', 'medium')
        reason = request.data.get('reason', '').strip()

        if level not in {'low', 'medium', 'high', 'critical'}:
            return Response({'error': 'Invalid escalation level'}, status=status.HTTP_400_BAD_REQUEST)
        if not reason:
            return Response({'error': 'Escalation reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        assignment.escalation_level = level
        assignment.escalation_reason = reason
        assignment.save()
        return Response({'status': 'Assignment escalated', 'level': level})


    @action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        assignment = self.get_object()
        if not _is_admin_or_supervisor(request.user):
            return Response({'error': 'Only admins/supervisors can reassign assignments'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response

        new_officer_id = request.data.get('officer_id')
        if not new_officer_id:
            return Response({'error': 'officer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_officer = User.objects.get(id=new_officer_id)
        except User.DoesNotExist:
            return Response({'error': 'Selected officer does not exist'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', '').strip()

        assignment.set_status_context(actor=request.user, reason='Assignment reassigned')
        assignment.officer = new_officer
        assignment.status = 'reassigned'
        assignment.notes = f"{assignment.notes}\n[Reassigned] {reason}".strip() if reason else assignment.notes
        assignment.escalation_level = assignment.escalation_level or 'none'
        assignment.save()

        serializer = self.get_serializer(assignment)
        return Response(serializer.data, status=status.HTTP_200_OK)

    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark assignment as completed"""
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response
        
        from django.utils import timezone
        assignment.set_status_context(actor=request.user, reason='Assignment completed')
        assignment.status = 'completed'
        assignment.progress_percent = 100
        assignment.completed_at = timezone.now()
        assignment.save()
        
        # Also update the report status
        if assignment.report:
            assignment.report.set_status_context(actor=request.user, reason='Report resolved from completed assignment')
            assignment.report.status = 'resolved'
            assignment.report.save()
        
        return Response({'status': 'Assignment completed'})

    @action(detail=True, methods=['post'])
    def upgrade_version(self, request, pk=None):
        """Upgrade assignment to the latest form version, discarding any draft data."""
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
        if conflict_response:
            return conflict_response

        template = assignment.form_version.template
        latest_version = template.versions.order_by('-version_number').first()

        if latest_version.id == assignment.form_version.id:
            return Response({'error': 'Already on the latest version'}, status=status.HTTP_400_BAD_REQUEST)

        # Delete any existing drafts (they are incompatible with the new schema)
        assignment.submissions.filter(is_draft=True).delete()

        # Update the assignment to point to the new version
        old_version = assignment.form_version.version_number
        assignment.set_status_context(actor=request.user, reason=f'Assignment form upgraded from v{old_version} to v{latest_version.version_number}')
        assignment.form_version = latest_version
        assignment.save()

        serializer = self.get_serializer(assignment)
        return Response({
            'status': f'Upgraded from v{old_version} to v{latest_version.version_number}',
            'assignment': serializer.data
        })


class FormSubmissionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for officer form submissions.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FormSubmissionCreateSerializer
        return FormSubmissionSerializer
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return FormSubmission.objects.all()
        return FormSubmission.objects.filter(submitted_by=user)
    
    def create(self, request, *args, **kwargs):
        # Verify the user owns the assignment
        assignment_id = request.data.get('assignment')
        try:
            assignment = OfficerAssignment.objects.get(id=assignment_id)
            if assignment.officer != request.user and not request.user.is_staff:
                return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
            conflict_response = _version_conflict_response(request, assignment, 'officer_assignment')
            if conflict_response:
                return conflict_response
        except OfficerAssignment.DoesNotExist:
            return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
        
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        conflict_response = _version_conflict_response(request, instance, 'form_submission')
        if conflict_response:
            return conflict_response
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        conflict_response = _version_conflict_response(request, instance, 'form_submission')
        if conflict_response:
            return conflict_response
        return super().partial_update(request, *args, **kwargs)

    def perform_create(self, serializer):
        submission = serializer.save()
        assignment = submission.assignment

        assignment_template = assignment.form_version.template
        is_follow_up_submission = bool(
            not submission.is_draft
            and assignment.report_id
            and assignment_template.follow_up_for_id
            and assignment_template.follow_up_for_id == assignment.report.form_version.template_id
        )

        if is_follow_up_submission:
            try:
                report = HazardReport(
                    form_version=assignment.form_version,
                    parent_report=assignment.report,
                    data=submission.data,
                    latitude=submission.latitude,
                    longitude=submission.longitude,
                    status='resolved',
                    priority=assignment.report.priority,
                    reporter_name=f"Officer Follow-up: {assignment.officer.username}",
                    origin_assignment=assignment,
                    origin_submission=submission,
                )
                report.set_status_context(actor=self.request.user, reason='Follow-up report created from officer submission')
                report.save()
                submission_report = report
            except Exception:
                logger.exception("Error creating follow-up report for assignment %s", assignment.id)
                submission_report = assignment.report
        # If this is a General/Persistent assignment (no pre-existing report), create a report now
        elif not assignment.report:
            try:
                # Create a new HazardReport to hold this submission results
                report = HazardReport(
                    form_version=assignment.form_version,
                    data=submission.data,
                    latitude=submission.latitude,
                    longitude=submission.longitude,
                    status='resolved',
                    priority='medium',
                    reporter_name=f"Officer Patrol: {assignment.officer.username}",
                    origin_assignment=assignment,
                    origin_submission=submission,
                )
                report.set_status_context(actor=self.request.user, reason='Hazard report created from officer submission')
                report.save()
                submission_report = report
            except Exception:
                logger.exception("Error creating report for persistent assignment %s", assignment.id)
                submission_report = None
        else:
            submission_report = assignment.report

        # Propagate location to the report and event
        if submission.latitude is not None and submission.longitude is not None and submission_report:
            try:
                report = submission_report
                
                # Update Report Location
                if report.latitude != submission.latitude or report.longitude != submission.longitude:
                    report.latitude = submission.latitude
                    report.longitude = submission.longitude
                    report.save()
                
                # Update or Create Event
                from infrastructure.models import EventModel
                from domain.entities import EventSeverity, EventStatus
                
                # Check for existing event
                if hasattr(report, 'event') and report.event:
                    event = report.event
                    event.latitude = submission.latitude
                    event.longitude = submission.longitude
                    event.save()
                    print(f"Updated event location for report {report.tracking_id}")
                else:
                    # Create new event if missing
                    print(f"Auto-creating missing event for report {report.tracking_id}")
                    
                    # Map priority/severity
                    severity_map = {
                        'low': EventSeverity.LOW.value,
                        'medium': EventSeverity.MEDIUM.value,
                        'high': EventSeverity.HIGH.value,
                        'critical': EventSeverity.CRITICAL.value
                    }
                    
                    event = EventModel(
                        title=f"{report.form_version.template.name} - {report.tracking_id}",
                        description=f"Officer Report Submitted.\n\nType: {report.form_version.template.name}\nTracking ID: {report.tracking_id}\nAddress: {report.address}",
                        category=report.form_version.template.event_category,
                        severity=severity_map.get(report.priority, EventSeverity.MEDIUM.value),
                        status=EventStatus.VERIFIED.value, # Officer submitted, so it's verified
                        latitude=submission.latitude,
                        longitude=submission.longitude,
                        trust_score=1.0,
                        source_system='inehss',
                        source_record_type='hazard_report',
                        source_record_id=str(report.id),
                        source_form_version_id=report.form_version_id,
                    )
                    event.set_status_context(actor=self.request.user, reason='Event created from officer submission')
                    event.save()
                    HazardReport.objects.filter(pk=report.pk).update(event=event)
                    report.event = event

            except Exception as e:
                logger.exception("Error propagating location data for submission %s", submission.id)


class MediaAttachmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for file uploads.
    Supports uploading attachments for reports and submissions.
    """
    queryset = MediaAttachment.objects.all()
    serializer_class = MediaAttachmentSerializer
    
    def get_permissions(self):
        # Allow public to upload to reports, but submissions require auth
        if self.request.data.get('report'):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
    
    def create(self, request, *args, **kwargs):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        max_file_size = 20 * 1024 * 1024
        if file.size > max_file_size:
            return Response({'error': 'File too large. Max size is 20MB.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Determine file type
        content_type = file.content_type
        if content_type.startswith('image/'):
            file_type = 'image'
        elif content_type.startswith('video/'):
            file_type = 'video'
        else:
            file_type = 'document'

        allowed_types = {
            'image/jpeg', 'image/png', 'image/webp',
            'video/mp4', 'video/webm',
            'application/pdf',
        }
        if content_type not in allowed_types:
            return Response({'error': f'Unsupported file type: {content_type}'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create attachment
        attachment = MediaAttachment(
            file=file,
            file_type=file_type,
            original_filename=file.name,
            file_size=file.size,
            report_id=request.data.get('report'),
            submission_id=request.data.get('submission')
        )
        attachment.save()
        
        serializer = self.get_serializer(attachment)
        
        # Sync to Infrastructure Event System
        try:
            from infrastructure.models import MediaModel
            
            event = None
            if attachment.report and attachment.report.event:
                event = attachment.report.event
            elif attachment.submission:
                submission_report = getattr(attachment.submission, 'generated_report', None) or attachment.submission.assignment.report
                if submission_report and submission_report.event:
                    event = submission_report.event
                
            if event:
                MediaModel.objects.create(
                    event=event,
                    file=attachment.file,
                    file_type=attachment.file_type,
                    metadata={
                        'source': 'inehss', 
                        'original_filename': attachment.original_filename,
                        'inehss_attachment_id': str(attachment.id)
                    }
                )
                print(f"Synced attachment {attachment.id} to Event {event.id}")
        except Exception as e:
            print(f"Failed to sync attachment to event system: {e}")

        return Response(serializer.data, status=status.HTTP_201_CREATED)
