import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyMapOperations,
    createDefaultMapFilters,
    getActiveFilterCount,
    getSearchMatches,
} from '../utils/mapOperations.js';

const sampleEvents = [
    {
        id: 'evt-001',
        timestamp: new Date().toISOString(),
        type: 'ENVIRONMENTAL',
        severity: 'CRITICAL',
        title: 'Blocked drainage in Ikeja',
        description: 'Drainage overflow around Awolowo Road',
        location: 'Ikeja',
        region: 'Nigeria',
        coords: { lat: 6.6018, lng: 3.3515 },
        source: 'INTERNAL_REPORT',
        verified: true,
        metadata: { hazard_report_id: 'rep-001' },
    },
    {
        id: 'evt-002',
        timestamp: new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString(),
        type: 'HUMAN_REPORT',
        severity: 'MEDIUM',
        title: 'Illegal dumping complaint',
        description: 'Open waste pile behind market',
        location: 'Yaba',
        region: 'Nigeria',
        coords: { lat: 6.5095, lng: 3.3711 },
        source: 'CITIZEN_PORTAL',
        verified: false,
        metadata: {},
    },
    {
        id: 'evt-003',
        timestamp: new Date().toISOString(),
        type: 'SENSORY',
        severity: 'LOW',
        title: 'Air quality sensor anomaly',
        description: 'PM2.5 increase near industrial estate',
        location: 'Apapa',
        region: 'Nigeria',
        coords: { lat: 6.4488, lng: 3.359 },
        source: 'SENSOR_GRID',
        verified: false,
        metadata: {},
    },
];

test('applyMapOperations filters by severity, verification, link state, source, search, and time window', () => {
    const filters = createDefaultMapFilters();
    filters.severity.LOW = false;
    filters.verification = 'verified';
    filters.linkedReport = 'linked';
    filters.source = 'INTERNAL_REPORT';
    filters.timeWindowHours = 24;

    const results = applyMapOperations(sampleEvents, {
        selectedRegion: 'Nigeria',
        searchQuery: 'Ikeja',
        filters,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'evt-001');
});

test('getSearchMatches prioritizes exact ids and report ids before looser title matches', () => {
    const byReportId = getSearchMatches(sampleEvents, 'rep-001');
    assert.equal(byReportId[0].id, 'evt-001');

    const byEventId = getSearchMatches(sampleEvents, 'evt-003');
    assert.equal(byEventId[0].id, 'evt-003');
});

test('getActiveFilterCount tracks meaningful operator constraints', () => {
    const filters = createDefaultMapFilters();
    filters.verification = 'unverified';
    filters.timeWindowHours = 24;
    filters.types.SENSORY = false;

    const count = getActiveFilterCount(filters, 'Nigeria', 'ikeja');
    assert.equal(count, 5);
});