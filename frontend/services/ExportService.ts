import { jsPDF } from 'jspdf';
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
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("SENTINEL STRATEGIC BRIEFING", 14, 20);

        doc.setFontSize(10);
        doc.text(`TITLE: ${title}`, 14, 30);
        doc.text(`DATE: ${new Date().toLocaleString()}`, 14, 36);
        doc.text(`VECTORS ANALYZED: ${events.length}`, 14, 42);

        doc.line(14, 45, 196, 45);

        doc.setFontSize(11);
        doc.text("EXECUTIVE SUMMARY", 14, 55);
        doc.setFontSize(10);
        const summary = `This report captures a snapshot of ${events.length} intelligence vectors. Significant clusters identified in ${Array.from(new Set(events.map(e => e.location))).join(", ")}.`;
        const splitSummary = doc.splitTextToSize(summary, 180);
        doc.text(splitSummary, 14, 62);

        doc.text("DATA LOG", 14, 80);
        let y = 88;
        events.forEach(e => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            const line = `[${e.severity}] ${e.title} - ${e.location}`;
            doc.text(line, 14, y);
            y += 6;
        });

        doc.line(14, y + 5, 196, y + 5);
        doc.text(`HASH: ${Math.random().toString(36).substring(7).toUpperCase()}`, 14, y + 12);

        // Return base64 without prefix for cleaner handling
        const base64 = doc.output('datauristring').split(',')[1];

        return {
            name: `${title.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`,
            type: 'pdf',
            data: base64
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
