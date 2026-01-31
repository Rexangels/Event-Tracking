import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { IntelligenceEvent } from '../types';
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
}

// Helper to create colored icons based on severity
const createEventIcon = (severity: string) => {
    const color = MAP_COLORS[severity as keyof typeof MAP_COLORS] || MAP_COLORS.MEDIUM;

    // We can use a custom HTML div icon for a glowing dot effect similar to D3
    return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="
            background-color: ${color};
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 10px ${color};
        "></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
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
    onViewChange
}) => {
    const [isDarkMode, setIsDarkMode] = React.useState(true);

    return (
        <React.Fragment>
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%', background: isDarkMode ? '#020617' : '#f8fafc' }}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer
                    url={isDarkMode
                        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    }
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                <MapController center={center} zoom={zoom} />

                {events.map(event => (
                    <Marker
                        key={event.id}
                        position={[event.coords.lat, event.coords.lng]}
                        icon={createEventIcon(event.severity)}
                        eventHandlers={{
                            click: () => onEventClick(event)
                        }}
                    >
                        <Popup
                            closeButton={false}
                            className={isDarkMode ? "custom-leaflet-popup" : "custom-leaflet-popup light-theme"}
                        >
                            <div className={`${isDarkMode ? 'bg-slate-900 text-slate-200 border-slate-700' : 'bg-white text-slate-800 border-slate-200'} p-2 text-xs rounded border shadow-lg`}>
                                <h3 className={`font-bold text-sm mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{event.title}</h3>
                                <p className="mb-1"><span className="text-slate-500">Type:</span> {event.type}</p>
                                <p><span className="text-slate-500">Severity:</span> <span style={{ color: MAP_COLORS[event.severity as keyof typeof MAP_COLORS] || MAP_COLORS.MEDIUM }}>{event.severity.toUpperCase()}</span></p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Theme Toggle Button */}
            <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`absolute top-20 right-4 z-[1000] p-2 rounded-lg shadow-xl border transition-all ${isDarkMode
                    ? 'bg-slate-900/90 border-slate-700 text-yellow-400 hover:bg-slate-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                title="Toggle Map Theme"
            >
                {isDarkMode ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
            </button>
        </React.Fragment>
    );
};

export default LeafletDetailLayer;
