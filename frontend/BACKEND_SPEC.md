# Sentinel Core - Backend Technical Specification

## 1. Overview
Sentinel is a high-performance command-and-control platform designed for real-time global event intelligence. It ingests multi-vector data (Sensory, Human, Geopolitical, Environmental) and utilizes AI for situational awareness and trend correlation.

## 2. Technical Stack (Proposed)
- **Runtime:** Node.js (v18+) or Go (1.20+)
- **Database:** PostgreSQL with PostGIS extension (required for geospatial queries).
- **Caching:** Redis for real-time event distribution and rate limiting.
- **AI Integration:** Google Gemini API (Vertex AI or Generative AI SDK).
- **Communication:** WebSockets (Socket.io or native WS) for live feed updates.

## 3. Data Models

### 3.1 Intelligence Event
```typescript
interface IntelligenceEvent {
  id: string;               // UUID
  timestamp: string;        // ISO-8601
  type: 'SENSORY' | 'HUMAN_REPORT' | 'API_FEED' | 'GEOPOLITICAL' | 'ENVIRONMENTAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  location: string;         // Human readable name
  region: string;           // Country/Province name (matches GeoJSON properties)
  coords: {
    lat: number;            // Float64
    lng: number;            // Float64
  };
  source: string;           // Origin identifier
  verified: boolean;        // Boolean status
  metadata: Record<string, any>; // Flexible JSONB for sensor-specific data
}
```

### 3.2 Audit Log Entry
```typescript
interface AuditEntry {
  id: string;
  timestamp: string;
  action: 'DATA_INGESTION' | 'USER_ACCESS' | 'POLICY_CHANGE' | 'AI_GENERATION';
  origin: string;           // IP or UserID
  target: string;           // Resource ID
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  checksum: string;         // SHA-256 hash of previous block + current data (Immutable Chain)
}
```

## 4. API Endpoints

### 4.1 Event Management
- `GET /api/v1/events`: Fetch active events. Supports filters: `severity`, `region`, `type`, `timeframe`.
- `GET /api/v1/events/:id`: Retrieve detailed event data + full metadata.
- `POST /api/v1/events/ingest`: Secure endpoint for external sensors to push data. Requires HMAC signature.

### 4.2 Intelligence & AI
- `POST /api/v1/analyst/correlate`: Payload includes array of event IDs. Returns AI-generated pattern analysis.
- `GET /api/v1/stats/summary`: Returns aggregated data for the top-bar HUD (Active reports, Risk index).

### 4.3 Governance
- `GET /api/v1/governance/ledger`: Fetch cryptographically signed audit logs.
- `GET /api/v1/governance/trust-index`: Health status of all connected data providers.

## 5. Architectural Requirements

### 5.1 Real-Time Streaming
The backend must maintain a persistent WebSocket connection to broadcast new events to the `Stream Decryptor` (Event Feed) component within 200ms of ingestion.

### 5.2 GIS Logic
The backend should perform spatial clustering for the `AnalystModule` to group events within a specific radius (e.g., 50km) or within specific GeoJSON polygon boundaries.

### 5.3 Security
- **Data Provenance:** Every event must track its source vector to satisfy the Governance Module's verification layer.
- **Immutability:** Audit logs should be implemented as an append-only ledger where each entry contains a hash of the previous one.

## 6. Development Priorities
1. Implement the **Geospatial Ingestion Pipe** (PostGIS).
2. Establish the **Real-time Broadcaster** (WebSockets).
3. Build the **AI Correlation Wrapper** for cross-sector analysis.
