from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from spa_app import routing 
from django.contrib import admin


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('spa_app.urls')),
    re_path(r'^ws/', include(routing.websocket_urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)