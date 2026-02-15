
from rest_framework import serializers
from infrastructure.models import EventModel, MediaModel, AuditLog, AIInteractionLog

class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaModel
        fields = ['id', 'file', 'file_type', 'file_hash', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']

class EventReportSerializer(serializers.ModelSerializer):
    """
    Serializer for Event Reports with location support.
    """
    media_attachments = MediaSerializer(many=True, read_only=True)
    
    class Meta:
        model = EventModel
        fields = [
            'id', 'title', 'description', 'category', 'severity', 
            'status', 'latitude', 'longitude', 'accuracy', 'altitude',
            'media_attachments', 'trust_score', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'trust_score', 'created_at']

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
