"""
INEHSS Serializers for API
"""

from rest_framework import serializers
from application.inehss_read_services import HazardReportReadService
from .models import (
    FormTemplate,
    FormVersion,
    HazardReport,
    HazardReportStatusHistory,
    HazardReportValue,
    OfficerAssignment,
    OfficerAssignmentStatusHistory,
    FormSubmission,
    FormSubmissionValue,
    MediaAttachment,
)


class FormTemplateSerializer(serializers.ModelSerializer):
    """Serializer for FormTemplate - used to list and update forms"""
    schema = serializers.SerializerMethodField()
    version_id = serializers.SerializerMethodField()
    version_number = serializers.SerializerMethodField()
    follow_up_for_name = serializers.SerializerMethodField()
    is_follow_up = serializers.SerializerMethodField()
    
    class Meta:
        model = FormTemplate
        fields = [
            'id', 'name', 'description', 'form_type', 'geo_mode', 'schema',
            'version_id', 'version_number', 'follow_up_for', 'follow_up_for_name', 'is_follow_up',
            'map_icon', 'map_color', 'event_category',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        form_type = attrs.get('form_type', getattr(self.instance, 'form_type', None))
        follow_up_for = attrs.get('follow_up_for', getattr(self.instance, 'follow_up_for', None))

        if follow_up_for and form_type != 'officer':
            raise serializers.ValidationError({'follow_up_for': 'Follow-up templates must use the officer form type.'})
        if self.instance and follow_up_for and follow_up_for.pk == self.instance.pk:
            raise serializers.ValidationError({'follow_up_for': 'A form cannot follow up on itself.'})

        return attrs

    def get_schema(self, obj):
        latest = obj.versions.order_by('-version_number').first()
        return latest.schema if latest else []

    def get_version_id(self, obj):
        latest = obj.versions.order_by('-version_number').first()
        return str(latest.id) if latest else None

    def get_version_number(self, obj):
        latest = obj.versions.order_by('-version_number').first()
        return latest.version_number if latest else None

    def get_follow_up_for_name(self, obj):
        return obj.follow_up_for.name if obj.follow_up_for_id else None

    def get_is_follow_up(self, obj):
        return bool(obj.follow_up_for_id)


class FormSchemaSerializer(serializers.ModelSerializer):
    """Serializer for FormTemplate with full schema - used when rendering forms"""
    schema = serializers.SerializerMethodField()
    
    class Meta:
        model = FormTemplate
        fields = ['id', 'name', 'description', 'form_type', 'geo_mode', 'schema']

    def get_schema(self, obj):
        latest = obj.versions.order_by('-version_number').first()
        return latest.schema if latest else []


class MediaAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for media attachments"""
    
    class Meta:
        model = MediaAttachment
        fields = ['id', 'file', 'file_type', 'original_filename', 'file_size', 'uploaded_at']
        read_only_fields = ['id', 'file_size', 'uploaded_at']


class HazardReportValueSerializer(serializers.ModelSerializer):
    field_key = serializers.CharField(source='field_definition.field_key', read_only=True)
    field_label = serializers.CharField(source='field_definition.field_label', read_only=True)
    field_type = serializers.CharField(source='field_definition.field_type', read_only=True)

    class Meta:
        model = HazardReportValue
        fields = ['field_key', 'field_label', 'field_type', 'value', 'value_text']


class FormSubmissionValueSerializer(serializers.ModelSerializer):
    field_key = serializers.CharField(source='field_definition.field_key', read_only=True)
    field_label = serializers.CharField(source='field_definition.field_label', read_only=True)
    field_type = serializers.CharField(source='field_definition.field_type', read_only=True)

    class Meta:
        model = FormSubmissionValue
        fields = ['field_key', 'field_label', 'field_type', 'value', 'value_text']


class HazardReportStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(source='changed_by.username', read_only=True)

    class Meta:
        model = HazardReportStatusHistory
        fields = ['from_status', 'to_status', 'changed_by_username', 'reason', 'metadata', 'changed_at']


class OfficerAssignmentStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(source='changed_by.username', read_only=True)

    class Meta:
        model = OfficerAssignmentStatusHistory
        fields = ['from_status', 'to_status', 'changed_by_username', 'reason', 'metadata', 'changed_at']


class HazardReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating public hazard reports"""
    parent_tracking_id = serializers.CharField(write_only=True, required=False, allow_blank=True)
    expected_version = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = HazardReport
        fields = [
            'id', 'tracking_id',  # Read-only, returned after creation
            'form_version', 'data', 
            'latitude', 'longitude', 'address',
            'reporter_name', 'reporter_phone', 'reporter_email',
            'status', 'priority', 'parent_tracking_id', 'expected_version'
        ]
        read_only_fields = ['id', 'tracking_id']
    
    def create(self, validated_data):
        parent_tracking_id = validated_data.pop('parent_tracking_id', None)
        validated_data.pop('expected_version', None)
        if parent_tracking_id:
            try:
                parent_report = HazardReport.objects.get(tracking_id=parent_tracking_id)
                validated_data['parent_report'] = parent_report
            except HazardReport.DoesNotExist:
                raise serializers.ValidationError({'parent_tracking_id': 'Report with this tracking ID does not exist.'})
                
        # Capture IP and user agent from request
        request = self.context.get('request')
        if request:
            validated_data['ip_address'] = self.get_client_ip(request)
            validated_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')

        report = HazardReport(**validated_data)
        report.set_status_context(
            actor=request.user if request and getattr(request.user, 'is_authenticated', False) else None,
            reason='Hazard report submitted',
        )
        report.save()
        return report

    def validate(self, attrs):
        latitude = attrs.get('latitude')
        longitude = attrs.get('longitude')

        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError({'latitude': 'Latitude must be between -90 and 90.'})
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError({'longitude': 'Longitude must be between -180 and 180.'})
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError('Latitude and longitude must be provided together.')

        return attrs
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')


class HazardReportSerializer(serializers.ModelSerializer):
    """Full serializer for viewing hazard reports"""
    form_version = serializers.SerializerMethodField()
    attachments = MediaAttachmentSerializer(many=True, read_only=True)
    assigned_officer = serializers.SerializerMethodField()
    assignment_count = serializers.SerializerMethodField()
    report_origin = serializers.SerializerMethodField()
    lineage = serializers.SerializerMethodField()
    event_id = serializers.UUIDField(source='event.id', read_only=True)
    field_values = HazardReportValueSerializer(many=True, read_only=True)
    status_history = HazardReportStatusHistorySerializer(many=True, read_only=True)
    
    class Meta:
        model = HazardReport
        fields = [
            'id', 'tracking_id', 'form_version', 'parent_report', 'data',
            'latitude', 'longitude', 'address',
            'status', 'priority',
            'reporter_name', 'reporter_phone', 'reporter_email',
            'version', 'event_id',
            'assigned_officer', 'assignment_count', 'report_origin', 'lineage',
            'field_values', 'status_history',
            'attachments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tracking_id', 'version', 'created_at', 'updated_at']

    def get_form_version(self, obj):
        if obj.form_version:
            return {
                'id': obj.form_version.id,
                'template_id': str(obj.form_version.template.id),
                'version_number': obj.form_version.version_number,
                'schema': obj.form_version.schema,
                'template_name': obj.form_version.template.name,
                'form_type': obj.form_version.template.form_type,
                'geo_mode': obj.form_version.template.geo_mode
            }
        return None

    def get_assigned_officer(self, obj):
        """Return the username of the first assigned officer, if any."""
        first_assignment = obj.assignments.order_by('assigned_at').first()
        if first_assignment:
            return first_assignment.officer.username
        if obj.origin_assignment_id and obj.origin_assignment:
            return obj.origin_assignment.officer.username
        return None

    def get_assignment_count(self, obj):
        return obj.assignments.count()

    def get_report_origin(self, obj):
        return HazardReportReadService.describe_origin(obj)

    def get_lineage(self, obj):
        return HazardReportReadService.build_lineage(obj)

class OfficerAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for officer assignments"""
    officer_username = serializers.CharField(source='officer.username', read_only=True)
    form_version = serializers.PrimaryKeyRelatedField(queryset=FormVersion.objects.all(), required=False)
    latest_draft = serializers.SerializerMethodField()
    latest_submission = serializers.SerializerMethodField()
    submission_count = serializers.SerializerMethodField()
    expected_version = serializers.IntegerField(write_only=True, required=False)
    inspection_form = serializers.PrimaryKeyRelatedField(
        queryset=FormTemplate.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    status_history = OfficerAssignmentStatusHistorySerializer(many=True, read_only=True)
    
    class Meta:
        model = OfficerAssignment
        fields = [
            'id', 'report', 'officer', 'officer_username', 'form_version',
            'status', 'progress_percent', 'escalation_level', 'escalation_reason',
            'is_persistent', 'notes', 'assigned_at', 'due_date', 'completed_at',
            'version', 'latest_draft', 'latest_submission', 'submission_count', 'status_history',
            'expected_version', 'inspection_form'
        ]
        read_only_fields = ['id', 'assigned_at', 'completed_at', 'version']

    def to_representation(self, instance):
        """Use nested serializers for the response representation"""
        ret = super().to_representation(instance)
        # Add detailed objects for the frontend to render properly
        if instance.report:
            ret['report'] = HazardReportSerializer(instance.report).data
        if instance.form_version:
            latest = instance.form_version.template.versions.order_by('-version_number').first()
            is_latest = latest is not None and latest.id == instance.form_version.id
            ret['form_version'] = {
                'id': str(instance.form_version.id),
                'template_id': str(instance.form_version.template.id),
                'version_number': instance.form_version.version_number,
                'schema': instance.form_version.schema,
                'template_name': instance.form_version.template.name,
                'geo_mode': instance.form_version.template.geo_mode,
                'is_latest': is_latest,
                'follow_up_for': str(instance.form_version.template.follow_up_for_id) if instance.form_version.template.follow_up_for_id else None,
            }
        return ret

    def validate(self, attrs):
        inspection_form = attrs.pop('inspection_form', None)
        form_version = attrs.get('form_version')
        report = attrs.get('report')

        if inspection_form and form_version:
            raise serializers.ValidationError({'inspection_form': 'Provide either inspection_form or form_version, not both.'})

        if inspection_form:
            latest_version = inspection_form.versions.order_by('-version_number').first()
            if latest_version is None:
                raise serializers.ValidationError({'inspection_form': 'Selected form has no published versions yet.'})
            attrs['form_version'] = latest_version
            form_version = latest_version

            if report and inspection_form.follow_up_for_id and inspection_form.follow_up_for_id != report.form_version.template_id:
                raise serializers.ValidationError({'inspection_form': 'Selected follow-up form does not belong to the chosen report form.'})

        if form_version is None:
            raise serializers.ValidationError({'form_version': 'This field is required.'})

        if form_version.template.form_type != 'officer':
            raise serializers.ValidationError({'form_version': 'Assignments must use officer forms.'})

        return attrs

    def create(self, validated_data):
        validated_data.pop('expected_version', None)
        # Automatically set assigned_by to the current user (admin)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['assigned_by'] = request.user
        assignment = OfficerAssignment(**validated_data)
        assignment.set_status_context(
            actor=request.user if request and request.user.is_authenticated else None,
            reason='Assignment created',
        )
        assignment.save()
        return assignment

    def update(self, instance, validated_data):
        validated_data.pop('expected_version', None)
        return super().update(instance, validated_data)

    def get_latest_draft(self, obj):
        # Only return draft if the most recent submission is a draft
        last_submission = obj.submissions.order_by('-submitted_at').first()
        if last_submission and last_submission.is_draft:
            return FormSubmissionSerializer(last_submission).data
        return None

    def get_latest_submission(self, obj):
        # Return the most recent submission regardless of draft status
        last_submission = obj.submissions.order_by('-submitted_at').first()
        if last_submission:
            return FormSubmissionSerializer(last_submission).data
        return None

    def get_submission_count(self, obj):
        """Count non-draft submissions for patrol mode assignments"""
        return obj.submissions.filter(is_draft=False).count()


class FormSubmissionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating officer form submissions"""
    expected_version = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = FormSubmission
        fields = [
            'id', 'assignment', 'data', 'latitude', 'longitude',
            'location_accuracy_m', 'location_source', 'location_captured_at',
            'is_draft', 'expected_version'
        ]
        read_only_fields = ['id']
    
    def create(self, validated_data):
        validated_data.pop('expected_version', None)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['submitted_by'] = request.user
        return super().create(validated_data)

    def validate(self, attrs):
        latitude = attrs.get('latitude')
        longitude = attrs.get('longitude')
        is_draft = attrs.get('is_draft', False)
        location_accuracy = attrs.get('location_accuracy_m')

        if latitude is not None and not -90 <= latitude <= 90:
            raise serializers.ValidationError({'latitude': 'Latitude must be between -90 and 90.'})
        if longitude is not None and not -180 <= longitude <= 180:
            raise serializers.ValidationError({'longitude': 'Longitude must be between -180 and 180.'})
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError('Latitude and longitude must be provided together.')
        if not is_draft and (latitude is None or longitude is None):
            raise serializers.ValidationError({'location': 'Live geolocation is required before submitting an inspection.'})
        if location_accuracy is not None and location_accuracy < 0:
            raise serializers.ValidationError({'location_accuracy_m': 'Location accuracy must be a positive number.'})

        return attrs


class FormSubmissionSerializer(serializers.ModelSerializer):
    """Full serializer for viewing form submissions"""
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True)
    attachments = MediaAttachmentSerializer(many=True, read_only=True)
    field_values = FormSubmissionValueSerializer(many=True, read_only=True)
    
    class Meta:
        model = FormSubmission
        fields = [
            'id', 'assignment', 'data',
            'latitude', 'longitude', 'location_accuracy_m', 'location_source', 'location_captured_at',
            'submitted_by_username', 'submitted_at',
            'is_draft', 'version', 'field_values', 'attachments'
        ]
        read_only_fields = ['id', 'submitted_at', 'version']
