/**
 * @typedef {import('../types').IntelligenceEvent} IntelligenceEvent
 */

export const MAP_TIME_WINDOW_OPTIONS = Object.freeze([
    { label: 'All activity', value: 'all' },
    { label: 'Last 1 hour', value: 1 },
    { label: 'Last 24 hours', value: 24 },
    { label: 'Last 7 days', value: 168 },
    { label: 'Last 30 days', value: 720 },
]);

export function createDefaultMapFilters() {
    return {
        severity: {
            LOW: true,
            MEDIUM: true,
            HIGH: true,
            CRITICAL: true,
        },
        types: {
            SENSORY: true,
            HUMAN_REPORT: true,
            API_FEED: true,
            GEOPOLITICAL: true,
            ENVIRONMENTAL: true,
        },
        verification: 'all',
        source: 'all',
        linkedReport: 'all',
        timeWindowHours: 'all',
    };
}

export function createDefaultMapLayerSettings() {
    return {
        showRegions: true,
        showSubregions: true,
        showMarkers: true,
        showHeatmap: false,
        enableAutoDetail: true,
        showReportOverlays: true,
        showAssignmentOverlays: true,
        showPatrolOrigins: true,
    };
}

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

function hasLinkedReport(event) {
    return Boolean(event?.metadata?.hazard_report_id);
}

export function matchesEventSearch(event, searchQuery) {
    const query = normalize(searchQuery);
    if (!query) return true;

    const haystacks = [
        event.id,
        event.title,
        event.description,
        event.location,
        event.region,
        event.source,
        event.type,
        event.severity,
        event.metadata?.hazard_report_id,
    ];

    return haystacks.some(value => normalize(value).includes(query));
}

function isWithinTimeWindow(event, timeWindowHours) {
    if (timeWindowHours === 'all') return true;
    const timestamp = new Date(event.timestamp).getTime();
    if (Number.isNaN(timestamp)) return false;
    const cutoff = Date.now() - (Number(timeWindowHours) * 60 * 60 * 1000);
    return timestamp >= cutoff;
}

export function applyMapOperations(events, options = {}) {
    const { selectedRegion = null, searchQuery = '', filters = createDefaultMapFilters() } = options;

    return events.filter((event) => {
        if (selectedRegion && event.region !== selectedRegion) return false;
        if (!filters.severity?.[event.severity]) return false;
        if (!filters.types?.[event.type]) return false;
        if (filters.verification === 'verified' && !event.verified) return false;
        if (filters.verification === 'unverified' && event.verified) return false;
        if (filters.source !== 'all' && normalize(filters.source) !== normalize(event.source)) return false;
        if (filters.linkedReport === 'linked' && !hasLinkedReport(event)) return false;
        if (filters.linkedReport === 'unlinked' && hasLinkedReport(event)) return false;
        if (!isWithinTimeWindow(event, filters.timeWindowHours)) return false;
        if (!matchesEventSearch(event, searchQuery)) return false;
        return true;
    });
}

export function getSourceOptions(events) {
    return [...new Set(events.map((event) => event.source).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function getSearchMatches(events, searchQuery, limit = 6) {
    const query = normalize(searchQuery);
    if (!query) return [];

    return [...events]
        .filter((event) => matchesEventSearch(event, query))
        .sort((a, b) => {
            const aScore = scoreSearchMatch(a, query);
            const bScore = scoreSearchMatch(b, query);
            if (aScore !== bScore) return bScore - aScore;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })
        .slice(0, limit);
}

function scoreSearchMatch(event, query) {
    const normalizedId = normalize(event.id);
    const normalizedReportId = normalize(event.metadata?.hazard_report_id);
    const normalizedTitle = normalize(event.title);
    const normalizedLocation = normalize(event.location);

    if (normalizedId === query || normalizedReportId === query) return 100;
    if (normalizedTitle.startsWith(query)) return 80;
    if (normalizedLocation.startsWith(query)) return 60;
    if (normalizedTitle.includes(query) || normalizedLocation.includes(query)) return 40;
    return 20;
}

export function countBySeverity(events) {
    return events.reduce((accumulator, event) => {
        accumulator[event.severity] = (accumulator[event.severity] || 0) + 1;
        return accumulator;
    }, { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
}

export function getActiveFilterCount(filters, selectedRegion = null, searchQuery = '') {
    let count = 0;
    if (selectedRegion) count += 1;
    if (normalize(searchQuery)) count += 1;
    if (filters.verification !== 'all') count += 1;
    if (filters.source !== 'all') count += 1;
    if (filters.linkedReport !== 'all') count += 1;
    if (filters.timeWindowHours !== 'all') count += 1;

    const disabledSeverityCount = Object.values(filters.severity || {}).filter(enabled => !enabled).length;
    const disabledTypeCount = Object.values(filters.types || {}).filter(enabled => !enabled).length;
    if (disabledSeverityCount > 0) count += 1;
    if (disabledTypeCount > 0) count += 1;

    return count;
}