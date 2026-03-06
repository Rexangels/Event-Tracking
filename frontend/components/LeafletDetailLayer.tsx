import React, { useEffect, useState, useMemo, useRef } from 'react';

import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IntelligenceEvent, MapLayerSettings, MapOverlayCollection, MapOverlayItem } from '../types';
import { MAP_COLORS } from '../constants';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default marker icon
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LeafletDetailLayerProps {
    events: IntelligenceEvent[];
    center: [number, number];
    zoom: number;
    onEventClick: (event: IntelligenceEvent) => void;
    onViewChange?: (center: [number, number], zoom: number) => void;
    showMarkers?: boolean;
    selectedEventId?: string;
    overlays: MapOverlayCollection;
    layerSettings: MapLayerSettings;
    onOverlayClick: (overlay: MapOverlayItem) => void;
}

const OVERLAY_COLORS = {
    report: '#38bdf8',
    assignment: '#f59e0b',
    patrol_origin: '#34d399',
} as const;

const hasDistinctTarget = (overlay: MapOverlayItem) => {
    if (!overlay.relatedEventCoords) return false;
    const latDelta = Math.abs(overlay.coords.lat - overlay.relatedEventCoords.lat);
    const lngDelta = Math.abs(overlay.coords.lng - overlay.relatedEventCoords.lng);
    return latDelta > 0.0001 || lngDelta > 0.0001;
};

const renderOverlayAction = (overlay: MapOverlayItem) => {
    if (overlay.eventId) return 'Open linked event';
    if (overlay.reportId) return 'Open report workspace';
    return 'Open overlay context';
};

// Helper to create colored icons based on severity
const createEventIcon = (severity: string, isSelected = false) => {
    const color = MAP_COLORS[severity as keyof typeof MAP_COLORS] || MAP_COLORS.MEDIUM;

    return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="
            background-color: ${color};
            width: ${isSelected ? 18 : 14}px;
            height: ${isSelected ? 18 : 14}px;
            border-radius: 50%;
            border: ${isSelected ? 4 : 3}px solid white;
            box-shadow: 0 0 ${isSelected ? 16 : 12}px ${color}, inset 0 0 6px rgba(255,255,255,0.6);
        "></div>`,
        iconSize: [isSelected ? 18 : 14, isSelected ? 18 : 14],
        iconAnchor: [isSelected ? 9 : 7, isSelected ? 9 : 7]
    });
};

const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom, { animate: true });
    }, [center, zoom, map]);
    return null;
};

const LeafletDetailLayer: React.FC<LeafletDetailLayerProps> = ({
    events,
    center,
    zoom,
    onEventClick,
    onViewChange,
    showMarkers = true,
    selectedEventId,
    overlays,
    layerSettings,
    onOverlayClick,
}) => {
    const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'terrain' | 'streets-detailed'>('street');
    const [showBuildings, setShowBuildings] = useState(false); // Disabled by default for performance
    const [currentZoom, setCurrentZoom] = useState(zoom);
    const mapRef = useRef<L.Map | null>(null);

    // Only render events visible in current view + limit max events
    const visibleEvents = useMemo(() => {
        if (mapRef.current) {
            const bounds = mapRef.current.getBounds();
            return events
                .filter(event => bounds.contains([event.coords.lat, event.coords.lng]))
                .slice(0, 200); // Max 200 visible events
        }
        return events.slice(0, 100); // Limit to 100 events on initial load
    }, [events, currentZoom]);

    const visibleOverlays = useMemo(() => {
        const candidates = [
            ...(layerSettings.showReportOverlays ? overlays.reports : []),
            ...(layerSettings.showAssignmentOverlays ? overlays.assignments : []),
            ...(layerSettings.showPatrolOrigins ? overlays.patrolOrigins : []),
        ];

        if (!mapRef.current) return candidates.slice(0, 150);
        const bounds = mapRef.current.getBounds();
        return candidates.filter((overlay) => bounds.contains([overlay.coords.lat, overlay.coords.lng])).slice(0, 150);
    }, [layerSettings, overlays, currentZoom]);

    // Tile layer configurations
    const tileConfigs = {
        street: {
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            name: 'Street Map'
        },
        'streets-detailed': {
            url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            name: 'Detailed Streets'
        },
        satellite: {
            url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
            attribution: '&copy; <a href="https://www.usgs.gov/">USGS</a>',
            name: 'Satellite (USGS)'
        },
        terrain: {
            url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
            attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
            name: 'Terrain'
        }
    };

    const MapUpdater = () => {
        const map = useMap();
        mapRef.current = map;

        useEffect(() => {
            const handleZoomEnd = () => {
                const newZoom = map.getZoom();
                setCurrentZoom(newZoom);
                const currentCenter = map.getCenter();
                onViewChange?.([currentCenter.lat, currentCenter.lng], newZoom);

                // Auto-enable detailed streets at zoom level 14+
                if (newZoom >= 14 && mapStyle === 'street') {
                    setMapStyle('streets-detailed');
                }
            };

            const handleMove = () => {
                setCurrentZoom(map.getZoom());
                const currentCenter = map.getCenter();
                onViewChange?.([currentCenter.lat, currentCenter.lng], map.getZoom());
            };

            const handleLayerChange = (e: any) => {
                // Get the name of the selected layer and map it to mapStyle
                const layerName = String(e.name || '');
                if (layerName.includes('Street Map')) setMapStyle('street');
                else if (layerName.includes('Detailed Streets')) setMapStyle('streets-detailed');
                else if (layerName.includes('Satellite')) setMapStyle('satellite');
                else if (layerName.includes('Terrain')) setMapStyle('terrain');
            };

            map.on('zoomend', handleZoomEnd);
            map.on('moveend', handleMove);
            map.on('baselayerchange', handleLayerChange);

            return () => {
                map.off('zoomend', handleZoomEnd);
                map.off('moveend', handleMove);
                map.off('baselayerchange', handleLayerChange);
            };
        }, [map, mapStyle, onViewChange]);

        return null;
    };

    // Add OSM Buildings layer
    const BuildingsLayer = () => {
        const map = useMap();

        useEffect(() => {
            if (!showBuildings || map.getZoom() < 15) return;

            // Pre-rendered buildings tile layer from OSM Buildings (no API calls)
            const buildingsLayer = L.tileLayer(
                'https://{s}.data.osmbuildings.org/0.2/anonymous/tile/{z}/{x}/{y}.json',
                {
                    minZoom: 15,
                    maxZoom: 18,
                    attribution: '&copy; <a href="https://osmbuildings.org">OSM Buildings</a>',
                    pointerCursor: true
                }
            );

            buildingsLayer.addTo(map);

            return () => {
                map.removeLayer(buildingsLayer);
            };
        }, [map, showBuildings]);

        return null;
    };

    return (
        <React.Fragment>
            <MapContainer
                ref={mapRef}
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
                attributionControl={true}
            >
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked={mapStyle === 'street'} name="📍 Street Map">
                        <TileLayer
                            key={`street-${mapStyle}`}
                            url={tileConfigs.street.url}
                            attribution={tileConfigs.street.attribution}
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.BaseLayer checked={mapStyle === 'streets-detailed'} name="🛣️ Detailed Streets">
                        <TileLayer
                            key={`streets-detailed-${mapStyle}`}
                            url={tileConfigs['streets-detailed'].url}
                            attribution={tileConfigs['streets-detailed'].attribution}
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.BaseLayer checked={mapStyle === 'satellite'} name="🛰️ Satellite">
                        <TileLayer
                            key={`satellite-${mapStyle}`}
                            url={tileConfigs.satellite.url}
                            attribution={tileConfigs.satellite.attribution}
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.BaseLayer checked={mapStyle === 'terrain'} name="🏔️ Terrain">
                        <TileLayer
                            key={`terrain-${mapStyle}`}
                            url={tileConfigs.terrain.url}
                            attribution={tileConfigs.terrain.attribution}
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.Overlay checked={false} name="🏢 Buildings (Zoom 15+)" enabled={false}>
                        <TileLayer
                            url="https://a.tile.opentopomap.org/{z}/{x}/{y}.png"
                            opacity={0}
                        />
                    </LayersControl.Overlay>
                </LayersControl>

                <MapController center={center} zoom={zoom} />
                <MapUpdater />
                {showBuildings && currentZoom >= 15 && <BuildingsLayer />}

                {showMarkers && visibleEvents.map(event => (
                    <Marker
                        key={event.id}
                        position={[event.coords.lat, event.coords.lng]}
                        icon={createEventIcon(event.severity, event.id === selectedEventId)}
                        eventHandlers={{
                            click: () => onEventClick(event)
                        }}
                    >
                        <Popup closeButton={true}>
                            <div className="bg-white text-slate-800 p-3 text-sm rounded">
                                <h3 className="font-bold text-base mb-2">{event.title}</h3>
                                <p className="mb-1"><strong>Type:</strong> {event.type}</p>
                                <p className="mb-1"><strong>Severity:</strong> <span style={{ color: MAP_COLORS[event.severity as keyof typeof MAP_COLORS] || MAP_COLORS.MEDIUM }} className="font-semibold">{event.severity.toUpperCase()}</span></p>
                                <p className="text-xs text-slate-500 mt-2">{event.coords.lat.toFixed(4)}, {event.coords.lng.toFixed(4)}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {visibleOverlays.filter(hasDistinctTarget).map((overlay) => (
                    <Polyline
                        key={`${overlay.id}-line`}
                        positions={[
                            [overlay.coords.lat, overlay.coords.lng],
                            [overlay.relatedEventCoords!.lat, overlay.relatedEventCoords!.lng],
                        ]}
                        pathOptions={{
                            color: OVERLAY_COLORS[overlay.kind],
                            dashArray: '6 6',
                            opacity: 0.6,
                            weight: overlay.kind === 'assignment' ? 3 : 2,
                        }}
                    />
                ))}

                {visibleOverlays.map((overlay) => (
                    <CircleMarker
                        key={overlay.id}
                        center={[overlay.coords.lat, overlay.coords.lng]}
                        radius={overlay.kind === 'patrol_origin' ? 10 : 8}
                        pathOptions={{
                            color: OVERLAY_COLORS[overlay.kind],
                            weight: overlay.kind === 'assignment' ? 3 : 2,
                            fillColor: '#020617',
                            fillOpacity: 0.75,
                            dashArray: overlay.kind === 'assignment' ? '6 3' : undefined,
                        }}
                        eventHandlers={{
                            click: () => onOverlayClick(overlay),
                        }}
                    >
                        <Popup closeButton={true}>
                            <div className="bg-white text-slate-800 p-3 text-sm rounded min-w-[220px]">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <h3 className="font-bold text-base truncate">{overlay.title}</h3>
                                    <span className="text-[10px] uppercase tracking-widest" style={{ color: OVERLAY_COLORS[overlay.kind] }}>
                                        {overlay.kind.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="mb-1 text-slate-600">{overlay.subtitle}</p>
                                {overlay.status && <p className="mb-1"><strong>Status:</strong> {overlay.status}</p>}
                                {overlay.officerUsername && <p className="mb-1"><strong>Officer:</strong> {overlay.officerUsername}</p>}
                                {overlay.trackingId && <p className="mb-1"><strong>Tracking:</strong> {overlay.trackingId}</p>}
                                <button
                                    type="button"
                                    onClick={() => onOverlayClick(overlay)}
                                    className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700"
                                >
                                    {renderOverlayAction(overlay)}
                                </button>
                            </div>
                        </Popup>
                    </CircleMarker>
                ))}
            </MapContainer>

            {/* Map Style Indicator */}
            <div className="absolute top-4 left-4 z-[500] bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg text-xs font-medium text-slate-700">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Map: <span className="font-bold">{tileConfigs[mapStyle].name}</span>
                </div>
                <div className="text-slate-500 text-xs mt-1">Zoom: {currentZoom}</div>
            </div>
        </React.Fragment>
    );
};

export default LeafletDetailLayer;
