from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from application.services import EventReportingService
from infrastructure.models import EventModel
from .serializers import EventReportSerializer
from django.db.models import Count, Q
from domain.entities import EventSeverity, EventStatus
import json

from rest_framework import viewsets, permissions
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from infrastructure.models import AuditLog, AIInteractionLog
from .serializers import (
    AuditLogSerializer,
    AIInteractionLogSerializer,
    AIInteractionLogCreateSerializer,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import ScopedRateThrottle
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

from .ai_audit import redact_sensitive_text, normalize_explainability

class EventReportCreateView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    @extend_schema(
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'title': {'type': 'string'},
                    'description': {'type': 'string'},
                    'category': {'type': 'string'},
                    'severity': {'type': 'string'},
                    'latitude': {'type': 'number'},
                    'longitude': {'type': 'number'},
                    'files': {
                        'type': 'array',
                        'items': {'type': 'string', 'format': 'binary'}
                    }
                }
            }
        },
        responses={201: EventReportSerializer}
    )
    def post(self, request, *args, **kwargs):
        # Extract data
        data = request.data.dict() # Convert QueryDict to dict
        files = request.FILES.getlist('files') # Get list of uploaded files

        # Clean data types manually if coming from FormData
        # Normalize casing for enums
        if 'severity' in data:
            data['severity'] = data['severity'].lower()
        if 'category' in data:
            data['category'] = data['category'].lower()
        
        serializer = EventReportSerializer(data=data)
        if serializer.is_valid():
            try:
                # Use Service to handle logic
                event = EventReportingService.create_event_report(serializer.validated_data, files)
                
                # Interface: Return result using Serializer
                return Response(
                    EventReportSerializer(event).data,
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Event creation failed: {str(e)}")
                return Response(
                    {'error': f"SYSTEM_ERROR: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Validation failed for report: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class EventListAdminView(APIView):
    """
    List events with optional geospatial filtering.
    
    Query Parameters:
        - bbox: Bounding box filter (minLon,minLat,maxLon,maxLat)
        - severity: Filter by severity level
        - status: Filter by event status
        - limit: Maximum number of results (default 100)
    """
    pagination_class = PageNumberPagination

    @extend_schema(
        parameters=[
            OpenApiParameter("bbox", OpenApiTypes.STR, description="minLon,minLat,maxLon,maxLat"),
            OpenApiParameter("severity", OpenApiTypes.STR),
            OpenApiParameter("status", OpenApiTypes.STR),
            OpenApiParameter("limit", OpenApiTypes.INT, description="Number of results per page (max 100)"),
            OpenApiParameter("page", OpenApiTypes.INT, description="Page number"),
        ],
        responses={200: EventReportSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        queryset = EventModel.objects.all()
        
        # Geospatial: Bounding Box Filter
        bbox_param = request.query_params.get('bbox')
        if bbox_param:
            try:
                coords = [float(c) for c in bbox_param.split(',')]
                if len(coords) == 4:
                    min_lon, min_lat, max_lon, max_lat = coords
                    queryset = queryset.filter(
                        latitude__gte=min_lat,
                        latitude__lte=max_lat,
                        longitude__gte=min_lon,
                        longitude__lte=max_lon
                    )
            except (ValueError, TypeError):
                pass
        
        # Severity Filter
        severity = request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity.lower())
        
        # Status Filter
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.lower())
        
        queryset = queryset.order_by('-created_at')

        # Use Pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        if page is not None:
            serializer = EventReportSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        serializer = EventReportSerializer(queryset, many=True)
        return Response(serializer.data)

class StatsSummaryView(APIView):
    @extend_schema(
        responses={
            200: OpenApiTypes.OBJECT,
        },
        description="Returns aggregated data for the top-bar HUD (Active reports, Risk index)."
    )
    def get(self, request, *args, **kwargs):
        try:
            total_events = EventModel.objects.count()
            critical_events = EventModel.objects.filter(severity=EventSeverity.CRITICAL.value).count()
            high_events = EventModel.objects.filter(severity=EventSeverity.HIGH.value).count()
            
            # Calculate sensor integrity (mock logic based on recent verified events)
            verified_count = EventModel.objects.filter(status='VERIFIED').count()
            integrity = (verified_count / total_events * 100) if total_events > 0 else 100
            
            # Calculate heat index (mock logic - e.g., density of high severity events)
            heat_index = min(10.0, (critical_events * 2 + high_events) / 10.0)
            
            return Response({
                'active_reports': total_events,
                'critical_sectors': critical_events,
                'sensor_integrity': round(integrity, 1),
                'global_heat_index': round(heat_index, 1)
            })
        except Exception as e:
            import traceback
            with open('server_error.log', 'a') as f:
                f.write(f"StatsSummaryView Error: {str(e)}\n")
                f.write(traceback.format_exc())
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API endpoint for governance audit logs.
    """
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]



class CanViewAIInteractionLogs(permissions.BasePermission):
    """Allow access to AI audit logs for staff, admin, supervisor, and analyst roles."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True

        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', None)
        return role in {'admin', 'supervisor', 'analyst'}


class AIInteractionLogViewSet(viewsets.ModelViewSet):
    """AI interaction audit endpoint.

    - POST: authenticated clients can submit interaction logs (prompt is redacted server-side).
    - GET: restricted to staff/admin/supervisor/analyst for governance review.
    """

    queryset = AIInteractionLog.objects.all().order_by('-created_at')
    http_method_names = ['get', 'post', 'head', 'options']

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated()]
        return [CanViewAIInteractionLogs()]

    def get_serializer_class(self):
        if self.action == 'create':
            return AIInteractionLogCreateSerializer
        return AIInteractionLogSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        explainability = normalize_explainability(serializer.validated_data.get('explainability'))
        prompt = redact_sensitive_text(serializer.validated_data.get('prompt_redacted', ''))
        response_text = serializer.validated_data.get('response_text', '')

        log = AIInteractionLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            provider=serializer.validated_data.get('provider', 'openrouter'),
            model_name=serializer.validated_data.get('model_name', ''),
            prompt_redacted=prompt,
            response_text=response_text,
            explainability=explainability,
            confidence_label=explainability.get('confidence_label', ''),
            confidence_score=explainability.get('confidence_score'),
        )

        return Response(AIInteractionLogSerializer(log).data, status=status.HTTP_201_CREATED)


class CustomAuthToken(ObtainAuthToken):
    """
    Custom Auth Token View that returns user details along with the token.
    Includes rate limiting to prevent brute force.
    """
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email,
            'username': user.username,
            'is_staff': user.is_staff
        })

class EventActionView(APIView):
    """
    Handle lifecycle actions for events: verify, escalate, archive.
    """
    @extend_schema(
        parameters=[
            OpenApiParameter("pk", OpenApiTypes.UUID, location=OpenApiParameter.PATH),
            OpenApiParameter("action", OpenApiTypes.STR, enum=['verify', 'escalate', 'archive'], location=OpenApiParameter.PATH)
        ],
        responses={200: EventReportSerializer, 400: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT}
    )
    def post(self, request, pk=None, action=None, *args, **kwargs):
        try:
            event = EventModel.objects.get(pk=pk)
            
            if action == 'verify':
                event.status = EventStatus.VERIFIED.value
            elif action == 'escalate':
                event.status = EventStatus.ESCALATED.value
                # In a real app, we'd store escalation details in a separate model
            elif action == 'archive':
                event.status = EventStatus.ARCHIVED.value
            else:
                return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
            
            event.save()
            
            # Audit the action
            AuditLog.objects.create(
                action=f'EVENT_{action.upper()}',
                source=request.user.username if request.user.is_authenticated else 'Anonymous',
                status='SUCCESS',
                details=f'Event {pk} status changed to {event.status}'
            )
            
            return Response(EventReportSerializer(event).data)
        except EventModel.DoesNotExist:
            return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class HealthCheckView(APIView):
    """
    Checks system health for the demo dashboard.
    """
    permission_classes = [permissions.AllowAny]
    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, *args, **kwargs):
        try:
            health = {
                'status': 'OPERATIONAL',
                'database': 'CONNECTED',
                'services': 'STABLE',
                'latency': 'OK'
            }
            try:
                from django.db import connection
                connection.ensure_connection()
            except Exception as e:
                import traceback
                with open('server_error.log', 'a') as f:
                    f.write(f"DB Connection Error: {str(e)}\n")
                    f.write(traceback.format_exc())
                health['database'] = 'ERROR'
                health['status'] = 'DEGRADED'
                
            return Response(health)
        except Exception as e:
            import traceback
            with open('server_error.log', 'a') as f:
                f.write(f"HealthCheckView Critical Error: {str(e)}\n")
                f.write(traceback.format_exc())
            return Response({'status': 'CRITICAL', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
