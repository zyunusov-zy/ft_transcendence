import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from .models import Message
from channels.db import database_sync_to_async

User = get_user_model()

class GlobalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        
        if self.user.is_anonymous:
            await self.close()
        else:
            await self.channel_layer.group_add(
                f"user_{self.user.id}",
                self.channel_name
            )
            await self.accept()

    async def disconnect(self, close_code):
        if not self.user.is_anonymous:
            await self.channel_layer.group_discard(
                f"user_{self.user.id}",
                self.channel_name
            )

    async def receive(self, text_data):
        pass  # Handle incoming messages if needed

    async def notify_user(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'message': message
        }))

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"].username
        self.friend = self.scope["url_route"]["kwargs"]["username"]
        self.room_name = ''.join(sorted([self.user, self.friend]))
        self.room_group_name = f'chat_{self.room_name}'


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
        text_data_json = json.loads(text_data)
        message = text_data_json.get('message')
        sender_username = self.user
        receiver_username = self.friend


        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender': sender_username,
            }
        )

        receiver_id = '23'


        # Sending notification to user-specific channel
        try:
            await self.channel_layer.group_send(
                f"user_{receiver_id}",
                {
                    'type': 'notify_user',
                    'message': message
                }
            )
        except Exception as e:



    async def chat_message(self, event):
        message = event['message']
        sender = event['sender']
        message_id = event['message_id']


        await self.send(text_data=json.dumps({
            'message': message,
            'sender': sender,
            'message_id': message_id,
        }))
