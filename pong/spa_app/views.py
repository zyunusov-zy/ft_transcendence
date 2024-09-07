from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views import View
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.urls import reverse
from django.utils.http import urlsafe_base64_encode,  urlsafe_base64_decode
from django.utils.encoding import force_bytes
from .models import UserProfile, Message, FriendRequest, Friendship, GameHistory, Block
import re
import os 
from django.conf import settings
from django.contrib.auth import logout, authenticate, login as auth_login
from django.contrib.auth.mixins import LoginRequiredMixin
from django.utils.crypto import get_random_string
from django.contrib.auth.hashers import make_password
from django.views.decorators.csrf import csrf_protect
from django.contrib.auth.decorators import login_required
from django.db.models import Q
import json
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import models
from .consumers import update_status_and_notify_friends, sanitize_group_name


class BaseTemplateView(View):
    template_name = 'base.html'

    def get(self, request, *args, **kwargs):
        context = kwargs.get('context', {})
        return render(request, self.template_name, context)

@method_decorator(login_required, name='dispatch')
class CheckAuthenticationView(View):
    def get(self, request, *args, **kwargs):
        return JsonResponse({'authenticated': True})

@method_decorator(csrf_exempt, name='dispatch')
class LoginView(View):
    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            if user.is_active:
                try:
                    profile = user.userprofile
                except UserProfile.DoesNotExist:
                    profile = None

                if profile and profile.email_verified:
                    auth_login(request, user)
                    return JsonResponse({'success': True})
                elif profile and not profile.email_verified:
                    return JsonResponse({'success': False, 'errors': 'Your email is not verified. Please check your email to activate your account.'})
                else:
                    return JsonResponse({'success': False, 'errors': 'Error logging in. Please contact support for assistance.'})
            else:
                return JsonResponse({'success': False, 'errors': 'Your account is inactive. Please contact support for assistance.'})
        else:
            return JsonResponse({'success': False, 'errors': 'Invalid username or password'})

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        print("working")
        csrf_token = get_token(request)
        return JsonResponse({'csrfToken': csrf_token})

@method_decorator(csrf_exempt, name='dispatch')
class SignupView(View):
    def post(self, request):
        print("post signup")
        username = request.POST.get('usernamesignup')
        email = request.POST.get('emailsignup')
        password = request.POST.get('passwordsignup')

        # Password policy
        if not re.findall('[A-Z]', password) or not re.findall('[0-9]', password) or not re.findall('[!@#$%^&*(),.?":{}|<>]', password):
            return JsonResponse({'success': False, 'errors': 'Password must contain at least one uppercase letter, one digit, one symbol.'})

        if User.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'errors': 'Username already exists. Please choose a different one.'})
        if User.objects.filter(email=email).exists():
            return JsonResponse({'success': False, 'errors': 'Email address already exists. Please use a different one.'})

        try:
            user = User.objects.create_user(username=username, email=email, password=password)
            UserProfile.objects.create(user=user)

            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            verification_link = request.build_absolute_uri(reverse('email_verify', args=[uid, token]))

            send_mail(
                'Verify your email for our awesome site',
                f'Please click the following link to verify your email address: {verification_link}',
                'pon42',  # need to change
                [email],
                fail_silently=False,
            )
            return JsonResponse({'success': True, 'message': 'Verification email sent. Please check your email to verify your account.'})
        except Exception as e:
            return JsonResponse({'success': False, 'errors': str(e)})


    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        print("get signup")
        csrf_token = get_token(request)
        return JsonResponse({'csrfToken': csrf_token})

@method_decorator(csrf_exempt, name='dispatch')
class FetchCSRFTokenView(View):
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        csrf_token = get_token(request)
        return JsonResponse({'csrfToken': csrf_token})
    
class VerifyEmailView(View):
    def get(self, request, uidb64, token):
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return redirect(f'/?verification=failed&uidb64={uidb64}&token={token}#login')

        if user is not None and default_token_generator.check_token(user, token):
            user.is_active = True
            user.save()
            user.userprofile.email_verified = True
            user.userprofile.save()
            return redirect(f'/?verification=success&uidb64={uidb64}&token={token}#login')
        else:
            return redirect(f'/?verification=failed&uidb64={uidb64}&token={token}#login')

@method_decorator(login_required, name='dispatch')
class UserDataView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        user = request.user
        try:
            profile = user.userprofile
        except UserProfile.DoesNotExist:
            profile = None

        data = {
            'nickname': user.username,
            'avatar': profile.profile_picture.url if profile and profile.profile_picture else '/static/img/avatar.jpg',
        }
        return JsonResponse(data)

@method_decorator(csrf_exempt, name='dispatch')
class PasswordResetView(View):
    def post(self, request, *args, **kwargs):
        username = request.POST.get('username')
        email = request.POST.get('email')

        print(username)
        print(email)
        try:
            user = User.objects.get(username=username, email=email)

            if not user.userprofile.email_verified:
                return JsonResponse({'success': False, 'error': 'Email not verified.'})
            token = get_random_string(length=32)
            
            user.userprofile.reset_token = token
            user.userprofile.save()

            reset_url = request.build_absolute_uri('/') + f'#setnewpass?token={token}'
            send_mail(
                'Password Reset',
                f'Click the link to reset your password: {reset_url}',
                'no-reply@example.com',
                [email],
                fail_silently=False,
            )
            return JsonResponse({'success': True, 'message': 'Password reset email sent.'})

        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Invalid username or email.'})
    
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        print("working")
        csrf_token = get_token(request)
        return JsonResponse({'csrfToken': csrf_token})

class ValidateTokenView(View):
    def get(self, request, *args, **kwargs):
        token = request.GET.get('token')
        print(token)
        if not token:
            return JsonResponse({'valid': False, 'error': 'No token provided'})

        try:
            profile = UserProfile.objects.get(reset_token=token)
            return JsonResponse({'valid': True})
        except UserProfile.DoesNotExist:
            return JsonResponse({'valid': False, 'error': 'Invalid token'})


@method_decorator(csrf_exempt, name='dispatch')
class SetNewPasswordView(View):
    def post(self, request, *args, **kwargs):
        token = request.POST.get('token')
        new_password = request.POST.get('new_password')
        confirm_password = request.POST.get('confirm_password')

        if not token or not new_password or not confirm_password:
            return JsonResponse({'success': False, 'error': 'Token, new password, and confirmation are required.'})

        if new_password != confirm_password:
            return JsonResponse({'success': False, 'error': 'Passwords do not match.'})

        if len(new_password) < 8:
            return JsonResponse({'success': False, 'error': 'Password must be at least 8 characters long.'})
        
        if not re.findall('[A-Z]', new_password) or not re.findall('[0-9]', new_password) or not re.findall('[!@#$%^&*(),.?":{}|<>]', new_password):
            return JsonResponse({'success': False, 'error': 'Password must contain at least one uppercase letter, one digit, and one symbol.'})
        
        try:
            profile = UserProfile.objects.get(reset_token=token)
            user = profile.user
            user.password = make_password(new_password)
            user.save()

            profile.reset_token = ''
            profile.save()

            return JsonResponse({'success': True, 'message': 'Password has been reset successfully.'})
        
        except UserProfile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Invalid token.'})

@method_decorator(login_required, name='dispatch')
@method_decorator(csrf_exempt, name='dispatch')
class EditProfileView(View):
    def post(self, request, *args, **kwargs):
        user = request.user
        avatar = request.FILES.get('avatar')

        if not nickname and not avatar:
            return JsonResponse({'success': False, 'error': 'At least one of nickname or avatar must be provided.'})

        try:
            user_profile = user.userprofile
            if avatar is not None:
                user_profile.profile_picture = avatar
            user_profile.save()

            return JsonResponse({'success': True, 'message': 'Profile updated successfully.'})

        except UserProfile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Profile does not exist.'})

@method_decorator(login_required, name='dispatch')
@method_decorator(csrf_exempt, name='dispatch')
class SendFriendRequestView(View):
     def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            print(f"Request body: {data}")
            to_user_username = data.get('to_user_username')
            print(f"Username received: {to_user_username}")

            if not to_user_username:
                return JsonResponse({'success': False, 'message': 'Username not provided.'})
            
            if to_user_username == request.user.username:
                return JsonResponse({'success': False, 'message': 'You cannot send a friend request to yourself.'})

            to_user = User.objects.get(username=to_user_username)
            friend_request, created = FriendRequest.objects.get_or_create(
                from_user=request.user, to_user=to_user)
            if created:
                return JsonResponse({'success': True, 'message': 'Friend request sent.'})
            else:
                return JsonResponse({'success': False, 'message': 'Friend request already sent.'})
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User does not exist.'})
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Invalid JSON.'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})

@method_decorator(csrf_protect, name='dispatch')
class AcceptFriendRequestView(View):
    def post(self, request, request_id, *args, **kwargs):
        try:
            friend_request = FriendRequest.objects.get(id=request_id)
        except FriendRequest.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Friend request does not exist.'})

        if friend_request.to_user == request.user:
            Friendship.make_friend(current_user=friend_request.from_user, new_friend=friend_request.to_user)
            Friendship.make_friend(current_user=friend_request.to_user, new_friend=friend_request.from_user)
            friend_request.delete()
            return JsonResponse({'success': True, 'message': 'Friend request accepted.'})
        return JsonResponse({'success': False, 'message': 'Unauthorized.'})

@method_decorator(csrf_protect, name='dispatch')
class RejectFriendRequestView(View):
    def post(self, request, request_id, *args, **kwargs):
        try:
            friend_request = FriendRequest.objects.get(id=request_id)
        except FriendRequest.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Friend request does not exist.'})

        if friend_request.to_user == request.user:
            friend_request.delete()
            return JsonResponse({'success': True, 'message': 'Friend request rejected.'})
        return JsonResponse({'success': False, 'message': 'Unauthorized.'})

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required, name='dispatch')
class GetFriendRequestsView(View):
    def get(self, request, *args, **kwargs):
        received_requests = FriendRequest.objects.filter(to_user=request.user)
        sent_requests = FriendRequest.objects.filter(from_user=request.user)
        return JsonResponse({
            'received_requests': [{'id': req.id, 'from_user': req.from_user.username} for req in received_requests],
            'sent_requests': [{'id': req.id, 'to_user': req.to_user.username} for req in sent_requests]
        })

@method_decorator(csrf_protect, name='dispatch')
@method_decorator(login_required, name='dispatch')
class GetFriendsView(View):
    def get(self, request, *args, **kwargs):
        try:
            friendship = Friendship.objects.get(current_user=request.user)
            friends = friendship.users.all()
            friends_list = []
            for friend in friends:
                profile = UserProfile.objects.get(user=friend)
                friends_list.append({
                    'username': friend.username,
                    'status': profile.status,
                })
            return JsonResponse({'friends': friends_list})
        except Friendship.DoesNotExist:
            return JsonResponse({'friends': []})

@method_decorator(login_required, name='dispatch')
@method_decorator(csrf_exempt, name='dispatch')
class UpdateStatusView(View):

    def post(self, request, *args, **kwargs):
        try:

            data = json.loads(request.body)
            status = data.get('status')
            user = request.user

            if user.is_authenticated:
                profile = UserProfile.objects.get(user=user)
                profile.status = status
                profile.save()

                update_status_and_notify_friends(user, status)
                print(profile.status)
                return JsonResponse({'status': 'success', 'message': 'Status updated successfully'})
            else:
                return JsonResponse({'status': 'error', 'message': 'User not authenticated'}, status=401)
        except UserProfile.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'UserProfile not found'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@method_decorator(login_required, name='dispatch')
@method_decorator(login_required, name='dispatch')
class MessagesListView(View):
    def get(self, request, username):
        print("HERE!!!!!!!!!!")
        user = request.user
        other_user = get_object_or_404(User, username=username)

        has_blocked = Block.objects.filter(blocker=user, blocked=other_user).exists()

        messages = Message.objects.filter(
            (Q(sender=user) & Q(receiver=other_user)) |
            (Q(sender=other_user) & Q(receiver=user))
        ).order_by('timestamp')

        message_list = []
        for message in messages:
            if has_blocked and message.sender == other_user:
                continue 
            message_list.append({
                'sender': message.sender.username,
                'receiver': message.receiver.username,
                'content': message.content,
                'timestamp': message.timestamp
            })

        return JsonResponse(message_list, safe=False)

@method_decorator(login_required, name='dispatch')
@method_decorator(csrf_exempt, name='dispatch')
class SendMessageView(View):
    def post(self, request):
        try:
            print("Entered the post method")
            data = json.loads(request.body)
            recipient_username = data.get('recipient_username')
            content = data.get('content')

            sender = request.user
            recipient = get_object_or_404(User, username=recipient_username)

            message = Message.objects.create(sender=sender, receiver=recipient, content=content)
            message_id = message.id
            print(f"Message created: {message_id}")

            channel_layer = get_channel_layer()
            room_group_name = f'chat_{recipient_username}'
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'chat_message',
                    'message': content,
                    'sender': sender.username,
                    'message_id': message_id,
                }
            )

            return JsonResponse({'status': 'Message sent successfully.'})
        
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)
        
        except User.DoesNotExist:
            return JsonResponse({'error': 'Recipient user not found.'}, status=404)

        except Exception as e:
            print(f"Exception: {e}")
            return JsonResponse({'error': 'Internal server error.'}, status=500)


@method_decorator(login_required, name='dispatch')
class BlockUserView(View):
    def post(self, request, friend_username):
        try:
            friend = get_object_or_404(User, username=friend_username)
            Block.objects.get_or_create(blocker=request.user, blocked=friend)
            return JsonResponse({"success": True, "message": f"You have blocked {friend_username}"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@method_decorator(login_required, name='dispatch')
class UnblockUserView(View):
    def post(self, request, friend_username):
        try:
            friend = get_object_or_404(User, username=friend_username)
            block = Block.objects.get(blocker=request.user, blocked=friend)
            block.delete()

            blocked_messages = Message.objects.filter(sender=friend, receiver=request.user, blocked=True)

            channel_layer = get_channel_layer()
            for message in blocked_messages:
                async_to_sync(channel_layer.group_send)(
                    sanitize_group_name(f"chat_{''.join(sorted([request.user.username, friend_username]))}"),
                    {
                        'type': 'chat_message',
                        'message': message.content,
                        'sender': message.sender.username,
                    }
                )
                message.blocked = False
                message.save()

            return JsonResponse({"success": True, "message": f"You have unblocked {friend_username}"})
        except Block.DoesNotExist:
            return JsonResponse({"error": "You have not blocked this user."}, status=404)
        except User.DoesNotExist:
            return JsonResponse({"error": "User not found."}, status=404)


@method_decorator(login_required, name='dispatch')
@method_decorator(login_required, name='dispatch')
class GameHistoryView(View):
    def get(self, request, *args, **kwargs):
        games = GameHistory.objects.filter(
            models.Q(player1=request.user) | models.Q(player2=request.user)
        ).order_by('-date_played')[:20]

        history = [{
            'player1': game.player1.username,
            'player2': game.player2.username,
            'score_player1': game.score_player1,
            'score_player2': game.score_player2,
            'winner': game.winner.username,
            'date_played': game.date_played.strftime('%Y-%m-%d %H:%M:%S')
        } for game in games]

        return JsonResponse({'history': history})

@method_decorator(login_required, name='dispatch')
class LogoutView(View):
    def post(self, request):
        logout(request)
        return JsonResponse({"success": True}, status=200)

@method_decorator(login_required, name='dispatch')
class FriendProfileView(View):
    def get(self, request, username):
        try:
            user = User.objects.get(username=username)
            profile = UserProfile.objects.get(user=user)
            
            game_history = GameHistory.objects.filter(
                models.Q(player1=user) | models.Q(player2=user)
            ).order_by('-date_played')[:20]
            
            data = {
                'nickname': user.username,
                'status': profile.status,
                'avatar': profile.profile_picture.url if profile.profile_picture else '/static/img/avatar.jpg',
                'history': [{
                    'player1': game.player1.username,
                    'player2': game.player2.username,
                    'winner': game.winner.username if game.winner else 'N/A',
                    'score_player1': game.score_player1,
                    'score_player2': game.score_player2,
                    'date_played': game.date_played.strftime('%Y-%m-%d'),
                } for game in game_history],
            }
            return JsonResponse(data, status=200)
        
        except User.DoesNotExist:
            return JsonResponse({'error': 'User not found'}, status=404)

class OAuthConfigView(View):
    def get(self, request, *args, **kwargs):
        return JsonResponse({
            'client_id': settings.FORTYTWO_CLIENT_ID,
            'redirect_uri': settings.FORTYTWO_REDIRECT_URI,
            'auth_url': settings.FORTYTWO_AUTH_URL
        })

class Auth42CallbackView(View):
    def get(self, request, *args, **kwargs):
        code = request.GET.get('code')
        if not code:
            return redirect('/#login')
        # check succes

        # send needed sec key, clien id and so on.
        # get user data save to database and then redirect user to home

        return redirect('/#login')