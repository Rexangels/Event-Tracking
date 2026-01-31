"""
INEHSS Admin Configuration
"""

from django.contrib import admin
from .models import FormTemplate, HazardReport, OfficerAssignment, FormSubmission, MediaAttachment


@admin.register(FormTemplate)
class FormTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'form_type', 'is_active', 'created_at']
    list_filter = ['form_type', 'is_active']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(HazardReport)
class HazardReportAdmin(admin.ModelAdmin):
    list_display = ['tracking_id', 'form_template', 'status', 'priority', 'created_at']
    list_filter = ['status', 'priority', 'form_template']
    search_fields = ['tracking_id', 'reporter_name', 'address']
    readonly_fields = ['id', 'tracking_id', 'created_at', 'updated_at']
    raw_id_fields = ['form_template']


@admin.register(OfficerAssignment)
class OfficerAssignmentAdmin(admin.ModelAdmin):
    list_display = ['report', 'officer', 'status', 'assigned_at', 'due_date']
    list_filter = ['status', 'inspection_form']
    search_fields = ['report__tracking_id', 'officer__username']
    readonly_fields = ['id', 'assigned_at', 'completed_at']
    raw_id_fields = ['report', 'officer', 'inspection_form', 'assigned_by']


@admin.register(FormSubmission)
class FormSubmissionAdmin(admin.ModelAdmin):
    list_display = ['assignment', 'submitted_by', 'is_draft', 'submitted_at']
    list_filter = ['is_draft']
    readonly_fields = ['id', 'submitted_at']
    raw_id_fields = ['assignment', 'submitted_by']


@admin.register(MediaAttachment)
class MediaAttachmentAdmin(admin.ModelAdmin):
    list_display = ['original_filename', 'file_type', 'report', 'submission', 'uploaded_at']
    list_filter = ['file_type']
    readonly_fields = ['id', 'uploaded_at']
