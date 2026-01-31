"""
INEHSS URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'forms', views.FormTemplateViewSet, basename='form-template')
router.register(r'reports', views.HazardReportViewSet, basename='hazard-report')
router.register(r'assignments', views.OfficerAssignmentViewSet, basename='officer-assignment')
router.register(r'submissions', views.FormSubmissionViewSet, basename='form-submission')
router.register(r'attachments', views.MediaAttachmentViewSet, basename='media-attachment')

urlpatterns = [
    path('', include(router.urls)),
    path('officers/', views.OfficerListView.as_view(), name='officer-list'),
]
