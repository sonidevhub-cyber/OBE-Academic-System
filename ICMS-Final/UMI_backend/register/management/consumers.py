import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from hods.models import HODRegistrationRequest
from hods.serializers import HODRegistrationRequestSerializer

class HODRequestConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'hod_requests'
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data['type'] == 'get_requests':
            requests_data = await self.get_requests()
            await self.send(text_data=json.dumps({
                'type': 'requests_update',
                'data': requests_data
            }))

    async def hod_request_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'requests_update',
            'data': event['data']
        }))

    @database_sync_to_async
    def get_requests(self):
        requests = HODRegistrationRequest.objects.all().order_by('-requested_at')
        serializer = HODRegistrationRequestSerializer(requests, many=True)
        return {
            'requests': serializer.data,
            'stats': {
                'total': requests.count(),
                'pending': requests.filter(status='pending').count(),
                'approved': requests.filter(status='approved').count(),
                'rejected': requests.filter(status='rejected').count()
            }
        }