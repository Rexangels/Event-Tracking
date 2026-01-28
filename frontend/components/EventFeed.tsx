
import React from 'react';
import { IntelligenceEvent, EventSeverity } from '../types';
import { Badge } from './ui/Badge';
import { formatDistanceToNow } from 'date-fns';

interface EventFeedProps {
  events: IntelligenceEvent[];
  onSelectEvent: (event: IntelligenceEvent) => void;
  selectedEventId?: string;
  isSearchVisible?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const EventFeed: React.FC<EventFeedProps> = ({
  events,
  onSelectEvent,
  selectedEventId,
  isSearchVisible = false,
  searchQuery = '',
  onSearchChange
}) => {
  return (
    <div className="flex flex-col h-full border-r border-slate-800 bg-slate-950">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 sticky top-0 z-10">
        <h2 className="font-bold text-sm uppercase tracking-tighter text-slate-400">Stream Decryptor</h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] mono text-emerald-500 font-bold">CONNECTED</span>
        </div>
      </div>

      {isSearchVisible && (
        <div className="p-3 border-b border-slate-800 bg-slate-900/50 animate-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="FILTER_VECTORS..."
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 pl-8 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono placeholder:text-slate-600"
              autoFocus
            />
            <svg className="w-3 h-3 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {events.length === 0 && searchQuery && (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            NO_VECTORS_FOUND
          </div>
        )}
        {[...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(event => (
          <div
            key={event.id}
            onClick={() => onSelectEvent(event)}
            className={`p-4 border-b border-slate-900 cursor-pointer transition-colors hover:bg-slate-900/50 ${selectedEventId === event.id ? 'bg-slate-900 border-l-4 border-l-blue-500' : ''}`}
          >
            <div className="flex justify-between items-start mb-1">
              <Badge variant={event.severity === EventSeverity.CRITICAL ? 'critical' : event.severity === EventSeverity.HIGH ? 'warning' : 'default'}>
                {event.severity}
              </Badge>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-200 line-clamp-1 mb-1">{event.title}</h3>
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{event.description}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-600 uppercase tracking-widest">{event.location}</span>
              {event.verified && (
                <span className="text-[9px] text-emerald-600 bg-emerald-600/10 px-1 rounded flex items-center gap-1">
                  VERIFIED
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventFeed;
