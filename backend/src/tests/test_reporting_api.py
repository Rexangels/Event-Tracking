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


@pytest.mark.django_db
class TestBBoxFiltering:
    """
    Test geospatial bounding box filtering for the events API.
    """
    def setup_method(self):
        self.client = APIClient()
        self.url = reverse('event-list-admin')
        
        # Create test events in different locations
        # New York (USA)
        EventModel.objects.create(
            title='New York Event',
            description='Event in NYC',
            latitude=40.7128,
            longitude=-74.0060,
            severity='high'
        )
        # London (UK)
        EventModel.objects.create(
            title='London Event',
            description='Event in London',
            latitude=51.5074,
            longitude=-0.1278,
            severity='medium'
        )
        # Tokyo (Japan)
        EventModel.objects.create(
            title='Tokyo Event',
            description='Event in Tokyo',
            latitude=35.6762,
            longitude=139.6503,
            severity='low'
        )

    def test_bbox_filter_north_america(self):
        """Test that bbox filter returns only events within North America."""
        # Bounding box covering North America (roughly)
        # minLon, minLat, maxLon, maxLat
        bbox = '-130,25,-60,50'
        
        response = self.client.get(self.url, {'bbox': bbox})
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only return NYC event
        assert len(data) == 1
        assert data[0]['title'] == 'New York Event'

    def test_bbox_filter_europe(self):
        """Test that bbox filter returns only events within Europe."""
        # Bounding box covering Europe
        bbox = '-15,35,30,60'
        
        response = self.client.get(self.url, {'bbox': bbox})
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only return London event
        assert len(data) == 1
        assert data[0]['title'] == 'London Event'

    def test_bbox_filter_asia(self):
        """Test that bbox filter returns only events within Asia."""
        # Bounding box covering Japan
        bbox = '130,30,145,45'
        
        response = self.client.get(self.url, {'bbox': bbox})
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only return Tokyo event
        assert len(data) == 1
        assert data[0]['title'] == 'Tokyo Event'

    def test_no_bbox_returns_all(self):
        """Test that without bbox filter, all events are returned."""
        response = self.client.get(self.url)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return all 3 events
        assert len(data) == 3

    def test_combined_filters(self):
        """Test bbox with severity filter combined."""
        # Global bbox but with severity filter
        bbox = '-180,-90,180,90'
        
        response = self.client.get(self.url, {'bbox': bbox, 'severity': 'high'})
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only return high severity event (NYC)
        assert len(data) == 1
        assert data[0]['severity'] == 'high'
