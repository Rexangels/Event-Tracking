import pytest
from rest_framework.test import APIClient
from django.urls import reverse
from infrastructure.models import EventModel, MediaModel
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
import io

@pytest.mark.django_db
class TestEventReportingAPI:
    def setup_method(self):
        self.client = APIClient()
        self.url = reverse('event-report-create')

    def create_test_image(self):
        file = io.BytesIO()
        image = Image.new('RGB', (100, 100), 'red')
        image.save(file, 'jpeg')
        file.seek(0)
        return SimpleUploadedFile("test_image.jpg", file.read(), content_type="image/jpeg")

    def test_create_event_report_success(self):
        image = self.create_test_image()
        data = {
            'title': 'Test Hazard',
            'description': 'A large pothole.',
            'category': 'infrastructure',
            'severity': 'medium',
            'latitude': 40.7128,
            'longitude': -74.0060,
            'files': [image]
        }
        
        response = self.client.post(self.url, data, format='multipart')
        
        assert response.status_code == 201
        assert EventModel.objects.count() == 1
        assert MediaModel.objects.count() == 1
        
        event = EventModel.objects.first()
        assert event.title == 'Test Hazard'
        assert event.media_attachments.count() == 1
        
        # Verify metadata extraction (basic check)
        media = event.media_attachments.first()
        assert media.file_type == 'image'
        # Note: Pillow generated image might not have EXIF, so we just check it doesn't crash
