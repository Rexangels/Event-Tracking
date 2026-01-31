"""
INEHSS API Views
"""

from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

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
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Officer accepts an assignment"""
        assignment = self.get_object()
        if assignment.officer != request.user:
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        
        assignment.status = 'accepted'
        assignment.save()
        return Response({'status': 'Assignment accepted'})
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark assignment as completed"""
        assignment = self.get_object()
        if assignment.officer != request.user:
            return Response({'error': 'Not your assignment'}, status=status.HTTP_403_FORBIDDEN)
        
        from django.utils import timezone
        assignment.status = 'completed'
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
        
        # Determine file type
        content_type = file.content_type
        if content_type.startswith('image/'):
            file_type = 'image'
        elif content_type.startswith('video/'):
            file_type = 'video'
        else:
            file_type = 'document'
        
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
        return Response(serializer.data, status=status.HTTP_201_CREATED)
