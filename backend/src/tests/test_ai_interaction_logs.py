import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from infrastructure.models import AIInteractionLog
from infrastructure.auth import UserProfile


@pytest.mark.django_db
class TestAIInteractionLogs:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='logger', password='pass1234')
        self.analyst = User.objects.create_user(username='analyst', password='pass1234')
        UserProfile.objects.create(user=self.analyst, role='analyst')
        self.staff = User.objects.create_user(username='staff', password='pass1234', is_staff=True)

    def test_create_ai_interaction_redacts_prompt(self):
        self.client.force_authenticate(user=self.user)

        payload = {
            'provider': 'openrouter',
            'model_name': 'google/gemini-2.0-flash-001',
            'prompt_redacted': 'Reach me at me@example.com phone +15551234567 Bearer sk-12345678901234567890',
            'response_text': 'Analysis output',
            'explainability': {
                'confidence_score': 0.72,
                'confidence_label': 'medium',
                'key_factors': ['factor1'],
                'assumptions': ['assume1'],
                'counter_indicators': [],
                'source_refs': ['event:1'],
            },
        }

        response = self.client.post('/api/v1/ai-interactions/', payload, format='json')
        assert response.status_code == 201
        saved = AIInteractionLog.objects.get(id=response.data['id'])
        assert '[REDACTED_EMAIL]' in saved.prompt_redacted
        assert '[REDACTED_PHONE]' in saved.prompt_redacted
        assert '[REDACTED_TOKEN]' in saved.prompt_redacted
        assert saved.confidence_label == 'medium'
        assert saved.confidence_score == pytest.approx(0.72)

    def test_only_governance_roles_can_list_logs(self):
        AIInteractionLog.objects.create(
            user=self.user,
            prompt_redacted='prompt',
            response_text='response',
            explainability={},
        )

        self.client.force_authenticate(user=self.user)
        forbidden = self.client.get('/api/v1/ai-interactions/')
        assert forbidden.status_code == 403

        self.client.force_authenticate(user=self.analyst)
        analyst_ok = self.client.get('/api/v1/ai-interactions/')
        assert analyst_ok.status_code == 200

        self.client.force_authenticate(user=self.staff)
        staff_ok = self.client.get('/api/v1/ai-interactions/')
        assert staff_ok.status_code == 200
