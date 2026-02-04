from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EventReportCreateView, EventListAdminView, StatsSummaryView, AuditLogViewSet, CustomAuthToken, EventActionView, HealthCheckView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),

    path('reports/', EventReportCreateView.as_view(), name='event-report-create'),
    path('admin/events/', EventListAdminView.as_view(), name='event-list-admin'),
    path('admin/events/<uuid:pk>/<str:action>/', EventActionView.as_view(), name='event-action'),
    path('stats/summary/', StatsSummaryView.as_view(), name='stats-summary'),
    path('health/', HealthCheckView.as_view(), name='health-check'),
    # API Schema views
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    # Optional UI:
    path('schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
