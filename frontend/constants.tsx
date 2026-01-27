
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

export const MAP_COLORS = {
  [EventSeverity.LOW]: '#10b981', // emerald-500
  [EventSeverity.MEDIUM]: '#f59e0b', // amber-500
  [EventSeverity.HIGH]: '#f97316', // orange-500
  [EventSeverity.CRITICAL]: '#ef4444', // red-500
};
