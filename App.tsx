
import React, { useState, useMemo } from 'react';
import { IntelligenceEvent } from './types';
import { MOCK_EVENTS } from './constants';
import EventFeed from './components/EventFeed';
import MapVisualizer from './components/MapVisualizer';
import AIAgentPanel from './components/AIAgentPanel';
import StatSummary from './components/StatSummary';
import RegionIntelligencePanel from './components/RegionIntelligencePanel';
import AnalystModule from './components/AnalystModule';
import GovernanceModule from './components/GovernanceModule';

const App: React.FC = () => {
  const [events, setEvents] = useState<IntelligenceEvent[]>(MOCK_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<'VISUALIZATION' | 'ANALYST' | 'GOVERNANCE'>('VISUALIZATION');

  const selectedEvent = useMemo(() => 
    events.find(e => e.id === selectedEventId) || null
  , [selectedEventId, events]);

  const regionalEvents = useMemo(() => 
    selectedRegion ? events.filter(e => e.region === selectedRegion) : []
  , [selectedRegion, events]);

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0 relative z-50 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">S</div>
            <h1 className="font-bold text-lg tracking-tight">SENTINEL <span className="text-blue-500 font-light">CORE</span></h1>
          </div>
          <div className="h-6 w-[1px] bg-slate-800 mx-2"></div>
          <nav className="flex gap-4">
            {['VISUALIZATION', 'ANALYST', 'GOVERNANCE'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveModule(tab as any)}
                className={`text-[11px] font-bold tracking-widest transition-all relative py-1 px-2 ${activeModule === tab ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {tab}
                {activeModule === tab && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_8px_#3b82f6]"></span>
                )}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-mono text-slate-500">OPERATOR: SEC-USR-4921</span>
            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
              System Stable
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors">
             <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
        </div>
      </header>

      <StatSummary />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Persistent Sidebar - Event Feed */}
        <aside className="w-80 shrink-0 relative z-30 shadow-2xl bg-slate-950">
          <EventFeed 
            events={events} 
            onSelectEvent={(e) => {
              setSelectedEventId(e.id);
              if (activeModule !== 'VISUALIZATION') setActiveModule('VISUALIZATION');
            }} 
            selectedEventId={selectedEventId} 
          />
        </aside>

        {/* Dynamic Content Panel */}
        <section className="flex-1 p-6 relative flex flex-col gap-6 overflow-y-auto bg-slate-950/20 custom-scrollbar">
          
          {activeModule === 'VISUALIZATION' && (
            <div className="flex flex-col gap-6 h-full animate-in fade-in duration-500">
              <div className="h-[60%] shrink-0 relative min-h-[400px]">
                <MapVisualizer 
                  events={events} 
                  onEventClick={(e) => setSelectedEventId(e.id)}
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

                <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex flex-col shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Analyst Worksheet</h3>
                    <button className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors text-slate-300">NEW_QUERY</button>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="p-3 bg-slate-900/50 rounded border border-slate-800/50">
                      <div className="text-[10px] text-blue-500 font-mono mb-1 flex justify-between">
                        <span>RUNNING_PROCEDURE: SPATIAL_QUERY_14</span>
                        <span className="animate-pulse">●</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full w-[65%] shadow-[0_0_8px_#3b82f6]"></div>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                        <span>Correlating events in Sector B...</span>
                        <span>65%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter mb-1">Export Templates</h4>
                      {['SITUATION_REPORT_PDF', 'RAW_CSV_GEOPACKAGE', 'MEDIA_EVIDENCE_BUNDLE'].map(t => (
                        <div key={t} className="p-2 border border-slate-900 rounded hover:bg-slate-900 hover:border-slate-700 transition-all cursor-pointer text-[10px] font-mono flex justify-between group">
                          <span className="text-slate-400 group-hover:text-blue-400 transition-colors">{t}</span>
                          <span className="text-slate-600 opacity-0 group-hover:opacity-100 tracking-widest text-[9px] transition-opacity">INITIATE</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-900">
                    <div className="flex items-center gap-2 text-[9px] text-slate-600 font-mono">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      <span>IMMUTABLE LOGGING ACTIVE</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeModule === 'ANALYST' && (
            <AnalystModule events={events} />
          )}

          {activeModule === 'GOVERNANCE' && (
            <GovernanceModule />
          )}

        </section>

        {/* Action Panel - Right Overlay (Hidden on Mobile) */}
        <aside className="w-16 border-l border-slate-800 flex flex-col items-center py-6 gap-6 shrink-0 bg-slate-950 relative z-40">
           {[
            { id: 'search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
            { id: 'layers', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' },
            { id: 'alert', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
            { id: 'settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
           ].map(action => (
             <button 
               key={action.id}
               className="p-2 rounded hover:bg-slate-800 transition-colors group relative"
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

      {/* Connection Bar (Bottom) */}
      <footer className="h-6 bg-blue-600 flex items-center px-4 justify-between shrink-0 relative z-50">
        <div className="flex gap-4 items-center">
          <span className="text-[9px] font-bold tracking-[0.2em] text-white">SYSTEM_VERSION_4.2.0-STABLE</span>
          <span className="text-[9px] font-mono opacity-80 underline cursor-pointer text-white">NODE_HASH: 0x82...f9a</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-[9px] font-bold tracking-widest text-white uppercase">
             Live_Feed: {events.length} Active Vectors // Integrity: Optimal
          </span>
          <span className="text-[9px] font-bold tracking-widest uppercase text-white">{new Date().toLocaleDateString()} // GMT {new Date().getHours()}:00</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
