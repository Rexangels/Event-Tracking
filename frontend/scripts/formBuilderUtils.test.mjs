import test from 'node:test';
import assert from 'node:assert/strict';

import {
    moveFormField,
    normalizeFieldName,
    removeFormFieldAndReferences,
    updateFormFieldWithReferenceSync,
} from '../utils/formBuilderUtils.js';

test('updateFormFieldWithReferenceSync keeps skip-logic references aligned when a field name changes', () => {
    const fields = [
        { name: 'hazard', label: 'Hazard', type: 'select', options: [{ label: 'Chemical', value: 'chemical' }] },
        { name: 'details', label: 'Details', type: 'text', conditions: [{ field: 'hazard', operator: 'equals', value: 'chemical' }] },
    ];

    const updated = updateFormFieldWithReferenceSync(fields, 0, { label: 'Hazard type', name: 'hazard_type' });

    assert.equal(updated[0].name, 'hazard_type');
    assert.equal(updated[1].conditions[0].field, 'hazard_type');
});

test('removeFormFieldAndReferences removes orphaned skip-logic conditions', () => {
    const fields = [
        { name: 'hazard', label: 'Hazard', type: 'select' },
        { name: 'severity', label: 'Severity', type: 'text', conditions: [{ field: 'hazard', operator: 'not_empty' }] },
    ];

    const updated = removeFormFieldAndReferences(fields, 0);

    assert.equal(updated.length, 1);
    assert.equal(updated[0].name, 'severity');
    assert.equal(updated[0].conditions, undefined);
});

test('normalizeFieldName preserves a fallback key while labels are blank during form editing', () => {
    assert.equal(normalizeFieldName('', 'field_1'), 'field_1');
    assert.equal(normalizeFieldName('Hazard Type', 'field_1'), 'hazard_type');
});

test('moveFormField reorders fields without changing their skip-logic references', () => {
    const fields = [
        { name: 'hazard', label: 'Hazard', type: 'select' },
        { name: 'details', label: 'Details', type: 'text', conditions: [{ field: 'hazard', operator: 'not_empty' }] },
        { name: 'summary', label: 'Summary', type: 'textarea' },
    ];

    const updated = moveFormField(fields, 2, 0);

    assert.deepEqual(updated.map(field => field.name), ['summary', 'hazard', 'details']);
    assert.equal(updated[2].conditions[0].field, 'hazard');
});