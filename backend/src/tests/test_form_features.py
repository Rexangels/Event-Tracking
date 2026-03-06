import pytest
from rest_framework.test import APIClient
from django.urls import reverse
from inehss.models import FormTemplate, FormVersion, HazardReport

@pytest.mark.django_db
class TestFormVersioningAPI:
    def setup_method(self):
        self.client = APIClient()
        self.url = reverse('form-template-list')
        from django.contrib.auth.models import User
        self.admin = User.objects.create_superuser('admin_test', 'admin@example.com', 'password123')
        self.client.force_authenticate(user=self.admin)

    def test_form_versioning_lifecycle(self):
        # 1. Create a FormTemplate
        data = {
            'name': 'Test Form',
            'description': 'A test form',
            'form_type': 'public',
            'geo_mode': 'manual',
            'schema': [{'name': 'field1', 'type': 'text'}],
            'is_active': True
        }
        response = self.client.post(self.url, data, format='json')
        
        # Fallback if URL is wrong, tests might fail here, we will iterate
        assert response.status_code == 201, response.data
        
        template_id = response.data['id']
        template = FormTemplate.objects.get(id=template_id)
        
        # Verify v1 is created
        assert template.versions.count() == 1
        v1 = template.versions.first()
        assert v1.version_number == 1
        assert v1.schema == data['schema']
        assert v1.field_definitions.count() == 1
        assert v1.field_definitions.first().field_key == 'field1'
        
        # 2. Update the form schema
        update_url = f"{self.url}{template_id}/"
        update_data = {
            'name': 'Test Form Updated',
            'description': 'A test form',
            'form_type': 'public',
            'geo_mode': 'auto',
            'schema': [{'name': 'field1', 'type': 'text'}, {'name': 'field2', 'type': 'number'}],
            'is_active': True
        }
        
        response = self.client.put(update_url, update_data, format='json')
        assert response.status_code == 200
        
        # Verify v2 is created
        template.refresh_from_db()
        assert template.versions.count() == 2
        
        v2 = template.versions.order_by('-version_number').first()
        assert v2.version_number == 2
        assert v2.schema == update_data['schema']
        assert list(v2.field_definitions.values_list('field_key', flat=True)) == ['field1', 'field2']
        
        # Verify v1 is not mutated
        v1.refresh_from_db()
        assert v1.schema == data['schema']

    def test_follow_up_form_link_persists_across_versions(self):
        base_template = FormTemplate.objects.create(name='Base Public Form', form_type='public')
        FormVersion.objects.create(template=base_template, version_number=1, schema=[{'name': 'summary', 'type': 'text'}])

        data = {
            'name': 'Follow-up Inspection',
            'description': 'Officer follow-up form',
            'form_type': 'officer',
            'follow_up_for': str(base_template.id),
            'geo_mode': 'manual',
            'schema': [{'name': 'notes', 'type': 'text'}],
            'is_active': True,
        }
        response = self.client.post(self.url, data, format='json')

        assert response.status_code == 201, response.data
        assert str(response.data['follow_up_for']) == str(base_template.id)
        assert response.data['is_follow_up'] is True

        template_id = response.data['id']
        template = FormTemplate.objects.get(id=template_id)
        assert template.follow_up_for == base_template
        assert template.versions.count() == 1

        update_url = f"{self.url}{template_id}/"
        update_data = {
            'name': 'Follow-up Inspection v2',
            'description': 'Officer follow-up form',
            'form_type': 'officer',
            'follow_up_for': str(base_template.id),
            'geo_mode': 'auto',
            'schema': [
                {'name': 'notes', 'type': 'text'},
                {'name': 'severity', 'type': 'select', 'options': [{'label': 'Low', 'value': 'low'}]},
            ],
            'is_active': True,
        }
        update_response = self.client.put(update_url, update_data, format='json')

        assert update_response.status_code == 200, update_response.data
        template.refresh_from_db()
        assert template.follow_up_for == base_template
        assert template.versions.count() == 2


@pytest.mark.django_db
class TestParentChildLinkage:
    def setup_method(self):
        self.client = APIClient()
        self.url = reverse('hazard-report-list')
        
        self.template = FormTemplate.objects.create(
            name='Report Form',
            form_type='public'
        )
        self.version = FormVersion.objects.create(
            template=self.template,
            version_number=1,
            schema=[]
        )

    def test_link_reports_via_tracking_id(self):
        # Create parent report
        parent = HazardReport.objects.create(
            form_version=self.version,
            data={'field': 'value'},
            latitude=10.0,
            longitude=20.0
        )
        
        # Create child report linked to parent
        child_data = {
            'form_version': str(self.version.id),
            'data': {'field': 'child value'},
            'latitude': 10.0,
            'longitude': 20.0,
            'parent_tracking_id': parent.tracking_id
        }
        
        response = self.client.post(self.url, child_data, format='json')
        assert response.status_code == 201, response.data
        
        # Verify linkage
        child = HazardReport.objects.get(tracking_id=response.data['tracking_id'])
        assert child.parent_report == parent
        assert parent.follow_up_reports.count() == 1
