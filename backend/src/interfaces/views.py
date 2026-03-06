from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from application.services import EventReportingService
from infrastructure.models import EventModel
from .serializers import EventReportSerializer
from django.db.models import Count, Q
from domain.entities import EventSeverity, EventStatus
import logging
import json

from rest_framework import viewsets, permissions
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from infrastructure.health import build_health_report
from infrastructure.models import AuditLog, AIInteractionLog, SyncConflictLog
from .serializers import (
    AuditLogSerializer,
    AIInteractionLogSerializer,
    AIInteractionLogCreateSerializer,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import ScopedRateThrottle
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

from .ai_audit import redact_sensitive_text, normalize_explainability

logger = logging.getLogger(__name__)


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

class EventReportCreateView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [permissions.AllowAny]

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
                logger.error(f"Event creation failed: {str(e)}")
                return Response(
                    {'error': f"SYSTEM_ERROR: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
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
            verified_count = EventModel.objects.filter(status=EventStatus.VERIFIED.value).count()
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
            logger.exception('StatsSummaryView error')
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class CanViewGovernanceLedger(permissions.BasePermission):
    """Allow access to governance ledger for staff/admin/supervisor/analyst roles."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True

        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', None)
        return role in {'admin', 'supervisor', 'analyst'}


def _verify_audit_chain(logs):
    previous_hash = '0' * 64
    for log in logs:
        if log.prev_hash != previous_hash:
            return False
        previous_hash = log.entry_hash
    return True

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API endpoint for governance audit logs.
    """
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [CanViewGovernanceLedger]



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




class GovernanceLedgerView(APIView):
    """Governance ledger endpoint with integrity metadata."""

    permission_classes = [CanViewGovernanceLedger]

    def get(self, request, *args, **kwargs):
        logs = AuditLog.objects.all().order_by('-timestamp')[:200]
        serialized_logs = AuditLogSerializer(logs, many=True).data
        # Verify full chain integrity for status indicator
        integrity_ok = _verify_audit_chain(AuditLog.objects.all().order_by('timestamp').iterator())
        return Response({
            'integrity_ok': integrity_ok,
            'count': len(serialized_logs),
            'results': serialized_logs,
        })


class GovernanceTrustIndexView(APIView):
    """Governance trust metrics endpoint for dashboard scorecards."""

    permission_classes = [CanViewGovernanceLedger]

    def get(self, request, *args, **kwargs):
        logs_asc = list(AuditLog.objects.all().order_by('timestamp'))
        total_logs = len(logs_asc)
        integrity_ok = _verify_audit_chain(logs_asc) if total_logs else True

        success_logs = sum(1 for l in logs_asc if (l.status or '').upper() in {'SUCCESS', 'VERIFIED'})
        source_verification = round((success_logs / total_logs) * 100, 1) if total_logs else 100.0

        from infrastructure.models import EventModel
        total_events = EventModel.objects.count()
        event_with_location = EventModel.objects.filter(latitude__isnull=False, longitude__isnull=False).count()
        data_integrity = round((event_with_location / total_events) * 100, 1) if total_events else 100.0

        ai_interaction_count = AIInteractionLog.objects.count()
        audit_coverage = round((ai_interaction_count / total_logs) * 100, 1) if total_logs else 0.0

        return Response({
            'data_integrity': data_integrity,
            'source_verification': source_verification,
            'audit_coverage': min(audit_coverage, 100.0),
            'integrity_ok': integrity_ok,
            'total_audit_logs': total_logs,
        })

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
            conflict_response = _version_conflict_response(request, event, 'event')
            if conflict_response:
                return conflict_response
            
            if action == 'verify':
                next_status = EventStatus.VERIFIED.value
                reason = 'Event verified by operator'
            elif action == 'escalate':
                next_status = EventStatus.ESCALATED.value
                reason = 'Event escalated for further review'
            elif action == 'archive':
                next_status = EventStatus.ARCHIVED.value
                reason = 'Event archived'
            else:
                return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
            
            event.transition_to(
                next_status,
                actor=request.user if request.user.is_authenticated else None,
                reason=reason,
            )
            
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
            health, http_status = build_health_report(getattr(request, 'request_id', None))
            return Response(health, status=http_status)
        except Exception as e:
            logger.exception('Health check critical error')
            return Response({'status': 'CRITICAL', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
