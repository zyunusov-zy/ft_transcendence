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
from rest_framework_simplejwt.tokens import RefreshToken
import requests
from django.core.exceptions import ValidationError
from django.utils.http import urlencode
from django.utils.html import escape
from django.utils import timezone
from .utils import jwt_required
import random
from datetime import timedelta
from django.utils import timezone


@method_decorator(csrf_exempt, name='dispatch')
class TokenRefreshView(View):
    def post(self, request):
        # Get the refresh token from cookies
        refresh_token = request.COOKIES.get('refresh_token')
        
        if not refresh_token:
            return JsonResponse({'success': False, 'message': 'No refresh token provided'}, status=400)

        try:
            # Create a RefreshToken instance and get a new access token
            refresh = RefreshToken(refresh_token)
            new_access_token = str(refresh.access_token)

            response = JsonResponse({'success': True})

            # Set the new access token in the cookies with the proper lifetime
            access_token_lifetime = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()

            response.set_cookie(
                'access_token',
                new_access_token,
                httponly=True,
                secure=True,  # Should be enabled in production (HTTPS)
                samesite='Strict',  # Stronger CSRF protection
                max_age=access_token_lifetime
            )

            return response
        except Exception as e:
            return JsonResponse({'success': False, 'message': 'Invalid refresh token'}, status=401)


class BaseTemplateView(View):
    template_name = 'base.html'

    def get(self, request, *args, **kwargs):
        context = kwargs.get('context', {})
        return render(request, self.template_name, context)

class Enable2FAView(View):
    def post(self, request):
        user = request.user
        user_profile = UserProfile.objects.get(user=user)

        try:
            code = str(random.randint(100000, 999999))
            user_profile.email_2fa_code = code
            user_profile.email_2fa_code_expiry = timezone.now() + timedelta(minutes=5)
            user_profile.save()


            send_mail(
                'Your 2FA Code',
                f'Your verification code is {code}. It will expire in 5 minutes.',
                'pong42',
                [user.email],
                fail_silently=False,
            )

            return JsonResponse({'success': True, 'message': '2FA code sent to your email.'})

        except Exception as e:
            return JsonResponse({'success': False, 'errors': f'Error sending 2FA code: {str(e)}'})

class Get2FAStatusView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        user_profile = UserProfile.objects.get(user=request.user)

        is_enabled = user_profile.is_2fa_enabled

        return JsonResponse({
            'success': True,
            'is_enabled': is_enabled
        })

class Verify2FAView(View):
    def post(self, request):
        user = request.user
        user_profile = UserProfile.objects.get(user=user)

        try:
            data = json.loads(request.body)
            code = data.get('code')

            code = code.strip() if code else ""


            if user_profile.email_2fa_code == code and timezone.now() < user_profile.email_2fa_code_expiry:
                user_profile.is_2fa_enabled = True
                user_profile.email_2fa_code = None
                user_profile.email_2fa_code_expiry = None
                user_profile.save()

                return JsonResponse({'success': True, 'message': '2FA enabled successfully.'})
            else:
                return JsonResponse({'success': False, 'errors': 'Invalid or expired 2FA code.'})

        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'errors': 'Invalid JSON format.'})
        except Exception as e:
            return JsonResponse({'success': False, 'errors': f'Error verifying 2FA code: {str(e)}'})

@method_decorator(login_required, name='dispatch')
class CheckAuthenticationView(View):
    def get(self, request, *args, **kwargs):
        return JsonResponse({'authenticated': True})

class Verify2FALView(View):
    @method_decorator(csrf_exempt)
    def post(self, request):
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            code = data.get('code')

            user = authenticate(username=username, password=password)
            if user is None:
                return JsonResponse({'success': False, 'errors': 'Invalid username or password.'}, status=400)

            user_profile = UserProfile.objects.get(user=user)
            if user_profile.is_2fa_enabled:
                if user_profile.verify_2fa_code(code):
                    auth_login(request, user)
                    refresh = RefreshToken.for_user(user)

                    response = JsonResponse({'success': True, 'message': '2FA verification successful!'})

                    access_token_lifetime = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']
                    refresh_token_lifetime = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']

                    access_token_expiry = timezone.now() + access_token_lifetime
                    refresh_token_expiry = timezone.now() + refresh_token_lifetime



                    response.set_cookie(
                        'access_token',
                        str(refresh.access_token),
                        httponly=True,
                        secure=True,
                        samesite='Lax',
                        expires=access_token_expiry
                    )
                    response.set_cookie(
                        'refresh_token',
                        str(refresh),
                        httponly=True,
                        secure=True,
                        samesite='Lax',
                        expires=refresh_token_expiry
                    )
                    return response
                else:
                    return JsonResponse({'success': False, 'errors': 'Invalid or expired 2FA code.'}, status=400)
            else:
                login(request, user)
                return JsonResponse({'success': True, 'message': 'Login successful!'})
        except UserProfile.DoesNotExist:
            return JsonResponse({'success': False, 'errors': 'User profile does not exist.'}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'errors': 'Invalid JSON format.'}, status=400)

class RequestDisable2FACodeView(View):
    def post(self, request):
        user = request.user
        user_profile = UserProfile.objects.get(user=user)

        try:
            code = str(random.randint(100000, 999999))
            user_profile.email_2fa_code = code
            user_profile.email_2fa_code_expiry = timezone.now() + timedelta(minutes=5)
            user_profile.save()

            send_mail(
                'Your 2FA Disable Code',
                f'Your verification code for disabling 2FA is {code}. It will expire in 5 minutes.',
                'no-reply@example.com',
                [user.email],
                fail_silently=False,
            )

            return JsonResponse({'success': True, 'message': '2FA disable code sent to your email.'})

        except Exception as e:
            return JsonResponse({'success': False, 'errors': f'Error sending disable 2FA code: {str(e)}'})

class VerifyDisable2FAView(View):
    def post(self, request):
        user = request.user
        user_profile = UserProfile.objects.get(user=user)

        try:
            data = json.loads(request.body)
            code = data.get('code')

            if code and user_profile.email_2fa_code == code and timezone.now() < user_profile.email_2fa_code_expiry:
                user_profile.is_2fa_enabled = False
                user_profile.email_2fa_code = None
                user_profile.email_2fa_code_expiry = None
                user_profile.save()

                return JsonResponse({'success': True, 'message': '2FA has been disabled.'})
            else:
                return JsonResponse({'success': False, 'errors': 'Invalid or expired 2FA code.'})

        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'errors': 'Invalid JSON format.'})
        except Exception as e:
            return JsonResponse({'success': False, 'errors': f'Error disabling 2FA: {str(e)}'})

@method_decorator(csrf_exempt, name='dispatch')
class LoginView(View):
    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')

        if not username or not password:
            return JsonResponse({'success': False, 'errors': 'Username and password are required.'})

        user = authenticate(request, username=username, password=password)

        if user is not None:
            if user.is_active:
                try:
                    profile = user.userprofile
                except UserProfile.DoesNotExist:
                    profile = None

                if profile and profile.is_2fa_enabled:
                    self.send_2fa_code(profile)
                    return JsonResponse({
                        'success': False,
                        'requires_2fa': True,
                        'message': '2FA is enabled. Enter the code sent to your email.'
                    })

                elif profile and profile.email_verified:
                    auth_login(request, user)

                    refresh = RefreshToken.for_user(user)

                    response = JsonResponse({'success': True})

                    access_token_lifetime = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']
                    refresh_token_lifetime = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']

                    access_token_expiry = timezone.now() + access_token_lifetime
                    refresh_token_expiry = timezone.now() + refresh_token_lifetime



                    response.set_cookie(
                        'access_token',
                        str(refresh.access_token),
                        httponly=True,
                        secure=True,
                        samesite='Lax',
                        expires=access_token_expiry
                    )
                    response.set_cookie(
                        'refresh_token',
                        str(refresh),
                        httponly=True,
                        secure=True,
                        samesite='Lax',
                        expires=refresh_token_expiry
                    )
                    return response
                elif profile and not profile.email_verified:
                    return JsonResponse({
                        'success': False,
                        'errors': 'Your email is not verified. Please check your email to activate your account.'
                    })

                else:
                    return JsonResponse({'success': False, 'errors': 'Error logging in. Please contact support for assistance.'})
            else:
                return JsonResponse({'success': False, 'errors': 'Your account is inactive. Please contact support for assistance.'})

        else:
            return JsonResponse({'success': False, 'errors': 'Invalid username or password'})

    def send_2fa_code(self, profile):
        code = str(random.randint(100000, 999999))
        profile.email_2fa_code = code
        profile.email_2fa_code_expiry = timezone.now() + timedelta(minutes=5)
        profile.save()

        send_mail(
            'Your 2FA Code',
            f'Your verification code is {code}. It will expire in 5 minutes.',
            'pong42',
            [profile.user.email],
            fail_silently=False,
        )

@method_decorator(csrf_exempt, name='dispatch')
class SignupView(View):
    def post(self, request):
        username = escape(request.POST.get('usernamesignup', '').strip())
        email = escape(request.POST.get('emailsignup', '').strip())
        password = escape(request.POST.get('passwordsignup', '').strip())

        if not username or not email or not password:
            return JsonResponse({'success': False, 'errors': 'All fields are required.'})

        email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
        if not re.match(email_regex, email):
            return JsonResponse({'success': False, 'errors': 'Invalid email format.'})

        if len(password) < 8:
            return JsonResponse({'success': False, 'errors': 'Password must be at least 8 characters long.'})
        if not re.findall('[A-Z]', password) or not re.findall('[0-9]', password) or not re.findall('[!@#$%^&*(),.?":{}|<>]', password):
            return JsonResponse({'success': False, 'errors': 'Password must contain at least one uppercase letter, one digit, and one symbol.'})

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
                'pong42', 
                [email],
                fail_silently=False,
            )
            return JsonResponse({'success': True, 'message': 'Verification email sent. Please check your email to verify your account.'})
        except Exception as e:
            return JsonResponse({'success': False, 'errors': str(e)})

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


class UserDataView(LoginRequiredMixin, View):
    @jwt_required
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
        username = escape(request.POST.get('username', '').strip())
        email = escape(request.POST.get('email', '').strip())

        if not username or not email:
            return JsonResponse({'success': False, 'error': 'Username and email are required.'})

        email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
        if not re.match(email_regex, email):
            return JsonResponse({'success': False, 'error': 'Invalid email format.'})

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
                'pong42',
                [email],
                fail_silently=False,
            )
            return JsonResponse({'success': True, 'message': 'Password reset email sent.'})

        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Invalid username or email.'})


@method_decorator(csrf_exempt, name='dispatch')
class SetNewPasswordView(View):
    def post(self, request, *args, **kwargs):
        token = escape(request.POST.get('token', '').strip())
        new_password = escape(request.POST.get('new_password', '').strip())
        confirm_password = escape(request.POST.get('confirm_password', '').strip())

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

class ValidateTokenView(View):
    def get(self, request, *args, **kwargs):
        token = request.GET.get('token')
        if not token:
            return JsonResponse({'valid': False, 'error': 'No token provided'})

        try:
            profile = UserProfile.objects.get(reset_token=token)
            return JsonResponse({'valid': True})
        except UserProfile.DoesNotExist:
            return JsonResponse({'valid': False, 'error': 'Invalid token'})

# @method_decorator(login_required, name='dispatch')
# @method_decorator(csrf_exempt, name='dispatch')
class EditProfileView(View):
    @jwt_required
    def post(self, request, *args, **kwargs):
        user = request.user
        avatar = request.FILES.get('avatar')
        username = request.POST.get('username', '').strip()

        if username:
            if User.objects.filter(username=username).exclude(id=user.id).exists():
                return JsonResponse({'success': False, 'error': 'Username is already taken.'})

            if username != user.username:
                user.username = username
                user.save()

        try:
            user_profile = user.userprofile

            if avatar:
                user_profile.profile_picture = avatar

            user_profile.save()

            return JsonResponse({'success': True, 'message': 'Profile updated successfully.'})

        except UserProfile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Profile does not exist.'})


class SendFriendRequestView(View):
    @jwt_required
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            to_user_username = data.get('to_user_username')

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


class AcceptFriendRequestView(View):
    @jwt_required
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


class RejectFriendRequestView(View):
    @jwt_required
    def post(self, request, request_id, *args, **kwargs):
        try:
            friend_request = FriendRequest.objects.get(id=request_id)
        except FriendRequest.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Friend request does not exist.'})

        if friend_request.to_user == request.user:
            friend_request.delete()
            return JsonResponse({'success': True, 'message': 'Friend request rejected.'})
        return JsonResponse({'success': False, 'message': 'Unauthorized.'})


class GetFriendRequestsView(View):
    @jwt_required
    def get(self, request, *args, **kwargs):
        received_requests = FriendRequest.objects.filter(to_user=request.user)
        sent_requests = FriendRequest.objects.filter(from_user=request.user)
        return JsonResponse({
            'received_requests': [{'id': req.id, 'from_user': req.from_user.username} for req in received_requests],
            'sent_requests': [{'id': req.id, 'to_user': req.to_user.username} for req in sent_requests]
        })

class GetFriendsView(View):
    @jwt_required
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

class UpdateStatusView(View):
    @jwt_required
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
                return JsonResponse({'status': 'success', 'message': 'Status updated successfully'})
            else:
                return JsonResponse({'status': 'error', 'message': 'User not authenticated'}, status=401)
        except UserProfile.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'UserProfile not found'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@method_decorator(login_required, name='dispatch')
class MessagesListView(View):
    @jwt_required
    def get(self, request, username):
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
class CheckBlockStatusView(View):
    def get(self, request, username):
        current_user = request.user
        other_user = get_object_or_404(User, username=username)

        has_blocked = Block.objects.filter(blocker=current_user, blocked=other_user).exists()
        return JsonResponse({
            'hasBlocked': has_blocked,
        })


class SendMessageView(View):
    @jwt_required
    def post(self, request):
        try:
            data = json.loads(request.body)
            recipient_username = data.get('recipient_username')
            content = data.get('content')

            sender = request.user
            recipient = get_object_or_404(User, username=recipient_username)

            message = Message.objects.create(sender=sender, receiver=recipient, content=content)
            message_id = message.id

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
            return JsonResponse({'error': 'Internal server error.'}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class BlockUserView(View):
    @jwt_required
    def post(self, request, friend_username):
        try:
            friend = get_object_or_404(User, username=friend_username)
            Block.objects.get_or_create(blocker=request.user, blocked=friend)
            return JsonResponse({"success": True, "message": f"You have blocked {friend_username}"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@method_decorator(csrf_exempt, name='dispatch')
class UnblockUserView(View):
    @jwt_required
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
@method_decorator(csrf_exempt, name='dispatch')
class GameHistoryView(View):
    @jwt_required
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

class LogoutView(View):
    def post(self, request):
        logout(request)
        response = JsonResponse({'success': True}, status=200)
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response

@method_decorator(login_required, name='dispatch')
@method_decorator(csrf_exempt, name='dispatch')
class FriendProfileView(View):
    @jwt_required
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

@method_decorator(csrf_exempt, name='dispatch')
class OAuthConfigView(View):
    def get(self, request, *args, **kwargs):
        return JsonResponse({
            'client_id': settings.FORTYTWO_CLIENT_ID,
            'redirect_uri': settings.FORTYTWO_THING,
            'auth_url': settings.FORTYTWO_AUTH_URL
        })

from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import login as auth_login

@method_decorator(csrf_exempt, name='dispatch')
class Auth42CallbackView(View):
    def get(self, request, *args, **kwargs):
        code = request.GET.get('code')
        if not code:
            return redirect(f"/#login?error='Authorization Failed'")
        try:
            # Exchange code for access token
            token_url = settings.FORTYTWO_URL_TOKEN
            token_data = {
                'grant_type': 'authorization_code',
                'client_id': settings.FORTYTWO_CLIENT_ID,
                'client_secret': settings.FORTYTWO_CLIENT_SECRET,
                'code': code,
                'redirect_uri': settings.FORTYTWO_THING,
            }
            
            token_response = requests.post(token_url, data=token_data)
            if token_response.status_code != 200:
                return redirect(f"/#login?error='Token Exchange Failed'")
            
            token_info = token_response.json()
            access_token = token_info.get('access_token')
            if not access_token:
                return redirect(f"/#login?error='Invalid Token'")

            # Get user info from OAuth provider
            user_info_url = settings.FORTYTWO_URL_INFO
            headers = {'Authorization': f'Bearer {access_token}'}
            user_response = requests.get(user_info_url, headers=headers)

            if user_response.status_code != 200:
                return redirect(f"/#login?error='Failed to Fetch User Info'")

            user_data = user_response.json()

            # Sanitize and get username and email
            username = self.sanitize_username(user_data.get('login'))
            email = self.sanitize_email(user_data.get('email'))
            request.session['access_token'] = access_token

            user = User.objects.filter(email=email).first()

            if not user:
                original_username = username
                count = 1

                while User.objects.filter(username__iexact=username).exists():
                    username = f"{original_username}_{count}"
                    count += 1

                user = User.objects.create_user(username=username, email=email)
                UserProfile.objects.create(user=user)

            auth_login(request, user)
            refresh = RefreshToken.for_user(user)

            response = redirect('/#home')

            access_token_lifetime = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()
            refresh_token_lifetime = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()

            response.set_cookie(
                'access_token',
                str(refresh.access_token),
                httponly=True,
                secure=True,
                samesite='Strict',
                max_age=access_token_lifetime
            )
            response.set_cookie(
                'refresh_token',
                str(refresh),
                httponly=True,
                secure=True,
                samesite='Strict',
                max_age=refresh_token_lifetime
            )

            return response

        except requests.RequestException:
            return redirect(f"/#login?error='Internal Error'")
        
        except ValidationError:
            return redirect(f"/#login?error='Data Validation Failed'")

    def sanitize_username(self, username):
        """
        Sanitize and validate the username.
        """
        if not username:
            raise ValidationError("Username is missing.")
        
        sanitized_username = re.sub(r'[^a-zA-Z0-9_]', '', username)
        return sanitized_username.lower()

    def sanitize_email(self, email):
        """
        Sanitize and validate the email address.
        """
        if not email:
            raise ValidationError("Email is missing.")
        
        email = email.strip().lower()
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            raise ValidationError("Invalid email format.")
        
        return email
