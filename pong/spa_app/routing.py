# spa_app/routing.py

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/global/$', consumers.GlobalConsumer.as_asgi()),
    re_path(r'ws/chat/(?P<username>\w+)/$', consumers.ChatConsumer.as_asgi()),
    re_path(r'ws/game/(?P<username>\w+)/$', consumers.GameConsumer.as_asgi()),
]



print("HEre")