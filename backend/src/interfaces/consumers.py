"""
WebSocket consumer for real-time event updates.
Clients connect to /ws/events/ to receive live event notifications.
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async


class EventConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time event streaming.
    """
    
    async def connect(self):
        """Called when a WebSocket connection is opened."""
        self.room_group_name = 'events_live'
        
        # Join the events broadcast group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send welcome message
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to Sentinel Core real-time feed'
        }))
    
    async def disconnect(self, close_code):
        """Called when the WebSocket closes."""
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """Handle incoming messages from WebSocket."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
            elif message_type == 'subscribe_region':
                # Subscribe to a specific region
                region = data.get('region')
                if region:
                    await self.channel_layer.group_add(
                        f'region_{region}',
                        self.channel_name
                    )
                    await self.send(text_data=json.dumps({
                        'type': 'subscribed',
                        'region': region
                    }))
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
    
    async def event_created(self, event):
        """Handle new event broadcast."""
        await self.send(text_data=json.dumps({
            'type': 'event_created',
            'event': event['data']
        }))
    
    async def event_updated(self, event):
        """Handle event update broadcast."""
        await self.send(text_data=json.dumps({
            'type': 'event_updated',
            'event': event['data']
        }))
    
    async def event_verified(self, event):
        """Handle event verification broadcast."""
        await self.send(text_data=json.dumps({
            'type': 'event_verified',
            'event_id': event['event_id'],
            'verified': event['verified']
        }))
    
    async def system_alert(self, event):
        """Handle system-wide alerts."""
        await self.send(text_data=json.dumps({
            'type': 'system_alert',
            'level': event.get('level', 'info'),
            'message': event['message']
        }))
