
import React from 'react';
import { IntelligenceEvent, EventSeverity } from '../types';
import { Badge } from './ui/Badge';
import { formatDistanceToNow } from 'date-fns';

interface EventFeedProps {
  events: IntelligenceEvent[];
  onSelectEvent: (event: IntelligenceEvent) => void;
  selectedEventId?: string;
}

const EventFeed: React.FC<EventFeedProps> = ({ events, onSelectEvent, selectedEventId }) => {
  return (
    <div className="flex flex-col h-full border-r border-slate-800 bg-slate-950">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <h2 className="font-bold text-sm uppercase tracking-tighter text-slate-400">Stream Decryptor</h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] mono text-emerald-500 font-bold">CONNECTED</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(event => (
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
