# Design Spec: Event Reporting & Analysis System

## 1. Overview
This document outlines the design for the "Event Reporting" feature and the "Admin Analysis Dashboard". The system aims to collect high-fidelity, credible data from users and provide actionable insights to administrators.

## 2. Event Reporting (Public/User View)
**Goal**: Speed and ease of use. Minimizing friction to report urgent events.

### 2.1 UI/UX Concepts
- **"Panic Button" Style**: Immediate access to camera/recording.
- **Progressive Disclosure**: Capture media first, add details (text/category) later.
- **Real-time Feedback**: Upload indicators, location lock status.

### 2.2 Functional Requirements
- **Media Capture**:
  - Live Camera (Video/Photo) with in-app preview.
  - Audio Recording.
  - File Upload (Gallery).
- **Metadata Collection** (Invisible to user, critical for credibility).
- **Offline Queuing**: If network fails, save locally and sync when back online (Service Worker).

## 3. Metadata & Authenticity Strategy
To ensure **authenticity** and **credibility**, we will capture the following layers of metadata:

### 3.1 Device & Location (The "When & Where")
- **Geolocation**:
  - Latitude/Longitude with **Accuracy Radius** (crucial for filtering noise).
  - Altitude (if available).
  - Heading/Speed (if moving).
- **Timestamps**:
  - `captured_at`: Actual time of sensor data.
  - `uploaded_at`: Server receipt time.
  - Timezone data.
- **Network**: IP Address (for rough geo-verification).

### 3.2 Media Integrity (The "What")
- **Client-Side Hashing**: Generate SHA-256 hash of file before upload. Server verifies to ensure no transit tampering.
- **EXIF/Metadata Extraction**:
  - For uploaded files, extract original camera metadata (Make, Model, Exposure).
  - Check for modification dates distinct from creation dates.
- **Digital Signature** (Advanced/Future): If possible, sign the payload with a device-unique key.

### 3.3 Context (The "Who")
- **Session ID**: Traceability for anonymous reports.
- **User Agent / Device Fingerprint**: Browser version, OS, screen resolution (helps detect bot farms).
- **Authentication**: OAuth token if user is logged in.

## 4. Admin Analysis Dashboard
**Goal**: Triage and Verification.

### 4.1 Features
- **Map View**: Heatmap of events; markers clustering.
- **Feed View**: Card layout of incoming reports sorted by severity/time.
- **Media Analysis**:
  - Video player with frame-by-frame seeking.
  - Image viewer with zoom and "Metadata Inspector" panel.
- **Verification Tools**:
  - "Trust Score" (calculated based on metadata completeness + user history).
  - Flagging system (Verified/Fake/Duplicate).

## 5. Data Model (Draft)

### `EventReport`
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| title | String | Optional initially |
| description | Text | |
| category | Enum | Emergency, Infrastructure, Social, etc. |
| severity | Enum | Low, Medium, High, Critical |
| status | Enum | Pending, Verified, Rejected, Resolved |
| location | Point | PostGIS Geography |
| location_accuracy | Float | Meters |
| trust_score | Float | 0.0 - 1.0 |

### `MediaAttachment`
| Field | Type | Notes |
|-------|------|-------|
| event | FK | |
| file_type | Enum | Video, Image, Audio |
| file_url | String | Storage path |
| file_hash | String | SHA-256 |
| metadata_json | JSON | EXIF + Device info |

## 6. Implementation Stages
1. **API Layer**: Django Rest Framework endpoints for multipart uploads.
2. **Frontend Capture**: React components for Camera/Mic access.
3. **Frontend Dashboard**: Admin tables and map integration.
