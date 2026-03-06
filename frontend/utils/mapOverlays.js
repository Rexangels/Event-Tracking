function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

function hasCoordinates(latitude, longitude) {
    return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function coordsFromReport(report) {
    if (!hasCoordinates(report?.latitude, report?.longitude)) return null;
    return {
        lat: Number(report.latitude),
        lng: Number(report.longitude),
    };
}

function buildEventMaps(events) {
    const byReportId = new Map();
    const byId = new Map();

    events.forEach((event) => {
        byId.set(event.id, event);
        const reportId = event?.metadata?.hazard_report_id;
        if (reportId) byReportId.set(String(reportId), event);
    });

    return { byId, byReportId };
}

function buildReportsByOriginAssignment(reports) {
    const reportsByAssignment = new Map();

    reports.forEach((report) => {
        const assignmentId = report?.lineage?.origin_assignment_id;
        if (!assignmentId) return;
        if (!reportsByAssignment.has(assignmentId)) reportsByAssignment.set(assignmentId, []);
        reportsByAssignment.get(assignmentId).push(report);
    });

    reportsByAssignment.forEach((items) => {
        items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    });

    return reportsByAssignment;
}

function getLinkedEvent(report, eventMaps) {
    return eventMaps.byReportId.get(String(report.id)) || (report.event_id ? eventMaps.byId.get(report.event_id) : null) || null;
}

function matchesOverlaySearch(overlay, query) {
    if (!query) return true;
    return [
        overlay.title,
        overlay.subtitle,
        overlay.status,
        overlay.reportId,
        overlay.trackingId,
        overlay.assignmentId,
        overlay.officerUsername,
    ].some((value) => normalize(value).includes(query));
}

function withinRegion(overlay, selectedRegion, eventById) {
    if (!selectedRegion) return true;
    if (!overlay.eventId) return true;
    const linkedEvent = eventById.get(overlay.eventId);
    return linkedEvent?.region === selectedRegion;
}

function filterOverlays(overlays, selectedRegion, searchQuery, eventById) {
    const query = normalize(searchQuery);
    return overlays.filter((overlay) => withinRegion(overlay, selectedRegion, eventById) && matchesOverlaySearch(overlay, query));
}

export function deriveMapOverlays({ events = [], reports = [], assignments = [], selectedRegion = null, searchQuery = '' }) {
    const eventMaps = buildEventMaps(events);
    const reportsByOriginAssignment = buildReportsByOriginAssignment(reports);

    const reportOverlays = reports
        .map((report) => {
            const coords = coordsFromReport(report);
            if (!coords) return null;
            const linkedEvent = getLinkedEvent(report, eventMaps);

            return {
                id: `report-${report.id}`,
                kind: 'report',
                coords,
                title: report.tracking_id || 'Hazard report',
                subtitle: report.address || report.form_version?.template_name || 'Linked hazard report',
                status: report.status,
                reportId: report.id,
                trackingId: report.tracking_id,
                eventId: linkedEvent?.id ?? report.event_id ?? null,
                relatedEventCoords: linkedEvent?.coords ?? null,
            };
        })
        .filter(Boolean);

    const assignmentOverlays = assignments
        .map((assignment) => {
            const anchorReport = assignment.report || reportsByOriginAssignment.get(assignment.id)?.[0] || null;
            const coords = coordsFromReport(anchorReport);
            if (!coords) return null;
            const linkedEvent = anchorReport ? getLinkedEvent(anchorReport, eventMaps) : null;

            return {
                id: `assignment-${assignment.id}`,
                kind: 'assignment',
                coords,
                title: assignment.officer_username || 'Assigned officer',
                subtitle: anchorReport?.tracking_id ? `Task for ${anchorReport.tracking_id}` : 'Officer task overlay',
                status: assignment.status,
                reportId: anchorReport?.id ?? null,
                trackingId: anchorReport?.tracking_id ?? null,
                eventId: linkedEvent?.id ?? anchorReport?.event_id ?? null,
                assignmentId: assignment.id,
                officerUsername: assignment.officer_username,
                relatedEventCoords: linkedEvent?.coords ?? null,
            };
        })
        .filter(Boolean);

    const patrolOriginOverlays = reports
        .filter((report) => report?.report_origin?.code === 'patrol' || report?.lineage?.is_patrol_generated)
        .map((report) => {
            const coords = coordsFromReport(report);
            if (!coords) return null;
            const linkedEvent = getLinkedEvent(report, eventMaps);

            return {
                id: `patrol-${report.id}`,
                kind: 'patrol_origin',
                coords,
                title: report.tracking_id || 'Patrol-origin report',
                subtitle: report.lineage?.origin_officer_username
                    ? `Patrol origin • ${report.lineage.origin_officer_username}`
                    : 'Patrol-origin lineage',
                status: report.lineage?.origin_assignment_status || report.status,
                reportId: report.id,
                trackingId: report.tracking_id,
                eventId: linkedEvent?.id ?? report.event_id ?? null,
                assignmentId: report.lineage?.origin_assignment_id ?? null,
                officerUsername: report.lineage?.origin_officer_username ?? null,
                relatedEventCoords: linkedEvent?.coords ?? null,
            };
        })
        .filter(Boolean);

    return {
        reports: filterOverlays(reportOverlays, selectedRegion, searchQuery, eventMaps.byId),
        assignments: filterOverlays(assignmentOverlays, selectedRegion, searchQuery, eventMaps.byId),
        patrolOrigins: filterOverlays(patrolOriginOverlays, selectedRegion, searchQuery, eventMaps.byId),
    };
}

export function countMapOverlays(overlays) {
    return {
        reports: overlays.reports.length,
        assignments: overlays.assignments.length,
        patrolOrigins: overlays.patrolOrigins.length,
    };
}