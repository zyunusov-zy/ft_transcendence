from functools import wraps
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from django.http import JsonResponse
from functools import wraps
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

def jwt_required(view_func):
    """
    Decorator to ensure the request has a valid JWT in the HttpOnly cookie.
    """
    @wraps(view_func)
    def wrapper(self, request, *args, **kwargs):
        print("Request object:", request)

        # Access the token from the cookies
        access_token = request.COOKIES.get('access_token')

        if not access_token:
            print("No access token found in cookies.")
            return JsonResponse({'success': False, 'error': 'No access token.'}, status=401)

        try:
            # Verify the access token
            AccessToken(access_token)
            print("Access token is valid.")
            return view_func(self, request, *args, **kwargs)

        except (InvalidToken, TokenError):
            print("Access token is invalid.")
            return JsonResponse({'success': False, 'error': 'Invalid access token.'}, status=401)

    return wrapper

