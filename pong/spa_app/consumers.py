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
from .ponggame import Game
import asyncio
from time import sleep



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
            # Use the user's ID to avoid issues with username changes
            self.group_name = sanitize_group_name(f"user_{self.user.id}")


            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()

            # Use self.user.id instead of username
            self.user_obj = await database_sync_to_async(User.objects.get)(id=self.user.id)
            
            # Notify friends about the user's online status
            await database_sync_to_async(update_status_and_notify_friends)(self.user_obj, 'online')
            
        else:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name') and self.channel_name:

            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

            # Use self.user.id instead of username
            self.user_obj = await database_sync_to_async(User.objects.get)(id=self.user.id)
            
            # Notify friends about the user's offline status
            await database_sync_to_async(update_status_and_notify_friends)(self.user_obj, 'offline')
            
        else:
            print("...")

    async def receive(self, text_data):
        data = json.loads(text_data)
        receiver_username = data.get('receiver_username')
        game_request = data.get('game_request')
        response = data.get('response')
        sender_id = self.user.id


        if receiver_username and game_request:
            if GlobalConsumer.is_game_in_progress:
                await self.send(text_data=json.dumps({
                    'type': 'game_in_progress',
                    'message': 'Another game request is already in progress. Please wait.'
                }))
                return

            GlobalConsumer.is_game_in_progress = True

            try:
                receiver = await sync_to_async(User.objects.get)(username=receiver_username)
                receiver_profile = await sync_to_async(UserProfile.objects.get)(user=receiver)

                if receiver_profile.status == 'in_game':
                    await self.send(text_data=json.dumps({
                        'type': 'in_game',
                        'message': f'User {receiver_username} is currently in a game and cannot accept new requests.'
                    }))
                elif receiver_profile.status == 'offline':
                    await self.send(text_data=json.dumps({
                        'type': 'offline',
                        'message': f'User {receiver_username} is currently offline and cannot accept new requests.'
                    }))
                else:
                    receiver_id = receiver.id
                    recipient_channel_name = sanitize_group_name(f"user_{receiver_id}")
                    
                    
                    await self.channel_layer.group_send(
                        recipient_channel_name,
                        {
                            'type': 'game_request',
                            'game_request': game_request,
                            'sender_id': sender_id,
                            'sender_username': self.user.username,
                        }
                    )
                    
            except User.DoesNotExist:
                GlobalConsumer.is_game_in_progress = False
        elif response:
            # Handle game response
            original_sender_id = data.get('receiver_id')
            sender_channel_name = sanitize_group_name(f"user_{original_sender_id}")
            
            
            await self.channel_layer.group_send(
                sender_channel_name,
                {
                    'type': 'game_response',
                    'response': response,
                    'responder_username': self.user.username,
                }
            )

            GlobalConsumer.is_game_in_progress = False
            

    async def game_request(self, event):
        game_request = event['game_request']
        sender_id = event['sender_id']
        sender_username = event['sender_username']


        await self.send(text_data=json.dumps({
            'type': 'game_request',
            'game_request': game_request,
            'sender_id': sender_id,
            'sender_username': sender_username,
        }))

    async def game_response(self, event):
        response = event['response']
        responder_username = event['responder_username']


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


        sender = await sync_to_async(User.objects.get)(username=sender_username)
        receiver = await sync_to_async(User.objects.get)(username=receiver_username)

        is_blocked = await sync_to_async(Block.objects.filter(blocker=receiver, blocked=sender).exists)()
        message_instance = await sync_to_async(Message.objects.create)(
            sender=sender, receiver=receiver, content=message, blocked=is_blocked
        )
        if not is_blocked:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender': sender_username,
                }
            )

            recipient_channel_name = sanitize_group_name(f"user_{receiver.id}")

            await self.channel_layer.group_send(
                recipient_channel_name,
                {
                    'type': 'notify_user',
                    'message': message,
                }
            )
        else:
            print("...")
    async def chat_message(self, event):
        message = event['message']
        sender = event['sender']


        await self.send(text_data=json.dumps({
            'message': message,
            'sender': sender,
        }))

class Player:
    def __init__(self, username, side):
        self.username = username
        self.side = side
        self.score = 0
        self.winner = 0

class GameManager:
    games = {}
    player_status = {} 
    players_in_rooms = {}

    @classmethod
    def get_game(cls, room_name):
        """
        Get or create a new game instance for the room.
        """
        if room_name not in cls.games:
            cls.games[room_name] = Game()
            cls.player_status[room_name] = {}
            cls.players_in_rooms[room_name] = set()
        return cls.games[room_name]

    @classmethod
    def add_player(cls, room_name, username):
        """
        Add a player to the game room and mark them as not ready initially.
        """
        if room_name not in cls.player_status:
            cls.player_status[room_name] = {}
        
        cls.player_status[room_name][username] = False
        cls.players_in_rooms[room_name].add(username)

    @classmethod
    def mark_player_ready(cls, room_name, username):
        """
        Mark a player as ready.
        """
        if room_name in cls.player_status:
            cls.player_status[room_name][username] = True

    @classmethod
    def both_ready(cls, room_name):
        """
        Check if both players in the room are ready.
        """
        if room_name not in cls.player_status:
            return False
        
        players_ready = cls.player_status[room_name]
        return len(players_ready) == 2 and all(players_ready.values())

    @classmethod
    def both_users_connected(cls, room_name):
        """
        Check if both users in the room are connected.
        """
        if room_name not in cls.players_in_rooms:
            return False
        
        connected_players = cls.players_in_rooms[room_name]
        return len(connected_players) == 2

    @classmethod
    def reset_last_game(cls, room_name):
        if room_name in cls.games:
            game = cls.games[room_name]
            game.reset()
            
            cls.player_status[room_name] = {player: False for player in cls.players_in_rooms[room_name]}
            cls.games[room_name].score = {'left': 0, 'right': 0}


            cls.players_in_rooms[room_name].clear()


    @classmethod
    def remove_player(cls, room_name, username):
        """
        Remove a player from the game room.
        """
        if room_name in cls.player_status and username in cls.player_status[room_name]:
            del cls.player_status[room_name][username]
            cls.players_in_rooms[room_name].discard(username)

            if len(cls.players_in_rooms[room_name]) < 2:
                cls.reset_last_game(room_name)




class GameConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.game = None
        self.update_task = None
        self.connected_users = 0
        self.room_group_name = None

    async def connect(self):
        await self.accept()

        self.user = self.scope["user"].username
        self.friend = self.scope["url_route"]["kwargs"]["username"]
        self.room_name = sanitize_group_name(''.join(sorted([self.user, self.friend])))
        self.room_group_name = f'game_{self.room_name}'


        self.cache_key = f'game_saved_{self.room_name}'
        self.game = GameManager.get_game(self.room_group_name)
        GameManager.add_player(self.room_group_name, self.user)

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        self.players = {
            'left': Player(self.user, 'left') if self.user < self.friend else Player(self.friend, 'left'),
            'right': Player(self.friend, 'right') if self.user < self.friend else Player(self.user, 'right')
        }
        self.side = self.players['left'].side if self.user < self.friend else self.players['right'].side

        user_obj = await database_sync_to_async(User.objects.get)(username=self.user)
        await database_sync_to_async(update_status_and_notify_friends)(user_obj, 'in_game')

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

        await self.wait_for_users()

        await self.send_ready_signal()

    async def wait_for_users(self):

        start_time = asyncio.get_event_loop().time()
        timeout_duration = 5
        
        while not GameManager.both_users_connected(self.room_group_name):
            current_time = asyncio.get_event_loop().time()
            elapsed_time = current_time - start_time
            
            if elapsed_time > timeout_duration:
                await self.disconnect()
                self.game.game_running = False
                
                return

            await asyncio.sleep(1)

    async def send_ready_signal(self):
        await self.send(text_data=json.dumps({
            'type': 'request_ready',
        }))

    async def send_game_start(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_start'
        }))

    async def send_game_state(self):
        ball_position = self.game.ball_position
        scores = self.game.score
        ball_velocity = self.game.ball_velocity
        message = {
            'type': 'ball_state',
            'velocity': ball_velocity,
            'ball_position': ball_position,
            'scores': scores
        }
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'ball_state',
                'message': message
            }
        )

    async def ball_state(self, event):
        message = event['message']
        await self.send(text_data=json.dumps(message))


    async def receive(self, text_data):
        data = json.loads(text_data)
        data['user'] = self.user
        data['side'] = self.side

        if data['type'] == 'player_ready':
            GameManager.mark_player_ready(self.room_group_name, self.user)

            if GameManager.both_ready(self.room_group_name):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'send_game_start',
                    }
                )

                if not self.game.game_running:
                    self.game.start()
                    self.game.set_update_callback(self.send_game_state)
                    self.game.set_score_update_callback(self.send_score_update)
                    self.game.set_end_game_callback(self.send_game_over)
                    self.update_task = asyncio.create_task(self.game.game_loop())
        elif data['type'] == 'move':
            racket_position = data['position']
            side = data['side']
            keyState = data['keyState']
            if side == 'left':
                self.game.left_racket_position[2] = racket_position['z'] + 5
            elif side == 'right':
                self.game.right_racket_position[2] = racket_position['z'] + 5

            await self.send_game_state_mov(side, keyState)

    async def send_game_state_mov(self, side, keyState):

        message = {
            'type': 'move',
            'side': side,
            'keyState': keyState
        }

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_message',
                'message': message
            }
        )

    async def send_score_update(self, score):
        self.players['left'].score = score['left']
        self.players['right'].score = score['right']
        message = {
            'type': 'score_update',
            'players': {
                'left': {'username': self.players['left'].username, 'score': score['left']},
                'right': {'username': self.players['right'].username, 'score': score['right']}
            }
        }

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_message',
                'message': message
            }
        )

    async def disconnect(self, close_code):
        if self.game.game_running:
            self.game.game_running = False
            remaining_player = self.players['left'].username if self.players['right'].username == self.user else self.players['right'].username
            
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
        score1 = self.players['left'].score == 0 and self.players['right'].score == 0
        if not self.game.game_running and score1:
            self.game.game_running = False
            remaining_player = self.players['left'].username if self.players['right'].username == self.user else self.players['right'].username
            
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
        GameManager.reset_last_game(self.room_group_name)
        user_obj = await database_sync_to_async(User.objects.get)(username=self.user)
        friend_user_obj = await database_sync_to_async(User.objects.get)(username=self.friend)

        await database_sync_to_async(update_status_and_notify_friends)(user_obj, 'available')
        await database_sync_to_async(update_status_and_notify_friends)(friend_user_obj, 'available')

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )


    async def save_game_if_necessary(self):
        is_game_saved = cache.get(self.cache_key)

        
        
        if not is_game_saved:
            if self.players['left'].score == 0 and self.players['right'].score == 0:
                print("...")
            else:
                cache.set(self.cache_key, True, None)

                winner_username = self.players['left'].username if self.players['left'].winner else self.players['right'].username
                winner = await database_sync_to_async(User.objects.get)(username=winner_username)

                game_record = await database_sync_to_async(GameHistory.objects.create)(
                    player1=await database_sync_to_async(User.objects.get)(username=self.players['left'].username),
                    player2=await database_sync_to_async(User.objects.get)(username=self.players['right'].username),
                    score_player1=self.players['left'].score,
                    score_player2=self.players['right'].score,
                    winner=winner
                )

    async def game_cancelled_message(self, event):
        message = event['message']
        await self.send(text_data=json.dumps(message))


    async def mark_game_complete(self):
        game_completed_key = f"{self.cache_key}_game_completed"
        
        cache.set(game_completed_key, True, None)
        
        await self.save_game_if_necessary()

    async def game_message(self, event):
        try:
            message = event['message']
            await self.send(text_data=json.dumps(message))
        except Exception as event:
            print(f"{event}")


    async def send_game_over(self, winner_side):

        if winner_side == 'left':
            winner_username = self.players['left'].username
            self.players['left'].winner = 1
        elif winner_side == 'right':
            winner_username = self.players['right'].username
            self.players['right'].winner = 1

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


        await self.send(text_data=json.dumps(message))
