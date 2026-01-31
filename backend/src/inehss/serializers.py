"""
INEHSS Serializers for API
"""

from rest_framework import serializers
from .models import FormTemplate, HazardReport, OfficerAssignment, FormSubmission, MediaAttachment


class FormTemplateSerializer(serializers.ModelSerializer):
    """Serializer for FormTemplate - used to list and update forms"""
    
    class Meta:
        model = FormTemplate
        fields = [
            'id', 'name', 'description', 'form_type', 'schema',
            'map_icon', 'map_color', 'event_category',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class FormSchemaSerializer(serializers.ModelSerializer):
    """Serializer for FormTemplate with full schema - used when rendering forms"""
    
    class Meta:
        model = FormTemplate
        fields = ['id', 'name', 'description', 'form_type', 'schema']


class MediaAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for media attachments"""
    
    class Meta:
        model = MediaAttachment
        fields = ['id', 'file', 'file_type', 'original_filename', 'file_size', 'uploaded_at']
        read_only_fields = ['id', 'file_size', 'uploaded_at']


class HazardReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating public hazard reports"""
    
    class Meta:
        model = HazardReport
        fields = [
            'form_template', 'data', 
            'latitude', 'longitude', 'address',
            'reporter_name', 'reporter_phone', 'reporter_email'
        ]
    
    def create(self, validated_data):
        # Capture IP and user agent from request
        request = self.context.get('request')
        if request:
            validated_data['ip_address'] = self.get_client_ip(request)
            validated_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')
        return super().create(validated_data)
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')


class HazardReportSerializer(serializers.ModelSerializer):
    """Full serializer for viewing hazard reports"""
    form_template = FormTemplateSerializer(read_only=True)
    attachments = MediaAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = HazardReport
        fields = [
            'id', 'tracking_id', 'form_template', 'data',
            'latitude', 'longitude', 'address',
            'status', 'priority',
            'reporter_name', 'reporter_phone', 'reporter_email',
            'attachments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tracking_id', 'created_at', 'updated_at']


class OfficerAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for officer assignments"""
    report = HazardReportSerializer(read_only=True)
    inspection_form = FormSchemaSerializer(read_only=True)
    officer_username = serializers.CharField(source='officer.username', read_only=True)
    
    class Meta:
        model = OfficerAssignment
        fields = [
            'id', 'report', 'officer_username', 'inspection_form',
            'status', 'notes', 'assigned_at', 'due_date', 'completed_at'
        ]
        read_only_fields = ['id', 'assigned_at', 'completed_at']


class FormSubmissionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating officer form submissions"""
    
    class Meta:
        model = FormSubmission
        fields = ['assignment', 'data', 'latitude', 'longitude', 'is_draft']
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['submitted_by'] = request.user
        return super().create(validated_data)


class FormSubmissionSerializer(serializers.ModelSerializer):
    """Full serializer for viewing form submissions"""
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True)
    attachments = MediaAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = FormSubmission
        fields = [
            'id', 'assignment', 'data',
            'latitude', 'longitude',
            'submitted_by_username', 'submitted_at',
            'is_draft', 'attachments'
        ]
        read_only_fields = ['id', 'submitted_at']
