from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^wss/global/$', consumers.GlobalConsumer.as_asgi()),
    re_path(r'^wss/chat/(?P<username>\w+)/$', consumers.ChatConsumer.as_asgi()),
    re_path(r'^wss/game/(?P<username>\w+)/$', consumers.GameConsumer.as_asgi()),
]

print("WebSocket URL patterns loaded")
