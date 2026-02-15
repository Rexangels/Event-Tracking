"""
INEHSS API Views
"""

from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from django.db.models import Q

from .models import FormTemplate, HazardReport, OfficerAssignment, FormSubmission, MediaAttachment
from .serializers import (
    FormTemplateSerializer, FormSchemaSerializer,
    HazardReportSerializer, HazardReportCreateSerializer,
    OfficerAssignmentSerializer,
    FormSubmissionSerializer, FormSubmissionCreateSerializer,
    MediaAttachmentSerializer
)

User = get_user_model()


class OfficerListView(APIView):
    """List staff users who can be assigned as officers"""
    permission_classes = [permissions.IsAdminUser]
    
    def get(self, request):
        officers = User.objects.filter(is_staff=True).values('id', 'username', 'email', 'date_joined')
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
                is_staff=True  # Officers must be staff to access admin endpoints
            )
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
            return FormTemplate.objects.all()
        return FormTemplate.objects.filter(is_active=True)
    
    @action(detail=True, methods=['get'])
    def schema(self, request, pk=None):
        """Get the full schema for a specific form template"""
        template = self.get_object()
        serializer = FormSchemaSerializer(template)
        return Response(serializer.data)
    
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
        queryset = HazardReport.objects.all().order_by('-created_at')

        tracking_id = self.request.query_params.get('tracking_id')
        priority = self.request.query_params.get('priority')
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        min_lat = self.request.query_params.get('min_lat')
        max_lat = self.request.query_params.get('max_lat')
        min_lon = self.request.query_params.get('min_lon')
        max_lon = self.request.query_params.get('max_lon')

        if tracking_id:
            queryset = queryset.filter(tracking_id__icontains=tracking_id)
        if priority:
            queryset = queryset.filter(priority=priority)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if search:
            queryset = queryset.filter(
                Q(reporter_name__icontains=search)
                | Q(reporter_email__icontains=search)
                | Q(address__icontains=search)
                | Q(tracking_id__icontains=search)
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

        return queryset
    
    def get_serializer_class(self):
        if self.action == 'create':
            return HazardReportCreateSerializer
        return HazardReportSerializer
    
    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
    
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
            event = EventModel.objects.create(
                title=f"{instance.form_template.name} - {instance.tracking_id}",
                description=f"Public hazard report submitted via INEHSS.\n\nType: {instance.form_template.name}\nTracking ID: {instance.tracking_id}\nAddress: {instance.address}",
                category=instance.form_template.event_category,
                severity=severity_map.get(instance.priority, EventSeverity.MEDIUM.value),
                status=EventStatus.PENDING.value,
                latitude=instance.latitude,
                longitude=instance.longitude,
                trust_score=0.5  # Unverified public report
            )
            
            # Link event to report
            instance.event = event
            instance.save()
            
        except Exception as e:
            # Don't fail the report submission if event creation fails, just log it
            print(f"Failed to auto-create event for report {instance.id}: {e}")
            
        # Return the tracking ID to the user
        return Response({
            'id': str(instance.id),
            'tracking_id': instance.tracking_id,
            'message': 'Report submitted successfully. Save your tracking ID for follow-up.'
        }, status=status.HTTP_201_CREATED)
    
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
        if user.is_staff:
            return OfficerAssignment.objects.all()
        return OfficerAssignment.objects.filter(officer=user)

    def _ensure_owner_or_staff(self, assignment, request):
        return assignment.officer == request.user or request.user.is_staff

    def create(self, request, *args, **kwargs):
        print("DEBUG: Creating assignment payload:", request.data)
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("DEBUG: Assignment Validation Errors:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Officer accepts an assignment"""
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        
        assignment.status = 'accepted'
        assignment.progress_percent = max(assignment.progress_percent, 10)
        assignment.save()
        return Response({'status': 'Assignment accepted'})

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        assignment.status = 'in_progress'
        assignment.progress_percent = max(assignment.progress_percent, 25)
        assignment.save()
        return Response({'status': 'Assignment in progress'})

    @action(detail=True, methods=['post'])
    def submit_review(self, request, pk=None):
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        assignment.status = 'awaiting_review'
        assignment.progress_percent = max(assignment.progress_percent, 85)
        assignment.save()
        return Response({'status': 'Assignment submitted for review'})

    @action(detail=True, methods=['post'])
    def request_revision(self, request, pk=None):
        assignment = self.get_object()
        if not request.user.is_staff:
            return Response({'error': 'Only staff can request revision'}, status=status.HTTP_403_FORBIDDEN)
        assignment.status = 'revision_needed'
        assignment.notes = request.data.get('notes', assignment.notes)
        assignment.progress_percent = min(assignment.progress_percent, 80)
        assignment.save()
        return Response({'status': 'Revision requested'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        assignment = self.get_object()
        if not request.user.is_staff:
            return Response({'error': 'Only staff can approve'}, status=status.HTTP_403_FORBIDDEN)
        assignment.status = 'approved'
        assignment.progress_percent = 100
        assignment.save()
        return Response({'status': 'Assignment approved'})

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        assignment.status = 'declined'
        assignment.notes = request.data.get('reason', assignment.notes)
        assignment.save()
        return Response({'status': 'Assignment declined'})

    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        assignment = self.get_object()
        if not self._ensure_owner_or_staff(assignment, request):
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
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
        if not request.user.is_staff:
            return Response({'error': 'Only staff can reassign assignments'}, status=status.HTTP_403_FORBIDDEN)

        new_officer_id = request.data.get('officer_id')
        if not new_officer_id:
            return Response({'error': 'officer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_officer = User.objects.get(id=new_officer_id)
        except User.DoesNotExist:
            return Response({'error': 'Selected officer does not exist'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', '').strip()

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
        
        from django.utils import timezone
        assignment.status = 'completed'
        assignment.progress_percent = 100
        assignment.completed_at = timezone.now()
        assignment.save()
        
        # Also update the report status
        assignment.report.status = 'resolved'
        assignment.report.save()
        
        return Response({'status': 'Assignment completed'})


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
        except OfficerAssignment.DoesNotExist:
            return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
        
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        submission = serializer.save()
        assignment = submission.assignment
        
        # If this is a General/Persistent assignment (no pre-existing report), create a report now
        if not assignment.report:
            try:
                # Create a new HazardReport to hold this submission results
                report = HazardReport.objects.create(
                    form_template=assignment.inspection_form, # Use the inspection form as the template
                    data=submission.data,
                    latitude=submission.latitude,
                    longitude=submission.longitude,
                    status='resolved', # Officer submission typically resolves the issue
                    priority='medium',
                    reporter_name=f"Officer Patrol: {assignment.officer.username}"
                )
                # Link this submission to the newly created report (conceptually)
                # Note: Currently OfficerAssignment links to Report, but in persistent mode, 
                # we might want to track which report each submission created.
                # For now, we propagate the location as if it were the assignment's report.
                submission_report = report
            except Exception as e:
                print(f"Error creating report for persistent assignment: {e}")
                submission_report = None
        else:
            submission_report = assignment.report

        # Propagate location to the report and event
        if submission.latitude and submission.longitude and submission_report:
            try:
                report = submission_report
                
                # Update Report Location
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
                    
                    event = EventModel.objects.create(
                        title=f"{report.form_template.name} - {report.tracking_id}",
                        description=f"Officer Report Submitted.\n\nType: {report.form_template.name}\nTracking ID: {report.tracking_id}\nAddress: {report.address}",
                        category=report.form_template.event_category,
                        severity=severity_map.get(report.priority, EventSeverity.MEDIUM.value),
                        status=EventStatus.VERIFIED.value, # Officer submitted, so it's verified
                        latitude=submission.latitude,
                        longitude=submission.longitude,
                        trust_score=1.0 
                    )
                    report.event = event
                    report.save()

            except Exception as e:
                print(f"Error propagating location data: {e}")


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
            elif attachment.submission and attachment.submission.assignment.report.event:
                event = attachment.submission.assignment.report.event
                
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
