import re
from typing import Any

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"\b(?:\+?\d[\d\s\-()]{7,}\d)\b")
TOKEN_PATTERN = re.compile(r"\b(?:sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})\b", re.IGNORECASE)


def redact_sensitive_text(value: str) -> str:
    redacted = EMAIL_PATTERN.sub('[REDACTED_EMAIL]', value)
    redacted = PHONE_PATTERN.sub('[REDACTED_PHONE]', redacted)
    redacted = TOKEN_PATTERN.sub('[REDACTED_TOKEN]', redacted)
    return redacted


def normalize_explainability(payload: Any) -> dict:
    if not isinstance(payload, dict):
        return {}

    score = payload.get('confidence_score')
    if not isinstance(score, (int, float)):
        score = None

    label = payload.get('confidence_label')
    if label not in {'low', 'medium', 'high'}:
        label = ''

    return {
        'confidence_score': score,
        'confidence_label': label,
        'key_factors': payload.get('key_factors') if isinstance(payload.get('key_factors'), list) else [],
        'assumptions': payload.get('assumptions') if isinstance(payload.get('assumptions'), list) else [],
        'counter_indicators': payload.get('counter_indicators') if isinstance(payload.get('counter_indicators'), list) else [],
        'source_refs': payload.get('source_refs') if isinstance(payload.get('source_refs'), list) else [],
    }
