import React, { useState, useMemo, useEffect } from 'react';
import api from '../services/api';
import { IntelligenceEvent } from '../types';
import { useNavigate } from 'react-router-dom';
import { fetchEvents } from '../services/eventService';
import { authService } from '../services/authService';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'; // Import hook
import EventFeed from '../components/EventFeed';
import MapVisualizer from '../components/MapVisualizer';
import AIAgentPanel from '../components/AIAgentPanel';
import StatSummary from '../components/StatSummary';
import RegionIntelligencePanel from '../components/RegionIntelligencePanel';
import AnalystModule from '../components/AnalystModule';
import MissionControl from '../components/MissionControl';
import GovernanceModule from '../components/GovernanceModule';
import INEHSSAdminModule from '../components/INEHSSAdminModule';
import EventDetailPanel from '../components/EventDetailPanel';
import Tooltip from '../components/ui/Tooltip';
import { ExportFile } from '../services/ExportService';

const AdminDashboard: React.FC = () => {
    const [events, setEvents] = useState<IntelligenceEvent[]>([]);
    const [exportedFiles, setExportedFiles] = useState<ExportFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<string>('DISCONNECTED');
    const [systemHealth, setSystemHealth] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const navigate = useNavigate();

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    // Real-time Event Hook
    const { isConnected } = useRealtimeEvents({
        onEventCreated: (newEvent) => {
            setEvents(prev => [newEvent, ...prev]);
            // Optional: Show notification toast
            console.log('New Event Received:', newEvent.title);
        },
        onEventUpdated: (updatedEvent) => {
            setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
        },
        onEventVerified: (eventId, verified) => {
            setEvents(prev => prev.map(e => e.id === eventId ? { ...e, verified } : e));
        }
    });

    useEffect(() => {
        setConnectionStatus(isConnected ? 'CONNECTED' : 'RECONNECTING...');
    }, [isConnected]);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const response = await api.get('/health/');
                setSystemHealth(response.data);
            } catch {
                setSystemHealth({ status: 'DEGRADED', database: 'ERROR' });
            }
        };
        checkHealth();
        const interval = setInterval(checkHealth, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const loadEvents = async () => {
            try {
                const data = await fetchEvents();
                // Strict adherence to real data only
                setEvents(data);
            } catch (error) {
                console.error("Failed to load events", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadEvents();
    }, []);

    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [activeModule, setActiveModule] = useState<'VISUALIZATION' | 'ANALYST' | 'GOVERNANCE' | 'INEHSS'>('VISUALIZATION');

    const selectedEvent = useMemo(() =>
        events.find(e => e.id === selectedEventId) || null
        , [selectedEventId, events]);

    const filteredEvents = useMemo(() => {
        let filtered = events;

        // 1. Filter by Region
        if (selectedRegion) {
            filtered = filtered.filter(e => e.region === selectedRegion);
        }

        // 2. Filter by Search Query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                e.title.toLowerCase().includes(query) ||
                e.description.toLowerCase().includes(query) ||
                e.location.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [selectedRegion, events, searchQuery]);

    // Derived for panels that need specific region data (legacy support if needed)
    const regionalEvents = useMemo(() =>
        selectedRegion ? events.filter(e => e.region === selectedRegion) : []
        , [selectedRegion, events]);

    return (
        <div className="flex flex-col h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
            {/* Top Navbar */}
            <header className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0 relative z-50 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h1 className="font-bold text-sm tracking-tight text-white/90">
                                Integrated National Environmental Health Surveillance System
                            </h1>
                        </div>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-800 mx-2"></div>
                    <nav className="flex gap-4">
                        {['VISUALIZATION', 'ANALYST', 'GOVERNANCE', 'INEHSS'].map((tab) => (
                            <Tooltip
                                key={tab}
                                content={
                                    tab === 'VISUALIZATION' ? 'Real-time geographical tracking and spatial distribution.' :
                                        tab === 'ANALYST' ? 'Deep data mining and automated pattern recognition.' :
                                            tab === 'GOVERNANCE' ? 'Incident management protocols and administrative controls.' :
                                                'Environmental Health Surveillance - Forms & Assignments.'
                                }
                            >
                                <button
                                    onClick={() => setActiveModule(tab as any)}
                                    className={`text-[11px] font-bold tracking-widest transition-all relative py-1 px-2 ${activeModule === tab ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {tab}
                                    {activeModule === tab && (
                                        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_8px_#3b82f6]"></span>
                                    )}
                                </button>
                            </Tooltip>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[10px] font-mono text-slate-500">OPERATOR: SEC-USR-4921</span>
                        <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${systemHealth?.status === 'OPERATIONAL' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            <span className={`w-1 h-1 rounded-full animate-pulse ${systemHealth?.status === 'OPERATIONAL' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            System {systemHealth?.status || 'INITIALIZING'}
                        </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                </div>
            </header>

            <StatSummary />

            {/* Main Content Area */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center bg-[#020617] text-blue-500 font-mono text-sm animate-pulse">
                    INITIALIZING_SYSTEM_CORE...
                </div>
            ) : (
                <main className="flex-1 flex overflow-hidden">
                    {/* Persistent Sidebar - Event Feed */}
                    <aside className="w-80 shrink-0 relative z-30 shadow-2xl bg-slate-950">
                        <EventFeed
                            events={filteredEvents}
                            onSelectEvent={(e) => {
                                setSelectedEventId(e.id);
                                setIsDetailOpen(true);
                                if (activeModule !== 'VISUALIZATION') setActiveModule('VISUALIZATION');
                            }}
                            selectedEventId={selectedEventId}
                            isSearchVisible={isSearchVisible}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                        />
                    </aside>

                    {/* Dynamic Content Panel */}
                    <section className="flex-1 p-6 relative flex flex-col gap-6 overflow-y-auto bg-slate-950/20 custom-scrollbar">

                        {activeModule === 'VISUALIZATION' && (
                            <div className="flex flex-col gap-6 h-full animate-in fade-in duration-500">
                                <div className="h-[60%] shrink-0 relative min-h-[400px]">
                                    <MapVisualizer
                                        events={filteredEvents}
                                        onEventClick={(e) => {
                                            setSelectedEventId(e.id);
                                            setIsDetailOpen(true);
                                        }}
                                        selectedEventId={selectedEventId}
                                        selectedRegion={selectedRegion}
                                        onRegionSelect={setSelectedRegion}
                                    />

                                    {selectedRegion && (
                                        <RegionIntelligencePanel
                                            region={selectedRegion}
                                            events={regionalEvents}
                                            onClose={() => setSelectedRegion(null)}
                                        />
                                    )}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[400px] mb-4">
                                    <AIAgentPanel selectedEvent={selectedEvent} />
                                    <MissionControl
                                        events={filteredEvents}
                                        onExport={(file) => setExportedFiles(prev => [file, ...prev])}
                                    />
                                </div>
                            </div>
                        )}

                        {activeModule === 'ANALYST' && (
                            <AnalystModule
                                events={events}
                                sharedExports={exportedFiles}
                                onSharedExport={(file) => setExportedFiles(prev => [file, ...prev])}
                            />
                        )}

                        {activeModule === 'GOVERNANCE' && (
                            <GovernanceModule />
                        )}

                        {activeModule === 'INEHSS' && (
                            <INEHSSAdminModule />
                        )}

                    </section>

                    {/* Action Panel - Right Overlay (Hidden on Mobile) */}
                    <aside className="w-16 border-l border-slate-800 flex flex-col items-center py-6 gap-6 shrink-0 bg-slate-950 relative z-40">
                        {[
                            { id: 'search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', action: () => setIsSearchVisible(!isSearchVisible) },
                            { id: 'layers', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', action: () => { } },
                            { id: 'alert', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', action: () => { } },
                            { id: 'logout', icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1', action: handleLogout }
                        ].map(action => (
                            <button
                                key={action.id}
                                onClick={action.action}
                                className={`p-2 rounded hover:bg-slate-800 transition-colors group relative ${action.id === 'search' && isSearchVisible ? 'bg-slate-800 text-blue-400' : ''}`}
                            >
                                <svg className="w-5 h-5 text-slate-500 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={action.icon} />
                                </svg>
                                <span className="absolute left-0 -translate-x-full ml-[-8px] top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-[10px] text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none uppercase whitespace-nowrap">
                                    {action.id}
                                </span>
                            </button>
                        ))}
                    </aside>
                </main>
            )}

            {/* Event Detail Panel - Slide-in from right */}
            <EventDetailPanel
                event={isDetailOpen ? selectedEvent : null}
                onClose={() => setIsDetailOpen(false)}
                onStatusUpdate={(updatedEvent) => {
                    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
                }}
            />

            {/* Connection Bar (Bottom) */}
            <footer className="h-6 bg-blue-600 flex items-center px-4 justify-between shrink-0 relative z-50">
                <div className="flex gap-4 items-center">
                    <span className="text-[9px] font-bold tracking-[0.2em] text-white">PRODUCTION_STABLE // SYSTEM_VERSION_4.2.0-STABLE</span>
                    <span className="text-[9px] font-mono opacity-80 underline cursor-pointer text-white">DB_STATUS: {systemHealth?.database || 'CONNECTING...'}</span>
                </div>
                <div className="flex gap-4 items-center">
                    <span className="text-[9px] font-bold tracking-widest text-white uppercase">
                        Live_Feed: {events.length} Active Vectors // Status: {connectionStatus}
                    </span>
                    <span className="text-[9px] font-bold tracking-widest uppercase text-white">{new Date().toLocaleDateString()} // GMT {new Date().getHours()}:00</span>
                </div>
            </footer>
        </div>
    );
};

export default AdminDashboard;
