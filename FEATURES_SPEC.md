# Sentinel Core - Features Specification & Roadmap

## 1. High-Level Strategy: "The 10k Problem" & Visualization

To visualize **10,000+ events** without crashing the browser or overwhelming the user, we will use a **Point Clustering Strategy**:

1.  **Zoom Level 1-4 (Global/Continent)**: Show **Heatmaps** or large **Cluster Circles** (e.g., "500 events here"). No individual icons.
2.  **Zoom Level 5-10 (Country/State)**: Break clusters into smaller regions. Clicking a cluster zooms you in automatically.
3.  **Zoom Level 11+ (City/Street)**: Show individual **Event Icons**.
    -   **Icon Coding**: Different icons for Fire, Riot, Flood, etc.
    -   **Color Coding**: Red for Critical, Yellow for Medium, Green for Low.

**Drill-Down Interaction**: 
-   Clicking a Country -> Zooms to State level -> API fetches events for that bounding box.
-   Clicking an Event Icon -> Opens a **Side Panel** or **Modal** with the media playback (Video/Image).

---

## 2. Prioritized Implementation Steps (MVP to Wow Factor)

### Phase 1: The Geospatial Foundation (CRITICAL)
*Why: We cannot do optimized location queries (finding states within countries) or clustering without a real spatial database.*
- [ ] **Migrate to PostgreSQL + PostGIS**: Replace SQLite.
- [ ] **Update Event Model**: Change `lat/lon` float fields to `PointField` for efficient geospatial querying.
- [ ] **Implement Bounding Box API**: Clients send `?bbox=minLon,minLat,maxLon,maxLat` to fetch only visible events.

### Phase 2: Visualization Core (The "Wow" Factor)
*Why: This makes the map look alive, usable, and impressive.*
- [ ] **Frontend Clustering**: Integrate `react-map-gl` (Mapbox/Leaflet) with `supercluster`.
- [ ] **Custom Map Markers**: distinct SVG icons for different event types (Fire, Protest, Biological).
- [ ] **Heatmap Layer**: Add a toggleable layer to see risk density dynamically.

### Phase 3: Media & Interactivity
*Why: The user needs to see the evidence of what is happening.*
- [ ] **Media Playback Component**: A robust `MediaPlayer` that handles:
    -   Images (Carousel)
    -   Videos (HTML5 Video Player with custom controls)
    -   Audio (Waveform visualizer)
- [ ] **Event Detail View**: A sleek overlay/sidebar showing Title, Description, Severity, and the Media Player.

### Phase 4: Hierarchy & Navigation (Drill-Down)
*Why: Navigating 10k events requires logical structure.*
- [ ] **Region/State API**: Endpoint to get event counts per state/province (`/api/v1/stats/geo-summary`).
- [ ] **Breadcrumbs**: UI to show context ("World > USA > California > San Francisco").
- [ ] **Click-to-Zoom Logic**: Clicking a country polygon auto-zooms to its bounds.

### Phase 5: Live Updates (Real-Time)
*Why: It's a "Command Center". It needs to alert instantly.*
- [ ] **WebSockets (Socket.io)**: Push new events to the frontend immediately.
- [ ] **Toast Notifications**: "New Critical Event in [Location]!" popup.

### Phase 6: AI Analysis (Deep Intelligence)
*Why: To make sense of the noise.*
- [ ] **Gemini Integration**: Summarize clusters. "50 reports of fire in this region -> Likely Wildfire Spreading".
