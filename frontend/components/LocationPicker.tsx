import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Location {
    latitude: number;
    longitude: number;
    address?: string;
    accuracy?: number;
    source?: 'gps' | 'manual' | 'map';
}

interface LocationPickerProps {
    initialLocation?: Location | null;
    onLocationSelect: (location: Location) => void;
}

const LocationMarker: React.FC<{
    position: [number, number];
    setPosition: (pos: [number, number]) => void;
}> = ({ position, setPosition }) => {
    const map = useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position === null ? null : (
        <Marker position={position} />
    );
};

// Component to handle map view updates
const MapUpdater: React.FC<{ position: [number, number] }> = ({ position }) => {
    const map = useMapEvents({});
    useEffect(() => {
        if (position) {
            // Keep current zoom if detailed enough, otherwise zoom to 13
            const targetZoom = Math.max(map.getZoom(), 13);
            map.flyTo(position, targetZoom, {
                animate: true,
                duration: 1.0 // Slightly faster animation
            });
        }
    }, [position, map]);
    return null;
};

const LocationPicker: React.FC<LocationPickerProps> = ({ initialLocation, onLocationSelect }) => {
    const [position, setPosition] = useState<[number, number] | null>(
        initialLocation ? [initialLocation.latitude, initialLocation.longitude] : null
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [locationSource, setLocationSource] = useState<'gps' | 'manual' | 'map'>(initialLocation?.source || 'map');

    // Initial load
    useEffect(() => {
        if (initialLocation) {
            setPosition([initialLocation.latitude, initialLocation.longitude]);
            setManualLat(initialLocation.latitude.toString());
            setManualLng(initialLocation.longitude.toString());
            setLocationSource(initialLocation.source || 'map');
        } else if (navigator.geolocation && !position) {
            // Auto-detect if no initial
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                    setLocationSource('gps');
                    setPosition(newPos);
                    onLocationSelect({ latitude: newPos[0], longitude: newPos[1], address: 'Your Location', accuracy: pos.coords.accuracy, source: 'gps' });
                },
                (err) => console.error("GPS Error:", err)
            );
        }
    }, []);

    // Reverse Geocoding when position changes
    useEffect(() => {
        if (position) {
            onLocationSelect({
                latitude: position[0],
                longitude: position[1],
                // We'll update address via search separately or leave generic
                source: locationSource
            });
            setManualLat(position[0].toFixed(6));
            setManualLng(position[1].toFixed(6));
        }
    }, [position, locationSource]);

    const handleSearch = async () => {
        if (!searchQuery) return;
        setIsLoading(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                setLocationSource('map');
                setPosition([lat, lon]);
                onLocationSelect({
                    latitude: lat,
                    longitude: lon,
                    address: data[0].display_name,
                    source: 'map'
                });
            }
        } catch (err) {
            console.error("Geocoding failed", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualUpdate = () => {
        const lat = parseFloat(manualLat);
        const lng = parseFloat(manualLng);
        if (!isNaN(lat) && !isNaN(lng)) {
            setLocationSource('manual');
            setPosition([lat, lng]);
            onLocationSelect({ latitude: lat, longitude: lng, source: 'manual' });
        }
    };

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setIsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                setLocationSource('gps');
                setPosition(newPos);
                setManualLat(pos.coords.latitude.toString());
                setManualLng(pos.coords.longitude.toString());

                // Do reverse geocoding to get address if possible, or just set coords
                // For now, let's just set coords and let the user see it
                onLocationSelect({
                    latitude: newPos[0],
                    longitude: newPos[1],
                    address: 'Current Location',
                    accuracy: pos.coords.accuracy,
                    source: 'gps'
                });
                setIsLoading(false);
            },
            (err) => {
                console.error("GPS Error:", err);
                setIsLoading(false);
                // Fail silently or show a non-intrusive toast if we had one, 
                // but user asked for "not error is visible", so we'll just log for now
                // or maybe set a fallback/default if it's critical.
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    return (
        <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => setIsManualEntry(!isManualEntry)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                    {isManualEntry ? "Switch to Map Search" : "Enter Coordinates Manually"}
                </button>
            </div>

            {isManualEntry ? (
                <div className="grid grid-cols-2 gap-4 bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="col-span-2 mb-2">
                        <button
                            type="button"
                            onClick={handleGetCurrentLocation}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isLoading ? (
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            )}
                            Get Current Location
                        </button>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Latitude</label>
                        <input
                            type="number"
                            value={manualLat}
                            onChange={(e) => setManualLat(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Longitude</label>
                        <input
                            type="number"
                            value={manualLng}
                            onChange={(e) => setManualLng(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"
                        />
                    </div>
                    <div className="col-span-2">
                        <button
                            type="button"
                            onClick={handleManualUpdate}
                            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
                        >
                            Update Location
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    {/* Search Bar */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search address (e.g. Wuse 2, Abuja)..."
                            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                        />
                        <button
                            type="button"
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isLoading ? '...' : 'Search'}
                        </button>
                        <button
                            type="button"
                            onClick={handleGetCurrentLocation}
                            disabled={isLoading}
                            title="Use Current Location"
                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {/* Target Icon */}
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>

                    {/* Map */}
                    <div className="h-[300px] w-full rounded-xl overflow-hidden border border-slate-700 relative z-0">
                        {position ? (
                            <MapContainer
                                center={position}
                                zoom={13}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <MapUpdater position={position} />
                                <LocationMarker position={position} setPosition={(pos) => {
                                    setPosition(pos);
                                }} />
                            </MapContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center bg-slate-800 text-slate-400">
                                <p>Detecting location...</p>
                            </div>
                        )}

                        {/* Crosshair Overlay */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000]">
                            <svg className="w-6 h-6 text-blue-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                        </div>
                    </div>

                    <p className="text-xs text-slate-400 text-center">
                        Drag map or click to pin location.
                        {position && <span className="text-green-400 ml-1 font-mono">{position[0].toFixed(5)}, {position[1].toFixed(5)}</span>}
                    </p>
                </div>
            )}
        </div>
    );
};

export default LocationPicker;
