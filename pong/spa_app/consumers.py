import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from .models import Message, GameHistory, UserProfile, Friendship, Block
from channels.db import database_sync_to_async
from django.core.cache import cache
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import re

User = get_user_model()

def update_status_and_notify_friends(user, status):
    # Update the user's status
    profile = UserProfile.objects.get(user=user)
    profile.status = status
    profile.save()

    notify_friends_status_change(user, status)

def notify_friends_status_change(user, status):
    try:
        friendship = Friendship.objects.get(current_user=user)
        friends = friendship.users.all()

        channel_layer = get_channel_layer()
        for friend in friends:
            friend_channel_name = sanitize_group_name(f"user_{friend.id}")
            async_to_sync(channel_layer.group_send)(
                friend_channel_name,
                {
                    'type': 'friend_status_update',
                    'username': user.username,
                    'status': status,
                }
            )
    except Friendship.DoesNotExist:
        pass

def sanitize_group_name(name):
    sanitized_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '', name)
    return sanitized_name[:100]

class GlobalConsumer(AsyncWebsocketConsumer):
    is_game_in_progress = False

    async def connect(self):
        self.user = self.scope['user']

        if self.user.is_authenticated:
            self.group_name = sanitize_group_name(f"user_{self.user.id}")

            print(f"User {self.user.id} connecting to user-specific channel {self.group_name}")

            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()

            self.user_obj = await database_sync_to_async(User.objects.get)(username=self.user.username)
        
            await database_sync_to_async(update_status_and_notify_friends)(self.user_obj, 'online')
            
            print(f"User {self.user.id} accepted in user-specific channel {self.group_name}")
        else:
            await self.close()
            print("User is not authenticated. Connection closed.")

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name') and self.channel_name:
            print(f"User {self.user.id} disconnecting from user-specific channel {self.group_name}")

            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            self.user_obj = await database_sync_to_async(User.objects.get)(username=self.user.username)
        
            await database_sync_to_async(update_status_and_notify_friends)(self.user_obj, 'offline')
            
            print(f"User {self.user.id} removed from user-specific channel {self.group_name}")
        else:
            print("Group name or channel name not found during disconnection.")


    async def receive(self, text_data):
        data = json.loads(text_data)
        receiver_username = data.get('receiver_username')
        game_request = data.get('game_request')
        response = data.get('response')
        sender_id = self.user.id

        print(f"GlobalConsumer: Received data: {data}")

        if receiver_username and game_request:
            if GlobalConsumer.is_game_in_progress:
                await self.send(text_data=json.dumps({
                    'type': 'game_in_progress',
                    'message': 'Another game request is already in progress. Please wait.'
                }))
                print(f"GlobalConsumer: A game is already in progress. Request from user {sender_id} rejected.")
                return

            GlobalConsumer.is_game_in_progress = True

            try:
                receiver = await sync_to_async(User.objects.get)(username=receiver_username)
                receiver_profile = await sync_to_async(UserProfile.objects.get)(user=receiver)

                print(receiver_profile.status)
                if receiver_profile.status == 'in_game':
                    await self.send(text_data=json.dumps({
                        'type': 'in_game',
                        'message': f'User {receiver_username} is currently in a game and cannot accept new requests.'
                    }))
                    print(f"GlobalConsumer: User {receiver_username} is in a game. Request rejected.")
                elif receiver_profile.status == 'offline':
                    await self.send(text_data=json.dumps({
                        'type': 'offline',
                        'message': f'User {receiver_username} is currently offline and cannot accept new requests.'
                    }))
                    print(f"GlobalConsumer: User {receiver_username} is offline. Request rejected.")
                else:
                    receiver_id = receiver.id
                    recipient_channel_name = sanitize_group_name(f"user_{receiver_id}")
                    
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
                GlobalConsumer.is_game_in_progress = False
        elif response:
            # Handle game response
            original_sender_id = data.get('receiver_id')
            sender_channel_name = sanitize_group_name(f"user_{original_sender_id}")
            
            print(f"GlobalConsumer: Sending game response from user {sender_id} to user {original_sender_id}.")
            
            await self.channel_layer.group_send(
                sender_channel_name,
                {
                    'type': 'game_response',
                    'response': response,
                    'responder_username': self.user.username,
                }
            )

            GlobalConsumer.is_game_in_progress = False
            
            print(f"GlobalConsumer: Game response sent to channel {sender_channel_name}. Game status reset.")

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

    async def friend_status_update(self, event):
        print("Updating status")
        print(event['username'])
        print(event['status'])
        if event['status'] == 'available':
            GlobalConsumer.is_game_in_progress = False
        await self.send(text_data=json.dumps({
            'type': 'friend_status_update',
            'username': event['username'],
            'status': event['status'],
        }))

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"].username
        self.friend = self.scope["url_route"]["kwargs"]["username"]

        # Sort and sanitize the room name
        self.room_name = sanitize_group_name(''.join(sorted([self.user, self.friend])))
        self.room_group_name = f'chat_{self.room_name}'

        print(f"User {self.user} connecting to chat room: {self.room_group_name}")

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

        sender = await sync_to_async(User.objects.get)(username=sender_username)
        receiver = await sync_to_async(User.objects.get)(username=receiver_username)

        is_blocked = await sync_to_async(Block.objects.filter(blocker=receiver, blocked=sender).exists)()
        message_instance = await sync_to_async(Message.objects.create)(
            sender=sender, receiver=receiver, content=message, blocked=is_blocked
        )
        print(f"Message saved to database from {sender_username} to {receiver_username}: {message}")
        if not is_blocked:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender': sender_username,
                }
            )
            print(f"Message sent to chat room group {self.room_group_name}")

            recipient_channel_name = sanitize_group_name(f"user_{receiver.id}")
            print(f"Recipient channel name: {recipient_channel_name}")

            print(f"Attempting to send notification to channel: {recipient_channel_name}")
            await self.channel_layer.group_send(
                recipient_channel_name,
                {
                    'type': 'notify_user',
                    'message': message,
                }
            )
            print(f"Notification sent to user-specific channel {recipient_channel_name}")
        else:
            print(f"Notification and message delivery skipped because {sender_username} is blocked by {receiver_username}")

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
        self.room_name = sanitize_group_name(''.join(sorted([self.user, self.friend])))
        self.room_group_name = f'game_{self.room_name}'

        # print(f"User {self.user} connecting to game room: {self.room_name}")
        self.cache_key = f'game_saved_{self.room_name}'

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

        user_obj = await database_sync_to_async(User.objects.get)(username=self.user)
        friend_user_obj = await database_sync_to_async(User.objects.get)(username=self.friend)

        await database_sync_to_async(update_status_and_notify_friends)(user_obj, 'in_game')
        await database_sync_to_async(update_status_and_notify_friends)(friend_user_obj, 'in_game')


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
        print(f"User {self.user} connected to game room: {self.room_group_name} on side {self.side}")

    async def disconnect(self, close_code):
        print(f"[DEBUG] Disconnect method called for user: {self.user}")
        
        # Ensure the cache key is consistent and checked reliably
        disconnect_count_key = f"{self.cache_key}_disconnect_count"
        
        # Retrieve and update the disconnect count
        disconnect_count = cache.get(disconnect_count_key) or 0
        disconnect_count += 1
        cache.set(disconnect_count_key, disconnect_count, None)
        
        print(f"[DEBUG] Disconnect count for {self.room_name}: {disconnect_count}")
        print(f"[DEBUG] Cached value for {self.cache_key}: {cache.get(self.cache_key)}")

        # Check the completion status of the game
        game_completed_key = f"{self.cache_key}_game_completed"
        game_completed = cache.get(game_completed_key)
        print(f"[DEBUG] Game completion status: {game_completed}")

        # Handle game cancellation for the first disconnect if the game is not completed
        if disconnect_count == 1 and not game_completed:
            remaining_player = self.players['left'].username if self.players['right'].username == self.user else self.players['right'].username
            print(f"[DEBUG] Notifying {remaining_player} that the game will not be counted.")
            
            # Send game cancellation message
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_cancelled_message',
                    'message': {
                        'type': 'game_cancelled',
                        'reason': f"Player {self.user} disconnected. The game will not be counted.",
                        'go_home': True
                    }
                }
            )
            cache.set(self.cache_key, True, None)

        await self.save_game_if_necessary()

        if disconnect_count >= 2:
            print(f"[DEBUG] Both players disconnected. Resetting cache for game: {self.room_name}")
            cache.delete(self.cache_key)
            cache.delete(disconnect_count_key)

        # Update user status and clean up
        user_obj = await database_sync_to_async(User.objects.get)(username=self.user)
        friend_user_obj = await database_sync_to_async(User.objects.get)(username=self.friend)

        await database_sync_to_async(update_status_and_notify_friends)(user_obj, 'available')
        await database_sync_to_async(update_status_and_notify_friends)(friend_user_obj, 'available')

        print(f"User {self.user} disconnecting from game room: {self.room_name}")
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )


    async def save_game_if_necessary(self):
        game_completed_key = f"{self.cache_key}_game_completed"
        
        # Ensure the cache state is checked consistently
        is_game_saved = cache.get(self.cache_key)
        is_game_completed = cache.get(game_completed_key)
        
        print(f"[DEBUG] Checking if game save is necessary. Game saved: {is_game_saved}, Game completed: {is_game_completed}")
        
        if not is_game_saved and is_game_completed:
            if self.players['left'].score == 0 and self.players['right'].score == 0:
                print(f"[DEBUG] Both players have a score of 0. Skipping game record creation for game: {self.room_name}")
            else:
                # Proceed to save the game history
                cache.set(self.cache_key, True, None)
                print(f"[DEBUG] Setting cache key {self.cache_key}")

                winner_username = self.players['left'].username if self.players['left'].winner else self.players['right'].username
                winner = await database_sync_to_async(User.objects.get)(username=winner_username)

                print(f"[DEBUG] Saving game history for {self.room_name}")
                game_record = await database_sync_to_async(GameHistory.objects.create)(
                    player1=await database_sync_to_async(User.objects.get)(username=self.players['left'].username),
                    player2=await database_sync_to_async(User.objects.get)(username=self.players['right'].username),
                    score_player1=self.players['left'].score,
                    score_player2=self.players['right'].score,
                    winner=winner
                )
                print(f"[DEBUG] Game record created with ID: {game_record.id}")
                print("Game Record:", game_record)

    async def game_cancelled_message(self, event):
        print("HERE SENDING MESSAGE")
        message = event['message']
        await self.send(text_data=json.dumps(message))

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
            if data['type'] == 'game_complete' and data['game_status'] == 'completed':
                await self.mark_game_complete()
        else:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_message',
                    'message': data
                }
            )

    async def mark_game_complete(self):
        game_completed_key = f"{self.cache_key}_game_completed"
        
        # Set the flag in the cache that the game was completed
        cache.set(game_completed_key, True, None)
        print(f"[DEBUG] Game marked as completed for {self.room_name}")
        
        # Now you can proceed to save the game if necessary
        await self.save_game_if_necessary()

    async def game_message(self, event):
        try:
            message = event['message']
            await self.send(text_data=json.dumps(message))
        except Disconnected:
            print(f"WebSocket is already disconnected, cannot send message.{event}")

        if message['type'] == 'ball_state':
            # print(f"Broadcasting ball state: Position - {message['position']}, Velocity - {message['velocity']}")
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'send_ball_state',
                    'position': message['position'],
                    'velocity': message['velocity'],
                }
            )
        # print(f"Sent message to {self.user}: {message}")

    async def send_ball_state(self, event):
        # print(f"Sending ball state to clients: Position - {event['position']}, Velocity - {event['velocity']}")
        await self.send(text_data=json.dumps({
            'type': 'ball_state',
            'position': event['position'],
            'velocity': event['velocity'],
        }))

    async def score_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'score_update',
            'players': event['players']
        }))
        print(f"Score update sent: {event['players']}")

    async def send_game_over(self, winner_username):
        print(f"[DEBUG] send_game_over called by {self.user}. Winner: {winner_username}")
        winner = await database_sync_to_async(User.objects.get)(username=winner_username)
        print(f"[DEBUG] Winner fetched: {winner.username}")
        player1 = await database_sync_to_async(User.objects.get)(username=self.players['left'].username)
        player2 = await database_sync_to_async(User.objects.get)(username=self.players['right'].username)

        print(f"[DEBUG] Player 1: {player1.username}, Player 2: {player2.username}")

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
        await self.mark_game_complete()

    async def game_over_message(self, event):
        message = event['message']

        print(f"[DEBUG] game_over_message called. Message: {message}")

        await self.send(text_data=json.dumps(message))
