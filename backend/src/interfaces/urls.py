from django.urls import path
from .views import EventReportCreateView, EventListAdminView, StatsSummaryView

urlpatterns = [
    path('reports/', EventReportCreateView.as_view(), name='event-report-create'),
    path('admin/events/', EventListAdminView.as_view(), name='event-list-admin'),
    path('stats/summary/', StatsSummaryView.as_view(), name='stats-summary'),
]
