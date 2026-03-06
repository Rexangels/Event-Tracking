"""INEHSS models for dynamic forms, case workflows, and normalized answer storage."""

import json
import uuid

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


def _schema_field_key(field: dict, fallback_index: int) -> str:
    raw_key = field.get('name') or field.get('key') or field.get('id') or f'field_{fallback_index}'
    return str(raw_key)


def _value_to_text(value) -> str:
    if value is None:
        return ''
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True, default=str)
    return str(value)


class FormTemplate(models.Model):
    """
    Dynamic form definition. Admins create these via Django Admin.
    The schema field stores the form structure as JSON.
    """
    FORM_TYPE_CHOICES = [
        ('public', 'Public Report'),
        ('officer', 'Officer Inspection'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    form_type = models.CharField(max_length=20, choices=FORM_TYPE_CHOICES, default='public')
    follow_up_for = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='follow_up_templates',
        help_text='Base form template that this officer form is designed to follow up on.',
    )
    # Form properties
    is_active = models.BooleanField(default=True)
    
    GEO_MODE_CHOICES = [
        ('disabled', 'Disabled'),
        ('manual', 'Manual Entry'),
        ('auto', 'Automatic GPS')
    ]
    geo_mode = models.CharField(max_length=20, choices=GEO_MODE_CHOICES, default='manual', help_text="Strategy for capturing geolocation")
    
    # Map display configuration
    map_icon = models.CharField(max_length=50, default='warning', help_text="Icon name for map markers (e.g., warning, alert, biohazard)")
    map_color = models.CharField(max_length=20, default='#f97316', help_text="Hex color for map markers")
    event_category = models.CharField(max_length=100, default='environmental_hazard', help_text="Category for events created from this form")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.form_type})"


class FormVersion(models.Model):
    """
    Immutable version of a FormTemplate's schema.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(FormTemplate, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    schema = models.JSONField(default=list)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('template', 'version_number')
        ordering = ['-version_number']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.sync_field_definitions()

    def sync_field_definitions(self):
        active_keys = []
        for index, field in enumerate(self.schema or [], start=1):
            if not isinstance(field, dict):
                continue
            field_key = _schema_field_key(field, index)
            FormFieldDefinition.objects.update_or_create(
                form_version=self,
                field_key=field_key,
                defaults={
                    'field_label': field.get('label') or field_key.replace('_', ' ').title(),
                    'field_type': str(field.get('type', 'text')),
                    'is_required': bool(field.get('required', False)),
                    'is_active': True,
                    'order_index': index,
                    'config': field,
                },
            )
            active_keys.append(field_key)

        if active_keys:
            self.field_definitions.exclude(field_key__in=active_keys).update(is_active=False)
        else:
            self.field_definitions.update(is_active=False)

    def __str__(self):
        return f"{self.template.name} - v{self.version_number}"


class FormFieldDefinition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form_version = models.ForeignKey(FormVersion, on_delete=models.CASCADE, related_name='field_definitions')
    field_key = models.CharField(max_length=150)
    field_label = models.CharField(max_length=255)
    field_type = models.CharField(max_length=50, default='text')
    is_required = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    order_index = models.PositiveIntegerField(default=0)
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('form_version', 'field_key')
        ordering = ['order_index', 'field_label']

    def __str__(self):
        return f"{self.form_version} :: {self.field_key}"



class HazardReport(models.Model):
    """
    Public hazard reports submitted by citizens.
    Data is stored generically in JSON format.
    """
    STATUS_CHOICES = [
        ('new', 'New'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tracking_id = models.CharField(max_length=24, unique=True, editable=False)

    form_version = models.ForeignKey(
        FormVersion,
        on_delete=models.PROTECT,
        related_name='reports'
    )
    
    parent_report = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='follow_up_reports')
    origin_assignment = models.ForeignKey(
        'OfficerAssignment',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='generated_reports'
    )
    origin_submission = models.OneToOneField(
        'FormSubmission',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='generated_report'
    )
    
    # Submitted data (matches the form_template schema)
    data = models.JSONField(default=dict)
    
    # Location
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    address = models.TextField(blank=True)
    
    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    
    # Optional reporter info
    reporter_name = models.CharField(max_length=255, blank=True)
    reporter_phone = models.CharField(max_length=50, blank=True)
    reporter_email = models.EmailField(blank=True)
    
    # Metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    
    # Link to main Event system for map display
    event = models.ForeignKey(
        'infrastructure.EventModel',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='hazard_reports'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']

    def set_status_context(self, actor=None, reason: str = '', metadata: dict | None = None):
        self._status_actor = actor if getattr(actor, 'is_authenticated', False) else None
        self._status_reason = reason or ''
        self._status_metadata = metadata or {}

    def sync_field_values(self):
        if not self.form_version_id or not isinstance(self.data, dict):
            return

        field_definitions = {d.field_key: d for d in self.form_version.field_definitions.all()}
        seen_definition_ids = []

        for key, value in self.data.items():
            field_definition = field_definitions.get(str(key))
            if field_definition is None:
                field_definition = FormFieldDefinition.objects.create(
                    form_version=self.form_version,
                    field_key=str(key),
                    field_label=str(key).replace('_', ' ').title(),
                    field_type='unknown',
                    is_active=False,
                    order_index=len(field_definitions) + 1,
                    config={'auto_generated': True},
                )
                field_definitions[field_definition.field_key] = field_definition

            HazardReportValue.objects.update_or_create(
                report=self,
                field_definition=field_definition,
                defaults={
                    'value': value,
                    'value_text': _value_to_text(value),
                },
            )
            seen_definition_ids.append(field_definition.id)

        if seen_definition_ids:
            self.field_values.exclude(field_definition_id__in=seen_definition_ids).delete()
        else:
            self.field_values.all().delete()
    
    def save(self, *args, **kwargs):
        previous = None
        if self.pk:
            previous = HazardReport.objects.filter(pk=self.pk).values('status', 'version').first()
            if previous:
                self.version = previous['version'] + 1

        if not self.tracking_id:
            date_str = timezone.now().strftime('%Y%m%d')
            while True:
                random_suffix = uuid.uuid4().hex[:8].upper()
                candidate = f"INH-{date_str}-{random_suffix}"
                if not HazardReport.objects.filter(tracking_id=candidate).exists():
                    self.tracking_id = candidate
                    break

        super().save(*args, **kwargs)

        previous_status = previous['status'] if previous else None
        if previous is None or previous_status != self.status:
            HazardReportStatusHistory.objects.create(
                report=self,
                from_status=previous_status or '',
                to_status=self.status,
                changed_by=getattr(self, '_status_actor', None),
                reason=getattr(self, '_status_reason', ''),
                metadata=getattr(self, '_status_metadata', {}),
            )

        self.sync_field_values()

        for attr in ('_status_actor', '_status_reason', '_status_metadata'):
            if hasattr(self, attr):
                delattr(self, attr)
    
    def __str__(self):
        return f"{self.tracking_id} - {self.form_version.template.name}"


class HazardReportStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(HazardReport, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='hazard_report_status_changes')
    reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['changed_at']

    def __str__(self):
        return f"{self.report_id}: {self.from_status or 'created'} -> {self.to_status}"


class HazardReportValue(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey(HazardReport, on_delete=models.CASCADE, related_name='field_values')
    field_definition = models.ForeignKey(FormFieldDefinition, on_delete=models.PROTECT, related_name='report_values')
    value = models.JSONField(default=dict, blank=True)
    value_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('report', 'field_definition')
        ordering = ['field_definition__order_index', 'field_definition__field_label']

    def __str__(self):
        return f"{self.report.tracking_id} :: {self.field_definition.field_key}"


class OfficerAssignment(models.Model):
    """
    Links an Officer (User) to a HazardReport for investigation.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('in_progress', 'In Progress'),
        ('awaiting_review', 'Awaiting Review'),
        ('approved', 'Approved'),
        ('revision_needed', 'Revision Needed'),
        ('completed', 'Completed'),
        ('declined', 'Declined'),
        ('reassigned', 'Reassigned'),
    ]

    ESCALATION_LEVEL_CHOICES = [
        ('none', 'None'),
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    report = models.ForeignKey(
        HazardReport,
        on_delete=models.CASCADE,
        related_name='assignments',
        null=True,
        blank=True
    )
    officer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='inehss_assignments'
    )

    form_version = models.ForeignKey(
        FormVersion,
        on_delete=models.PROTECT,
        related_name='assignments'
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress_percent = models.PositiveSmallIntegerField(default=0)
    escalation_level = models.CharField(max_length=20, choices=ESCALATION_LEVEL_CHOICES, default='none')
    escalation_reason = models.TextField(blank=True)
    is_persistent = models.BooleanField(default=False, help_text="If true, assignment remains open for multiple submissions (Patrol Mode)")
    notes = models.TextField(blank=True, help_text="Admin notes for the officer")
    version = models.PositiveIntegerField(default=1)
    
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='inehss_assignments_given'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-assigned_at']

    def set_status_context(self, actor=None, reason: str = '', metadata: dict | None = None):
        self._status_actor = actor if getattr(actor, 'is_authenticated', False) else None
        self._status_reason = reason or ''
        self._status_metadata = metadata or {}

    def save(self, *args, **kwargs):
        previous = None
        if self.pk:
            previous = OfficerAssignment.objects.filter(pk=self.pk).values('status', 'version').first()
            if previous:
                self.version = previous['version'] + 1

        super().save(*args, **kwargs)

        previous_status = previous['status'] if previous else None
        if previous is None or previous_status != self.status:
            OfficerAssignmentStatusHistory.objects.create(
                assignment=self,
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
        report_ref = self.report.tracking_id if self.report else 'unlinked'
        return f"{self.officer.username} -> {report_ref}"


class OfficerAssignmentStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(OfficerAssignment, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='assignment_status_changes')
    reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['changed_at']

    def __str__(self):
        return f"{self.assignment_id}: {self.from_status or 'created'} -> {self.to_status}"


class FormSubmission(models.Model):
    """
    Officer inspection form submissions.
    Linked to an assignment (which links to the original report).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    assignment = models.ForeignKey(
        OfficerAssignment,
        on_delete=models.CASCADE,
        related_name='submissions'
    )
    
    # Submitted data (matches the inspection_form schema)
    data = models.JSONField(default=dict)
    
    # Location where inspection was conducted
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    location_accuracy_m = models.FloatField(null=True, blank=True)
    location_source = models.CharField(max_length=30, blank=True)
    location_captured_at = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    # Draft support
    is_draft = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
    
    class Meta:
        ordering = ['-submitted_at']

    def sync_field_values(self):
        if not self.assignment_id or not isinstance(self.data, dict):
            return

        form_version = self.assignment.form_version
        field_definitions = {d.field_key: d for d in form_version.field_definitions.all()}
        seen_definition_ids = []

        for key, value in self.data.items():
            field_definition = field_definitions.get(str(key))
            if field_definition is None:
                field_definition = FormFieldDefinition.objects.create(
                    form_version=form_version,
                    field_key=str(key),
                    field_label=str(key).replace('_', ' ').title(),
                    field_type='unknown',
                    is_active=False,
                    order_index=len(field_definitions) + 1,
                    config={'auto_generated': True},
                )
                field_definitions[field_definition.field_key] = field_definition

            FormSubmissionValue.objects.update_or_create(
                submission=self,
                field_definition=field_definition,
                defaults={
                    'value': value,
                    'value_text': _value_to_text(value),
                },
            )
            seen_definition_ids.append(field_definition.id)

        if seen_definition_ids:
            self.field_values.exclude(field_definition_id__in=seen_definition_ids).delete()
        else:
            self.field_values.all().delete()

    def save(self, *args, **kwargs):
        if self.pk:
            previous = FormSubmission.objects.filter(pk=self.pk).values('version').first()
            if previous:
                self.version = previous['version'] + 1

        super().save(*args, **kwargs)
        self.sync_field_values()
    
    def __str__(self):
        return f"Submission for {self.assignment}"


class FormSubmissionValue(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(FormSubmission, on_delete=models.CASCADE, related_name='field_values')
    field_definition = models.ForeignKey(FormFieldDefinition, on_delete=models.PROTECT, related_name='submission_values')
    value = models.JSONField(default=dict, blank=True)
    value_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('submission', 'field_definition')
        ordering = ['field_definition__order_index', 'field_definition__field_label']

    def __str__(self):
        return f"{self.submission_id} :: {self.field_definition.field_key}"


class MediaAttachment(models.Model):
    """
    File attachments for reports and submissions.
    """
    ATTACHMENT_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('document', 'Document'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Polymorphic link - can attach to report OR submission
    report = models.ForeignKey(
        HazardReport,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments'
    )
    submission = models.ForeignKey(
        FormSubmission,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments'
    )
    
    file = models.FileField(upload_to='inehss/attachments/%Y/%m/')
    file_type = models.CharField(max_length=20, choices=ATTACHMENT_TYPE_CHOICES)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0)  # bytes
    
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.original_filename} ({self.file_type})"
