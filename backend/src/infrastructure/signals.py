"""
Signal handlers to broadcast real-time events via WebSocket.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from infrastructure.models import EventModel
from interfaces.serializers import EventReportSerializer


@receiver(post_save, sender=EventModel)
def broadcast_event(sender, instance, created, **kwargs):
    """
    Broadcast event creation/update to all connected WebSocket clients.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    
    serializer = EventReportSerializer(instance)
    event_data = serializer.data
    
    message_type = 'event_created' if created else 'event_updated'
    
    # Broadcast to all connected clients
    async_to_sync(channel_layer.group_send)(
        'events_live',
        {
            'type': message_type,
            'data': event_data
        }
    )
