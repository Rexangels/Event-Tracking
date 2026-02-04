"""
INEHSS Models - Dynamic Form System for Environmental Hazard Surveillance

Models:
- FormTemplate: Stores dynamic form definitions as JSON schema
- HazardReport: Public submissions (links to FormTemplate)
- OfficerAssignment: Links Officer to HazardReport
- FormSubmission: Officer inspection responses
"""

import uuid
from django.db import models
from django.contrib.auth.models import User


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
    is_active = models.BooleanField(default=True)
    
    # JSON Schema defining the form fields
    # Example: [{"name": "facility_name", "type": "text", "label": "Facility Name", "required": true}, ...]
    schema = models.JSONField(default=list)
    
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
    tracking_id = models.CharField(max_length=20, unique=True, editable=False)
    
    form_template = models.ForeignKey(
        FormTemplate, 
        on_delete=models.PROTECT,  # Don't delete template if reports exist
        related_name='reports'
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
    
    def save(self, *args, **kwargs):
        if not self.tracking_id:
            # Generate tracking ID: INH-YYYYMMDD-XXXX
            from datetime import datetime
            import random
            date_str = datetime.now().strftime('%Y%m%d')
            random_suffix = ''.join([str(random.randint(0, 9)) for _ in range(4)])
            self.tracking_id = f"INH-{date_str}-{random_suffix}"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.tracking_id} - {self.form_template.name}"


class OfficerAssignment(models.Model):
    """
    Links an Officer (User) to a HazardReport for investigation.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('declined', 'Declined'),
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
    
    # What form should the officer fill?
    inspection_form = models.ForeignKey(
        FormTemplate,
        on_delete=models.PROTECT,
        related_name='assignments',
        limit_choices_to={'form_type': 'officer'}
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    is_persistent = models.BooleanField(default=False, help_text="If true, assignment remains open for multiple submissions (Patrol Mode)")
    notes = models.TextField(blank=True, help_text="Admin notes for the officer")
    
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
    
    def __str__(self):
        return f"{self.officer.username} -> {self.report.tracking_id}"


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
    
    # Metadata
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    # Draft support
    is_draft = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-submitted_at']
    
    def __str__(self):
        return f"Submission for {self.assignment}"


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
