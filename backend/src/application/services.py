from infrastructure.models import EventModel, MediaModel
from infrastructure.metadata_utils import MetadataExtractor
from django.db import transaction
import hashlib

class EventReportingService:
    @staticmethod
    def create_event_report(data, files):
        """
        Orchestrate the creation of an event report and its media attachments.
        """
        with transaction.atomic():
            # 1. Create Event
            event = EventModel.objects.create(**data)

            # 2. Process Files
            media_instances = []
            for file in files:
                # Calculate hash for integrity (basic implementation)
                # Note: In production, large files should be chunked or hashed on client
                file_hash = EventReportingService._calculate_hash(file)
                
                # Determine type based on content_type
                file_type = 'image'
                if 'video' in file.content_type:
                    file_type = 'video'
                elif 'audio' in file.content_type:
                    file_type = 'audio'

                media = MediaModel.objects.create(
                    event=event,
                    file=file,
                    file_type=file_type,
                    file_hash=file_hash,
                    metadata=MetadataExtractor.extract_from_file(file)
                )
                media_instances.append(media)
            
            return event
    
    @staticmethod
    def _calculate_hash(file_obj):
        sha256 = hashlib.sha256()
        for chunk in file_obj.chunks():
            sha256.update(chunk)
        return sha256.hexdigest()
