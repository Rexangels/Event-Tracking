import api from './api';
import { IntelligenceEvent, EventSeverity, EventType } from '../types';

export interface BackendEvent {
    id: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    status: string;
    latitude: number | null;
    longitude: number | null;
    accuracy: number;
    altitude: number | null;
    media_attachments: any[];
    trust_score: number;
    created_at: string;
}

const mapSeverity = (severity: string): EventSeverity => {
    switch (severity?.toUpperCase()) {
        case 'LOW': return EventSeverity.LOW;
        case 'MEDIUM': return EventSeverity.MEDIUM;
        case 'HIGH': return EventSeverity.HIGH;
        case 'CRITICAL': return EventSeverity.CRITICAL;
        default: return EventSeverity.LOW;
    }
};

const mapCategoryToType = (category: string): EventType => {
    switch (category?.toUpperCase()) {
        case 'SENSORY': return EventType.SENSORY;
        case 'HUMAN_REPORT': return EventType.HUMAN_REPORT;
        case 'API_FEED': return EventType.API_FEED;
        case 'GEOPOLITICAL': return EventType.GEOPOLITICAL;
        case 'ENVIRONMENTAL': return EventType.ENVIRONMENTAL;
        default: return EventType.HUMAN_REPORT;
    }
};

const transformBackendEvent = (backendEvent: BackendEvent): IntelligenceEvent => {
    // Extract region from description if strictly following simulation format
    // Format: "Automated stress test event generated in {Region} region."
    let region = 'Unknown Region';
    const simMatch = backendEvent.description?.match(/generated in (.+) region/);
    if (simMatch && simMatch[1]) {
        region = simMatch[1];
    }

    return {
        id: backendEvent.id,
        timestamp: backendEvent.created_at,
        type: mapCategoryToType(backendEvent.category),
        severity: mapSeverity(backendEvent.severity),
        title: backendEvent.title || 'Untitled Event',
        description: backendEvent.description,
        location: `Lat: ${backendEvent.latitude?.toFixed(4)}, Lng: ${backendEvent.longitude?.toFixed(4)}`,
        region: region,
        coords: {
            lat: backendEvent.latitude || 0,
            lng: backendEvent.longitude || 0
        },
        source: 'INTERNAL_REPORT',
        verified: backendEvent.status === 'VERIFIED',
        metadata: {
            trust_score: backendEvent.trust_score,
            media: backendEvent.media_attachments
        },
        media_attachments: backendEvent.media_attachments
    };
};

export const fetchEvents = async (): Promise<IntelligenceEvent[]> => {
    try {
        const response = await api.get<any>('/admin/events/'); // Use any to allow runtime validation
        console.log('API Response:', response); // Debug log

        // Validate response structure
        if (!response.data || !Array.isArray(response.data)) {
            console.error('Invalid API response format: Expected array, got:', response.data);
            return [];
        }

        return response.data.map(transformBackendEvent);
    } catch (error) {
        console.error('Error fetching events:', error);
        return [];
    }
};

export const createEvent = async (eventData: FormData): Promise<IntelligenceEvent | null> => {
    try {
        const response = await api.post<BackendEvent>('/reports/', eventData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return transformBackendEvent(response.data);
    } catch (error) {
        console.error('Error creating event:', error);
        return null;
    }
};
