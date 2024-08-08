import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from .models import Message
from channels.db import database_sync_to_async

User = get_user_model()

class GlobalConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        # self.channel_name = f"user_{self.user.id}" if self.user.is_authenticated else None

        if self.user.is_authenticated:
            print(f"User {self.user.id} connecting to user-specific channel {self.channel_name}")

            await self.channel_layer.group_add(
                f"user_{self.user.id}",
                self.channel_name
            )
            await self.accept()
            print(f"User {self.user.id} accepted in user-specific channel {self.channel_name}")
        else:
            await self.close()
            print("User is not authenticated. Connection closed.")

    async def disconnect(self, close_code):
        if hasattr(self, 'user') and self.channel_name:
            print(f"User {self.user.id} disconnecting from user-specific channel {self.channel_name}")

            await self.channel_layer.group_discard(
                self.channel_name,
                self.channel_name
            )
            print(f"User {self.user.id} removed from user-specific channel {self.channel_name}")
        else:
            print("User or channel name not found during disconnection.")

    async def receive(self, text_data):
        data = json.loads(text_data)
        receiver_username = data.get('receiver_username')
        game_request = data.get('game_request')
        response = data.get('response')
        sender_id = self.user.id

        print(f"GlobalConsumer: Received data: {data}")

        if receiver_username and game_request:
            try:
                receiver = await sync_to_async(User.objects.get)(username=receiver_username)
                receiver_id = receiver.id
                recipient_channel_name = f"user_{receiver_id}"
                print(f"GlobalConsumer: Sending game request from user {sender_id} to user {receiver_id} (username: {receiver_username}).")
                await self.channel_layer.group_send(
                    recipient_channel_name,
                    {
                        'type': 'game_request',
                        'game_request': game_request,
                        'sender_id': sender_id,
                        'sender_username': self.user.username,
                    }
                )
                print(f"GlobalConsumer: Game request sent to channel {recipient_channel_name}.")
            except User.DoesNotExist:
                print(f"GlobalConsumer: User with username {receiver_username} does not exist.")
        elif response:
            original_sender_id = data.get('receiver_id')
            sender_channel_name = f"user_{original_sender_id}"
            print(f"GlobalConsumer: Sending game response from user {sender_id} to user {original_sender_id}.")
            await self.channel_layer.group_send(
                sender_channel_name,
                {
                    'type': 'game_response',
                    'response': response,
                    'responder_username': self.user.username,
                }
            )
            print(f"GlobalConsumer: Game response sent to channel {sender_channel_name}.")

    async def game_request(self, event):
        game_request = event['game_request']
        sender_id = event['sender_id']
        sender_username = event['sender_username']

        print(f"GlobalConsumer: Handling game request from {sender_username} (ID: {sender_id}): {game_request}")

        await self.send(text_data=json.dumps({
            'type': 'game_request',
            'game_request': game_request,
            'sender_id': sender_id,
            'sender_username': sender_username,
        }))

    async def game_response(self, event):
        response = event['response']
        responder_username = event['responder_username']

        print(f"GlobalConsumer: Handling game response: {response} by {responder_username}")

        await self.send(text_data=json.dumps({
            'type': 'game_response',
            'response': response,
            'responder_username': responder_username,
        }))
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

        print(f"User {self.user} connecting to chat room: {self.room_name}")

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        print(f"User {self.user} connected to chat room: {self.room_group_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print(f"User {self.user} disconnected from chat room: {self.room_group_name}")

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json.get('message')
        sender_username = self.user
        receiver_username = self.friend

        print(f"Received message from {sender_username} to {receiver_username}: {message}")

        sender = await database_sync_to_async(User.objects.get)(username=sender_username)
        receiver = await database_sync_to_async(User.objects.get)(username=receiver_username)
        message_instance = await database_sync_to_async(Message.objects.create)(
            sender=sender, receiver=receiver, content=message
        )
        print(f"Message saved to database from {sender_username} to {receiver_username}: {message}")

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender': sender_username,
            }
        )
        print(f"Message sent to chat room group {self.room_group_name}")

        recipient_channel_name = f"user_{receiver.id}"
        print(f"Recipient channel name: {recipient_channel_name}")

        # Sending notification to user-specific channel
            
        print(f"Attempting to send notification to channel: {recipient_channel_name}")
        await self.channel_layer.group_send(
            recipient_channel_name,
            {
                'type': 'notify_user',
                'message': message
            }
        )
        print(f"Notification sent to user-specific channel {recipient_channel_name}")


    async def chat_message(self, event):
        message = event['message']
        sender = event['sender']

        print(f"Broadcasting message from {sender}: {message}")

        await self.send(text_data=json.dumps({
            'message': message,
            'sender': sender,
        }))
        print(f"Message sent to WebSocket from {sender}: {message}")

class Player:
    def __init__(self, username, side):
        self.username = username
        self.side = side
        self.score = 0
        self.winner = 0

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"].username
        self.friend = self.scope["url_route"]["kwargs"]["username"]
        self.room_name = ''.join(sorted([self.user, self.friend]))
        self.room_group_name = f'game_{self.room_name}'

        # print(f"User {self.user} connecting to game room: {self.room_name}")

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        self.players = {
            'left': Player(self.user, 'left') if self.user < self.friend else Player(self.friend, 'left'),
            'right': Player(self.friend, 'right') if self.user < self.friend else Player(self.user, 'right')
        }
        self.side = self.players['left'].side if self.user < self.friend else self.players['right'].side

        await self.send(text_data=json.dumps({
            'type': 'side_assignment',
            'side': self.side,
            'players': {
                'left': {
                    'username': self.players['left'].username,
                    'score': self.players['left'].score
                },
                'right': {
                    'username': self.players['right'].username,
                    'score': self.players['right'].score
                }
            }
        }))
        print(f"Connected user: {self.user} on side {self.side}")
        # print(f"User {self.user} connected to game room: {self.room_group_name} on side {self.side}")

    async def disconnect(self, close_code):
        print(f"User {self.user} disconnecting from game room: {self.room_name}")
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        # print(f"Received data from {self.user}: {text_data}")
        data = json.loads(text_data)
        data['user'] = self.user
        data['side'] = self.side

        if data['type'] == 'score_update':
            print(f"Received side: {data['player']}")
            if data['player'] == 'left':
                self.players['left'].score += 1
                print(f"Player {self.players['left'].username} (left) scored. New score: {self.players['left'].score}")
            else:
                self.players['right'].score += 1
                print(f"Player {self.players['right'].username} (right) scored. New score: {self.players['right'].score}")
            
            if self.players['left'].score >= 5:
                self.players['left'].winner = 1
                await self.send_game_over(self.players['left'].username)
            elif self.players['right'].score >= 5:
                self.players['right'].winner = 1
                await self.send_game_over(self.players['right'].username)

            await self.send(text_data=json.dumps({
                'type': 'score_update',
                'players': {
                    'left': {
                        'username': self.players['left'].username,
                        'score': self.players['left'].score
                    },
                    'right': {
                        'username': self.players['right'].username,
                        'score': self.players['right'].score
                    }
                }
            }))
        else:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_message',
                    'message': data
                }
            )

    async def game_message(self, event):
        message = event['message']
        # print(f"Received message to send to {self.user}: {message}")
        await self.send(text_data=json.dumps(message))

        if message['type'] == 'ball_state':
            # print(f"Broadcasting ball state: Position - {message['position']}, Velocity - {message['velocity']}")
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'send_ball_state',
                    'position': message['position'],
                    'velocity': message['velocity']
                }
            )
        # print(f"Sent message to {self.user}: {message}")

    async def send_ball_state(self, event):
        # print(f"Sending ball state to clients: Position - {event['position']}, Velocity - {event['velocity']}")
        await self.send(text_data=json.dumps({
            'type': 'ball_state',
            'position': event['position'],
            'velocity': event['velocity']
        }))

    async def score_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'score_update',
            'players': event['players']
        }))
        print(f"Score update sent: {event['players']}")

    async def send_game_over(self, winner_username):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_over_message',
                'message': {
                    'type': 'game_over',
                    'winner': winner_username
                }
            }
        )

    async def game_over_message(self, event):
        message = event['message']
        await self.send(text_data=json.dumps(message))
