import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveMapOverlays, countMapOverlays } from '../utils/mapOverlays.js';

const events = [
    {
        id: 'evt-001',
        timestamp: new Date().toISOString(),
        type: 'ENVIRONMENTAL',
        severity: 'HIGH',
        title: 'Waste discharge alert',
        description: 'Linked to report rep-100',
        location: 'Ikeja',
        region: 'Nigeria',
        coords: { lat: 6.6, lng: 3.35 },
        source: 'INTERNAL_REPORT',
        verified: true,
        metadata: { hazard_report_id: 'rep-100' },
    },
];

const reports = [
    {
        id: 'rep-100',
        tracking_id: 'TRK-100',
        latitude: 6.61,
        longitude: 3.36,
        address: 'Ikeja Industrial Road',
        status: 'open',
        event_id: 'evt-001',
        form_version: { template_name: 'Hazard Intake' },
        report_origin: { code: 'public' },
        lineage: null,
        updated_at: new Date().toISOString(),
    },
    {
        id: 'rep-200',
        tracking_id: 'TRK-200',
        latitude: 6.5,
        longitude: 3.4,
        address: 'Yaba Canal',
        status: 'in_review',
        event_id: null,
        form_version: { template_name: 'Patrol Follow-up' },
        report_origin: { code: 'patrol' },
        lineage: {
            is_patrol_generated: true,
            origin_assignment_id: 'asgmt-9',
            origin_officer_username: 'officer.ade',
            origin_assignment_status: 'submitted',
        },
        updated_at: new Date().toISOString(),
    },
];

const assignments = [
    {
        id: 'asgmt-1',
        report: reports[0],
        officer_username: 'officer.jane',
        status: 'assigned',
    },
    {
        id: 'asgmt-9',
        report: null,
        officer_username: 'officer.ade',
        status: 'submitted',
    },
];

test('deriveMapOverlays creates report, assignment, and patrol-origin overlays', () => {
    const overlays = deriveMapOverlays({ events, reports, assignments, selectedRegion: 'Nigeria' });

    assert.equal(overlays.reports.length, 2);
    assert.equal(overlays.assignments.length, 2);
    assert.equal(overlays.patrolOrigins.length, 1);
    assert.equal(overlays.assignments[1].reportId, 'rep-200');
});

test('deriveMapOverlays filters by search query across report and officer fields', () => {
    const overlays = deriveMapOverlays({ events, reports, assignments, searchQuery: 'officer.ade' });

    assert.equal(overlays.reports.length, 0);
    assert.equal(overlays.assignments.length, 1);
    assert.equal(overlays.patrolOrigins.length, 1);
});

test('countMapOverlays returns overlay totals by family', () => {
    const overlays = deriveMapOverlays({ events, reports, assignments });
    const counts = countMapOverlays(overlays);

    assert.deepEqual(counts, {
        reports: 2,
        assignments: 2,
        patrolOrigins: 1,
    });
});