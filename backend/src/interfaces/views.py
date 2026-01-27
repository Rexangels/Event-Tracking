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
from infrastructure.models import AuditLog
from .serializers import AuditLogSerializer # Assuming AuditLogSerializer is in the same .serializers file

class EventReportCreateView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        # Extract data
        data = request.data.dict() # Convert QueryDict to dict
        files = request.FILES.getlist('files') # Get list of uploaded files

        # Clean data types manually if coming from FormData (e.g., 'latitude' might be string)
        # For simplicity, we pass valid keys to the serializer/service
        # Ideally, use a Serializer to validate 'data' first.
        
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
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
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
    def get(self, request, *args, **kwargs):
        queryset = EventModel.objects.all()
        
        # Geospatial: Bounding Box Filter (pure Python using lat/lon ranges)
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
                pass  # Invalid bbox, ignore filter
        
        # Severity Filter
        severity = request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity.lower())
        
        # Status Filter
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.lower())
        
        # Limit results for performance
        limit = int(request.query_params.get('limit', 100))
        queryset = queryset.order_by('-created_at')[:limit]
        
        serializer = EventReportSerializer(queryset, many=True)
        return Response(serializer.data)

class StatsSummaryView(APIView):
    def get(self, request, *args, **kwargs):
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

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API endpoint for governance audit logs.
    """
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

class CustomAuthToken(ObtainAuthToken):
    """
    Custom Auth Token View that returns user details along with the token.
    """
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
