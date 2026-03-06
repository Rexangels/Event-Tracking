import hashlib
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

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
    source_system = models.CharField(max_length=50, default='sentinel', db_index=True)
    source_record_type = models.CharField(max_length=50, blank=True, db_index=True)
    source_record_id = models.CharField(max_length=64, blank=True, db_index=True)
    source_form_version_id = models.UUIDField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)
    
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
            models.Index(fields=['source_system', 'source_record_type'], name='events_source_idx'),
        ]

    parent_event = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='follow_up_events')

    def set_status_context(self, actor=None, reason: str = '', metadata: dict | None = None):
        self._status_actor = actor if getattr(actor, 'is_authenticated', False) else None
        self._status_reason = reason or ''
        self._status_metadata = metadata or {}

    def transition_to(self, new_status: str, actor=None, reason: str = '', metadata: dict | None = None):
        self.set_status_context(actor=actor, reason=reason, metadata=metadata)
        self.status = new_status
        self.save()

    def save(self, *args, **kwargs):
        previous = None
        if self.pk:
            previous = EventModel.objects.filter(pk=self.pk).values('status', 'version').first()
            if previous:
                self.version = previous['version'] + 1

        super().save(*args, **kwargs)

        previous_status = previous['status'] if previous else None
        if previous is None or previous_status != self.status:
            EventStatusHistory.objects.create(
                event=self,
                from_status=previous_status or '',
                to_status=self.status,
                changed_by=getattr(self, '_status_actor', None),
                reason=getattr(self, '_status_reason', ''),
                metadata=getattr(self, '_status_metadata', {}),
            )

        for attr in ('_status_actor', '_status_reason', '_status_metadata'):
            if hasattr(self, attr):
                delattr(self, attr)

    def __str__(self):
        return f"{self.title or 'Untitled'} ({self.status})"


class EventStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(EventModel, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='event_status_changes')
    reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'event_status_history'
        ordering = ['changed_at']

    def __str__(self):
        return f"{self.event_id}: {self.from_status or 'created'} -> {self.to_status}"


class SyncConflictLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record_type = models.CharField(max_length=50, db_index=True)
    record_id = models.CharField(max_length=64, db_index=True)
    client_version = models.PositiveIntegerField()
    server_version = models.PositiveIntegerField()
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='sync_conflicts')
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sync_conflict_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.record_type}:{self.record_id} ({self.client_version} != {self.server_version})"

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
    prev_hash = models.CharField(max_length=64, editable=False, db_index=True, default='0' * 64)
    entry_hash = models.CharField(max_length=64, editable=False, unique=True, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']

    def _build_hash(self) -> str:
        payload = '|'.join([
            str(self.id),
            self.action or '',
            self.source or '',
            self.status or '',
            self.details or '',
            self.ip_address or '',
            self.prev_hash or ('0' * 64),
            timezone.now().isoformat(),
        ])
        return hashlib.sha256(payload.encode('utf-8')).hexdigest()

    def save(self, *args, **kwargs):
        if self.pk and AuditLog.objects.filter(pk=self.pk).exists():
            raise ValidationError('AuditLog is append-only and cannot be modified.')

        if not self.entry_hash:
            previous_entry = AuditLog.objects.order_by('-timestamp').values('entry_hash').first()
            self.prev_hash = previous_entry['entry_hash'] if previous_entry and previous_entry.get('entry_hash') else ('0' * 64)
            self.entry_hash = self._build_hash()

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.action} - {self.source} ({self.status})"


class AIInteractionLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='ai_interactions')
    provider = models.CharField(max_length=100, default='openrouter')
    model_name = models.CharField(max_length=150, blank=True)
    prompt_redacted = models.TextField()
    response_text = models.TextField()
    explainability = models.JSONField(default=dict, blank=True)
    confidence_label = models.CharField(max_length=20, blank=True)
    confidence_score = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_interaction_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.provider}:{self.model_name or 'unknown'} ({self.created_at.isoformat()})"
