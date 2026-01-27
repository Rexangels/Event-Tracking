from django.db import models
import uuid
from domain.entities import EventSeverity, EventStatus

class EventModel(models.Model):
    """
    Core event model with geospatial data.
    Uses simple lat/lon float fields with pure Python geospatial calculations.
    Can migrate to PostGIS PointField when GDAL is properly configured.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField()
    category = models.CharField(max_length=100, default='general')
    severity = models.CharField(
        max_length=20,
        choices=[(tag.value, tag.name) for tag in EventSeverity],
        default=EventSeverity.LOW.value
    )
    status = models.CharField(
        max_length=20,
        choices=[(tag.value, tag.name) for tag in EventStatus],
        default=EventStatus.PENDING.value
    )
    
    # Location data (simple floats for GDAL-free environment)
    latitude = models.FloatField(null=True, blank=True, db_index=True)
    longitude = models.FloatField(null=True, blank=True, db_index=True)
    accuracy = models.FloatField(default=0.0)  # in meters
    altitude = models.FloatField(null=True, blank=True)
    
    trust_score = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'events'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['latitude', 'longitude'], name='events_coords_idx'),
        ]

    def __str__(self):
        return f"{self.title or 'Untitled'} ({self.status})"

class MediaModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(EventModel, on_delete=models.CASCADE, related_name='media_attachments')
    file = models.FileField(upload_to='uploads/%Y/%m/%d/')
    file_type = models.CharField(max_length=50, default='image') # image, video, audio
    file_hash = models.CharField(max_length=64, blank=True) # SHA-256
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'event_media'

    def __str__(self):
        return f"Media {self.id} for {self.event.id}"



class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=50)  # e.g., 'LOGIN', 'CREATE_EVENT'
    source = models.CharField(max_length=50)  # e.g., 'Username', 'System'
    status = models.CharField(max_length=20)  # e.g., 'SUCCESS', 'FAILURE'
    details = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} - {self.source} ({self.status})"
