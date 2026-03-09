/** @typedef {import('../services/inehssService').FormField} FormField */

export function normalizeFieldName(label, fallbackName = 'field') {
    const normalized = String(label || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || fallbackName;
}

/**
 * @param {FormField[]} fields
 * @param {number} index
 * @param {Partial<FormField>} updates
 * @returns {FormField[]}
 */
export function updateFormFieldWithReferenceSync(fields, index, updates) {
    const previousName = fields[index]?.name;
    const nextFields = fields.map((field, fieldIndex) => (
        fieldIndex === index ? { ...field, ...updates } : field
    ));
    const nextName = nextFields[index]?.name;

    if (!previousName || !nextName || previousName === nextName) {
        return nextFields;
    }

    return nextFields.map(field => {
        if (!field.conditions?.length) return field;

        return {
            ...field,
            conditions: field.conditions.map(condition => (
                condition.field === previousName
                    ? { ...condition, field: nextName }
                    : condition
            )),
        };
    });
}

/**
 * @param {FormField[]} fields
 * @param {number} index
 * @returns {FormField[]}
 */
export function removeFormFieldAndReferences(fields, index) {
    const removedFieldName = fields[index]?.name;
    const nextFields = fields.filter((_, fieldIndex) => fieldIndex !== index);

    if (!removedFieldName) {
        return nextFields;
    }

    return nextFields.map(field => {
        if (!field.conditions?.length) return field;

        const remainingConditions = field.conditions.filter(condition => condition.field !== removedFieldName);

        return {
            ...field,
            conditions: remainingConditions.length > 0 ? remainingConditions : undefined,
        };
    });
}

/**
 * @param {FormField[]} fields
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {FormField[]}
 */
export function moveFormField(fields, fromIndex, toIndex) {
    if (
        fromIndex === toIndex
        || fromIndex < 0
        || toIndex < 0
        || fromIndex >= fields.length
        || toIndex >= fields.length
    ) {
        return fields;
    }

    const nextFields = [...fields];
    const [movedField] = nextFields.splice(fromIndex, 1);
    nextFields.splice(toIndex, 0, movedField);
    return nextFields;
}