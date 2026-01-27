from rest_framework import serializers
from infrastructure.models import EventModel, MediaModel

class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaModel
        fields = ['id', 'file', 'file_type', 'file_hash', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']

class EventReportSerializer(serializers.ModelSerializer):
    media_attachments = MediaSerializer(many=True, read_only=True)
    # Allow uploading files separately or handling them in the view
    
    class Meta:
        model = EventModel
        fields = [
            'id', 'title', 'description', 'category', 'severity', 
            'status', 'latitude', 'longitude', 'accuracy', 'altitude',
            'media_attachments', 'trust_score', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'trust_score', 'created_at']
