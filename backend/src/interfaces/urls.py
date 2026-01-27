from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EventReportCreateView, EventListAdminView, StatsSummaryView, AuditLogViewSet, CustomAuthToken

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', CustomAuthToken.as_view(), name='api-token-auth'),
    path('reports/', EventReportCreateView.as_view(), name='event-report-create'),
    path('admin/events/', EventListAdminView.as_view(), name='event-list-admin'),
    path('stats/summary/', StatsSummaryView.as_view(), name='stats-summary'),
]
