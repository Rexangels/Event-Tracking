
import { IntelligenceEvent, EventSeverity, EventType } from './types';

export const MOCK_EVENTS: IntelligenceEvent[] = [
  {
    id: 'evt-001',
    timestamp: new Date().toISOString(),
    type: EventType.ENVIRONMENTAL,
    severity: EventSeverity.CRITICAL,
    title: 'Anomalous Seismic Activity - Sector 7G',
    description: 'Magnitude 6.2 seismic event detected. Aftershocks continuing. Automatic sensor grid triggered emergency protocols.',
    location: 'Coastal Region A',
    region: 'United States of America',
    coords: { lat: 37, lng: -95 },
    source: 'SeismicNet API',
    verified: true,
    metadata: { sensor_id: 'SN-442', depth_km: 12.4 }
  },
  {
    id: 'evt-002',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    type: EventType.HUMAN_REPORT,
    severity: EventSeverity.MEDIUM,
    title: 'Border Crossing Congestion',
    description: 'Manual report indicates significant buildup of cargo vehicles at Northern Passage. Delay estimated at 8 hours.',
    location: 'Northern Border',
    region: 'Canada',
    coords: { lat: 56, lng: -106 },
    source: 'Verified Field Agent #88',
    verified: true,
    metadata: { vehicle_count: 450, wait_time_hours: 8 }
  },
  {
    id: 'evt-003',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    type: EventType.GEOPOLITICAL,
    severity: EventSeverity.HIGH,
    title: 'Critical Infrastructure Cyber-Prob',
    description: 'Sophisticated multi-vector probe detected against regional power distribution center. IP range traced to External Actor X.',
    location: 'Central Power Hub',
    region: 'Russia',
    coords: { lat: 61, lng: 105 },
    source: 'CyberSentinel IDS',
    verified: true,
    metadata: { protocol: 'SSH/Brute', intensity: '9/10' }
  },
  {
    id: 'evt-004',
    timestamp: new Date(Date.now() - 150000).toISOString(),
    type: EventType.SENSORY,
    severity: EventSeverity.LOW,
    title: 'Unidentified Marine Vessel',
    description: 'Acoustic buoy detected unknown cavitation pattern consistent with mid-sized transport vessel in restricted waters.',
    location: 'Gulf of Shadows',
    region: 'Brazil',
    coords: { lat: -14, lng: -51 },
    source: 'Hydro-Array 4',
    verified: false,
    metadata: { confidence_interval: 0.72 }
  }
];

export const MAP_COLORS: Record<EventSeverity, string> = {
  [EventSeverity.LOW]: '#10b981', // emerald-500
  [EventSeverity.MEDIUM]: '#f59e0b', // amber-500
  [EventSeverity.HIGH]: '#f97316', // orange-500
  [EventSeverity.CRITICAL]: '#ef4444', // red-500
};

// SVG icon paths for each event type (24x24 viewBox)
export const EVENT_ICONS: Record<EventType, { path: string; label: string }> = {
  [EventType.ENVIRONMENTAL]: {
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    label: 'Environmental'
  },
  [EventType.HUMAN_REPORT]: {
    path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    label: 'Human Report'
  },
  [EventType.SENSORY]: {
    path: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
    label: 'Sensory'
  },
  [EventType.GEOPOLITICAL]: {
    path: 'M7 2v11h3v9l7-12h-4l4-8z',
    label: 'Geopolitical'
  },
  [EventType.API_FEED]: {
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    label: 'API Feed'
  }
};

// Cluster colors by density
export const CLUSTER_COLORS = {
  small: '#3b82f6',   // blue-500 (< 10 events)
  medium: '#8b5cf6',  // violet-500 (10-50 events)
  large: '#ec4899',   // pink-500 (50-100 events)
  massive: '#ef4444'  // red-500 (100+ events)
};

export const getClusterColor = (count: number): string => {
  if (count < 10) return CLUSTER_COLORS.small;
  if (count < 50) return CLUSTER_COLORS.medium;
  if (count < 100) return CLUSTER_COLORS.large;
  return CLUSTER_COLORS.massive;
};
