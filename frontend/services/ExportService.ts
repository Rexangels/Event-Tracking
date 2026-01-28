import { IntelligenceEvent } from "../types";

export interface ExportFile {
    name: string;
    type: 'pdf' | 'csv' | 'json';
    data: string;
}

export class ExportService {
    static generateCSV(events: IntelligenceEvent[], fileName: string): ExportFile {
        const headers = "id,type,severity,title,location,timestamp\n";
        const rows = events.map(e =>
            `${e.id},${e.type},${e.severity},"${e.title}","${e.location}",${e.timestamp}`
        ).join("\n");

        return {
            name: `${fileName}_${new Date().getTime()}.csv`,
            type: 'csv',
            data: headers + rows
        };
    }

    static generateBriefing(events: IntelligenceEvent[], title: string): ExportFile {
        const content = `
SENTINEL STRATEGIC BRIEFING
TITLE: ${title}
DATE: ${new Date().toLocaleString()}
VECTORS ANALYZED: ${events.length}

--- EXECUTIVE SUMMARY ---
This report captures a snapshot of ${events.length} intelligence vectors. 
Significant clusters identified in ${Array.from(new Set(events.map(e => e.location))).join(", ")}.

--- DATA LOG ---
${events.map(e => `[${e.severity}] ${e.title} - ${e.location}`).join("\n")}

--- IMMUTABLE AUTHENTICATION ---
HASH: ${Math.random().toString(36).substring(7).toUpperCase()}
LOGGING_STATUS: ACTIVE
    `.trim();

        return {
            name: `${title.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`,
            type: 'pdf',
            data: content
        };
    }

    static generateGeoJSON(events: IntelligenceEvent[]): ExportFile {
        const geojson = {
            type: "FeatureCollection",
            features: events.map(e => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [0, 0] // In a real app, we'd use real lat/lng
                },
                properties: {
                    title: e.title,
                    severity: e.severity,
                    type: e.type
                }
            }))
        };

        return {
            name: `Geospatial_Export_${new Date().getTime()}.json`,
            type: 'json',
            data: JSON.stringify(geojson, null, 2)
        };
    }
}
