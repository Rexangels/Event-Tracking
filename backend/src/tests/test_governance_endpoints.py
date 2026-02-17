import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from infrastructure.auth import UserProfile, UserRole
from infrastructure.models import AuditLog


@pytest.mark.django_db
class TestGovernanceEndpoints:
    def setup_method(self):
        self.client = APIClient()
        self.analyst = User.objects.create_user(username='governance_analyst', password='pass1234')
        UserProfile.objects.create(user=self.analyst, role=UserRole.ANALYST)
        self.basic_user = User.objects.create_user(username='basic_user', password='pass1234')

    def test_audit_log_hash_chain_is_generated(self):
        first = AuditLog.objects.create(action='LOGIN', source='tester', status='SUCCESS', details='first')
        second = AuditLog.objects.create(action='EVENT_VERIFY', source='tester', status='SUCCESS', details='second')

        assert first.prev_hash == '0' * 64
        assert len(first.entry_hash) == 64
        assert second.prev_hash == first.entry_hash

    def test_governance_endpoints_allow_analyst(self):
        AuditLog.objects.create(action='LOGIN', source='tester', status='SUCCESS', details='first')

        self.client.force_authenticate(user=self.analyst)
        ledger = self.client.get('/api/v1/governance/ledger/')
        trust_index = self.client.get('/api/v1/governance/trust-index/')

        assert ledger.status_code == 200
        assert trust_index.status_code == 200
        assert 'integrity_ok' in ledger.data
        assert 'data_integrity' in trust_index.data

    def test_governance_endpoints_block_non_governance_user(self):
        self.client.force_authenticate(user=self.basic_user)
        ledger = self.client.get('/api/v1/governance/ledger/')

        assert ledger.status_code == 403

    def test_trust_index_flags_tampered_chain(self):
        first = AuditLog.objects.create(action='LOGIN', source='tester', status='SUCCESS', details='first')
        second = AuditLog.objects.create(action='EVENT_VERIFY', source='tester', status='SUCCESS', details='second')

        AuditLog.objects.filter(pk=second.pk).update(prev_hash='f' * 64)

        self.client.force_authenticate(user=self.analyst)
        trust_index = self.client.get('/api/v1/governance/trust-index/')

        assert trust_index.status_code == 200
        assert trust_index.data['integrity_ok'] is False
