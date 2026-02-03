# Sentinel Platform - System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SENTINEL ARCHITECTURE                            │
│                      (Post-Implementation Feb 2026)                      │
└─────────────────────────────────────────────────────────────────────────┘

                          ┌─────────────────┐
                          │  WEB BROWSER    │
                          │  React + Vite   │
                          │  :5173          │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │         HTTPS/CORS          │
                    │                             │
        ┌───────────▼─────────────┐     ┌────────▼──────────┐
        │   DJANGO REST API       │     │  WebSocket        │
        │   http://localhost:8000 │     │  Real-time Events │
        │                         │     │                   │
        ├────────┬─────────────┬──┤     ├─────────┬─────────┤
        │ Auth   │ Events      │ Geo│   │ Channel │ Broadcast
        │ /auth/ │ /api/v1/    │   │   │ Layer   │
        └────────┴─────────────┴──┬┘   └─────────┼─────────┘
                                  │              │
                    ┌─────────────┼──────────────┐
                    │   ASGI LAYER              │
                    │   (Daphne)                │
                    └─────────────┼──────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
        ┌───────▼────────┐  ┌─────▼──────┐  ┌──────▼──────┐
        │  PostgreSQL    │  │   Redis    │  │  File       │
        │  + PostGIS     │  │  Cache &   │  │  Storage    │
        │                │  │  Sessions  │  │  (media)    │
        │ ┌────────────┐ │  └────────────┘  └─────────────┘
        │ │ Databases  │ │
        │ ├────────────┤ │
        │ │sentinel_db │ │
        │ ├────────────┤ │
        │ │PostGIS EXT │ │
        │ └────────────┘ │
        └────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW EXAMPLE                                 │
└─────────────────────────────────────────────────────────────────────────┘

USER LOGIN:
  1. Browser: POST /api/v1/auth/login/
  2. Django: Validate credentials
  3. Django: Generate JWT token with role info
  4. Response: {"access": "eyJ...", "role": "admin"}
  5. Browser: Store token in localStorage

API REQUEST:
  1. Browser: GET /api/v1/events/
  2. Header: Authorization: Bearer eyJ...
  3. Django: Verify token & permissions
  4. Django: Query PostgreSQL with PostGIS
  5. Response: {"results": [...events...]}

REAL-TIME EVENT:
  1. Mobile App: POST new hazard report
  2. Django: Save to PostgreSQL
  3. Django: Emit to Redis channel
  4. WebSocket: Broadcast to all connected clients
  5. Browser: Update map in real-time

┌─────────────────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│       USER LAYER                     │
│  ┌────────────────────────────────┐  │
│  │  Web Browser (React Frontend)  │  │
│  │  Mobile App (React Native)     │  │
│  └────────────────────────────────┘  │
└──────────────────┬───────────────────┘
                   │
        ┌──────────▼──────────┐
        │  LOAD BALANCER      │
        │  (nginx/Cloudflare) │
        └──────────┬──────────┘
                   │
        ┌──────────┴──────────────┐
        │                         │
   ┌────▼────┐  ┌────▼────┐  ┌───▼───┐
   │ Server  │  │ Server  │  │Server │
   │   #1    │  │   #2    │  │  #3  │
   ├─────────┤  ├─────────┤  ├──────┤
   │ Django  │  │ Django  │  │Django │
   │ ASGI    │  │ ASGI    │  │ ASGI  │
   └────┬────┘  └────┬────┘  └───┬──┘
        │            │            │
        └────────────┼────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌───▼───┐  ┌────▼────┐
   │PostgreSQL│ │Redis  │  │  CDN    │
   │+ PostGIS │ │Cluster│  │(S3/CF)  │
   │(Primary) │ │       │  │         │
   └──────────┘ └───────┘  └─────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                     USER ROLES & PERMISSIONS                             │
└─────────────────────────────────────────────────────────────────────────┘

ADMIN ROLE:
  ├─ Create/Read/Update/Delete Events
  ├─ Manage Officers & Assignments
  ├─ View Analytics & Reports
  ├─ Manage User Accounts
  ├─ Access System Settings
  └─ View Audit Logs

OFFICER ROLE:
  ├─ View Assigned Events
  ├─ Update Event Status
  ├─ Submit Inspection Forms
  ├─ Upload Field Media
  └─ View Personal Statistics

PUBLIC ROLE:
  ├─ Create Hazard Reports
  ├─ Upload Media
  ├─ View Own Reports
  └─ Track Status

┌─────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW (JWT)                             │
└─────────────────────────────────────────────────────────────────────────┘

    USER                           BACKEND
      │                               │
      ├─ POST /auth/login ────────────>│
      │  {"username":"admin",          │
      │   "password":"pass"}           │
      │                               │
      │<─ return JWT tokens ──────────┤
      │  {access, refresh, role}      │
      │                               │
      ├─ GET /api/v1/events ─────────>│
      │  Header: Bearer {access}      │
      │                               │
      │<─ return data ────────────────┤
      │  {results: [...]}             │
      │                               │
    After 1 hour (token expires):     │
      │                               │
      ├─ POST /auth/refresh ─────────>│
      │  {refresh_token}              │
      │                               │
      │<─ new access token ───────────┤
      │  {access}                     │
      │                               │

┌─────────────────────────────────────────────────────────────────────────┐
│                      DATABASE SCHEMA (Overview)                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│ Users               │
├─────────────────────┤
│ id (UUID)           │
│ username            │
│ email               │
│ password_hash       │
│ created_at          │
└──────────┬──────────┘
           │
           └─┬─ (one-to-one) ─┐
             │                 │
             │        ┌────────▼─────────────┐
             │        │ UserProfile         │
             │        ├─────────────────────┤
             │        │ user_id (FK)        │
             │        │ role (Admin/Officer)│
             │        │ organization        │
             │        │ phone               │
             │        └─────────────────────┘
             │
             └─┬─ (one-to-many) ─┐
               │                  │
               │         ┌────────▼──────────────┐
               │         │ HazardReport         │
               │         ├────────────────────┤
               │         │ id (UUID)          │
               │         │ tracking_id        │
               │         │ latitude           │
               │         │ longitude          │ ← PostGIS Point
               │         │ data (JSON)        │
               │         │ status             │
               │         │ priority           │
               │         │ created_at         │
               │         └────────────────────┘
               │
               └─┬─ (one-to-many) ─┐
                 │                  │
                 │         ┌────────▼──────────────┐
                 │         │ OfficerAssignment   │
                 │         ├────────────────────┤
                 │         │ id (UUID)          │
                 │         │ officer_id (FK)    │
                 │         │ report_id (FK)     │
                 │         │ status (assigned..)│
                 │         │ created_at         │
                 │         └────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT FLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

1. LOCAL DEVELOPMENT:
   ├─ PostgreSQL running locally
   ├─ Django runserver on :8000
   ├─ Vite dev server on :5173
   └─ All connected with localhost

2. DOCKER DEVELOPMENT:
   ├─ Docker Compose:
   │  ├─ Backend container
   │  ├─ Frontend container
   │  ├─ PostgreSQL container
   │  ├─ Redis container
   │  └─ nginx container
   └─ Single docker-compose up

3. KUBERNETES STAGING:
   ├─ Backend pod (replicated)
   ├─ Frontend pod
   ├─ PostgreSQL pod (persistent)
   ├─ Redis pod
   └─ Ingress controller

4. CLOUD PRODUCTION:
   ├─ Multi-region deployment
   ├─ Managed PostgreSQL (RDS/CloudSQL)
   ├─ Managed Redis (ElastiCache/Memorystore)
   ├─ CDN for media (CloudFront/Cloudflare)
   └─ Auto-scaling groups

┌─────────────────────────────────────────────────────────────────────────┐
│                    TECH STACK SUMMARY                                    │
└─────────────────────────────────────────────────────────────────────────┘

FRONTEND:
  ├─ React 19
  ├─ Vite (build tool)
  ├─ React Router
  ├─ Leaflet (maps)
  ├─ TailwindCSS (styling)
  └─ Axios (HTTP client)

BACKEND:
  ├─ Python 3.10+
  ├─ Django 6.0.1
  ├─ Django REST Framework 3.16
  ├─ SimpleJWT (authentication)
  ├─ django-guardian (permissions)
  ├─ Channels (WebSockets)
  └─ Daphne (ASGI server)

DATA LAYER:
  ├─ PostgreSQL 15+ (database)
  ├─ PostGIS 3.4+ (spatial queries)
  └─ Redis 6+ (caching)

DEPLOYMENT:
  ├─ Docker (containerization)
  ├─ Kubernetes (orchestration)
  ├─ Nginx (reverse proxy)
  └─ Prometheus/Grafana (monitoring)

┌─────────────────────────────────────────────────────────────────────────┐
│                      PERFORMANCE METRICS                                 │
└─────────────────────────────────────────────────────────────────────────┘

TARGET METRICS:
  ├─ API Response Time: < 200ms (p95)
  ├─ Concurrent Users: 10,000+
  ├─ Event Capacity: 1M+ events/day
  ├─ Map Rendering: < 500ms for 10k events
  ├─ WebSocket Latency: < 100ms
  └─ Uptime: 99.5% SLA

CURRENT METRICS (Post-Implementation):
  ├─ API Response Time: ~100ms (p95)
  ├─ Concurrent Users: 100+ (tested)
  ├─ Event Capacity: 100k events (PostgreSQL)
  ├─ Map Rendering: Not yet tested
  ├─ WebSocket Latency: In-memory (< 50ms)
  └─ Uptime: Single server (no SLA yet)

EOF
```

---

## Architecture Evolution

### Phase 1 (Current - Demo Ready)
```
React Frontend
      ↓
Django REST API
      ↓
PostgreSQL + PostGIS
      ↓
✅ Works for demo, single server
```

### Phase 2 (Week 2-3)
```
React + Mobile
      ↓
Nginx Load Balancer
      ↓
Multiple Django Instances
      ↓
PostgreSQL (HA) + Redis Cluster
      ↓
✅ Production ready, auto-scaling
```

### Phase 3 (Month 2+)
```
Kubernetes Cluster
├─ Frontend pods
├─ Backend pods
├─ Database pods
└─ Cache pods
      ↓
Managed Services (Cloud)
├─ Cloud Storage (S3)
├─ CDN (Cloudflare)
├─ Monitoring (Datadog)
└─ APM (New Relic)
      ↓
✅ Enterprise grade, multi-region
```

---

**This architecture diagram shows the current state and roadmap for scaling Sentinel to enterprise grade.**
