
import React from 'react';
import { IntelligenceEvent, EventSeverity } from '../types';
import { Badge } from './ui/Badge';
import { MAP_COLORS } from '../constants';

interface RegionIntelligencePanelProps {
  region: string;
  events: IntelligenceEvent[];
  onClose: () => void;
}

const RegionIntelligencePanel: React.FC<RegionIntelligencePanelProps> = ({ region, events, onClose }) => {
  const criticalEvents = events.filter(e => e.severity === EventSeverity.CRITICAL);
  const highEvents = events.filter(e => e.severity === EventSeverity.HIGH);

  const mostSevereEvent = [...events].sort((a, b) => {
    const order = { [EventSeverity.CRITICAL]: 4, [EventSeverity.HIGH]: 3, [EventSeverity.MEDIUM]: 2, [EventSeverity.LOW]: 1 };
    return order[b.severity] - order[a.severity];
  })[0];

  return (
    <div className="absolute top-4 left-4 w-72 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-left-4">
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
        <div>
          <span className="text-[9px] font-mono text-blue-500 uppercase tracking-widest block mb-0.5">Tactical Sector</span>
          <h2 className="text-sm font-bold text-slate-100 uppercase truncate">{region}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
            <span className="text-[9px] text-slate-500 uppercase font-bold block">Total Alerts</span>
            <span className="text-lg font-bold text-slate-100">{events.length}</span>
          </div>
          <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
            <span className="text-[9px] text-slate-500 uppercase font-bold block">Critical</span>
            <span className={`text-lg font-bold ${criticalEvents.length > 0 ? 'text-red-500' : 'text-slate-600'}`}>
              {criticalEvents.length}
            </span>
          </div>
        </div>

        {events.length > 0 ? (
          <div>
            <h3 className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Primary Threat Vector</h3>
            <div className="p-3 bg-slate-900/80 rounded border-l-2 border-l-blue-500 border border-slate-800">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold" style={{ color: MAP_COLORS[mostSevereEvent.severity] }}>
                  {mostSevereEvent.severity}
                </span>
                <span className="text-[9px] text-slate-600 font-mono">
                  {new Date(mostSevereEvent.timestamp).toLocaleTimeString([], { hour12: false })}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">{mostSevereEvent.title}</h4>
              <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                {mostSevereEvent.description}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-900/30 rounded border border-slate-800 border-dashed">
            <div className="text-[10px] text-emerald-500/50 font-bold uppercase tracking-widest">Sector Nominal</div>
            <p className="text-[9px] text-slate-600 mt-1">No active incidents detected.</p>
          </div>
        )}

        <div className="pt-2">
          <button className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded text-[10px] font-bold uppercase tracking-widest transition-all">
            DEPLOY_QUICK_RESPONSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegionIntelligencePanel;
