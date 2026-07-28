"""
URL configuration for infolake project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
import re

from django.urls import path, include, re_path
from django.conf import settings
from django.views.generic import RedirectView
from django.views.static import serve

from api import urls as api_urls
from equipment.admin_redirects import equipment_admin_redirect_urlpatterns
from infolake.admin_views import markdown_preview

urlpatterns = [
    path(
        '',
        RedirectView.as_view(url=settings.FRONTEND_URL, permanent=False),
        name='root',
    ),
    *equipment_admin_redirect_urlpatterns(),
    path('admin/markdown-preview/', markdown_preview, name='admin_markdown_preview'),
    path('admin/', admin.site.urls),
    path('api/v1/', include(api_urls)),
]

# Media: в офлайн/self-hosted нет отдельного CDN/nginx — отдаём файлы через Django
# и при DEBUG=False (django.conf.urls.static.static() в этом режиме не регистрирует маршруты).
if settings.MEDIA_URL and settings.MEDIA_ROOT:
    media_prefix = re.escape(settings.MEDIA_URL.lstrip('/'))
    urlpatterns += [
        re_path(
            rf'^{media_prefix}(?P<path>.*)$',
            serve,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]
