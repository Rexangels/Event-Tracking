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
    def get(self, request, *args, **kwargs):
        # In a real app, add permission_classes = [IsAdminUser]
        events = EventModel.objects.all().order_by('-created_at')
        serializer = EventReportSerializer(events, many=True)
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
