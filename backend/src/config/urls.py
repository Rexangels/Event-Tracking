"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
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
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from infrastructure.auth_views import UserViewSet, CustomTokenObtainPairView, HealthCheckView, AdminEventsViewSet
from rest_framework_simplejwt.views import TokenRefreshView

# Auth router
auth_router = DefaultRouter()
auth_router.register(r'users', UserViewSet, basename='users')

# Admin router
admin_router = DefaultRouter()
admin_router.register(r'health', HealthCheckView, basename='health')
admin_router.register(r'events', AdminEventsViewSet, basename='admin-events')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication endpoints
    path('api/v1/auth/', include(auth_router.urls)),
    path('api/v1/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Admin endpoints
    path('api/v1/admin/', include(admin_router.urls)),
    
    # API endpoints
    path('api/v1/', include(('interfaces.urls', 'interfaces'), namespace='v1')),
    path('api/v1/inehss/', include('inehss.urls')),
    
    # Schema/Documentation - Disabled for demo
    # path('api/schema/', include('drf_spectacular.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
