
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

export interface AgentResponse {
  role: 'explainer' | 'analyst' | 'quality_checker';
  content: string;
  timestamp: string;
}

