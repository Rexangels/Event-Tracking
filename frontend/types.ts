
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

export interface IntelligenceEvent {
  id: string;
  timestamp: string;
  type: EventType;
  severity: EventSeverity;
  title: string;
  description: string;
  location: string;
  region: string; // Added to match GeoJSON properties
  coords: Coordinates;
  source: string;
  verified: boolean;
  metadata: Record<string, any>;
}

export interface AgentResponse {
  role: 'explainer' | 'analyst' | 'quality_checker';
  content: string;
  timestamp: string;
}
