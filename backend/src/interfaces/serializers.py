
from rest_framework import serializers
from infrastructure.models import EventModel, EventStatusHistory, MediaModel, AuditLog, AIInteractionLog

class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaModel
        fields = ['id', 'file', 'file_type', 'file_hash', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']


class EventStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(source='changed_by.username', read_only=True)

    class Meta:
        model = EventStatusHistory
        fields = ['from_status', 'to_status', 'changed_by_username', 'reason', 'metadata', 'changed_at']

class EventReportSerializer(serializers.ModelSerializer):
    """
    Serializer for Event Reports with location support.
    """
    media_attachments = MediaSerializer(many=True, read_only=True)
    hazard_report_id = serializers.SerializerMethodField()
    status_history = EventStatusHistorySerializer(many=True, read_only=True)
    
    class Meta:
        model = EventModel
        fields = [
            'id', 'title', 'description', 'category', 'severity', 
            'status', 'latitude', 'longitude', 'accuracy', 'altitude',
            'source_system', 'source_record_type', 'source_record_id', 'source_form_version_id',
            'version', 'media_attachments', 'trust_score', 'created_at', 'hazard_report_id', 'status_history'
        ]
        read_only_fields = [
            'id', 'status', 'source_system', 'source_record_type', 'source_record_id',
            'source_form_version_id', 'version', 'trust_score', 'created_at'
        ]

    def get_hazard_report_id(self, obj):
        # Find the hazard report linked to this event
        from inehss.models import HazardReport
        report = HazardReport.objects.filter(event=obj).first()
        return str(report.id) if report else None

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = '__all__'




class AIInteractionLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AIInteractionLog
        fields = [
            'id',
            'username',
            'provider',
            'model_name',
            'prompt_redacted',
            'response_text',
            'explainability',
            'confidence_label',
            'confidence_score',
            'created_at',
        ]
        read_only_fields = fields


class AIInteractionLogCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIInteractionLog
        fields = ['provider', 'model_name', 'prompt_redacted', 'response_text', 'explainability']
