
export enum EventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum EventType {
  SENSORY = 'SENSORY',
  HUMAN_REPORT = 'HUMAN_REPORT',
  API_FEED = 'API_FEED',
  GEOPOLITICAL = 'GEOPOLITICAL',
  ENVIRONMENTAL = 'ENVIRONMENTAL'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MediaAttachment {
  id: string;
  file: string;        // URL to the file
  file_type: 'image' | 'video' | 'audio';
  file_hash: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface IntelligenceEvent {
  id: string;
  timestamp: string;
  type: EventType;
  severity: EventSeverity;
  title: string;
  description: string;
  location: string;
  region: string;
  coords: Coordinates;
  source: string;
  verified: boolean;
  metadata: Record<string, any>;
  media_attachments?: MediaAttachment[];
}

export type VerificationFilter = 'all' | 'verified' | 'unverified';
export type LinkedReportFilter = 'all' | 'linked' | 'unlinked';
export type TimeWindowFilter = 'all' | number;

export interface MapFilterState {
  severity: Record<EventSeverity, boolean>;
  types: Record<EventType, boolean>;
  verification: VerificationFilter;
  source: string;
  linkedReport: LinkedReportFilter;
  timeWindowHours: TimeWindowFilter;
}

export interface MapLayerSettings {
  showRegions: boolean;
  showSubregions: boolean;
  showMarkers: boolean;
  showHeatmap: boolean;
  enableAutoDetail: boolean;
  showReportOverlays: boolean;
  showAssignmentOverlays: boolean;
  showPatrolOrigins: boolean;
}

export type MapOverlayKind = 'report' | 'assignment' | 'patrol_origin';

export interface MapOverlayItem {
  id: string;
  kind: MapOverlayKind;
  coords: Coordinates;
  title: string;
  subtitle: string;
  status?: string | null;
  reportId?: string | null;
  trackingId?: string | null;
  eventId?: string | null;
  assignmentId?: string | null;
  officerUsername?: string | null;
  relatedEventCoords?: Coordinates | null;
}

export interface MapOverlayCollection {
  reports: MapOverlayItem[];
  assignments: MapOverlayItem[];
  patrolOrigins: MapOverlayItem[];
}

export interface MapOverlayCounts {
  reports: number;
  assignments: number;
  patrolOrigins: number;
}

export interface AgentResponse {
  role: 'explainer' | 'analyst' | 'quality_checker';
  content: string;
  timestamp: string;
}

